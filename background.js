// AI Chat Enhancer - Background Service Worker
'use strict';

// duluduluduludulu

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[AI Chat Enhancer] Installed');
    chrome.tabs.create({ url: 'https://chatgpt.com' });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'getPlatform':
      sendResponse({ platform: detectPlatformFromUrl(sender.url) });
      break;

    case 'getPageInfo':
      sendResponse({ url: sender.url, tabId: sender.tab?.id });
      break;

    case 'exportData':
      chrome.storage.local.get(null, (data) => {
        const filtered = {};
        for (const [key, value] of Object.entries(data)) {
          if (key.startsWith('aice:')) filtered[key] = value;
        }
        sendResponse({ data: filtered });
      });
      return true;

    case 'clearAllData':
      chrome.storage.local.get(null, (data) => {
        const keys = Object.keys(data).filter((k) => k.startsWith('aice:'));
        if (keys.length) chrome.storage.local.remove(keys);
        sendResponse({ success: true });
      });
      return true;
  }
});

function detectPlatformFromUrl(url) {
  if (!url) return 'unknown';
  if (/chatgpt\.com|chat\.openai\.com/.test(url)) return 'chatgpt';
  if (/gemini\.google\.com/.test(url)) return 'gemini';
  if (/chat\.deepseek\.com/.test(url)) return 'deepseek';
  if (/yuanbao\.tencent\.com/.test(url)) return 'yuanbao';
  if (/kimi\.moonshot\.cn/.test(url)) return 'kimi';
  if (/tongyi\.aliyun\.com/.test(url)) return 'tongyi';
  if (/claude\.ai/.test(url)) return 'claude';
  if (/x\.com|grok\.com/.test(url)) return 'grok';
  return 'unknown';
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-timeline') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleTimeline' }).catch(() => {});
      }
    });
  }
});

// 点击插件图标 → 直接打开设置面板
chrome.action.onClicked.addListener((tab) => {
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'showSettings' }).catch(() => {});
  }
});
