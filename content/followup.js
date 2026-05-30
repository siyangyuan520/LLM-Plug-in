// AI Chat Enhancer - 追问回复监测与通知
window.AIChatEnhancer = window.AIChatEnhancer || {};

(function(ns) {
  'use strict';

  const { debounce } = ns.utils;
  const { detectPlatform, getSelector, findElement } = ns.platforms;

  const COMPLETION_DEBOUNCE = 2500; // 2.5秒无内容变化视为回答完成
  const PHASE_TIMEOUT = 120000;     // 2分钟超时自动取消

  class FollowUpMonitor {
    constructor() {
      this._phase = 'idle'; // idle | waiting_send | waiting_ai | waiting_complete | notified
      this._platform = null;
      this._quotedText = '';
      this._observer = null;
      this._completionTimer = null;
      this._phaseTimer = null;
      this._notificationEl = null;
      this._targetAssistantEl = null;
      this._lastContent = '';
      this._scrollHandler = null;
      this._trackedUserNodes = new WeakSet();
      this._trackedAssistantNodes = new WeakSet();

      // 滚动拦截
      this._origScrollIntoView = null;
      this._allowScroll = false;
    }

    /**
     * 开始监测：用户已点击"引用追问"，文本已粘贴到输入框
     */
    start(quotedText) {
      this.cancel();
      this._quotedText = quotedText;
      this._platform = detectPlatform();

      // 标记现有的 user/assistant 节点
      this._markExistingNodes();

      this._phase = 'waiting_send';
      this._bindScroll();
      this._startObserving();
      this._setPhaseTimeout('waiting_send');

      console.log('[AI Chat Enhancer] 追问监测已启动，等待发送...');
    }

    cancel() {
      this._clearTimers();
      this._stopObserving();
      this._hideNotification();
      this._unbindScroll();
      this._unpatchScrollIntoView();
      this._phase = 'idle';
      this._targetAssistantEl = null;
      this._lastContent = '';
      this._allowScroll = false;
    }

    destroy() {
      this.cancel();
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }
    }

    // === DOM 监测 ===

    _markExistingNodes() {
      const userSel = getSelector('userMessage', this._platform);
      const assistantSel = getSelector('assistantMessage', this._platform);
      if (userSel) {
        try { document.querySelectorAll(userSel).forEach(el => this._trackedUserNodes.add(el)); } catch (e) {}
      }
      if (assistantSel) {
        try { document.querySelectorAll(assistantSel).forEach(el => this._trackedAssistantNodes.add(el)); } catch (e) {}
      }
    }

    _startObserving() {
      if (this._observer) this._observer.disconnect();

      const conversationArea = findElement('conversationArea', this._platform);
      const target = conversationArea || document.body;

      const check = debounce(() => this._checkDOM(), 400);

      this._observer = new MutationObserver((mutations) => {
        const hasNewNodes = mutations.some(m => m.addedNodes.length > 0);
        if (hasNewNodes) check();
      });

      this._observer.observe(target, {
        childList: true,
        subtree: true,
        characterData: false
      });
    }

    _stopObserving() {
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }
    }

    _checkDOM() {
      if (this._phase === 'idle') return;

      const userSel = getSelector('userMessage', this._platform);
      const assistantSel = getSelector('assistantMessage', this._platform);

      if (this._phase === 'waiting_send') {
        const allUser = userSel ? this._safeQueryAll(userSel) : [];
        for (const el of allUser) {
          if (!this._trackedUserNodes.has(el)) {
            this._trackedUserNodes.add(el);
            const text = (el.textContent || '').trim();
            if (text.includes(this._quotedText.substring(0, 50)) || text.length > 0) {
              console.log('[AI Chat Enhancer] 检测到用户发送消息，锁定滚动并等待AI回复...');
              this._phase = 'waiting_ai';
              this._setPhaseTimeout('waiting_ai');
              break;
            }
          }
        }
      }

      if (this._phase === 'waiting_ai') {
        const allAssistant = assistantSel ? this._safeQueryAll(assistantSel) : [];
        for (const el of allAssistant) {
          if (!this._trackedAssistantNodes.has(el)) {
            this._trackedAssistantNodes.add(el);
            this._targetAssistantEl = el;
            this._lastContent = el.textContent || '';
            this._phase = 'waiting_complete';
            this._setPhaseTimeout(null);
            this._patchScrollIntoView();
            console.log('[AI Chat Enhancer] AI开始回复（滚动已锁定），监测完成状态...');
            this._watchCompletion(el);
            return;
          }
        }

        if (allAssistant.length > 0) {
          const last = allAssistant[allAssistant.length - 1];
          if (last !== this._targetAssistantEl && !this._trackedAssistantNodes.has(last)) {
            this._targetAssistantEl = last;
            this._trackedAssistantNodes.add(last);
            this._lastContent = last.textContent || '';
            this._phase = 'waiting_complete';
            this._setPhaseTimeout(null);
            this._patchScrollIntoView();
            this._watchCompletion(last);
            return;
          }
        }
      }
    }

    _safeQueryAll(sel) {
      try { return Array.from(document.querySelectorAll(sel)); } catch (e) { return []; }
    }

    /**
     * 观察AI回复内容变化，稳定后视为完成
     */
    _watchCompletion(el) {
      const completionObserver = new MutationObserver(() => {
        const current = el.textContent || '';
        if (current !== this._lastContent) {
          this._lastContent = current;
          this._resetCompletionTimer(el);
        }
      });

      completionObserver.observe(el, {
        childList: true,
        subtree: true,
        characterData: true
      });

      this._resetCompletionTimer(el, completionObserver);
      this._completionObserver = completionObserver;
    }

    _resetCompletionTimer(el, observer) {
      if (this._completionTimer) clearTimeout(this._completionTimer);
      this._completionTimer = setTimeout(() => {
        if (observer) observer.disconnect();
        if (this._completionObserver) {
          this._completionObserver.disconnect();
          this._completionObserver = null;
        }
        this._stopObserving();
        this._onAICompleted(el);
      }, COMPLETION_DEBOUNCE);
    }

    /**
     * AI回答完成 → 检查可见性，决定是否弹出通知
     */
    _onAICompleted(el) {
      console.log('[AI Chat Enhancer] AI回答完成');
      this._targetAssistantEl = el;
      this._unpatchScrollIntoView(); // 解锁滚动

      if (!this._isElementVisible(el)) {
        this._showNotification(el);
      } else {
        this._phase = 'idle';
      }
    }

    _isElementVisible(el) {
      if (!el) return true;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const visibleTop = Math.max(rect.top, 0);
      const visibleBottom = Math.min(rect.bottom, vh);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      return visibleHeight >= rect.height * 0.4;
    }

    // === 阻止平台自动滚动（核心） ===

    /**
     * 拦截 Element.prototype.scrollIntoView
     * 在 AI 流式回复期间，平台会反复调用它来保持最新内容在视口中，
     * 这里直接屏蔽掉，让用户可以自由滚动阅读之前的内容。
     */
    _patchScrollIntoView() {
      if (this._origScrollIntoView) return; // 已拦截

      const self = this;
      this._origScrollIntoView = Element.prototype.scrollIntoView;

      Element.prototype.scrollIntoView = function(...args) {
        // 允许我们自己触发的滚动（查看按钮等）
        if (self._allowScroll) {
          return self._origScrollIntoView.apply(this, args);
        }
        // 监测结束后的正常滚动
        if (self._phase === 'idle' || self._phase === 'notified') {
          return self._origScrollIntoView.apply(this, args);
        }
        // waiting_complete 期间：吞掉所有外部 scrollIntoView 调用
      };
    }

    _unpatchScrollIntoView() {
      if (this._origScrollIntoView) {
        Element.prototype.scrollIntoView = this._origScrollIntoView;
        this._origScrollIntoView = null;
      }
    }

    // === 浮动通知 ===

    _showNotification(answerEl) {
      if (this._notificationEl) return;
      this._phase = 'notified';

      const container = document.createElement('div');
      container.className = 'aice-followup-notification';

      const text = document.createElement('span');
      text.className = 'aice-followup-text';
      text.textContent = 'AI 已回答完成';

      const viewBtn = document.createElement('button');
      viewBtn.className = 'aice-followup-btn aice-followup-view';
      viewBtn.textContent = '查看';
      viewBtn.addEventListener('click', () => {
        this._scrollToAnswer(answerEl);
      });

      const closeBtn = document.createElement('button');
      closeBtn.className = 'aice-followup-btn aice-followup-close';
      closeBtn.innerHTML = '&#10005;';
      closeBtn.title = '关闭';
      closeBtn.addEventListener('click', () => {
        this._hideNotification();
      });

      container.appendChild(text);
      container.appendChild(viewBtn);
      container.appendChild(closeBtn);
      document.body.appendChild(container);

      this._notificationEl = container;

      this._autoDismissTimer = setTimeout(() => {
        this._hideNotification();
      }, 60000);
    }

    _hideNotification() {
      if (this._autoDismissTimer) {
        clearTimeout(this._autoDismissTimer);
        this._autoDismissTimer = null;
      }
      if (this._notificationEl) {
        this._notificationEl.classList.add('aice-followup-hiding');
        setTimeout(() => {
          if (this._notificationEl && this._notificationEl.parentNode) {
            this._notificationEl.parentNode.removeChild(this._notificationEl);
          }
          this._notificationEl = null;
        }, 250);
      }
      if (this._phase === 'notified') {
        this._phase = 'idle';
      }
    }

    _scrollToAnswer(el) {
      this._hideNotification();
      if (!el) return;
      // 临时放行 scrollIntoView
      this._allowScroll = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this._allowScroll = false;
      // 闪烁高亮
      el.style.transition = 'outline 0.3s';
      el.style.outline = '3px solid #10b981';
      setTimeout(() => {
        el.style.outline = '';
        setTimeout(() => { el.style.transition = ''; }, 300);
      }, 2000);
    }

    // === 滚动监听：用户手动滚回答案时自动关闭通知 ===

    _bindScroll() {
      this._scrollHandler = debounce(() => {
        if (this._phase === 'notified' && this._targetAssistantEl) {
          if (this._isElementVisible(this._targetAssistantEl)) {
            this._hideNotification();
          }
        }
      }, 300);
      window.addEventListener('scroll', this._scrollHandler, { passive: true });
    }

    _unbindScroll() {
      if (this._scrollHandler) {
        window.removeEventListener('scroll', this._scrollHandler);
        this._scrollHandler = null;
      }
    }

    // === 定时器 ===

    _setPhaseTimeout(phase) {
      if (this._phaseTimer) clearTimeout(this._phaseTimer);
      if (!phase) {
        this._phaseTimer = null;
        return;
      }
      this._phaseTimer = setTimeout(() => {
        console.log('[AI Chat Enhancer] 追问监测超时，自动取消');
        this.cancel();
      }, PHASE_TIMEOUT);
    }

    _clearTimers() {
      if (this._completionTimer) {
        clearTimeout(this._completionTimer);
        this._completionTimer = null;
      }
      if (this._phaseTimer) {
        clearTimeout(this._phaseTimer);
        this._phaseTimer = null;
      }
      if (this._completionObserver) {
        this._completionObserver.disconnect();
        this._completionObserver = null;
      }
    }
  }

  ns.FollowUpMonitor = FollowUpMonitor;

})(window.AIChatEnhancer);
