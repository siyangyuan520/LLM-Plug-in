// AI Chat Enhancer - 主入口
window.AIChatEnhancer = window.AIChatEnhancer || {};

(function(ns) {
  'use strict';

  const { detectPlatform, getConversationId } = ns.platforms;
  const { debounce } = ns.utils;

  let timeline = null;
  let annotationMgr = null;
  let toolbar = null;
  let followUpMonitor = null;
  let formulaTableCopy = null;
  let promptRepo = null;
  let folderPanel = null;
  let settingsPanel = null;

  // URL变化检测
  let lastUrl = location.href;
  let urlCheckTimer = null;

  // 防抖初始化（避免SPA页面多次触发）
  const debouncedInit = debounce(initialize, 500);

  function initialize() {
    const platform = detectPlatform();
    console.log('[AI Chat Enhancer] 初始化平台:', platform, '| host:', location.hostname);

    cleanup();

    // 初始化标注管理器
    annotationMgr = new ns.AnnotationManager();
    annotationMgr.init();

    // 初始化追问监测器
    followUpMonitor = new ns.FollowUpMonitor();

    // 初始化公式/表格复制
    formulaTableCopy = new ns.FormulaTableCopy();
    formulaTableCopy.init();

    // 初始化 Prompt 仓库
    promptRepo = new ns.PromptRepo();
    promptRepo.init();
    window._promptRepoInstance = promptRepo;

    // 初始化文件夹面板（数据管理，UI 集成到时间轴标签页）
    folderPanel = new ns.FolderPanel();
    folderPanel.init();

    // 初始化浮动工具栏（依赖标注管理器和追问监测器）
    toolbar = new ns.SelectionToolbar(annotationMgr, followUpMonitor);
    toolbar.init();
    annotationMgr.setToolbar(toolbar);

    // 初始化时间轴（稍延迟，等页面渲染）
    setTimeout(() => {
      timeline = new ns.Timeline();
      timeline.init();
    }, 1000);

    // 自动记录当前对话
    recordConversation();

    // 启动URL变化监听
    startUrlMonitor();
  }

  function cleanup() {
    if (timeline) {
      timeline.destroy();
      timeline = null;
    }
    if (toolbar) {
      toolbar.destroy();
      toolbar = null;
    }
    if (followUpMonitor) {
      followUpMonitor.destroy();
      followUpMonitor = null;
    }
    if (formulaTableCopy) {
      formulaTableCopy.destroy();
      formulaTableCopy = null;
    }
    if (promptRepo) {
      promptRepo.destroy();
      promptRepo = null;
    }
    if (folderPanel) {
      folderPanel.destroy();
      folderPanel = null;
    }
    if (settingsPanel) {
      settingsPanel.destroy();
      settingsPanel = null;
    }
    if (annotationMgr) {
      annotationMgr.destroy();
      annotationMgr = null;
    }
  }

  function startUrlMonitor() {
    if (urlCheckTimer) return;
    urlCheckTimer = setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        console.log('[AI Chat Enhancer] URL变化，重新初始化');
        debouncedInit();
      }
    }, 1000);
  }

  function handleConversationChange() {
    // 取消当前追问监测
    if (followUpMonitor) {
      followUpMonitor.cancel();
    }
    // 会话切换时刷新标注和时间轴
    if (annotationMgr) {
      annotationMgr.refresh();
    }
    if (timeline) {
      timeline.refresh();
    }
    if (promptRepo) {
      promptRepo.refresh();
    }
    if (folderPanel) {
      folderPanel.refresh();
    }
  }

  // 自动记录当前对话
  async function recordConversation() {
    const platform = detectPlatform();
    if (platform === 'unknown') return;
    const convId = getConversationId(platform);
    if (!convId) return;
    try {
      await ns.storage.conversations.upsertByConversation(platform, convId, {
        title: document.title || '',
        lastActive: Date.now()
      });
    } catch (e) {
      // 静默失败
    }
  }

  // === 启动 ===

  // 初始加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initialize, 1500); // 延迟等页面渲染
    });
  } else {
    setTimeout(initialize, 1500);
  }

  // 监听pushState和replaceState（SPA路由变化）
  const origPushState = history.pushState;
  const origReplaceState = history.replaceState;

  history.pushState = function(...args) {
    origPushState.apply(this, args);
    handleConversationChange();
  };

  history.replaceState = function(...args) {
    origReplaceState.apply(this, args);
    handleConversationChange();
  };

  window.addEventListener('popstate', () => {
    handleConversationChange();
  });

  // === Message handling (popup / background) ===

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'toggleTimeline':
        if (timeline) {
          timeline.visible ? timeline.hide() : timeline.show();
        }
        sendResponse({ success: true });
        break;

      case 'showSettings':
        if (!settingsPanel) {
          settingsPanel = new ns.SettingsPanel();
        }
        settingsPanel.show();
        sendResponse({ success: true });
        break;

      case 'getStats': {
        const annCount = annotationMgr ? 0 : 0;
        const nodes = timeline ? timeline.turns.length : 0;
        // Count annotations from DOM
        const domAnnCount = document.querySelectorAll('[data-aice-annotation]').length;
        sendResponse({ annoCount: domAnnCount, nodeCount: nodes });
        break;
      }

      case 'clearPageData':
        if (annotationMgr) {
          document.querySelectorAll('[data-aice-annotation]').forEach((el) => {
            const text = el.textContent || '';
            const parent = el.parentNode;
            if (parent) {
              parent.replaceChild(document.createTextNode(text), el);
              parent.normalize();
            }
          });
        }
        if (timeline) {
          timeline.turns = [];
          timeline._renderDots();
          timeline._renderNodes();
        }
        sendResponse({ success: true });
        break;
    }
    return true;
  });

  console.log('[AI Chat Enhancer] 扩展已加载');

})(window.AIChatEnhancer);
