// AI Chat Enhancer - 竖式时间轴（固定竖条 + 悬停浮窗）
window.AIChatEnhancer = window.AIChatEnhancer || {};

(function(ns) {
  'use strict';

  const { debounce, throttle } = ns.utils;
  const { detectPlatform, getSelector, isUserMessage, isAssistantMessage } = ns.platforms;
  const { setTimelineVisible, isTimelineVisible, getPref, setPref } = ns.storage;

  const STARRED_KEY = 'timeline_starred';
  const PINNED_KEY = 'timeline_pinned';
  const STRIP_WIDTH = 16;
  const LS_PREFIX = 'aice:';
  const TIMESTAMP_MAP_KEY = 'aice:timeline_timestamps';

  class Timeline {
    constructor() {
      this.platform = null;
      this.host = null;
      this.strip = null;
      this.dotsContainer = null;
      this.popover = null;
      this.popoverList = null;
      this.tooltipEl = null;
      this.contextMenu = null;
      this.floatCard = null;
      this._floatCardTimer = null;
      this._expandedRow = null;

      this.turns = [];
      this.dots = [];
      this.nodes = [];
      this.visible = true;
      this.observer = null;
      this.scrollHandler = null;
      this._starredNodes = {};
      this._pinnedNodes = {};
      this._hideTimer = null;
      this._showTimer = null;
      this._stripHovered = false;
      this._popoverHovered = false;
      this._contextTarget = null;
      this._turnTimestamps = {};
      this._onStripEnter = this._onStripEnter.bind(this);
      this._onStripLeave = this._onStripLeave.bind(this);
      this._onPopoverEnter = this._onPopoverEnter.bind(this);
      this._onPopoverLeave = this._onPopoverLeave.bind(this);
      this._onDocClick = this._onDocClick.bind(this);
      this._onSettingsChanged = this._onSettingsChanged.bind(this);
    }

    // === 设置相关 ===

    _isPlatformEnabled() {
      const platformName = this.platform;
      if (!platformName || platformName === 'unknown') return true;
      // key 中平台名首字母大写：ChatGPT, Claude, Gemini, Kimi, Tongyi, DeepSeek, Yuanbao, Grok
      const keyMap = {
        chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', kimi: 'Kimi',
        tongyi: 'Tongyi', deepseek: 'DeepSeek', yuanbao: 'Yuanbao', grok: 'Grok'
      };
      const key = keyMap[platformName];
      if (!key) return true;
      try {
        const v = localStorage.getItem(LS_PREFIX + 'timeline_platform_' + key);
        if (v === null) return true; // 默认启用
        return v === 'true';
      } catch { return true; }
    }

    _isShowTime() {
      try {
        const v = localStorage.getItem(LS_PREFIX + 'timeline_show_time');
        return v === 'true';
      } catch { return false; }
    }

    _onSettingsChanged(e) {
      const { key } = e.detail || {};
      if (!key) return;

      // 平台权限变化 → 检查当前平台
      if (key.startsWith('timeline_platform_')) {
        if (!this._isPlatformEnabled()) {
          this.hide();
        } else if (this.visible) {
          this.show();
        }
      }

      // 显示时间变化 → 补全时间戳并重新渲染
      if (key === 'timeline_show_time') {
        // 为所有 turn 补全时间戳
        this.turns.forEach((t) => {
          if (!t.timestamp) {
            t.timestamp = this._getTurnTimestamp(t, t.index);
          }
        });
        this._renderDots();
        if (this.popover && this.popover.classList.contains('aice-visible')) {
          this._renderNodes();
        }
      }
    }

    async init() {
      this.platform = detectPlatform();
      this.visible = await isTimelineVisible();
      if (!this.visible) return;

      // 检查当前平台是否被启用
      if (!this._isPlatformEnabled()) return;

      await this._loadState();
      this._loadTimestamps();

      // 从 localStorage 恢复 turns（防止虚拟滚动导致丢失）
      this.turns = this._loadSavedTurns();

      this._createDOM();
      this._scanTurns();
      this._startObserver();
      this._bindScroll();
      document.addEventListener('click', this._onDocClick);
      window.addEventListener('aice-settings-changed', this._onSettingsChanged);
    }

    async _loadState() {
      try { this._starredNodes = await getPref(STARRED_KEY, {}); } catch (e) { this._starredNodes = {}; }
      try { this._pinnedNodes = await getPref(PINNED_KEY, {}); } catch (e) { this._pinnedNodes = {}; }
    }

    async _saveStarred() { await setPref(STARRED_KEY, this._starredNodes); }
    async _savePinned() { await setPref(PINNED_KEY, this._pinnedNodes); }

    // === 时间戳管理 ===

    _loadTimestamps() {
      try {
        const raw = localStorage.getItem(TIMESTAMP_MAP_KEY);
        this._turnTimestamps = raw ? JSON.parse(raw) : {};
      } catch { this._turnTimestamps = {}; }
    }

    _saveTimestamps() {
      try { localStorage.setItem(TIMESTAMP_MAP_KEY, JSON.stringify(this._turnTimestamps)); } catch {}
    }

    // 尝试从 DOM 元素提取时间戳
    _extractTimestamp(el) {
      if (!el) return null;
      // 1. 查找 <time> 元素
      const timeEl = el.querySelector('time[datetime]');
      if (timeEl) {
        const dt = timeEl.getAttribute('datetime');
        if (dt) {
          const t = new Date(dt);
          if (!isNaN(t.getTime())) return t.getTime();
        }
      }
      // 2. 查找包含时间格式文本的元素
      const timeTextEl = el.querySelector('[class*="time"], [class*="date"], [class*="timestamp"]');
      if (timeTextEl) {
        const txt = timeTextEl.textContent.trim();
        // 匹配 HH:MM 或 YYYY-MM-DD HH:MM 等
        const m = txt.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
        if (m) {
          const parts = m[1].split(':');
          const d = new Date();
          d.setHours(parseInt(parts[0]), parseInt(parts[1]), parts[2] ? parseInt(parts[2]) : 0, 0);
          if (!isNaN(d.getTime())) return d.getTime();
        }
      }
      return null;
    }

    // 为 turn 获取或创建时间戳
    _getTurnTimestamp(turn, index) {
      const fp = this._makeContentFingerprint(turn.fullText || turn.text || '');
      // 优先用已有记录
      if (this._turnTimestamps[fp]) return this._turnTimestamps[fp];
      // 尝试从 DOM 提取
      const ts = this._extractTimestamp(turn.el);
      if (ts) {
        this._turnTimestamps[fp] = ts;
        this._saveTimestamps();
        return ts;
      }
      // 兜底：记录首次扫描到的时间
      const now = Date.now();
      this._turnTimestamps[fp] = now;
      this._saveTimestamps();
      return now;
    }

    _formatTimestamp(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const time = pad(d.getHours()) + ':' + pad(d.getMinutes());
      // 今天只显示时间
      if (d.toDateString() === now.toDateString()) return time;
      // 今年显示 月日 + 时间
      if (d.getFullYear() === now.getFullYear()) {
        return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + time;
      }
      // 其他显示完整日期
      return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + time;
    }

    // === DOM ===

    _createDOM() {
      this.host = document.createElement('div');
      this.host.className = 'aice-timeline-host';

      // 固定竖条
      this.strip = document.createElement('div');
      this.strip.className = 'aice-timeline-strip';
      this.strip.addEventListener('mouseenter', this._onStripEnter);
      this.strip.addEventListener('mouseleave', this._onStripLeave);
      this.strip.addEventListener('mousemove', (e) => this._onStripMove(e));

      // 竖线
      const line = document.createElement('div');
      line.className = 'aice-timeline-strip-line';
      this.strip.appendChild(line);

      // 圆点容器
      this.dotsContainer = document.createElement('div');
      this.dotsContainer.className = 'aice-timeline-dots';
      this.strip.appendChild(this.dotsContainer);

      this.host.appendChild(this.strip);

      // 浮窗（纯节点列表，无标题栏）
      this.popover = document.createElement('div');
      this.popover.className = 'aice-timeline-popover';
      this.popover.addEventListener('mouseenter', this._onPopoverEnter);
      this.popover.addEventListener('mouseleave', this._onPopoverLeave);

      this.popoverList = document.createElement('div');
      this.popoverList.className = 'aice-timeline-popover-list';
      this.popover.appendChild(this.popoverList);

      this.host.appendChild(this.popover);
      document.body.appendChild(this.host);

      // 右键菜单
      this.contextMenu = document.createElement('div');
      this.contextMenu.className = 'aice-timeline-context-menu';
      this.contextMenu.innerHTML = `
        <div class="aice-timeline-ctx-item" data-action="share">
          <span class="aice-timeline-ctx-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></span>
          <span>生成分享链接</span>
        </div>
        <div class="aice-timeline-ctx-sep"></div>
        <div class="aice-timeline-ctx-item" data-action="export-md"><span class="aice-timeline-ctx-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span><span>导出 Markdown</span></div>
        <div class="aice-timeline-ctx-item" data-action="export-json"><span class="aice-timeline-ctx-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span><span>导出 JSON</span></div>
        <div class="aice-timeline-ctx-item" data-action="export-text"><span class="aice-timeline-ctx-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span><span>导出纯文本</span></div>
      `;
      this.contextMenu.addEventListener('click', (e) => {
        const item = e.target.closest('[data-action]');
        if (!item || !this._contextTarget) return;
        e.stopPropagation();
        this._handleContextAction(item.getAttribute('data-action'), this._contextTarget.turn, this._contextTarget.index);
        this._hideContextMenu();
      });
      document.body.appendChild(this.contextMenu);

      // hover提示
      this.tooltipEl = document.createElement('div');
      this.tooltipEl.className = 'aice-timeline-tooltip';
      document.body.appendChild(this.tooltipEl);

      // 浮动详情卡片（悬停节点时出现在popover左侧）
      this.floatCard = document.createElement('div');
      this.floatCard.className = 'aice-timeline-float-card';
      this.floatCard.innerHTML = '<div class="aice-timeline-float-card-content"></div>';
      this.floatCard.addEventListener('mouseenter', () => {
        if (this._floatCardTimer) { clearTimeout(this._floatCardTimer); this._floatCardTimer = null; }
      });
      this.floatCard.addEventListener('mouseleave', () => {
        this._scheduleFloatCardHide();
      });
      document.body.appendChild(this.floatCard);
    }

    _scheduleFloatCardHide() {
      if (this._floatCardTimer) { clearTimeout(this._floatCardTimer); this._floatCardTimer = null; }
      this._floatCardTimer = setTimeout(() => {
        this._hideFloatCard();
      }, 300);
    }

    _showFloatCard(nodeRow, turn) {
      if (!this.floatCard || !this.popover) return;
      if (this._floatCardTimer) { clearTimeout(this._floatCardTimer); this._floatCardTimer = null; }
      const contentEl = this.floatCard.querySelector('.aice-timeline-float-card-content');
      if (contentEl) contentEl.textContent = turn.fullText || turn.text || '';

      const popoverRect = this.popover.getBoundingClientRect();
      const rowRect = nodeRow.getBoundingClientRect();

      // 卡片在 popover 左侧 25px 处，垂直居中对齐提问行
      const cardW = 280;
      const cardH = 120;
      let left = popoverRect.left - cardW - 25;
      let top = rowRect.top + rowRect.height / 2 - cardH / 2;

      // 确保不超出视口
      if (left < 8) left = 8;
      if (top < 8) top = 8;
      if (top + cardH > window.innerHeight - 8) {
        top = window.innerHeight - cardH - 8;
      }

      this.floatCard.style.left = left + 'px';
      this.floatCard.style.top = top + 'px';
      this.floatCard.classList.add('aice-float-visible');

      // 当前行共享悬停背景，与卡片融为一体
      if (this._expandedRow && this._expandedRow !== nodeRow) {
        this._expandedRow.classList.remove('aice-row-expanding');
      }
      this._expandedRow = nodeRow;
      nodeRow.classList.add('aice-row-expanding');
    }

    _hideFloatCard() {
      if (this._floatCardTimer) { clearTimeout(this._floatCardTimer); this._floatCardTimer = null; }
      if (this.floatCard) this.floatCard.classList.remove('aice-float-visible');
      if (this._expandedRow) {
        this._expandedRow.classList.remove('aice-row-expanding');
        this._expandedRow = null;
      }
    }

    // === 显示/隐藏浮窗 ===

    _onStripEnter() {
      this._stripHovered = true;
      this.strip.classList.add('aice-strip-hover');
      if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
      if (this._showTimer) clearTimeout(this._showTimer);
      this._showTimer = setTimeout(() => this._showPopover(), 250);
    }

    _onStripLeave(e) {
      this._stripHovered = false;
      this.strip.classList.remove('aice-strip-hover');
      if (this._showTimer) clearTimeout(this._showTimer);
      this._scheduleHide(200);
    }

    _onStripMove(e) {
      if (this.tooltipEl && !this.popover.classList.contains('aice-visible')) {
        // 悬停到竖条上的圆点区域时显示小提示
        const dot = e.target.closest('.aice-timeline-dot');
        if (dot) {
          const idx = parseInt(dot.getAttribute('data-turn-index'));
          if (idx >= 0 && idx < this.turns.length) {
            this._showDotTooltip(e.clientX, e.clientY, this.turns[idx].text);
          }
        } else {
          this._hideDotTooltip();
        }
      }
    }

    _onPopoverEnter() {
      this._popoverHovered = true;
      if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    }

    _onPopoverLeave() {
      this._popoverHovered = false;
      this._scheduleHide(250);
    }

    _scheduleHide(delay) {
      if (this._hideTimer) clearTimeout(this._hideTimer);
      this._hideTimer = setTimeout(() => {
        if (!this._stripHovered && !this._popoverHovered) {
          this._hidePopover();
        }
      }, delay);
    }

    _showPopover() {
      this._renderNodes();
      this.popover.classList.add('aice-visible');
      this.strip.classList.add('aice-strip-active');
    }

    _hidePopover() {
      this.popover.classList.remove('aice-visible');
      this.strip.classList.remove('aice-strip-active');
      this._hideDotTooltip();
    }

    // === 圆点提示 ===

    _showDotTooltip(x, y, text) {
      if (!this.tooltipEl) return;
      this.tooltipEl.textContent = text || '';
      this.tooltipEl.style.display = '';
      const tw = this.tooltipEl.offsetWidth || 200;
      const th = this.tooltipEl.offsetHeight || 30;
      let left = x - tw - 14;
      let top = y - th / 2;
      if (left < 8) left = x + 14;
      if (top < 8) top = 8;
      if (top + th > window.innerHeight - 8) top = window.innerHeight - th - 8;
      this.tooltipEl.style.left = left + 'px';
      this.tooltipEl.style.top = top + 'px';
    }

    _hideDotTooltip() {
      if (this.tooltipEl) this.tooltipEl.style.display = 'none';
    }

    // === Turns 持久化 ===

    _getTurnsStorageKey() {
      return 'aice:timeline_turns:' + (this.platform || 'unknown');
    }

    _saveTurns() {
      try {
        const data = this.turns.map(t => ({
          fingerprint: t.fingerprint,
          text: t.text,
          fullText: t.fullText,
          timestamp: t.timestamp
        }));
        localStorage.setItem(this._getTurnsStorageKey(), JSON.stringify(data));
      } catch {}
    }

    _loadSavedTurns() {
      try {
        const raw = localStorage.getItem(this._getTurnsStorageKey());
        if (!raw) return [];
        const data = JSON.parse(raw);
        return data.map(d => ({
          el: null,  // DOM 引用在扫描时更新
          text: d.text,
          fullText: d.fullText,
          fingerprint: d.fingerprint,
          timestamp: d.timestamp
        }));
      } catch { return []; }
    }

    // === 扫描对话轮次 ===

    // 去掉各平台的用户消息前缀
    _stripUserPrefix(raw) {
      return raw.replace(/^(你说[：:]|我[：:]|User[：:]|You said[：:]|You[：:]|Human[：:]|用户[：:]|提问[：:]|Q[：:])\s*/i, '').trim();
    }

    // 内容指纹：取前120字符压缩空白，用于去重比对
    _makeContentFingerprint(text) {
      return text.substring(0, 120).replace(/\s+/g, ' ').trim();
    }

    // 基于内容判断是否为AI回复（排除"AI：xxx"、"助手：xxx"等明确前缀）
    _looksLikeAIResponse(text) {
      if (!text) return false;
      return /^(AI|助手|Assistant|Bot|机器人|模型|Agent|元宝|ChatGPT|Claude|Gemini|DeepSeek|Kimi|通义|Grok)[：:\s]/.test(text);
    }

    // 回退：使用通用选择器扫描 DOM
    _scanGenericTurns() {
      const genericSelectors = [
        'article[data-testid^="conversation-turn-"]',
        '[data-testid^="conversation-turn-"]',
        '[data-message-author-role]',
        '[data-role]',
        '[class*="message-item"]',
        '[class*="chat-item"]',
        '[class*="turn-item"]',
      ];
      const results = [];
      for (const sel of genericSelectors) {
        try {
          const els = document.querySelectorAll(sel);
          if (els.length > 0) return Array.from(els);
        } catch (e) { /* skip invalid selector */ }
      }
      return results;
    }

    _scanTurns() {
      const turnSelector = getSelector('turns', this.platform);
      if (!turnSelector) return;
      const turnEls = document.querySelectorAll(turnSelector);

      const effectiveEls = turnEls.length > 0
        ? Array.from(turnEls)
        : this._scanGenericTurns();

      // === 第一步：扫描当前 DOM，按 DOM 顺序构建 turns ===
      // DOM 顺序 = 时间顺序（越靠后的用户消息越新）
      const scannedByFp = new Map(); // fingerprint → { el, text, fullText }
      const scannedFps = [];

      effectiveEls.forEach((el) => {
        if (isAssistantMessage(el, this.platform)) return;
        if (!isUserMessage(el, this.platform)) return;

        const fullText = (el.textContent || '').trim();
        if (!fullText) return;
        if (this._looksLikeAIResponse(fullText)) return;

        const cleaned = this._stripUserPrefix(fullText);
        const text = cleaned.substring(0, 200);
        const fp = this._makeContentFingerprint(cleaned);
        if (!fp || scannedByFp.has(fp)) return;

        scannedByFp.set(fp, { el, text, fullText: cleaned });
        scannedFps.push(fp);
      });

      // === 第二步：构建新的 turns 列表 ===
      // 以旧列表为基础，更新 DOM 引用，仅保留 DOM 中存在的 turn
      const oldByFp = new Map();
      this.turns.forEach(t => {
        if (!t.fingerprint) t.fingerprint = this._makeContentFingerprint(t.fullText || t.text || '');
        if (t.fingerprint) oldByFp.set(t.fingerprint, t);
      });

      const newTurns = [];

      // 按 DOM 顺序遍历（= 时间顺序）
      scannedFps.forEach(fp => {
        const old = oldByFp.get(fp);
        const scan = scannedByFp.get(fp);
        if (old) {
          // 已存在：复用旧对象，更新 DOM 引用
          old.el = scan.el;
          newTurns.push(old);
        } else {
          // 新消息
          newTurns.push({
            el: scan.el,
            text: scan.text,
            fullText: scan.fullText,
            fingerprint: fp,
            timestamp: this._getTurnTimestamp({ el: scan.el, text: scan.text, fullText: scan.fullText }, newTurns.length)
          });
        }
        oldByFp.delete(fp); // 标记已处理
      });

      // 注意：不追加 oldByFp 中剩余的旧 turn（它们已被虚拟滚动移除）
      // 当用户滚回这些消息时，它们会重新出现在 DOM 中，下次扫描时自动加入

      // === 第三步：检测变化 ===
      const changed = newTurns.length !== this.turns.length ||
        newTurns.some((t, i) => !this.turns[i] || t.fingerprint !== this.turns[i].fingerprint);

      if (changed) {
        this.turns = newTurns;
        this._renderDots();
        if (this.popover && this.popover.classList.contains('aice-visible')) {
          this._renderNodes();
        }
      }

      // 持久化到 localStorage
      this._saveTurns();
    }

    // === 渲染竖条上的圆点 ===

    _renderDots() {
      if (!this.dotsContainer) return;
      this.dotsContainer.innerHTML = '';
      this.dots = [];

      this.turns.forEach((turn, i) => {
        const dot = document.createElement('div');
        dot.className = 'aice-timeline-dot';
        dot.setAttribute('data-turn-index', i);

        if (this._starredNodes[i]) dot.classList.add('aice-dot-starred');
        if (this._pinnedNodes[i]) dot.classList.add('aice-dot-pinned');

        const pct = this.turns.length > 1 ? (i / (this.turns.length - 1)) * 100 : 50;
        dot.style.top = pct + '%';

        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          this._scrollToTurn(turn, i);
        });
        dot.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._showContextMenu(e, turn, i);
        });

        this.dotsContainer.appendChild(dot);
        this.dots.push({ el: dot, turn });
      });
    }

    _findScrollContainer() {
      const sel = getSelector('conversationArea', this.platform);
      const area = sel ? document.querySelector(sel) : null;
      if (area) {
        let el = area;
        while (el) {
          const style = window.getComputedStyle(el);
          if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 5) {
            return el;
          }
          el = el.parentElement;
        }
      }
      return document.documentElement;
    }

    // === 渲染浮窗中的节点列表 ===

    _createNodeEl(turn, i) {
      const fp = turn.fingerprint;
      const node = document.createElement('div');
      node.className = 'aice-timeline-node';
      node.setAttribute('data-turn-index', i);
      node.setAttribute('data-fingerprint', fp);

      const isStarred = !!this._starredNodes[i];
      const isPinned = !!this._pinnedNodes[i];
      if (isStarred) node.classList.add('aice-starred');
      if (isPinned) node.classList.add('aice-pinned');

      // === 行（dot + label + actions） ===
      const row = document.createElement('div');
      row.className = 'aice-timeline-node-row';

      const dot = document.createElement('span');
      dot.className = 'aice-timeline-node-dot';
      row.appendChild(dot);

      const labelWrap = document.createElement('div');
      labelWrap.className = 'aice-timeline-node-label-wrap';

      const label = document.createElement('span');
      label.className = 'aice-timeline-node-label';
      label.textContent = turn.text || ('提问 ' + (i + 1));
      labelWrap.appendChild(label);

      // 显示时间
      if (this._isShowTime() && turn.timestamp) {
        const timeEl = document.createElement('span');
        timeEl.className = 'aice-timeline-node-time';
        timeEl.textContent = this._formatTimestamp(turn.timestamp);
        labelWrap.appendChild(timeEl);
      }

      row.appendChild(labelWrap);

      // 操作按钮
      const actions = document.createElement('span');
      actions.className = 'aice-timeline-node-actions';

      const pinBtn = document.createElement('button');
      pinBtn.className = 'aice-timeline-node-btn';
      pinBtn.title = isPinned ? '取消标记' : '标记为重点';
      pinBtn.innerHTML = isPinned
        ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>'
        : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aeaeb2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>';
      pinBtn.addEventListener('click', (e) => { e.stopPropagation(); this._togglePin(i); });
      actions.appendChild(pinBtn);

      const starBtn = document.createElement('button');
      starBtn.className = 'aice-timeline-node-btn';
      starBtn.title = isStarred ? '取消收藏' : '收藏';
      starBtn.innerHTML = isStarred
        ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
        : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aeaeb2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
      starBtn.addEventListener('click', (e) => { e.stopPropagation(); this._toggleStar(i); });
      actions.appendChild(starBtn);

      row.appendChild(actions);
      node.appendChild(row);

      // 悬停 → 左侧浮动卡片（200ms延迟显示，300ms延迟隐藏）
      node.addEventListener('mouseenter', () => {
        if (this._floatCardTimer) { clearTimeout(this._floatCardTimer); this._floatCardTimer = null; }
        this._floatCardTimer = setTimeout(() => {
          const curTurn = this._findTurnByFp(fp);
          if (curTurn) this._showFloatCard(row, curTurn);
        }, 200);
      });
      node.addEventListener('mouseleave', () => {
        if (this._floatCardTimer) { clearTimeout(this._floatCardTimer); this._floatCardTimer = null; }
        this._floatCardTimer = setTimeout(() => {
          this._hideFloatCard();
        }, 300);
      });

      // 点击节点 → 滚动到对应轮次（通过 fingerprint 查找当前 turn，避免闭包过期）
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        const curTurn = this._findTurnByFp(fp);
        if (curTurn) this._scrollToTurn(curTurn, this.turns.indexOf(curTurn));
      });

      // 右键菜单
      node.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const curTurn = this._findTurnByFp(fp);
        if (curTurn) this._showContextMenu(e, curTurn, this.turns.indexOf(curTurn));
      });

      // 拖拽到文件夹
      row.setAttribute('draggable', 'true');
      row.addEventListener('dragstart', (e) => {
        const curTurn = this._findTurnByFp(fp);
        e.dataTransfer.setData('application/aice-turn', JSON.stringify({
          index: this.turns.indexOf(curTurn),
          text: curTurn ? curTurn.text : '',
          fullText: curTurn ? curTurn.fullText : '',
          platform: this.platform
        }));
        e.dataTransfer.effectAllowed = 'move';
        row.style.opacity = '0.5';
        if (e.dataTransfer.setDragImage) {
          const ghost = row.cloneNode(true);
          ghost.style.position = 'absolute';
          ghost.style.top = '-9999px';
          ghost.style.opacity = '0.7';
          ghost.style.width = row.offsetWidth + 'px';
          document.body.appendChild(ghost);
          e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
          setTimeout(() => document.body.removeChild(ghost), 0);
        }
      });
      row.addEventListener('dragend', () => {
        row.style.opacity = '';
      });

      return node;
    }

    // 通过 fingerprint 查找当前 turn 对象（避免闭包引用过期对象）
    _findTurnByFp(fp) {
      return this.turns.find(t => t.fingerprint === fp) || null;
    }

    _renderNodes() {
      if (!this.popoverList) return;
      this.popoverList.innerHTML = '';
      this.nodes = [];

      if (this.turns.length === 0) {
        this.popoverList.innerHTML = '<div class="aice-timeline-empty">暂无对话</div>';
        return;
      }

      // 全量渲染所有节点
      const fragment = document.createDocumentFragment();
      this.turns.forEach((turn, i) => {
        const node = this._createNodeEl(turn, i);
        fragment.appendChild(node);
        this.nodes.push({ el: node, turn });
      });
      this.popoverList.appendChild(fragment);

      this._updateActiveNode();
    }

    // === 图钉 / 星标 ===

    async _togglePin(index) {
      if (this._pinnedNodes[index]) {
        delete this._pinnedNodes[index];
      } else {
        this._pinnedNodes[index] = true;
      }
      await this._savePinned();
      this._renderDots();
      this._renderNodes();
    }

    async _toggleStar(index) {
      if (this._starredNodes[index]) {
        delete this._starredNodes[index];
      } else {
        this._starredNodes[index] = true;
      }
      await this._saveStarred();
      this._renderDots();
      this._renderNodes();
      // 通知文件夹模块
      window.dispatchEvent(new CustomEvent('aice-star-changed', {
        detail: { index, starred: !!this._starredNodes[index], turn: this.turns[index], platform: this.platform }
      }));
    }

    // === 滚动到对话轮次 ===

    _scrollToTurn(turn, index) {
      // 1. 尝试已存储的 DOM 引用
      let targetEl = turn.el;
      if (targetEl && targetEl.isConnected) {
        this._doScrollToEl(targetEl, turn);
        return;
      }

      // 2. 在当前 DOM 中按文本搜索
      targetEl = this._findTurnElByText(turn);
      if (targetEl) {
        turn.el = targetEl;
        this._doScrollToEl(targetEl, turn);
        return;
      }

      // 3. 虚拟滚动场景：消息可能不在 DOM 中
      //    尝试滚动对话区域到顶部，触发虚拟化重新加载，然后再搜索
      const scrollParent = this._findScrollContainer();
      if (scrollParent && scrollParent !== document.documentElement) {
        // 先滚到顶部
        scrollParent.scrollTo({ top: 0, behavior: 'instant' });
        // 等待 DOM 更新后重新搜索
        setTimeout(() => {
          const el = this._findTurnElByText(turn);
          if (el) {
            turn.el = el;
            this._doScrollToEl(el, turn);
          }
        }, 300);
      }
    }

    // 在 DOM 中按文本内容查找消息元素
    _findTurnElByText(turn) {
      const turnSelector = getSelector('turns', this.platform);
      if (!turnSelector) return null;
      const allTurns = document.querySelectorAll(turnSelector);
      // 用前 40 字符做匹配（去掉空白，避免截断差异）
      const normalize = s => (s || '').replace(/\s+/g, '').substring(0, 40);
      const searchText = normalize(turn.text);
      if (!searchText) return null;

      for (const el of allTurns) {
        if (isAssistantMessage(el, this.platform)) continue;
        if (!isUserMessage(el, this.platform)) continue;
        const elText = normalize(el.textContent);
        if (elText.includes(searchText) || searchText.includes(elText)) {
          return el;
        }
      }
      return null;
    }

    // 执行实际滚动 + 高亮反馈
    _doScrollToEl(targetEl, turn) {
      const scrollParent = this._findScrollContainer();
      if (scrollParent && scrollParent !== document.documentElement) {
        const parentRect = scrollParent.getBoundingClientRect();
        const elRect = targetEl.getBoundingClientRect();
        const targetScrollTop = scrollParent.scrollTop + (elRect.top - parentRect.top);
        scrollParent.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
      } else {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      // Apple 风格反馈：极淡遮罩 + 0.6s 淡出
      const isDark = matchMedia('(prefers-color-scheme: dark)').matches;
      targetEl.style.transition = 'filter 0.6s ease-out';
      targetEl.style.filter = isDark ? 'brightness(1.18)' : 'brightness(0.92)';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          targetEl.style.filter = 'brightness(1)';
        });
      });
      setTimeout(() => {
        targetEl.style.filter = '';
        targetEl.style.transition = '';
      }, 650);

      // 找到当前 turn 在 this.turns 中的位置，设置高亮
      const idx = this.turns.indexOf(turn);
      if (idx >= 0) this._setActiveNode(idx);
    }

    // === 高亮当前节点 ===

    _setActiveNode(index) {
      if (this.popoverList) {
        const allNodes = this.popoverList.querySelectorAll('.aice-timeline-node');
        allNodes.forEach((n, i) => n.classList.toggle('aice-active', i === index));
      }
      if (this.dotsContainer) {
        const allDots = this.dotsContainer.querySelectorAll('.aice-timeline-dot');
        allDots.forEach((d, i) => d.classList.toggle('aice-dot-active', i === index));
      }
    }

    _updateActiveNode() {
      if (this.turns.length === 0) return;
      let activeIndex = -1;
      let closestDistance = Infinity;
      const vh = window.innerHeight;
      this.turns.forEach((turn, i) => {
        if (!turn.el) return;
        const rect = turn.el.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const dist = Math.abs(center - vh / 2);
        if (dist < closestDistance) { closestDistance = dist; activeIndex = i; }
      });
      if (activeIndex >= 0) {
        this._setActiveNode(activeIndex);
        // 滚动浮窗列表使当前节点可见（可能尚未加载）
        if (activeIndex < this.nodes.length && this.popoverList) {
          const nodeEl = this.nodes[activeIndex].el;
          const listRect = this.popoverList.getBoundingClientRect();
          const nodeRect = nodeEl.getBoundingClientRect();
          if (nodeRect.bottom > listRect.bottom || nodeRect.top < listRect.top) {
            nodeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }
      }
    }

    // === 右键菜单 ===

    _showContextMenu(e, turn, index) {
      this._contextTarget = { turn, index };
      const menu = this.contextMenu;
      menu.style.display = 'none';
      requestAnimationFrame(() => {
        menu.style.display = '';
        const menuW = menu.offsetWidth || 180;
        const menuH = menu.offsetHeight || 160;
        let left = e.clientX, top = e.clientY;
        if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
        if (top + menuH > window.innerHeight - 8) top = window.innerHeight - menuH - 8;
        if (left < 4) left = 4;
        if (top < 4) top = 4;
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
      });
    }

    _hideContextMenu() {
      if (this.contextMenu) this.contextMenu.style.display = 'none';
      this._contextTarget = null;
    }

    _handleContextAction(action, turn, index) {
      switch (action) {
        case 'share': this._generateShareLink(turn, index); break;
        case 'export-md': this._exportTurn(turn, index, 'markdown'); break;
        case 'export-json': this._exportTurn(turn, index, 'json'); break;
        case 'export-text': this._exportTurn(turn, index, 'text'); break;
      }
    }

    _generateShareLink(turn, index) {
      const url = new URL(location.href);
      url.hash = 'aice-turn-' + index;
      const link = url.toString();
      if (turn.el) turn.el.setAttribute('id', 'aice-turn-' + index);
      navigator.clipboard.writeText(link).then(() => {
        this._showMiniToast('链接已复制');
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = link; ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        this._showMiniToast('链接已复制');
      });
    }

    _exportTurn(turn, index, format) {
      const fullText = turn.el ? (turn.el.textContent || '').trim() : (turn.text || '');
      const title = '提问_' + (index + 1);
      let content = '', ext = 'txt';
      switch (format) {
        case 'markdown':
          content = '# ' + title + '\n\n> 来源: ' + location.href + '\n\n' + fullText;
          ext = 'md'; break;
        case 'json':
          content = JSON.stringify({ platform: this.platform, url: location.href, title, turnIndex: index, text: fullText, exportedAt: new Date().toISOString() }, null, 2);
          ext = 'json'; break;
        default:
          content = fullText; break;
      }
      const filename = title.replace(/[^a-zA-Z0-9一-鿿]/g, '_') + '.' + ext;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl; a.download = filename; a.style.display = 'none';
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(blobUrl); }, 100);
      this._showMiniToast('已导出 ' + filename);
    }

    _showMiniToast(msg) {
      let toast = document.querySelector('.aice-timeline-mini-toast');
      if (!toast) { toast = document.createElement('div'); toast.className = 'aice-timeline-mini-toast'; document.body.appendChild(toast); }
      toast.textContent = msg;
      toast.style.display = ''; toast.offsetHeight;
      toast.classList.add('aice-toast-visible');
      clearTimeout(toast._timer);
      toast._timer = setTimeout(() => { toast.classList.remove('aice-toast-visible'); toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 200); }, 1800);
    }

    // === Observer & Scroll ===

    _startObserver() {
      const sel = getSelector('conversationArea', this.platform);
      const target = (sel ? document.querySelector(sel) : null) || document.body;

      // 记录新消息出现的时间（在扫描之前）
      const recordAppearanceTimestamps = (mutations) => {
        const now = Date.now();
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== 1) continue; // 只处理元素节点
            // 检查是否是用户消息
            if (isUserMessage(node, this.platform)) {
              const fullText = (node.textContent || '').trim();
              if (fullText) {
                const cleaned = this._stripUserPrefix(fullText);
                const fp = this._makeContentFingerprint(cleaned);
                if (fp && !this._turnTimestamps[fp]) {
                  this._turnTimestamps[fp] = now;
                  this._saveTimestamps();
                }
              }
            }
            // 也检查子元素
            if (node.querySelectorAll) {
              node.querySelectorAll('[data-message-author-role="user"], [data-role="user"]').forEach(el => {
                const fullText = (el.textContent || '').trim();
                if (fullText) {
                  const cleaned = this._stripUserPrefix(fullText);
                  const fp = this._makeContentFingerprint(cleaned);
                  if (fp && !this._turnTimestamps[fp]) {
                    this._turnTimestamps[fp] = now;
                    this._saveTimestamps();
                  }
                }
              });
            }
          }
        }
      };

      const debouncedScan = debounce(() => this._scanTurns(), 500);
      this.observer = new MutationObserver((mutations) => {
        // 先记录时间戳，再触发扫描
        if (mutations.some(m => m.addedNodes.length > 0)) {
          recordAppearanceTimestamps(mutations);
          debouncedScan();
        }
      });
      this.observer.observe(target, { childList: true, subtree: true });
    }

    _bindScroll() {
      this.scrollHandler = throttle(() => {
        this._renderDots();
        if (this.popover.classList.contains('aice-visible')) {
          this._updateActiveNode();
        }
      }, 100);
      window.addEventListener('scroll', this.scrollHandler, { passive: true });
    }

    _onDocClick(e) {
      if (this.contextMenu && !this.contextMenu.contains(e.target)) this._hideContextMenu();
      if (this.popover && !this.popover.contains(e.target) && !this.strip.contains(e.target)) {
        this._hidePopover();
      }
    }

    refresh() {
      this.turns = [];
      this._scanTurns();
    }

    async hide() {
      this.visible = false;
      await setTimelineVisible(false);
      if (this.host) this.host.style.display = 'none';
    }

    async show() {
      if (!this._isPlatformEnabled()) return;
      this.visible = true;
      await setTimelineVisible(true);
      if (this.host) this.host.style.display = '';
    }

    destroy() {
      if (this.observer) this.observer.disconnect();
      if (this.scrollHandler) window.removeEventListener('scroll', this.scrollHandler);
      document.removeEventListener('click', this._onDocClick);
      window.removeEventListener('aice-settings-changed', this._onSettingsChanged);
      if (this.host?.parentNode) this.host.parentNode.removeChild(this.host);
      if (this.tooltipEl?.parentNode) this.tooltipEl.parentNode.removeChild(this.tooltipEl);
      if (this.contextMenu?.parentNode) this.contextMenu.parentNode.removeChild(this.contextMenu);
      if (this._hideTimer) clearTimeout(this._hideTimer);
      if (this._showTimer) clearTimeout(this._showTimer);
      if (this._floatCardTimer) clearTimeout(this._floatCardTimer);
      if (this.floatCard?.parentNode) this.floatCard.parentNode.removeChild(this.floatCard);
    }
  }

  ns.Timeline = Timeline;

})(window.AIChatEnhancer);
