// AI Chat Enhancer - 存储数据库（Store-based architecture）
window.AIChatEnhancer = window.AIChatEnhancer || {};

(function(ns) {
  'use strict';

  const browserAPI = (typeof browser !== 'undefined' ? browser : chrome);

  // 获取存储适配器（browser.storage.local / localStorage fallback）
  function getStorageAdapter() {
    if (browserAPI && browserAPI.storage && browserAPI.storage.local) {
      return browserAPI.storage.local;
    }
    return {
      get(keys) {
        return new Promise(resolve => {
          const result = {};
          const k = Array.isArray(keys) ? keys : (keys === null ? Object.keys(localStorage) : [keys]);
          if (keys === null) {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              try { result[key] = JSON.parse(localStorage.getItem(key)); }
              catch (e) { result[key] = localStorage.getItem(key); }
            }
          } else {
            k.forEach(key => {
              const val = localStorage.getItem(key);
              if (val !== null) {
                try { result[key] = JSON.parse(val); } catch (e) { result[key] = val; }
              }
            });
          }
          resolve(result);
        });
      },
      set(items) {
        return new Promise(resolve => {
          Object.entries(items).forEach(([key, val]) => {
            localStorage.setItem(key, JSON.stringify(val));
          });
          resolve();
        });
      },
      remove(keys) {
        return new Promise(resolve => {
          const k = Array.isArray(keys) ? keys : [keys];
          k.forEach(key => localStorage.removeItem(key));
          resolve();
        });
      }
    };
  }

  const storage = getStorageAdapter();
  const KEY_PREFIX = 'aice';

  function generateId() {
    return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11);
  }

  // === Store 类 ===

  class Store {
    /**
     * @param {string} name - store 名称
     * @param {object} opts
     * @param {boolean} opts.scoped - 是否为会话级存储（按 platform+conversationId 分组）
     */
    constructor(name, opts = {}) {
      this._name = name;
      this._scoped = !!opts.scoped;
      this._prefix = `${KEY_PREFIX}:${name}`;
    }

    _key(id) {
      return `${this._prefix}:${id}`;
    }

    _conversationPrefix(platform, conversationId) {
      return `${this._prefix}:${platform}:${conversationId}`;
    }

    _isMatch(key) {
      return key.startsWith(this._prefix + ':');
    }

    // === CRUD ===

    async getAll() {
      const all = await storage.get(null);
      const items = [];
      for (const [key, value] of Object.entries(all)) {
        if (this._isMatch(key)) items.push(value);
      }
      return items;
    }

    async get(id) {
      const result = await storage.get(this._key(id));
      return result[this._key(id)] || null;
    }

    async put(item) {
      const id = item.id || generateId();
      const now = Date.now();
      const record = {
        ...item,
        id,
        createdAt: item.createdAt || now,
        updatedAt: now
      };
      await storage.set({ [this._key(id)]: record });
      return record;
    }

    async update(id, updates) {
      const existing = await this.get(id);
      if (!existing) return null;
      const record = { ...existing, ...updates, id, updatedAt: Date.now() };
      await storage.set({ [this._key(id)]: record });
      return record;
    }

    async delete(id) {
      await storage.remove(this._key(id));
    }

    async clear() {
      const all = await storage.get(null);
      const keys = Object.keys(all).filter(k => this._isMatch(k));
      if (keys.length) await storage.remove(keys);
    }

    async query(filterFn) {
      const all = await this.getAll();
      return all.filter(filterFn);
    }

    async count() {
      const all = await storage.get(null);
      return Object.keys(all).filter(k => this._isMatch(k)).length;
    }

    // === 会话级方法（scoped stores） ===

    /**
     * 获取某会话下的所有记录
     */
    async getByConversation(platform, conversationId) {
      if (!this._scoped) return [];
      const prefix = this._conversationPrefix(platform, conversationId);
      const all = await storage.get(null);
      const items = [];
      for (const [key, value] of Object.entries(all)) {
        if (key.startsWith(prefix + ':')) items.push(value);
      }
      return items;
    }

    /**
     * 在会话下创建记录（自动填充 platform + conversationId）
     */
    async putInConversation(platform, conversationId, item) {
      const id = item.id || generateId();
      const now = Date.now();
      const record = {
        ...item,
        id,
        platform,
        conversationId,
        createdAt: item.createdAt || now,
        updatedAt: now
      };
      // 会话级 key: aice:store:platform:convId:id
      const key = `${this._conversationPrefix(platform, conversationId)}:${id}`;
      await storage.set({ [key]: record });
      return record;
    }

    /**
     * 删除某会话下的所有记录
     */
    async clearConversation(platform, conversationId) {
      if (!this._scoped) return;
      const prefix = this._conversationPrefix(platform, conversationId);
      const all = await storage.get(null);
      const keys = Object.keys(all).filter(k => k.startsWith(prefix + ':'));
      if (keys.length) await storage.remove(keys);
    }

    // === 会话（conversations store 专用） ===

    async upsertByConversation(platform, conversationId, data) {
      const existing = (await this.query(
        c => c.platform === platform && c.conversationId === conversationId
      ))[0];
      if (existing) {
        return this.update(existing.id, {
          ...data,
          lastActive: Date.now()
        });
      } else {
        return this.put({
          platform,
          conversationId,
          title: '',
          messageCount: 0,
          lastActive: Date.now(),
          ...data
        });
      }
    }

    // === 批量导出/导入 ===

    async exportAll() {
      const all = await storage.get(null);
      const data = {};
      for (const [key, value] of Object.entries(all)) {
        if (key.startsWith(`${KEY_PREFIX}:`)) {
          data[key] = value;
        }
      }
      return JSON.stringify(data, null, 2);
    }

    async importData(jsonStr) {
      try {
        const data = JSON.parse(jsonStr);
        const filtered = {};
        for (const [key, value] of Object.entries(data)) {
          if (key.startsWith(`${KEY_PREFIX}:`)) {
            filtered[key] = value;
          }
        }
        if (Object.keys(filtered).length) {
          await storage.set(filtered);
        }
        return true;
      } catch (e) {
        return false;
      }
    }

    async clearAll() {
      const all = await storage.get(null);
      const keys = Object.keys(all).filter(k => k.startsWith(`${KEY_PREFIX}:`));
      if (keys.length) await storage.remove(keys);
    }
  }

  // === 6个 Stores ===

  /**
   * conversations — 对话记录
   * { id, platform, conversationId, title, messageCount, lastActive, createdAt, updatedAt }
   */
  const conversations = new Store('conv');

  /**
   * annotations — 文本标注（会话级）
   * { id, platform, conversationId, turnIndex, text, contextBefore, contextAfter, type, color, timestamp }
   */
  const annotations = new Store('ann', { scoped: true });

  /**
   * bookmarks — 书签（会话级）
   * { id, platform, conversationId, turnIndex, text, note, timestamp }
   */
  const bookmarks = new Store('bkm', { scoped: true });

  /**
   * notes — 笔记（全局）
   * { id, title, content, tags, createdAt, updatedAt }
   */
  const notes = new Store('note');

  /**
   * prompts — 提示词模板（全局）
   * { id, title, content, category, tags, usageCount, createdAt, updatedAt }
   */
  const prompts = new Store('prompt');

  /**
   * inspiration — 灵感速记（全局）
   * { id, content, source, sourceUrl, createdAt }
   */
  const inspiration = new Store('insp');

  /**
   * timeline — 时间轴可见性状态
   */
  const TIMELINE_KEY = `${KEY_PREFIX}:timeline_visible`;

  // === 兼容旧版存储接口（供 annotations.js 等使用） ===

  async function saveAnnotation(data) {
    if (!data.platform || !data.conversationId) return;
    // 检查是否已存在
    const existing = await annotations.getByConversation(data.platform, data.conversationId);
    const dup = existing.find(a => a.id === data.id);
    if (!dup) {
      await annotations.putInConversation(data.platform, data.conversationId, data);
    }
  }

  async function getAnnotations(platform, conversationId) {
    if (!platform || !conversationId) return [];
    return annotations.getByConversation(platform, conversationId);
  }

  async function deleteAnnotation(id, platform, conversationId) {
    if (!platform || !conversationId) return;
    const existing = await annotations.getByConversation(platform, conversationId);
    const target = existing.find(a => a.id === id);
    if (target) {
      const key = `aice:ann:${platform}:${conversationId}:${id}`;
      await storage.remove(key);
    }
  }

  async function clearConversationAnnotations(platform, conversationId) {
    await annotations.clearConversation(platform, conversationId);
  }

  async function getAllAnnotations() {
    return annotations.getAll();
  }

  async function setTimelineVisible(visible) {
    await storage.set({ [TIMELINE_KEY]: visible });
  }

  async function isTimelineVisible() {
    const result = await storage.get(TIMELINE_KEY);
    return result[TIMELINE_KEY] !== false;
  }

  async function exportAllData() {
    const all = await storage.get(null);
    const data = {};
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith(`${KEY_PREFIX}:`)) {
        data[key] = value;
      }
    }
    return JSON.stringify(data, null, 2);
  }

  async function importData(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      const filtered = {};
      for (const [key, value] of Object.entries(data)) {
        if (key.startsWith(`${KEY_PREFIX}:`)) {
          filtered[key] = value;
        }
      }
      if (Object.keys(filtered).length) {
        await storage.set(filtered);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // === 偏好设置（全局 key-value） ===

  const PREFS_KEY_GLOBAL = `${KEY_PREFIX}:prefs`;

  async function getPref(key, defaultValue) {
    try {
      const result = await storage.get(PREFS_KEY_GLOBAL);
      const prefs = result[PREFS_KEY_GLOBAL] || {};
      return prefs[key] !== undefined ? prefs[key] : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }

  async function setPref(key, value) {
    try {
      const result = await storage.get(PREFS_KEY_GLOBAL);
      const prefs = result[PREFS_KEY_GLOBAL] || {};
      prefs[key] = value;
      await storage.set({ [PREFS_KEY_GLOBAL]: prefs });
    } catch (e) { /* ignore */ }
  }

  // === 暴露接口 ===

  ns.storage = {
    // 6 Stores
    conversations,
    annotations,
    bookmarks,
    notes,
    prompts,
    inspiration,
    // 偏好设置
    getPref,
    setPref,
    // 兼容旧接口
    saveAnnotation,
    getAnnotations,
    deleteAnnotation,
    clearConversationAnnotations,
    getAllAnnotations,
    setTimelineVisible,
    isTimelineVisible,
    exportAllData,
    importData
  };

})(window.AIChatEnhancer);
