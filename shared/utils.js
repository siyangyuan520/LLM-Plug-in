// AI Chat Enhancer - 工具函数
window.AIChatEnhancer = window.AIChatEnhancer || {};

(function(ns) {
  'use strict';

  // 浏览器API兼容
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  // 生成唯一ID
  function generateId() {
    return 'aice_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11);
  }

  // 防抖
  function debounce(fn, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // 节流
  function throttle(fn, delay) {
    let last = 0;
    return function(...args) {
      const now = Date.now();
      if (now - last >= delay) {
        last = now;
        fn.apply(this, args);
      }
    };
  }

  // 获取元素的XPath
  function getXPath(element) {
    if (!element || element.nodeType !== 1) return '';
    if (element.id) return `//*[@id="${element.id}"]`;

    const parts = [];
    while (element && element.nodeType === 1) {
      let index = 1;
      let sibling = element.previousSibling;
      while (sibling) {
        if (sibling.nodeType === 1 && sibling.nodeName === element.nodeName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }
      const tag = element.nodeName.toLowerCase();
      const part = index > 1 ? `${tag}[${index}]` : tag;
      parts.unshift(part);
      element = element.parentNode;
    }
    return '/' + parts.join('/');
  }

  // 通过XPath获取元素
  function getElementByXPath(xpath, context) {
    const result = document.evaluate(
      xpath, context || document, null,
      XPathResult.FIRST_ORDERED_NODE_TYPE, null
    );
    return result.singleNodeValue;
  }

  // HTML转义
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // 等待元素出现
  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for: ${selector}`));
      }, timeout);
    });
  }

  // 判断元素是否在视口内
  function isInViewport(el) {
    const rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  }

  // 获取元素相对文档顶部的距离
  function getDocumentTop(el) {
    let top = 0;
    while (el) {
      top += el.offsetTop;
      el = el.offsetParent;
    }
    return top;
  }

  ns.utils = {
    browserAPI,
    generateId,
    debounce,
    throttle,
    getXPath,
    getElementByXPath,
    escapeHTML,
    waitForElement,
    isInViewport,
    getDocumentTop
  };

})(window.AIChatEnhancer);
