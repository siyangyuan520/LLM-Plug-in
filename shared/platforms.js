// AI Chat Enhancer - 平台检测与选择器
window.AIChatEnhancer = window.AIChatEnhancer || {};

(function(ns) {
  'use strict';

  const PLATFORMS = {
    chatgpt: {
      name: 'ChatGPT',
      hostPattern: /chatgpt\.com|chat\.openai\.com/,
      selectors: {
        conversationArea: 'main, [role="main"]',
        turns: 'article[data-testid^="conversation-turn-"], [data-testid^="conversation-turn-"]',
        userMessage: '[data-message-author-role="user"]',
        assistantMessage: '[data-message-author-role="assistant"]',
        messageContent: '[data-message-content], .markdown, .whitespace-pre-wrap',
        inputArea: '#prompt-textarea, [contenteditable="true"]',
        sendButton: 'button[data-testid="send-button"]',
        turnContainer: 'article[data-testid^="conversation-turn-"]',
        leftSidebar: 'nav[aria-label="Chat history"], nav'
      },
      getConversationId() {
        const m = location.pathname.match(/\/c\/([a-zA-Z0-9_-]+)/);
        return m ? m[1] : null;
      }
    },

    gemini: {
      name: 'Gemini',
      hostPattern: /gemini\.google\.com/,
      selectors: {
        conversationArea: 'main, [role="main"], .conversation-container',
        turns: 'message-content, [data-turn], [class*="turn-container"]',
        userMessage: '[data-role="user"], [class*="user-query"], [class*="user-turn"]',
        assistantMessage: '[data-role="model"], [class*="model-response"], [class*="bot-turn"]',
        messageContent: '[data-message-content], .markdown, .response-content',
        inputArea: 'rich-textarea, [contenteditable="true"]',
        sendButton: 'button[aria-label*="Send"], button[aria-label*="send"]',
        turnContainer: 'message-content, [data-turn]',
        leftSidebar: 'nav, [class*="drawer"], [class*="side-panel"]'
      },
      getConversationId() {
        const url = new URL(location.href);
        return url.searchParams.get('thread') || url.pathname.split('/').pop() || null;
      }
    },

    deepseek: {
      name: 'DeepSeek',
      hostPattern: /chat\.deepseek\.com/,
      selectors: {
        conversationArea: '[class*="chat"], main',
        turns: '[class*="message"], [class*="turn"]',
        userMessage: '[class*="user"], [data-role="user"]',
        assistantMessage: '[class*="assistant"], [data-role="assistant"]',
        messageContent: '.markdown, [class*="content"]',
        inputArea: 'textarea, [contenteditable="true"]',
        sendButton: 'button[type="submit"], [class*="send"]',
        turnContainer: '[class*="message"]',
        leftSidebar: 'nav, [class*="sidebar"]'
      },
      getConversationId() {
        const m = location.pathname.match(/\/chat\/([a-zA-Z0-9_-]+)/);
        return m ? m[1] : null;
      }
    },

    yuanbao: {
      name: '元宝',
      hostPattern: /yuanbao\.tencent\.com/,
      selectors: {
        conversationArea: '[class*="chat"], main, [class*="agent-chat"], [class*="conversation"]',
        turns: '[data-role], [class*="chat-message"], [class*="message-item"], [class*="bubble"], [class*="turn"], [class*="message"]:not([class*="system"]):not([class*="notification"])',
        userMessage: '[data-role="user"], [class*="user"], [class*="question"], [class*="human"], [class*="user-msg"], [class*="userMsg"], .chat-message-user, .user-message',
        assistantMessage: '[data-role="assistant"], [class*="answer"], [class*="ai-msg"], [class*="assistant-msg"], [class*="agent-msg"], [class*="bot"], [class*="model"]',
        messageContent: '.markdown, [class*="content"], [class*="text"], [class*="body"]',
        inputArea: 'textarea, [contenteditable="true"]',
        sendButton: 'button[type="submit"], [class*="send"]',
        turnContainer: '[data-role], [class*="chat-message"], [class*="message-item"], [class*="bubble"], [class*="message"]:not([class*="system"])',
        leftSidebar: 'nav, [class*="sidebar"]'
      },
      getConversationId() {
        const m = location.pathname.match(/\/([a-zA-Z0-9_-]+)$/);
        return m ? m[1] : null;
      }
    },

    kimi: {
      name: 'Kimi',
      hostPattern: /kimi\.moonshot\.cn/,
      selectors: {
        conversationArea: '[class*="chat"], main',
        turns: '[class*="message"], [class*="turn"]',
        userMessage: '[class*="user"], [class*="question"]',
        assistantMessage: '[class*="assistant"], [class*="answer"]',
        messageContent: '.markdown, [class*="content"]',
        inputArea: 'textarea, [contenteditable="true"]',
        sendButton: 'button[type="submit"], [class*="send"]',
        turnContainer: '[class*="message"]',
        leftSidebar: 'nav, [class*="sidebar"]'
      },
      getConversationId() {
        const m = location.pathname.match(/\/chat\/([a-zA-Z0-9_-]+)/);
        return m ? m[1] : null;
      }
    },

    tongyi: {
      name: '通义千问',
      hostPattern: /tongyi\.aliyun\.com/,
      selectors: {
        conversationArea: '[class*="chat"], main',
        turns: '[class*="message"], [class*="turn"]',
        userMessage: '[class*="user"], [class*="question"]',
        assistantMessage: '[class*="assistant"], [class*="answer"]',
        messageContent: '.markdown, [class*="content"]',
        inputArea: 'textarea, [contenteditable="true"]',
        sendButton: 'button[type="submit"], [class*="send"]',
        turnContainer: '[class*="message"]',
        leftSidebar: 'nav, [class*="sidebar"]'
      },
      getConversationId() {
        const m = location.pathname.match(/\/([a-zA-Z0-9_-]+)$/);
        return m ? m[1] : null;
      }
    },

    claude: {
      name: 'Claude',
      hostPattern: /claude\.ai/,
      selectors: {
        conversationArea: '[class*="chat"], main',
        turns: '[class*="message"], [class*="turn"]',
        userMessage: '[class*="user"], [data-role="user"]',
        assistantMessage: '[class*="assistant"], [class*="claude"], [data-role="assistant"]',
        messageContent: '.markdown, [class*="content"]',
        inputArea: '[contenteditable="true"], textarea',
        sendButton: 'button[type="submit"], [class*="send"]',
        turnContainer: '[class*="message"]',
        leftSidebar: 'nav, [class*="sidebar"]'
      },
      getConversationId() {
        const m = location.pathname.match(/\/([a-zA-Z0-9_-]+)$/);
        return m ? m[1] : null;
      }
    },

    grok: {
      name: 'Grok',
      hostPattern: /x\.com|grok\.com/,
      pathPattern: /\/i\/grok|grok\.com/,
      selectors: {
        conversationArea: 'main, [role="main"], [class*="chat"]',
        turns: '[class*="message"], [class*="turn"], [class*="bubble"]',
        userMessage: '[class*="user"], [data-role="user"], [class*="human"]',
        assistantMessage: '[class*="assistant"], [data-role="assistant"], [class*="grok"], [class*="bot"]',
        messageContent: '.markdown, [class*="content"], [class*="text"]',
        inputArea: '[contenteditable="true"], textarea',
        sendButton: 'button[type="submit"], [class*="send"]',
        turnContainer: '[class*="message"]',
        leftSidebar: 'nav, [class*="sidebar"]'
      },
      getConversationId() {
        const m = location.pathname.match(/\/([a-zA-Z0-9_-]+)$/);
        return m ? m[1] : null;
      }
    },

  };

  // === 通用回退选择器（不依赖平台，所有 AI 聊天页面生效） ===
  const GENERIC_TURN_SELECTORS = [
    'article[data-testid^="conversation-turn-"]',
    '[data-testid^="conversation-turn-"]',
    '[data-message-author-role]',
    'message-content',
    '[data-turn]',
    '.chat-message-user',
    '.user-message',
    '[class*="chat-message"]',
    '[class*="turn"]',
    '[class*="message-item"]',
    '[class*="conversation"]',
    '[class*="dialog"]',
    'article'
  ];

  const GENERIC_USER_ATTRS = [
    '[data-message-author-role="user"]',
    '[data-role="user"]',
    '[data-speaker="user"]',
    '[data-sender="user"]',
    '.chat-message-user',
    '.user-message',
    '[class*="human"]',
    '[class*="user-msg"]',
    '[class*="user-message"]',
    '[class*="userMsg"]',
    '[class*="question"]'
  ];

  const GENERIC_ASSISTANT_ATTRS = [
    '[data-message-author-role="assistant"]',
    '[data-role="assistant"]',
    '[data-role="model"]',
    '[data-speaker="assistant"]',
    '[class*="-assistant"]',
    '[class*="assistant-"]',
    '[class*="ai-msg"]',
    '[class*="-ai-"]',
    '[class*="answer"]',
    '[class*="-bot"]',
    '[class*="bot-"]',
    '[class*="bot-message"]',
    '[class*="model-response"]'
  ];

  let _currentPlatform = null;

  function detectPlatform() {
    if (_currentPlatform) return _currentPlatform;
    const host = location.hostname;
    for (const [key, cfg] of Object.entries(PLATFORMS)) {
      if (cfg.hostPattern.test(host)) {
        // 额外 path 检测（如 Grok 需要区分普通 Twitter）
        if (cfg.pathPattern && !cfg.pathPattern.test(location.href)) continue;
        _currentPlatform = key;
        return key;
      }
    }
    _currentPlatform = 'unknown';
    return 'unknown';
  }

  function getPlatformConfig(platform) {
    const key = platform || detectPlatform();
    return PLATFORMS[key] || null;
  }

  function getSelector(name, platform) {
    const cfg = getPlatformConfig(platform);
    if (cfg && cfg.selectors[name]) return cfg.selectors[name];
    // 回退到通用选择器
    if (name === 'turns' || name === 'turnContainer') return GENERIC_TURN_SELECTORS.join(', ');
    if (name === 'userMessage') return GENERIC_USER_ATTRS.join(', ');
    if (name === 'assistantMessage') return GENERIC_ASSISTANT_ATTRS.join(', ');
    if (name === 'conversationArea') return 'main, [role="main"], body';
    if (name === 'inputArea') return '[contenteditable="true"], textarea';
    if (name === 'messageContent') return '.markdown, [class*="content"]';
    if (name === 'sendButton') return 'button[type="submit"], [class*="send"]';
    if (name === 'leftSidebar') return 'nav, [class*="sidebar"], [class*="drawer"], [class*="side-panel"]';
    return null;
  }

  // 安全 querySelector，忽略无效选择器报错
  function _tryQuery(selectors, all) {
    if (typeof selectors === 'string') selectors = selectors.split(',').map(s => s.trim());
    if (!Array.isArray(selectors)) selectors = [selectors];
    for (const sel of selectors) {
      if (!sel) continue;
      try {
        const result = all ? document.querySelectorAll(sel) : document.querySelector(sel);
        if (result && (all ? result.length > 0 : true)) return result;
      } catch (e) { /* 忽略 */ }
    }
    return all ? [] : null;
  }

  function findElements(selectorName, platform) {
    const sel = getSelector(selectorName, platform);
    return Array.from(_tryQuery(sel, true));
  }

  function findElement(selectorName, platform) {
    const sel = getSelector(selectorName, platform);
    if (sel) {
      const result = _tryQuery(sel, false);
      if (result) return result;
    }
    // 额外回退
    if (selectorName === 'conversationArea') {
      return document.querySelector('main, [role="main"]') || document.body;
    }
    if (selectorName === 'inputArea') {
      return document.querySelector('[contenteditable="true"], textarea');
    }
    return null;
  }

  function getConversationId(platform) {
    const cfg = getPlatformConfig(platform);
    return cfg ? cfg.getConversationId() : null;
  }

  // 判断某个元素是否为用户消息（带回退）
  function isUserMessage(el, platform) {
    // 1. 平台选择器
    const cfg = getPlatformConfig(platform);
    if (cfg) {
      const sel = cfg.selectors.userMessage;
      if (sel) {
        try { if (el.matches(sel) || el.closest(sel)) return true; } catch (e) {}
      }
    }
    // 2. 通用属性
    for (const genSel of GENERIC_USER_ATTRS) {
      try { if (el.matches(genSel) || el.closest(genSel)) return true; } catch (e) {}
    }
    // 3. 启发式：父元素不是 assistant 则为 user
    const parent = findParentTurn(el, platform);
    if (parent) {
      // 先检查平台专属 assistant 选择器
      if (cfg) {
        const asstSel = cfg.selectors.assistantMessage;
        if (asstSel) {
          try { if (parent.matches(asstSel) || parent.querySelector(asstSel)) return false; } catch (e) {}
        }
      }
      // 再检查通用 assistant 选择器
      const isAssistant = GENERIC_ASSISTANT_ATTRS.some(s => {
        try { return parent.matches(s) || parent.querySelector(s); } catch (e) { return false; }
      });
      if (!isAssistant) return true;
    }
    return false;
  }

  function isAssistantMessage(el, platform) {
    const cfg = getPlatformConfig(platform);
    if (cfg) {
      const sel = cfg.selectors.assistantMessage;
      if (sel) {
        try { if (el.matches(sel) || el.closest(sel)) return true; } catch (e) {}
      }
    }
    for (const genSel of GENERIC_ASSISTANT_ATTRS) {
      try { if (el.matches(genSel) || el.closest(genSel)) return true; } catch (e) {}
    }
    return false;
  }

  // 查找元素所属的对话轮次（带多层回退）
  function findParentTurn(el, platform) {
    // 1. 平台选择器
    const cfg = getPlatformConfig(platform);
    if (cfg) {
      const turnSel = cfg.selectors.turnContainer || cfg.selectors.turns;
      if (turnSel) {
        try { const m = el.closest(turnSel); if (m) return m; } catch (e) {}
      }
    }
    // 2. 通用选择器
    for (const genSel of GENERIC_TURN_SELECTORS) {
      try { const m = el.closest(genSel); if (m) return m; } catch (e) {}
    }
    // 3. 兜底
    return el.closest('article, [role="article"], [class*="message"]');
  }

  function isInConversationArea(el) {
    if (!el) return false;
    if (findParentTurn(el, detectPlatform())) return true;
    const main = document.querySelector('main, [role="main"]');
    if (main && main.contains(el)) return true;
    return false;
  }

  ns.platforms = {
    PLATFORMS,
    GENERIC_TURN_SELECTORS,
    GENERIC_USER_ATTRS,
    GENERIC_ASSISTANT_ATTRS,
    detectPlatform,
    getPlatformConfig,
    getSelector,
    findElements,
    findElement,
    getConversationId,
    isUserMessage,
    isAssistantMessage,
    findParentTurn,
    isInConversationArea
  };

})(window.AIChatEnhancer);
