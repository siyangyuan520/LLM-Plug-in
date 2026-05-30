// AI Chat Enhancer - 设置面板（页面中央卡片）
window.AIChatEnhancer = window.AIChatEnhancer || {};

(function(ns) {
  'use strict';

  const LS_PREFIX = 'aice:';
  const { generateId } = ns.utils;

  function loadBool(key, fallback) {
    try {
      const v = localStorage.getItem(LS_PREFIX + key);
      if (v === null) return fallback;
      return v === 'true';
    } catch { return fallback; }
  }

  function saveBool(key, val) {
    try { localStorage.setItem(LS_PREFIX + key, String(val)); } catch {}
  }

  // === SVG 图标 ===
  const ICONS = {
    timeline: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    annotation: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    folder: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>',
    prompt: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    add: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    edit: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  };

  // === 面板内容定义 ===
  const PANELS = {
    timeline: {
      icon: 'timeline',
      title: '时间轴',
      sections: [
        {
          title: 'AI 平台权限',
          checks: [
            { key: 'timeline_platform_ChatGPT', label: 'ChatGPT', default: true },
            { key: 'timeline_platform_Claude', label: 'Claude', default: true },
            { key: 'timeline_platform_Gemini', label: 'Gemini', default: true },
            { key: 'timeline_platform_Kimi', label: 'Kimi', default: true },
            { key: 'timeline_platform_Tongyi', label: '通义千问', default: true },
            { key: 'timeline_platform_DeepSeek', label: 'DeepSeek', default: true },
            { key: 'timeline_platform_Yuanbao', label: '腾讯元宝', default: true },
            { key: 'timeline_platform_Grok', label: 'Grok', default: true },
          ],
        },
        {
          title: '显示选项',
          toggles: [
            { key: 'timeline_show_time', label: '时间轴是否显示对话时间', default: false },
          ],
        },
      ],
    },
    annotation: {
      icon: 'annotation',
      title: '文本标注',
      sections: [
        {
          title: '标注行为',
          toggles: [
            { key: 'annotation_highlight', label: '启用高亮标注', default: true },
            { key: 'annotation_underline', label: '启用下划线标注', default: true },
            { key: 'annotation_bold', label: '启用加粗标注', default: true },
          ],
        },
        {
          title: '标注颜色',
          checks: [
            { key: 'annotation_color_yellow', label: '黄色', color: '#f59e0b', default: true },
            { key: 'annotation_color_green', label: '绿色', color: '#34c759', default: true },
            { key: 'annotation_color_blue', label: '蓝色', color: '#0071e3', default: true },
            { key: 'annotation_color_pink', label: '粉色', color: '#ff2d55', default: false },
          ],
        },
      ],
    },
    prompts: {
      icon: 'prompt',
      title: 'Prompt 管理',
      custom: true,
    },
    folder: {
      icon: 'folder',
      title: '对话文件夹',
      sections: [
        {
          title: '文件夹设置',
          toggles: [
            { key: 'folder_show_in_sidebar', label: '在侧边栏显示文件夹', default: true },
            { key: 'folder_auto_sort', label: '自动按时间排序', default: false },
            { key: 'folder_show_count', label: '显示文件夹内对话数量', default: true },
          ],
        },
      ],
    },
  };

  class SettingsPanel {
    constructor() {
      this.overlay = null;
      this.card = null;
      this.currentPanel = 'timeline';
      this._prompts = [];
      this._rightPanel = null;
      this._isDragging = false;
      this._dragOffsetX = 0;
      this._dragOffsetY = 0;
    }

    show(defaultPanel) {
      if (defaultPanel) this.currentPanel = defaultPanel;

      if (this.overlay) {
        this.overlay.style.display = '';
        this._refreshContent();
        return;
      }
      this._create();
    }

    hide() {
      if (this.overlay) {
        this.overlay.style.display = 'none';
      }
    }

    async _loadPrompts() {
      this._prompts = await ns.storage.prompts.query(() => true);
      this._prompts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    async _savePrompt(data) {
      if (data.id) {
        await ns.storage.prompts.update(data.id, data);
      } else {
        await ns.storage.prompts.put(data);
      }
      await this._loadPrompts();
    }

    async _deletePrompt(id) {
      await ns.storage.prompts.delete(id);
      await this._loadPrompts();
    }

    _create() {
      // 遮罩层
      this.overlay = document.createElement('div');
      this.overlay.className = 'aice-settings-overlay';

      // 卡片
      this.card = document.createElement('div');
      this.card.className = 'aice-settings-card';

      // 顶栏（可拖动）
      const topBar = document.createElement('div');
      topBar.className = 'aice-settings-topbar';
      topBar.style.cursor = 'move';

      const topTitle = document.createElement('div');
      topTitle.className = 'aice-settings-topbar-title';
      topTitle.textContent = 'AI Chat Enhancer 设置';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'aice-settings-close';
      closeBtn.innerHTML = ICONS.close;
      closeBtn.addEventListener('click', () => this.hide());
      topBar.appendChild(topTitle);
      topBar.appendChild(closeBtn);
      this.card.appendChild(topBar);

      // 拖动功能
      this._bindDrag(topBar);

      // 主体：左导航 + 右面板
      const body = document.createElement('div');
      body.className = 'aice-settings-body';

      // 左导航
      const nav = document.createElement('div');
      nav.className = 'aice-settings-nav';

      this._navItems = [];
      Object.keys(PANELS).forEach((key) => {
        const cfg = PANELS[key];
        const item = document.createElement('div');
        item.className = 'aice-settings-nav-item' + (key === this.currentPanel ? ' active' : '');
        item.innerHTML = `<span class="aice-settings-nav-icon">${ICONS[cfg.icon]}</span>${cfg.title}`;
        item.addEventListener('click', () => {
          this.currentPanel = key;
          this._navItems.forEach(n => n.classList.remove('active'));
          item.classList.add('active');
          this._refreshContent();
        });
        nav.appendChild(item);
        this._navItems.push(item);
      });

      body.appendChild(nav);

      // 右面板
      this._rightPanel = document.createElement('div');
      this._rightPanel.className = 'aice-settings-right';
      body.appendChild(this._rightPanel);

      this.card.appendChild(body);
      this.overlay.appendChild(this.card);

      // ESC 关闭
      this._escHandler = (e) => {
        if (e.key === 'Escape') this.hide();
      };
      document.addEventListener('keydown', this._escHandler);

      document.body.appendChild(this.overlay);
      this._refreshContent();
    }

    // === 拖动功能 ===

    _bindDrag(topBar) {
      const onMouseDown = (e) => {
        // 如果点击的是关闭按钮，不拖动
        if (e.target.closest('.aice-settings-close')) return;

        this._isDragging = true;
        const rect = this.card.getBoundingClientRect();
        this._dragOffsetX = e.clientX - rect.left;
        this._dragOffsetY = e.clientY - rect.top;

        // 防止选中内容
        e.preventDefault();
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'move';
      };

      const onMouseMove = (e) => {
        if (!this._isDragging) return;

        const x = e.clientX - this._dragOffsetX;
        const y = e.clientY - this._dragOffsetY;

        // 限制在视口内
        const maxX = window.innerWidth - this.card.offsetWidth;
        const maxY = window.innerHeight - this.card.offsetHeight;

        this.card.style.position = 'fixed';
        this.card.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
        this.card.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
        this.card.style.transform = 'none';
      };

      const onMouseUp = () => {
        if (!this._isDragging) return;
        this._isDragging = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };

      topBar.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      // 保存清理函数
      this._cleanupDrag = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
    }

    // === 内容渲染 ===

    async _refreshContent() {
      await this._loadPrompts();
      this._renderContent();
    }

    _renderContent() {
      if (!this._rightPanel) return;

      const cfg = PANELS[this.currentPanel];

      if (cfg.custom && cfg.title === 'Prompt 管理') {
        this._renderPromptsPanel();
      } else {
        this._renderDefaultPanel(cfg);
      }
    }

    _renderDefaultPanel(cfg) {
      this._rightPanel.innerHTML = '';

      cfg.sections.forEach((section) => {
        const sec = document.createElement('div');
        sec.className = 'aice-settings-section';

        const secHeader = document.createElement('div');
        secHeader.className = 'aice-settings-section-header';
        secHeader.innerHTML = `<span class="aice-settings-section-title">${section.title}</span><span class="aice-settings-section-line"></span>`;
        sec.appendChild(secHeader);

        if (section.checks) {
          section.checks.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'aice-settings-check-row';
            const checked = loadBool(item.key, item.default);
            if (checked) row.classList.add('checked');

            const dot = item.color
              ? `<span class="aice-settings-color-dot" style="background:${item.color}"></span>`
              : '';
            row.innerHTML = `<div class="aice-settings-check-box"></div><span class="aice-settings-check-label">${dot}${item.label}</span>`;

            row.addEventListener('click', () => {
              row.classList.toggle('checked');
              const val = row.classList.contains('checked');
              saveBool(item.key, val);
              window.dispatchEvent(new CustomEvent('aice-settings-changed', { detail: { key: item.key, value: val } }));
            });
            sec.appendChild(row);
          });
        }

        if (section.toggles) {
          section.toggles.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'aice-settings-toggle-row';
            const on = loadBool(item.key, item.default);
            if (on) row.classList.add('on');

            row.innerHTML = `<span class="aice-settings-toggle-label">${item.label}</span><div class="aice-settings-toggle-track"><div class="aice-settings-toggle-thumb"></div></div>`;

            row.addEventListener('click', () => {
              row.classList.toggle('on');
              const val = row.classList.contains('on');
              saveBool(item.key, val);
              window.dispatchEvent(new CustomEvent('aice-settings-changed', { detail: { key: item.key, value: val } }));
            });
            sec.appendChild(row);
          });
        }

        this._rightPanel.appendChild(sec);
      });
    }

    // === Prompt 管理面板 ===

    _renderPromptsPanel() {
      this._rightPanel.innerHTML = '';

      // 顶部操作栏
      const header = document.createElement('div');
      header.className = 'aice-settings-prompt-header';

      const title = document.createElement('span');
      title.className = 'aice-settings-prompt-title';
      title.textContent = `已添加 ${this._prompts.length} 个 Prompt`;

      const addBtn = document.createElement('button');
      addBtn.className = 'aice-settings-prompt-add-btn';
      addBtn.innerHTML = `${ICONS.add} <span>添加 Prompt</span>`;
      addBtn.addEventListener('click', () => this._showAddPromptModal());

      header.appendChild(title);
      header.appendChild(addBtn);
      this._rightPanel.appendChild(header);

      // Prompt 列表
      const list = document.createElement('div');
      list.className = 'aice-settings-prompt-list';

      if (this._prompts.length === 0) {
        list.innerHTML = '<div class="aice-settings-prompt-empty">暂无 Prompt，点击上方按钮添加</div>';
      } else {
        this._prompts.forEach(p => {
          const item = this._createPromptListItem(p);
          list.appendChild(item);
        });
      }

      this._rightPanel.appendChild(list);
    }

    _createPromptListItem(prompt) {
      const item = document.createElement('div');
      item.className = 'aice-settings-prompt-item';

      // 左侧内容
      const content = document.createElement('div');
      content.className = 'aice-settings-prompt-item-content';

      const titleEl = document.createElement('div');
      titleEl.className = 'aice-settings-prompt-item-title';
      titleEl.textContent = prompt.title || '未命名';

      const tags = (prompt.tags || []).slice(0, 3);
      const tagsHtml = tags.length
        ? `<div class="aice-settings-prompt-item-tags">${tags.map(t => `<span class="aice-settings-prompt-item-tag">${t}</span>`).join('')}</div>`
        : '';

      content.appendChild(titleEl);
      if (tagsHtml) {
        content.insertAdjacentHTML('beforeend', tagsHtml);
      }

      // 右侧操作
      const actions = document.createElement('div');
      actions.className = 'aice-settings-prompt-item-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'aice-settings-prompt-item-btn';
      editBtn.innerHTML = ICONS.edit;
      editBtn.title = '编辑';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showEditPromptModal(prompt);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'aice-settings-prompt-item-btn aice-settings-prompt-item-btn-danger';
      deleteBtn.innerHTML = ICONS.trash;
      deleteBtn.title = '删除';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showDeleteConfirm(prompt);
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      item.appendChild(content);
      item.appendChild(actions);

      // 点击整行插入到对话框
      item.addEventListener('click', () => {
        this._insertPromptToChat(prompt);
      });

      return item;
    }

    _insertPromptToChat(prompt) {
      if (!prompt.content) return;

      const inputSelectors = [
        '#prompt-textarea',
        'textarea[placeholder*="消息"]',
        'textarea[placeholder*="Message"]',
        '[contenteditable="true"][role="textbox"]',
        'textarea'
      ];

      let inputEl = null;
      for (const sel of inputSelectors) {
        const el = document.querySelector(sel);
        if (el && (el.tagName === 'TEXTAREA' || el.getAttribute('contenteditable') === 'true')) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 20) {
            inputEl = el;
            break;
          }
        }
      }

      if (inputEl) {
        // 获取原有内容
        let existingContent = '';
        if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
          existingContent = inputEl.value || '';
        } else {
          existingContent = inputEl.textContent || '';
        }

        // 构建新内容
        let newContent = prompt.content;
        if (existingContent.trim()) {
          newContent = prompt.content + '\n\n' + existingContent;
        }

        inputEl.focus();
        if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
          inputEl.value = newContent;
        } else {
          inputEl.textContent = newContent;
        }
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        navigator.clipboard.writeText(prompt.content).catch(() => {});
      }
    }

    // === 添加/编辑 Prompt 弹窗 ===

    _showAddPromptModal() {
      this._showPromptModal(null);
    }

    _showEditPromptModal(prompt) {
      this._showPromptModal(prompt);
    }

    _showPromptModal(existingPrompt) {
      const isEdit = !!existingPrompt;

      // 创建浮层（无遮罩）
      const modal = document.createElement('div');
      modal.className = 'aice-add-prompt-float';

      const card = document.createElement('div');
      card.className = 'aice-add-prompt-card';

      // 顶栏（可拖动）
      const topBar = document.createElement('div');
      topBar.className = 'aice-add-prompt-topbar';
      topBar.style.cursor = 'move';
      const topTitle = document.createElement('div');
      topTitle.className = 'aice-add-prompt-topbar-title';
      topTitle.textContent = isEdit ? '编辑 Prompt' : '添加 Prompt';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'aice-add-prompt-close';
      closeBtn.innerHTML = ICONS.close;
      // close handler will be set after cleanup is defined
      topBar.appendChild(topTitle);
      topBar.appendChild(closeBtn);
      card.appendChild(topBar);

      // 拖动功能 - 通过修改 modal 的 justify-content/align-items 来移动
      let isDragging = false;
      let dragOffsetX = 0;
      let dragOffsetY = 0;

      const onMouseDown = (e) => {
        if (e.target.closest('.aice-add-prompt-close')) return;
        isDragging = true;
        const rect = card.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        // 切换为精确像素定位
        modal.style.display = 'block';
        modal.style.justifyContent = 'unset';
        modal.style.alignItems = 'unset';
        card.style.position = 'fixed';
        card.style.left = rect.left + 'px';
        card.style.top = rect.top + 'px';
        card.style.margin = '0';
        e.preventDefault();
        document.body.style.userSelect = 'none';
      };

      const onMouseMove = (e) => {
        if (!isDragging) return;
        const x = e.clientX - dragOffsetX;
        const y = e.clientY - dragOffsetY;
        card.style.left = Math.max(0, Math.min(x, window.innerWidth - card.offsetWidth)) + 'px';
        card.style.top = Math.max(0, Math.min(y, window.innerHeight - card.offsetHeight)) + 'px';
      };

      const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        document.body.style.userSelect = '';
      };

      topBar.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      // 表单主体
      const body = document.createElement('div');
      body.className = 'aice-add-prompt-body';

      // 名称输入
      const nameGroup = this._createFormGroup('Prompt 名称', 'text', '例如：代码审查助手', true);
      const nameInput = nameGroup.querySelector('input');
      if (existingPrompt?.title) nameInput.value = existingPrompt.title;
      body.appendChild(nameGroup);

      // 内容输入
      const contentGroup = this._createFormGroup('Prompt 内容', 'textarea', '输入 Prompt 的具体内容...', true);
      const contentInput = contentGroup.querySelector('textarea');
      if (existingPrompt?.content) contentInput.value = existingPrompt.content;
      body.appendChild(contentGroup);

      // 标签输入
      const tagGroup = this._createTagGroup(existingPrompt?.tags || []);
      const tagInput = tagGroup.querySelector('.aice-add-prompt-tag-input');
      const tagList = tagGroup.querySelector('.aice-add-prompt-tag-list');
      let tags = [...(existingPrompt?.tags || [])];
      body.appendChild(tagGroup);

      // 标签输入事件
      tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const text = tagInput.value.trim();
          if (text && !tags.includes(text) && tags.length < 5) {
            tags.push(text);
            renderTags();
          }
          tagInput.value = '';
        } else if (e.key === 'Backspace' && tagInput.value === '' && tags.length > 0) {
          tags.pop();
          renderTags();
        }
      });

      const renderTags = () => {
        tagList.innerHTML = tags.map((t, i) =>
          `<span class="aice-add-prompt-tag"><span class="aice-add-prompt-tag-text">${t}</span><button class="aice-add-prompt-tag-remove" data-index="${i}">&times;</button></span>`
        ).join('');
      };
      renderTags();

      tagList.addEventListener('click', (e) => {
        const btn = e.target.closest('.aice-add-prompt-tag-remove');
        if (btn) {
          const idx = parseInt(btn.getAttribute('data-index'));
          tags.splice(idx, 1);
          renderTags();
        }
      });

      card.appendChild(body);

      // 底部按钮
      const footer = document.createElement('div');
      footer.className = 'aice-add-prompt-footer';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'aice-add-prompt-btn aice-add-prompt-btn-cancel';
      cancelBtn.textContent = '取消';
      cancelBtn.addEventListener('click', () => modal.remove());

      const submitBtn = document.createElement('button');
      submitBtn.className = 'aice-add-prompt-btn aice-add-prompt-btn-submit';
      submitBtn.textContent = isEdit ? '保存' : '添加';

      const updateSubmitBtn = () => {
        const name = nameInput.value.trim();
        const content = contentInput.value.trim();
        submitBtn.disabled = !name || !content;
        submitBtn.classList.toggle('aice-add-prompt-btn-disabled', !name || !content);
      };

      nameInput.addEventListener('input', updateSubmitBtn);
      contentInput.addEventListener('input', updateSubmitBtn);
      updateSubmitBtn();

      submitBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        const content = contentInput.value.trim();
        if (!name || !content) return;

        const data = {
          ...(existingPrompt || {}),
          title: name,
          content: content,
          tags: [...tags],
          updatedAt: Date.now()
        };

        if (!existingPrompt) {
          data.id = 'prompt_' + generateId();
          data.createdAt = Date.now();
        }

        await this._savePrompt(data);
        modal.remove();
        this._refreshContent();

        // 刷新 Prompt 仓库面板
        if (window._promptRepoInstance) {
          window._promptRepoInstance.refresh();
        }
      });

      footer.appendChild(cancelBtn);
      footer.appendChild(submitBtn);
      card.appendChild(footer);

      modal.appendChild(card);

      // 清理函数
      const cleanup = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('keydown', onEsc);
      };

      // 覆盖关闭按钮事件
      closeBtn.removeEventListener('click', closeBtn._handler);
      closeBtn._handler = () => { cleanup(); modal.remove(); };
      closeBtn.addEventListener('click', closeBtn._handler);

      // 插入到设置面板上方
      if (this.card) {
        this.card.parentNode.insertBefore(modal, this.card.nextSibling);
      } else {
        document.body.appendChild(modal);
      }

      // ESC 关闭
      const onEsc = (e) => {
        if (e.key === 'Escape') {
          cleanup();
          modal.remove();
        }
      };
      document.addEventListener('keydown', onEsc);

      // 聚焦名称输入框
      setTimeout(() => nameInput.focus(), 100);
    }

    _createFormGroup(labelText, type, placeholder, required) {
      const group = document.createElement('div');
      group.className = 'aice-add-prompt-form-group';

      const label = document.createElement('label');
      label.className = 'aice-add-prompt-label';
      label.textContent = labelText;
      if (required) {
        const star = document.createElement('span');
        star.className = 'aice-add-prompt-required';
        star.textContent = ' *';
        label.appendChild(star);
      }
      group.appendChild(label);

      if (type === 'textarea') {
        const textarea = document.createElement('textarea');
        textarea.className = 'aice-add-prompt-textarea';
        textarea.placeholder = placeholder;
        textarea.rows = 5;
        group.appendChild(textarea);
      } else {
        const input = document.createElement('input');
        input.className = 'aice-add-prompt-input';
        input.type = type;
        input.placeholder = placeholder;
        group.appendChild(input);
      }

      return group;
    }

    _createTagGroup(existingTags) {
      const group = document.createElement('div');
      group.className = 'aice-add-prompt-form-group';

      const label = document.createElement('label');
      label.className = 'aice-add-prompt-label';
      label.textContent = '标签';
      group.appendChild(label);

      const tagContainer = document.createElement('div');
      tagContainer.className = 'aice-add-prompt-tag-container';

      const tagList = document.createElement('div');
      tagList.className = 'aice-add-prompt-tag-list';

      const tagInput = document.createElement('input');
      tagInput.className = 'aice-add-prompt-tag-input';
      tagInput.type = 'text';
      tagInput.placeholder = '添加标签，按回车确认';

      tagContainer.appendChild(tagList);
      tagContainer.appendChild(tagInput);
      group.appendChild(tagContainer);

      return group;
    }

    // === 删除确认面板 ===

    _showDeleteConfirm(prompt) {
      const confirm = document.createElement('div');
      confirm.className = 'aice-delete-confirm-float';

      const card = document.createElement('div');
      card.className = 'aice-delete-confirm-card';

      const message = document.createElement('div');
      message.className = 'aice-delete-confirm-message';
      message.textContent = '确定删除此 Prompt 吗？';

      const buttons = document.createElement('div');
      buttons.className = 'aice-delete-confirm-buttons';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'aice-delete-confirm-btn aice-delete-confirm-btn-cancel';
      cancelBtn.textContent = '取消';
      cancelBtn.addEventListener('click', () => confirm.remove());

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'aice-delete-confirm-btn aice-delete-confirm-btn-danger';
      deleteBtn.textContent = '确定';
      deleteBtn.addEventListener('click', async () => {
        await this._deletePrompt(prompt.id);
        confirm.remove();
        this._refreshContent();

        // 刷新 Prompt 仓库面板
        if (window._promptRepoInstance) {
          window._promptRepoInstance.refresh();
        }
      });

      buttons.appendChild(cancelBtn);
      buttons.appendChild(deleteBtn);
      card.appendChild(message);
      card.appendChild(buttons);
      confirm.appendChild(card);

      // 插入到设置面板上方
      if (this.card) {
        this.card.parentNode.insertBefore(confirm, this.card.nextSibling);
      } else {
        document.body.appendChild(confirm);
      }

      // ESC 关闭
      const onEsc = (e) => {
        if (e.key === 'Escape') {
          confirm.remove();
          document.removeEventListener('keydown', onEsc);
        }
      };
      document.addEventListener('keydown', onEsc);
    }

    destroy() {
      if (this._cleanupDrag) this._cleanupDrag();
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      if (this._escHandler) {
        document.removeEventListener('keydown', this._escHandler);
      }
      this.overlay = null;
      this.card = null;
    }
  }

  ns.SettingsPanel = SettingsPanel;

})(window.AIChatEnhancer);
