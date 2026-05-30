// AI Chat Enhancer - 文件夹（嵌入左侧边栏，支持拖拽）
window.AIChatEnhancer = window.AIChatEnhancer || {};

(function(ns) {
  'use strict';

  const { getPref, setPref } = ns.storage;
  const { detectPlatform, getConversationId, getSelector } = ns.platforms;
  const { generateId } = ns.utils;

  const FOLDERS_KEY = 'folders_data';

  function folderId() { return 'fld_' + folderId(); }
  function itemId() { return 'fit_' + folderId(); }

  class FolderPanel {
    constructor() {
      this.platform = null;
      this.conversationId = null;
      this.folders = [];
      this.activeFolderId = null;
      this._renamingId = null;
      this._ctxTarget = null;
      this._contextMenu = null;
      this._host = null;
      this._sidebarEl = null;
      this._dragPreview = null;

      this._onDocClick = this._onDocClick.bind(this);
      this._onStarChanged = this._onStarChanged.bind(this);
    }

    async init() {
      this.platform = detectPlatform();
      if (this.platform === 'unknown') return;
      this.conversationId = getConversationId(this.platform) || location.href;
      await this._loadFolders();
      this._createContextMenu();
      this._createDragPreview();
      this._injectSidebar();
      window.addEventListener('aice-star-changed', this._onStarChanged);
      document.addEventListener('click', this._onDocClick);
    }

    destroy() {
      window.removeEventListener('aice-star-changed', this._onStarChanged);
      document.removeEventListener('click', this._onDocClick);
      if (this._contextMenu?.parentNode) this._contextMenu.parentNode.removeChild(this._contextMenu);
      if (this._dragPreview?.parentNode) this._dragPreview.parentNode.removeChild(this._dragPreview);
      if (this._host?.parentNode) this._host.parentNode.removeChild(this._host);
      this._contextMenu = null;
      this._dragPreview = null;
      this._host = null;
    }

    refresh() {
      this.conversationId = getConversationId(this.platform) || location.href;
      this._injectSidebar();
    }

    // === 数据 ===

    async _loadFolders() {
      try {
        this.folders = await getPref(FOLDERS_KEY, []);
        if (!Array.isArray(this.folders) || this.folders.length === 0) {
          this.folders = [{ id: folderId(), name: '我的收藏', items: [], createdAt: Date.now() }];
          await this._saveFolders();
        }
      } catch (e) {
        this.folders = [{ id: folderId(), name: '我的收藏', items: [], createdAt: Date.now() }];
      }
    }

    async _saveFolders() { await setPref(FOLDERS_KEY, this.folders); }

    _getDefaultFolder() { return this.folders[0] || null; }

    // === 星标联动 ===

    _onStarChanged(e) {
      const { index, starred, turn } = e.detail || {};
      if (starred) { this._addToDefaultFolder(index, turn); }
      else { this._removeByTurnIndex(index); }
    }

    async _addToDefaultFolder(turnIndex, turn) {
      const folder = this._getDefaultFolder();
      if (!folder) return;
      const exists = folder.items.some(it =>
        it.platform === this.platform && it.conversationId === this.conversationId && it.turnIndex === turnIndex
      );
      if (exists) return;
      folder.items.push({
        id: itemId(),
        platform: this.platform,
        conversationId: this.conversationId,
        turnIndex,
        text: (turn?.text || turn?.fullText || '').substring(0, 60),
        fullText: turn?.fullText || turn?.text || '',
        starredAt: Date.now()
      });
      await this._saveFolders();
      this._render();
    }

    async _removeByTurnIndex(turnIndex) {
      let changed = false;
      for (const folder of this.folders) {
        const idx = folder.items.findIndex(it =>
          it.platform === this.platform && it.conversationId === this.conversationId && it.turnIndex === turnIndex
        );
        if (idx >= 0) { folder.items.splice(idx, 1); changed = true; }
      }
      if (changed) { await this._saveFolders(); this._render(); }
    }

    // === 找到左侧边栏 ===

    _findSidebar() {
      // 1. 平台特定选择器
      const sel = getSelector('leftSidebar', this.platform);
      if (sel) {
        const candidates = [];
        try {
          const list = document.querySelectorAll(sel);
          for (const el of list) {
            const rect = el.getBoundingClientRect();
            // 左侧边栏特征：位于页面左侧，有一定高度
            if (rect.left < window.innerWidth * 0.4 && rect.height > 200) {
              candidates.push(el);
            }
          }
        } catch (e) {}
        // 返回最小的（通常是最内层的）
        if (candidates.length > 0) {
          candidates.sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width);
          return candidates[0];
        }
      }
      // 2. 通用回退：找左侧的 nav 或 sidebar
      const generic = document.querySelectorAll('nav, [class*="sidebar"], [class*="drawer"], [class*="side-panel"], [class*="side"]');
      for (const el of generic) {
        const rect = el.getBoundingClientRect();
        if (rect.left < window.innerWidth * 0.4 && rect.height > 200 && rect.width > 80 && rect.width < 500) {
          return el;
        }
      }
      return null;
    }

    _injectSidebar() {
      const sidebar = this._findSidebar();
      if (!sidebar) {
        // 没有侧边栏则定期重试
        if (!this._retryTimer) {
          this._retryTimer = setTimeout(() => { this._retryTimer = null; this._injectSidebar(); }, 2000);
        }
        return;
      }
      this._sidebarEl = sidebar;

      // 移除旧 host
      if (this._host?.parentNode) this._host.parentNode.removeChild(this._host);

      // 创建 host
      this._host = document.createElement('div');
      this._host.className = 'aice-folder-sidebar-host';

      // 插入到侧边栏顶部（对话列表上方）
      const firstChild = sidebar.firstElementChild;
      if (firstChild) {
        sidebar.insertBefore(this._host, firstChild);
      } else {
        sidebar.appendChild(this._host);
      }

      this._render();
    }

    // === 拖拽预览 ===

    _createDragPreview() {
      this._dragPreview = document.createElement('div');
      this._dragPreview.className = 'aice-folder-drag-preview';
      this._dragPreview.style.display = 'none';
      document.body.appendChild(this._dragPreview);
    }

    // === 右键菜单 ===

    _createContextMenu() {
      this._contextMenu = document.createElement('div');
      this._contextMenu.className = 'aice-folder-ctx-menu';
      document.body.appendChild(this._contextMenu);
    }

    _showContextMenu(e, items) {
      const menu = this._contextMenu;
      menu.innerHTML = '';
      items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'aice-folder-ctx-item' + (item.danger ? ' aice-folder-ctx-danger' : '');
        el.textContent = item.label;
        el.addEventListener('click', ev => { ev.stopPropagation(); this._handleContextAction(item); this._hideContextMenu(); });
        menu.appendChild(el);
      });
      menu.style.display = 'none';
      requestAnimationFrame(() => {
        menu.style.display = '';
        const mw = menu.offsetWidth || 160, mh = menu.offsetHeight || 100;
        let left = e.clientX, top = e.clientY;
        if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
        if (top + mh > window.innerHeight - 8) top = window.innerHeight - mh - 8;
        if (left < 4) left = 4;
        menu.style.left = left + 'px'; menu.style.top = top + 'px';
      });
    }

    _hideContextMenu() { if (this._contextMenu) this._contextMenu.style.display = 'none'; this._ctxTarget = null; }

    _handleContextAction(actionItem) {
      if (!this._ctxTarget) return;
      const { type, folder, item } = this._ctxTarget;
      if (actionItem.action === 'rename' && type === 'folder') {
        this._renamingId = folder.id; this._render();
      } else if (actionItem.action === 'delete' && type === 'folder') {
        this._deleteFolder(folder);
      } else if (actionItem.action === 'remove-item' && type === 'item') {
        const idx = folder.items.indexOf(item);
        if (idx >= 0) { folder.items.splice(idx, 1); this._saveFolders().then(() => this._render()); }
      } else if (actionItem.action && actionItem.action.startsWith('move-to-')) {
        const targetId = actionItem.action.replace('move-to-', '');
        const targetFolder = this.folders.find(f => f.id === targetId);
        if (targetFolder && type === 'item') this._moveItem(item, folder, targetFolder);
      }
    }

    async _deleteFolder(folder) {
      if (!confirm('确定删除文件夹「' + folder.name + '」？\n其中的对话将丢失。')) return;
      const idx = this.folders.indexOf(folder);
      if (idx >= 0) {
        this.folders.splice(idx, 1);
        if (this.folders.length === 0) {
          this.folders.push({ id: folderId(), name: '我的收藏', items: [], createdAt: Date.now() });
        }
        await this._saveFolders();
        if (this.activeFolderId === folder.id) this.activeFolderId = null;
        this._render();
      }
    }

    async _moveItem(item, fromFolder, toFolder) {
      const idx = fromFolder.items.indexOf(item);
      if (idx >= 0) fromFolder.items.splice(idx, 1);
      toFolder.items.push(item);
      await this._saveFolders();
      this._render();
    }

    // === 渲染 ===

    _render() {
      if (!this._host) return;
      this._host.innerHTML = '';

      const section = document.createElement('div');
      section.className = 'aice-folder-sidebar-section';

      // 标题行
      const header = document.createElement('div');
      header.className = 'aice-folder-sidebar-header';

      const title = document.createElement('span');
      title.className = 'aice-folder-sidebar-title';
      title.textContent = '收藏夹';
      header.appendChild(title);

      const addBtn = document.createElement('button');
      addBtn.className = 'aice-folder-sidebar-add';
      addBtn.textContent = '+';
      addBtn.title = '新建文件夹';
      addBtn.addEventListener('click', e => { e.stopPropagation(); this._createFolder(); });
      header.appendChild(addBtn);

      section.appendChild(header);

      // 文件夹列表
      this.folders.forEach(folder => {
        const isOpen = folder.id === this.activeFolderId;

        const folderRow = document.createElement('div');
        folderRow.className = 'aice-folder-sidebar-folder';
        folderRow.setAttribute('data-folder-id', folder.id);

        const icon = document.createElement('span');
        icon.className = 'aice-folder-sidebar-icon';
        icon.textContent = isOpen ? '\u{1F4C2}' : '\u{1F4C1}';
        folderRow.appendChild(icon);

        if (this._renamingId === folder.id) {
          const input = document.createElement('input');
          input.className = 'aice-folder-rename-input';
          input.value = folder.name;
          input.style.cssText = 'flex:1;min-width:0;padding:2px 6px;border:1px solid rgba(0,113,227,0.4);border-radius:5px;font-size:11px;font-family:inherit;outline:none;box-shadow:0 0 0 3px rgba(0,113,227,0.08);';
          input.addEventListener('blur', () => this._finishRename(folder, input.value));
          input.addEventListener('keydown', e => {
            if (e.key === 'Enter') this._finishRename(folder, input.value);
            if (e.key === 'Escape') { this._renamingId = null; this._render(); }
          });
          folderRow.appendChild(input);
          setTimeout(() => input.focus(), 50);
        } else {
          const nameEl = document.createElement('span');
          nameEl.className = 'aice-folder-sidebar-name';
          nameEl.textContent = folder.name;
          nameEl.addEventListener('dblclick', e => {
            e.stopPropagation();
            this._renamingId = folder.id;
            this._render();
          });
          folderRow.appendChild(nameEl);
        }

        const count = document.createElement('span');
        count.className = 'aice-folder-sidebar-count';
        count.textContent = folder.items.length;
        folderRow.appendChild(count);

        // 点击展开/收起
        folderRow.addEventListener('click', e => {
          e.stopPropagation();
          this.activeFolderId = isOpen ? null : folder.id;
          this._render();
        });

        // 右键菜单
        folderRow.addEventListener('contextmenu', e => {
          e.preventDefault(); e.stopPropagation();
          this._ctxTarget = { type: 'folder', folder };
          this._showContextMenu(e, [
            { label: '重命名', action: 'rename' },
            { label: '删除文件夹', action: 'delete', danger: true }
          ]);
        });

        // 拖放目标
        folderRow.addEventListener('dragover', e => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          folderRow.classList.add('aice-folder-drag-over');
        });
        folderRow.addEventListener('dragleave', () => {
          folderRow.classList.remove('aice-folder-drag-over');
        });
        folderRow.addEventListener('drop', e => {
          e.preventDefault();
          folderRow.classList.remove('aice-folder-drag-over');
          const raw = e.dataTransfer.getData('application/aice-turn');
          if (raw) {
            try {
              const data = JSON.parse(raw);
              this._addDroppedTurn(folder, data);
            } catch (err) {}
          }
        });

        section.appendChild(folderRow);

        // 展开的项
        if (isOpen && folder.items.length > 0) {
          const itemsContainer = document.createElement('div');
          itemsContainer.className = 'aice-folder-sidebar-items';

          folder.items.forEach(item => {
            const itemRow = document.createElement('div');
            itemRow.className = 'aice-folder-sidebar-item';
            itemRow.title = item.fullText || item.text;

            const itemIcon = document.createElement('span');
            itemIcon.className = 'aice-folder-sidebar-item-icon';
            itemIcon.textContent = '\u{1F4AC}';
            itemRow.appendChild(itemIcon);

            const itemText = document.createElement('span');
            itemText.className = 'aice-folder-sidebar-item-text';
            itemText.textContent = item.text || '收藏的对话';
            itemRow.appendChild(itemText);

            itemRow.addEventListener('click', e => {
              e.stopPropagation();
              this._jumpToItem(item);
            });
            itemRow.addEventListener('contextmenu', e => {
              e.preventDefault(); e.stopPropagation();
              this._ctxTarget = { type: 'item', folder, item };
              const moveTargets = this.folders.filter(f => f.id !== folder.id);
              const menuItems = [{ label: '从本文件夹移除', action: 'remove-item', danger: true }];
              moveTargets.forEach(f => {
                menuItems.unshift({ label: '移到 \u{1F4C1} ' + f.name, action: 'move-to-' + f.id });
              });
              this._showContextMenu(e, menuItems);
            });

            itemsContainer.appendChild(itemRow);
          });

          section.appendChild(itemsContainer);
        }
      });

      this._host.appendChild(section);
    }

    async _addDroppedTurn(folder, data) {
      const exists = folder.items.some(it =>
        it.platform === (data.platform || this.platform) &&
        it.conversationId === this.conversationId &&
        it.turnIndex === data.index
      );
      if (exists) return;
      folder.items.push({
        id: itemId(),
        platform: data.platform || this.platform,
        conversationId: this.conversationId,
        turnIndex: data.index,
        text: (data.text || '').substring(0, 60),
        fullText: data.fullText || data.text || '',
        starredAt: Date.now()
      });
      await this._saveFolders();
      this._render();
    }

    async _finishRename(folder, newName) {
      this._renamingId = null;
      const trimmed = newName.trim();
      if (trimmed && trimmed !== folder.name) { folder.name = trimmed; await this._saveFolders(); }
      this._render();
    }

    async _createFolder() {
      const name = prompt('输入文件夹名称：');
      if (!name || !name.trim()) return;
      this.folders.push({ id: folderId(), name: name.trim(), items: [], createdAt: Date.now() });
      await this._saveFolders();
      this.activeFolderId = this.folders[this.folders.length - 1].id;
      this._render();
    }

    _jumpToItem(item) {
      const currentConvId = getConversationId(this.platform) || location.href;
      if (item.conversationId === currentConvId || item.conversationId === location.href) {
        const turnSelector = ns.platforms.getSelector('turns', this.platform);
        if (turnSelector) {
          const turns = document.querySelectorAll(turnSelector);
          const userTurns = [];
          turns.forEach(el => {
            if (ns.platforms.isUserMessage(el, this.platform) && !ns.platforms.isAssistantMessage(el, this.platform)) {
              userTurns.push(el);
            }
          });
          if (item.turnIndex < userTurns.length) {
            const target = userTurns[item.turnIndex];
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const isDark = matchMedia('(prefers-color-scheme: dark)').matches;
            target.style.transition = 'filter 0.6s ease-out';
            target.style.filter = isDark ? 'brightness(1.18)' : 'brightness(0.92)';
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                target.style.filter = 'brightness(1)';
              });
            });
            setTimeout(() => {
              target.style.filter = '';
              target.style.transition = '';
            }, 650);
          }
        }
      }
    }

    _onDocClick(e) {
      if (this._contextMenu && !this._contextMenu.contains(e.target)) this._hideContextMenu();
    }
  }

  ns.FolderPanel = FolderPanel;

})(window.AIChatEnhancer);
