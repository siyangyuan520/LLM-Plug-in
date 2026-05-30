// AI Chat Enhancer - 添加 Prompt 浮动面板
window.AIChatEnhancer = window.AIChatEnhancer || {};

(function(ns) {
  'use strict';

  const { generateId } = ns.utils;
  const { prompts } = ns.storage;

  class AddPromptModal {
    constructor() {
      this._overlay = null;
      this._isOpen = false;
      this._tags = [];
      this._onSave = null;

      // Bound handlers
      this._onKeyDown = this._onKeyDown.bind(this);
      this._onOverlayClick = this._onOverlayClick.bind(this);
    }

    /**
     * 打开添加 Prompt 面板
     * @param {Function} onSave - 保存回调，接收 prompt 数据对象
     */
    show(onSave) {
      if (this._isOpen) return;
      this._isOpen = true;
      this._onSave = onSave;
      this._tags = [];
      this._create();
    }

    hide() {
      if (!this._isOpen) return;
      this._isOpen = false;
      this._destroy();
    }

    // === DOM 创建 ===

    _create() {
      // 遮罩层
      this._overlay = document.createElement('div');
      this._overlay.className = 'aice-add-prompt-overlay';

      // 卡片
      const card = document.createElement('div');
      card.className = 'aice-add-prompt-card';

      // 顶栏
      const topBar = document.createElement('div');
      topBar.className = 'aice-add-prompt-topbar';
      const topTitle = document.createElement('div');
      topTitle.className = 'aice-add-prompt-topbar-title';
      topTitle.textContent = '添加 Prompt';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'aice-add-prompt-close';
      closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      closeBtn.addEventListener('click', () => this.hide());
      topBar.appendChild(topTitle);
      topBar.appendChild(closeBtn);
      card.appendChild(topBar);

      // 表单主体
      const body = document.createElement('div');
      body.className = 'aice-add-prompt-body';

      // 1. Prompt 名称
      const nameGroup = this._createFormGroup('Prompt 名称', 'text', '例如：代码审查助手', true);
      this._nameInput = nameGroup.querySelector('input');
      body.appendChild(nameGroup);

      // 2. Prompt 内容
      const contentGroup = this._createFormGroup('Prompt 内容', 'textarea', '输入 Prompt 的具体内容...', true);
      this._contentInput = contentGroup.querySelector('textarea');
      body.appendChild(contentGroup);

      // 3. 标签
      const tagGroup = this._createTagGroup();
      this._tagInput = tagGroup.querySelector('.aice-add-prompt-tag-input');
      this._tagList = tagGroup.querySelector('.aice-add-prompt-tag-list');
      body.appendChild(tagGroup);

      card.appendChild(body);

      // 底部按钮
      const footer = document.createElement('div');
      footer.className = 'aice-add-prompt-footer';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'aice-add-prompt-btn aice-add-prompt-btn-cancel';
      cancelBtn.textContent = '取消';
      cancelBtn.addEventListener('click', () => this.hide());

      this._submitBtn = document.createElement('button');
      this._submitBtn.className = 'aice-add-prompt-btn aice-add-prompt-btn-submit';
      this._submitBtn.textContent = '添加';
      this._submitBtn.addEventListener('click', () => this._handleSubmit());

      footer.appendChild(cancelBtn);
      footer.appendChild(this._submitBtn);
      card.appendChild(footer);

      this._overlay.appendChild(card);
      document.body.appendChild(this._overlay);

      // 绑定事件
      document.addEventListener('keydown', this._onKeyDown);
      this._overlay.addEventListener('click', this._onOverlayClick);

      // 聚焦名称输入框
      setTimeout(() => this._nameInput?.focus(), 100);

      // 监听输入变化，更新按钮状态
      this._nameInput?.addEventListener('input', () => this._updateSubmitBtn());
      this._contentInput?.addEventListener('input', () => this._updateSubmitBtn());
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

    _createTagGroup() {
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

      tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this._addTag(tagInput.value.trim());
          tagInput.value = '';
        } else if (e.key === 'Backspace' && tagInput.value === '' && this._tags.length > 0) {
          this._removeTag(this._tags.length - 1);
        }
      });

      tagContainer.appendChild(tagList);
      tagContainer.appendChild(tagInput);
      group.appendChild(tagContainer);

      return group;
    }

    // === 标签操作 ===

    _addTag(text) {
      if (!text || this._tags.includes(text)) return;
      if (this._tags.length >= 5) return; // 最多5个标签

      this._tags.push(text);
      this._renderTags();
    }

    _removeTag(index) {
      this._tags.splice(index, 1);
      this._renderTags();
    }

    _renderTags() {
      if (!this._tagList) return;
      this._tagList.innerHTML = '';

      this._tags.forEach((tag, i) => {
        const tagEl = document.createElement('span');
        tagEl.className = 'aice-add-prompt-tag';

        const text = document.createElement('span');
        text.className = 'aice-add-prompt-tag-text';
        text.textContent = tag;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'aice-add-prompt-tag-remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.addEventListener('click', () => this._removeTag(i));

        tagEl.appendChild(text);
        tagEl.appendChild(removeBtn);
        this._tagList.appendChild(tagEl);
      });
    }

    // === 表单验证 ===

    _updateSubmitBtn() {
      const name = this._nameInput?.value?.trim() || '';
      const content = this._contentInput?.value?.trim() || '';
      const isValid = name.length > 0 && content.length > 0;

      if (this._submitBtn) {
        this._submitBtn.disabled = !isValid;
        this._submitBtn.classList.toggle('aice-add-prompt-btn-disabled', !isValid);
      }
    }

    _validate() {
      const name = this._nameInput?.value?.trim() || '';
      const content = this._contentInput?.value?.trim() || '';

      if (!name) {
        this._nameInput?.focus();
        return false;
      }
      if (!content) {
        this._contentInput?.focus();
        return false;
      }

      return true;
    }

    // === 提交 ===

    async _handleSubmit() {
      if (!this._validate()) return;

      const data = {
        id: 'prompt_' + generateId(),
        title: this._nameInput.value.trim(),
        content: this._contentInput.value.trim(),
        tags: [...this._tags],
        category: '',
        starred: false,
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // 保存到 storage
      await prompts.put(data);

      // 调用回调
      if (typeof this._onSave === 'function') {
        this._onSave(data);
      }

      this.hide();
    }

    // === 事件处理 ===

    _onKeyDown(e) {
      if (e.key === 'Escape') {
        this.hide();
      }
    }

    _onOverlayClick(e) {
      // 点击遮罩关闭（排除卡片区域）
      if (e.target === this._overlay) {
        this.hide();
      }
    }

    // === 销毁 ===

    _destroy() {
      document.removeEventListener('keydown', this._onKeyDown);
      if (this._overlay) {
        this._overlay.removeEventListener('click', this._onOverlayClick);
        if (this._overlay.parentNode) {
          this._overlay.parentNode.removeChild(this._overlay);
        }
      }
      this._overlay = null;
      this._nameInput = null;
      this._contentInput = null;
      this._tagInput = null;
      this._tagList = null;
      this._submitBtn = null;
      this._onSave = null;
    }
  }

  ns.AddPromptModal = AddPromptModal;

})(window.AIChatEnhancer);
