// AI Chat Enhancer - Popup Logic
'use strict';

(function () {
  const PLATFORM_NAMES = {
    chatgpt: 'ChatGPT',
    gemini: 'Gemini',
    deepseek: 'DeepSeek',
    yuanbao: 'Yuanbao',
    kimi: 'Kimi',
    tongyi: 'Tongyi',
    claude: 'Claude',
    grok: 'Grok',
    unknown: 'Unknown',
  };

  async function getCurrentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }

  function detectPlatform(url) {
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

  async function updateUI() {
    const tab = await getCurrentTab();
    const platform = detectPlatform(tab?.url);
    const badge = document.getElementById('platformBadge');
    const pageUrl = document.getElementById('pageUrl');
    const annoCount = document.getElementById('annoCount');
    const nodeCount = document.getElementById('nodeCount');

    badge.textContent = PLATFORM_NAMES[platform] || 'Unknown';
    badge.className = 'popup-badge ' + (platform !== 'unknown' ? 'active' : 'inactive');

    pageUrl.textContent = tab?.url ? new URL(tab.url).hostname : '-';

    if (platform !== 'unknown' && tab?.id) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStats' });
        if (response) {
          annoCount.textContent = response.annoCount ?? '0';
          nodeCount.textContent = response.nodeCount ?? '0';
        }
      } catch {
        annoCount.textContent = 'Loading...';
        nodeCount.textContent = 'Loading...';
      }
    } else {
      annoCount.textContent = '-';
      nodeCount.textContent = '-';
    }
  }

  function bindEvents() {
    document.getElementById('openSettings')?.addEventListener('click', async () => {
      const tab = await getCurrentTab();
      if (!tab?.id) return;
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'showSettings' });
      } catch {
        alert('请在支持的 AI 聊天页面中打开设置');
      }
      window.close();
    });

    document.getElementById('toggleTimeline')?.addEventListener('click', async () => {
      const tab = await getCurrentTab();
      if (!tab?.id) return;
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'toggleTimeline' });
      } catch {
        alert('Please open a supported AI chat page (ChatGPT / Gemini / DeepSeek / Claude / etc.)');
      }
      window.close();
    });

    document.getElementById('clearAnnotations')?.addEventListener('click', async () => {
      if (!confirm('Clear all annotations and timeline data for this page? This cannot be undone!')) return;
      const tab = await getCurrentTab();
      if (!tab?.id) return;
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'clearPageData' });
        alert('Cleared all data for this page.');
        updateUI();
      } catch {
        alert('Please use this feature on a supported AI chat page.');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateUI();
    bindEvents();
  });
})();
