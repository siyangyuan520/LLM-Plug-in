// AI Chat Enhancer - Prompt 仓库浮动面板
window.AIChatEnhancer = window.AIChatEnhancer || {};

(function(ns) {
  'use strict';

  const { detectPlatform } = ns.platforms;

  class PromptRepo {
    constructor() {
      this._platform = null;
      this._host = null;
      this._iconEl = null;
      this._panel = null;
      this._searchInput = null;
      this._searchWrap = null;
      this._listEl = null;

      this._open = false;
      this._prompts = [];
      this._searchQuery = '';
      this._observer = null;

      // 拖拽状态
      this._dragItem = null;
      this._dragGhost = null;
      this._dragStartY = 0;
      this._dragStartIndex = -1;
      this._dragOverIndex = -1;
      this._dropIndicator = null;

      // bound handlers
      this._onKeyDown = this._onKeyDown.bind(this);
      this._onDocMouseDown = this._onDocMouseDown.bind(this);
      this._onResize = this._onResize.bind(this);
      this._onDragOver = this._onDragOver.bind(this);
      this._onDragEnd = this._onDragEnd.bind(this);
    }

    async init() {
      this._platform = detectPlatform();
      await this._loadPrompts();
      this._createDOM();
      this._renderList();
      this._bindEvents();
    }

    destroy() {
      document.removeEventListener('keydown', this._onKeyDown);
      document.removeEventListener('mousedown', this._onDocMouseDown, true);
      window.removeEventListener('resize', this._onResize);
      if (this._observer) this._observer.disconnect();
      if (this._iconEl?.parentNode) this._iconEl.parentNode.removeChild(this._iconEl);
      if (this._panel?.parentNode) this._panel.parentNode.removeChild(this._panel);
    }

    // === 数据 ===

    async _loadPrompts() {
      this._prompts = await ns.storage.prompts.query(() => true);
      this._sortPrompts();
    }

    _sortPrompts() {
      // 置顶的按 pinnedAt 倒序在前，其余按 order 或 updatedAt 倒序
      this._prompts.sort((a, b) => {
        const aPinned = a.pinned ? 1 : 0;
        const bPinned = b.pinned ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        if (a.pinned && b.pinned) {
          return (b.pinnedAt || 0) - (a.pinnedAt || 0);
        }
        return (a.order ?? Infinity) - (b.order ?? Infinity);
      });
    }

    _getFilteredPrompts() {
      let list = [...this._prompts];
      if (this._searchQuery.trim()) {
        const q = this._searchQuery.trim().toLowerCase();
        list = list.filter(p => {
          return (
            (p.title || '').toLowerCase().includes(q) ||
            (p.content || '').toLowerCase().includes(q) ||
            (p.tags || []).some(t => t.toLowerCase().includes(q))
          );
        });
      }
      return list;
    }

    async _saveAllOrders() {
      for (let i = 0; i < this._prompts.length; i++) {
        const p = this._prompts[i];
        if (p.order !== i) {
          await ns.storage.prompts.update(p.id, { order: i });
        }
      }
    }

    // === DOM 创建 ===

    _createDOM() {
      // 浮动图标容器
      this._iconEl = document.createElement('div');
      this._iconEl.className = 'aice-prompt-float-icon';
      this._iconEl.title = 'Prompt 仓库';
      this._iconEl.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
      document.body.appendChild(this._iconEl);

      // 面板
      this._panel = document.createElement('div');
      this._panel.className = 'aice-prompt-float-panel';

      // 头部：标题 + 设置
      const header = document.createElement('div');
      header.className = 'aice-prompt-float-header';

      const title = document.createElement('span');
      title.className = 'aice-prompt-float-title';
      title.textContent = 'Prompt 仓库';

      const settingsBtn = document.createElement('button');
      settingsBtn.className = 'aice-prompt-float-settings-btn';
      settingsBtn.title = '打开设置';
      settingsBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

      header.appendChild(title);
      header.appendChild(settingsBtn);

      // 搜索条（单独一行）
      this._searchWrap = document.createElement('div');
      this._searchWrap.className = 'aice-prompt-float-search-wrap';

      const searchIcon = document.createElement('span');
      searchIcon.className = 'aice-prompt-float-search-icon';
      searchIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

      this._searchInput = document.createElement('input');
      this._searchInput.className = 'aice-prompt-float-search';
      this._searchInput.type = 'text';
      this._searchInput.placeholder = '搜索 Prompt...';

      this._searchWrap.appendChild(searchIcon);
      this._searchWrap.appendChild(this._searchInput);

      // 列表
      this._listEl = document.createElement('div');
      this._listEl.className = 'aice-prompt-float-list';

      this._panel.appendChild(header);
      this._panel.appendChild(this._searchWrap);
      this._panel.appendChild(this._listEl);
      document.body.appendChild(this._panel);

      // 定位图标和面板
      this._positionIcon();

      // 监听窗口变化，重新定位
      this._resizeObserver = new ResizeObserver(() => this._positionIcon());
      this._resizeObserver.observe(document.body);
      window.addEventListener('resize', () => this._positionIcon());
    }

    _positionIcon() {
      // 查找 AI 对话框输入框
      const inputEl = this._findChatInput();
      if (inputEl) {
        const rect = inputEl.getBoundingClientRect();
        // 图标定位在输入框左上方
        const iconLeft = Math.max(16, rect.left - 48);
        const iconTop = rect.top - 48;

        this._iconEl.style.position = 'fixed';
        this._iconEl.style.left = iconLeft + 'px';
        this._iconEl.style.top = iconTop + 'px';
        this._iconEl.style.bottom = 'auto';

        // 面板定位在图标下方
        this._panel.style.position = 'fixed';
        this._panel.style.left = iconLeft + 'px';
        this._panel.style.top = (iconTop + 42) + 'px';
        this._panel.style.bottom = 'auto';
      } else {
        // 默认位置：左上角
        this._iconEl.style.position = 'fixed';
        this._iconEl.style.left = '16px';
        this._iconEl.style.top = '80px';
        this._iconEl.style.bottom = 'auto';

        this._panel.style.position = 'fixed';
        this._panel.style.left = '16px';
        this._panel.style.top = '122px';
        this._panel.style.bottom = 'auto';
      }
    }

    // === 列表渲染 ===

    _renderList() {
      const list = this._getFilteredPrompts();

      if (list.length === 0) {
        this._listEl.innerHTML = '<div class="aice-prompt-float-empty">暂无 Prompt</div>';
        return;
      }

      let html = '';
      list.forEach((p, i) => {
        const title = this._highlightText(p.title || '未命名', this._searchQuery);
        const tags = (p.tags || []).slice(0, 3);
        const tagsHtml = tags.map(t =>
          `<span class="aice-prompt-float-tag">${this._highlightText(t, this._searchQuery)}</span>`
        ).join('');
        const isPinned = p.pinned ? ' aice-prompt-pinned' : '';
        const pinIcon = p.pinned
          ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>'
          : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aeaeb2" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>';

        html += `
          <div class="aice-prompt-float-card${isPinned}" data-pid="${p.id}" data-index="${i}" draggable="true">
            <div class="aice-prompt-float-card-row">
              <span class="aice-prompt-float-card-title">${title}</span>
              ${tags.length ? `<span class="aice-prompt-float-card-tags">${tagsHtml}</span>` : ''}
            </div>
            <button class="aice-prompt-float-pin-btn" data-pid="${p.id}" title="${p.pinned ? '取消置顶' : '置顶'}">${pinIcon}</button>
          </div>`;
      });

      this._listEl.innerHTML = html;
    }

    _highlightText(text, query) {
      if (!query || !query.trim()) return text;
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(${escaped})`, 'gi');
      return text.replace(re, '<mark class="aice-search-highlight">$1</mark>');
    }

    // === 事件绑定 ===

    _bindEvents() {
      // 图标点击 → 切换面板
      this._iconEl.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        this._toggle();
      });

      // 面板内 mousedown 阻止冒泡
      this._panel.addEventListener('mousedown', e => {
        e.stopPropagation();
      });

      // 搜索展开/收起
      this._searchWrap.addEventListener('mouseenter', () => {
        this._searchWrap.classList.add('aice-search-expanded');
        setTimeout(() => this._searchInput.focus(), 100);
      });

      this._searchWrap.addEventListener('mouseleave', () => {
        if (!this._searchInput.value.trim()) {
          this._searchWrap.classList.remove('aice-search-expanded');
        }
      });

      this._searchInput.addEventListener('blur', () => {
        if (!this._searchInput.value.trim()) {
          setTimeout(() => this._searchWrap.classList.remove('aice-search-expanded'), 150);
        }
      });

      this._searchInput.addEventListener('input', () => {
        this._searchQuery = this._searchInput.value;
        this._renderList();
      });

      // 卡片点击 → 插入
      this._listEl.addEventListener('click', e => {
        const pinBtn = e.target.closest('.aice-prompt-float-pin-btn');
        if (pinBtn) {
          e.stopPropagation();
          this._togglePin(pinBtn.getAttribute('data-pid'));
          return;
        }

        const card = e.target.closest('.aice-prompt-float-card');
        if (!card) return;
        e.stopPropagation();
        this._insertPrompt(card.getAttribute('data-pid'));
      });

      // 拖拽
      this._listEl.addEventListener('dragstart', e => {
        const card = e.target.closest('.aice-prompt-float-card');
        if (!card) return;
        this._dragItem = card;
        this._dragStartIndex = parseInt(card.getAttribute('data-index'));
        card.classList.add('aice-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.getAttribute('data-pid'));
      });

      this._listEl.addEventListener('dragover', this._onDragOver);

      this._listEl.addEventListener('dragleave', e => {
        const card = e.target.closest('.aice-prompt-float-card');
        if (card) card.classList.remove('aice-drag-over');
        this._removeDropIndicator();
      });

      this._listEl.addEventListener('drop', e => {
        e.preventDefault();
        const card = e.target.closest('.aice-prompt-float-card');
        if (!card) return;
        this._dragOverIndex = parseInt(card.getAttribute('data-index'));
        card.classList.remove('aice-drag-over');
        this._removeDropIndicator();
        this._executeDrop();
      });

      this._listEl.addEventListener('dragend', this._onDragEnd);

      // 设置按钮 → 打开插件设置面板
      const settingsBtn = this._panel.querySelector('.aice-prompt-float-settings-btn');
      if (settingsBtn) {
        settingsBtn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          this._openSettingsPanel();
        });
      }

      window.addEventListener('resize', this._onResize);
      this._startObserver();
      document.addEventListener('mousedown', this._onDocMouseDown, true);
      document.addEventListener('keydown', this._onKeyDown);
    }

    _onDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const card = e.target.closest('.aice-prompt-float-card');
      if (!card) return;

      this._listEl.querySelectorAll('.aice-prompt-float-card').forEach(c => c.classList.remove('aice-drag-over'));
      card.classList.add('aice-drag-over');

      // 显示拖放指示线
      const rect = card.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const overIndex = parseInt(card.getAttribute('data-index'));

      if (e.clientY < midY) {
        this._showDropIndicator(card, 'before');
        this._dragOverIndex = overIndex;
      } else {
        this._showDropIndicator(card, 'after');
        this._dragOverIndex = overIndex + 1;
      }
    }

    _onDragEnd() {
      if (this._dragItem) {
        this._dragItem.classList.remove('aice-dragging');
      }
      this._listEl.querySelectorAll('.aice-drag-over').forEach(c => c.classList.remove('aice-drag-over'));
      this._removeDropIndicator();
      this._dragItem = null;
      this._dragStartIndex = -1;
      this._dragOverIndex = -1;
    }

    _showDropIndicator(targetCard, position) {
      this._removeDropIndicator();
      this._dropIndicator = document.createElement('div');
      this._dropIndicator.className = 'aice-drop-indicator';
      if (position === 'before') {
        targetCard.parentNode.insertBefore(this._dropIndicator, targetCard);
      } else {
        targetCard.parentNode.insertBefore(this._dropIndicator, targetCard.nextSibling);
      }
    }

    _removeDropIndicator() {
      if (this._dropIndicator && this._dropIndicator.parentNode) {
        this._dropIndicator.parentNode.removeChild(this._dropIndicator);
      }
      this._dropIndicator = null;
    }

    _executeDrop() {
      if (this._dragStartIndex < 0 || this._dragOverIndex < 0) return;
      if (this._dragStartIndex === this._dragOverIndex || this._dragStartIndex === this._dragOverIndex - 1) return;

      const list = this._getFilteredPrompts();
      const draggedItem = list[this._dragStartIndex];
      if (!draggedItem) return;

      // 确定目标位置的 item
      const targetItem = list[this._dragOverIndex > this._dragStartIndex ? this._dragOverIndex - 1 : this._dragOverIndex];
      if (!targetItem || draggedItem.id === targetItem.id) return;

      // 置顶与非置顶不能互相拖拽
      if (draggedItem.pinned !== targetItem.pinned) return;

      // 在原数组中移动
      const fromIdx = this._prompts.findIndex(p => p.id === draggedItem.id);
      const toIdx = this._prompts.findIndex(p => p.id === targetItem.id);
      if (fromIdx < 0 || toIdx < 0) return;

      const [removed] = this._prompts.splice(fromIdx, 1);
      const newToIdx = this._prompts.findIndex(p => p.id === targetItem.id);
      if (this._dragOverIndex > this._dragStartIndex) {
        this._prompts.splice(newToIdx + 1, 0, removed);
      } else {
        this._prompts.splice(newToIdx, 0, removed);
      }

      // 重新编号并保存
      this._prompts.forEach((p, i) => { p.order = i; });
      this._saveAllOrders().then(() => this._renderList());
    }

    // === 置顶 ===

    async _togglePin(id) {
      const p = this._prompts.find(x => x.id === id);
      if (!p) return;
      const newPinned = !p.pinned;
      await ns.storage.prompts.update(id, {
        pinned: newPinned,
        pinnedAt: newPinned ? Date.now() : 0
      });
      await this._loadPrompts();
      this._renderList();
    }

    // === 插入对话框 ===

    _insertPrompt(id) {
      const p = this._prompts.find(x => x.id === id);
      if (!p || !p.content) return;

      const text = p.content;
      const inputEl = this._findChatInput();
      if (inputEl) {
        this._fillInput(inputEl, text);
      } else {
        navigator.clipboard.writeText(text).catch(() => {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        });
      }

      if (this._open) this._collapse();
    }

    _findChatInput() {
      const selectors = [
        '#prompt-textarea',
        'textarea[placeholder*="消息"]',
        'textarea[placeholder*="Message"]',
        'textarea[placeholder*="chat"]',
        'textarea[data-id]',
        '[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"]',
        'textarea'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && (el.tagName === 'TEXTAREA' || el.getAttribute('contenteditable') === 'true')) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 20) return el;
        }
      }
      return null;
    }

    _fillInput(el, text) {
      let existingContent = '';
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        existingContent = el.value || '';
      } else if (el.getAttribute('contenteditable') === 'true') {
        existingContent = el.textContent || el.innerText || '';
      }

      let newContent = text;
      if (existingContent.trim()) {
        newContent = text + '\n\n' + existingContent;
      }

      el.focus();
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        el.value = newContent;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (el.getAttribute('contenteditable') === 'true') {
        el.textContent = newContent;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    // === 设置面板 ===

    _openSettingsPanel() {
      if (this._open) this._collapse();
      if (ns.SettingsPanel) {
        const settingsPanel = new ns.SettingsPanel();
        settingsPanel.show('prompts');
      }
    }

    // === 展开/收起 ===

    _toggle() {
      if (this._open) {
        this._collapse();
      } else {
        this._expand();
      }
    }

    _expand() {
      this._panel.classList.add('aice-prompt-open');
      this._open = true;
    }

    _collapse() {
      this._panel.classList.remove('aice-prompt-open');
      this._open = false;
      this._searchInput.value = '';
      this._searchQuery = '';
      this._searchWrap.classList.remove('aice-search-expanded');
    }

    _onKeyDown(e) {
      if (e.key === 'Escape' && this._open) {
        this._collapse();
      }
    }

    _onDocMouseDown(e) {
      if (!this._open) return;
      if (this._iconEl.contains(e.target)) return;
      if (this._panel.contains(e.target)) return;
      this._collapse();
    }

    _onResize() {
      // 面板位置固定，无需重新定位
    }

    _startObserver() {
      const chatArea = this._findChatInput()?.closest('form, [role="form"], .chat-area, main') || document.body;
      this._observer = new ResizeObserver(() => {
        this._positionNearInput();
      });
      this._observer.observe(chatArea);
      this._observer.observe(document.body);
    }

    refresh() {
      this._loadPrompts().then(() => {
        this._renderList();
      });
    }
  }

  ns.PromptRepo = PromptRepo;

})(window.AIChatEnhancer);
