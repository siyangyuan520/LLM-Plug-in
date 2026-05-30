// AI Chat Enhancer - 文本标注（支持多格式叠加）
window.AIChatEnhancer = window.AIChatEnhancer || {};

(function(ns) {
  'use strict';

  const { generateId } = ns.utils;
  const { detectPlatform, getConversationId, findParentTurn, findElements, isInConversationArea } = ns.platforms;
  const { saveAnnotation, getAnnotations, deleteAnnotation } = ns.storage;

  class AnnotationManager {
    constructor() {
      this.platform = null;
      this.conversationId = null;
      this._toolbar = null;
      this._onAnnotationClick = this._onAnnotationClick.bind(this);
    }

    setToolbar(toolbar) { this._toolbar = toolbar; }

    async init() {
      this.platform = detectPlatform();
      this.conversationId = getConversationId(this.platform) || location.href;
      await this.restoreAll();
      document.addEventListener('click', this._onAnnotationClick, true);
    }

    destroy() {
      document.removeEventListener('click', this._onAnnotationClick, true);
      this._removeTooltip();
    }

    async refresh() {
      this.conversationId = getConversationId(this.platform) || location.href;
      await this.restoreAll();
    }

    // === 颜色工具 ===

    _colorNameToHex(name) {
      const map = { yellow: '#F6E268', blue: '#68B5FB', red: '#FC7D9F', green: '#6BD66B' };
      return map[name] || null;
    }

    _hexToRgba(hex, alpha) {
      const resolved = hex && hex.startsWith('#') ? hex : this._colorNameToHex(hex);
      if (!resolved) return '';
      const r = parseInt(resolved.slice(1, 3), 16);
      const g = parseInt(resolved.slice(3, 5), 16);
      const b = parseInt(resolved.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }

    _toHex(color) {
      return color && color.startsWith('#') ? color : this._colorNameToHex(color);
    }

    // === 应用标注（新建 span） ===

    applyAnnotation(type, color) {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
      const range = selection.getRangeAt(0);
      if (!range || range.collapsed) return null;
      if (!this._isInConversation(range)) return null;

      const span = document.createElement('span');
      span.setAttribute('data-aice-annotation', 'true');
      span.setAttribute('data-aice-id', generateId());
      this._addFormatToElement(span, type, color);

      try {
        range.surroundContents(span);
      } catch (e) {
        try {
          const fragment = range.extractContents();
          span.appendChild(fragment);
          range.insertNode(span);
          if (span.parentNode) span.parentNode.normalize();
        } catch (e2) { return null; }
      }

      selection.removeAllRanges();
      this._saveAnnotationData(span);
      return span;
    }

    // === 多格式管理 ===

    addFormatToSpan(span, type, color) {
      this._addFormatToElement(span, type, color);
      this._saveAnnotationData(span);
    }

    updateFormatOnSpan(span, type, color) {
      const hex = this._toHex(color);
      if (!hex) return;
      if (type === 'highlight') {
        span.style.backgroundColor = this._hexToRgba(hex, 0.3);
        span.setAttribute('data-aice-highlight', hex);
      } else if (type === 'textColor') {
        span.style.color = hex;
        span.setAttribute('data-aice-textColor', hex);
      }
      this._saveAnnotationData(span);
    }

    removeFormatFromSpan(span, type) {
      const types = (span.getAttribute('data-aice-type') || '').split(' ').filter(Boolean);
      const idx = types.indexOf(type);
      if (idx < 0) return;
      types.splice(idx, 1);

      span.classList.remove('aice-' + type);
      if (type === 'highlight') {
        span.style.backgroundColor = '';
        span.removeAttribute('data-aice-highlight');
      } else if (type === 'textColor') {
        span.style.color = '';
        span.removeAttribute('data-aice-textColor');
      }

      if (types.length === 0) {
        this.removeAnnotation(span);
        return;
      }
      span.setAttribute('data-aice-type', types.join(' '));
      this._saveAnnotationData(span);
    }

    // 对 span 元素添加单个格式
    _addFormatToElement(span, type, color) {
      const types = (span.getAttribute('data-aice-type') || '').split(' ').filter(Boolean);
      if (!types.includes(type)) types.push(type);
      span.setAttribute('data-aice-type', types.join(' '));

      if (type === 'underline') {
        span.classList.add('aice-underline');
      } else if (type === 'bold') {
        span.classList.add('aice-bold');
      } else if (type === 'highlight') {
        span.classList.add('aice-highlight');
        const hex = this._toHex(color);
        if (hex) {
          span.style.backgroundColor = this._hexToRgba(hex, 0.3);
          span.setAttribute('data-aice-highlight', hex);
        }
      } else if (type === 'textColor') {
        span.classList.add('aice-text-color');
        const hex = this._toHex(color);
        if (hex) {
          span.style.color = hex;
          span.setAttribute('data-aice-textColor', hex);
        }
      }
    }

    // === 兼容旧版 updateAnnotationStyle ===

    async updateAnnotationStyle(spanEl, type, color) {
      this.addFormatToSpan(spanEl, type, color);
    }

    // === 删除标注 ===

    async removeAnnotation(spanEl) {
      const id = spanEl.getAttribute('data-aice-id');
      const text = spanEl.textContent || '';
      const parent = spanEl.parentNode;
      if (parent) {
        const textNode = document.createTextNode(text);
        parent.replaceChild(textNode, spanEl);
        parent.normalize();
      }
      if (id) {
        await deleteAnnotation(id, this.platform, this.conversationId || location.href);
      }
    }

    // === 存储 ===

    async _saveAnnotationData(span) {
      // 允许 conversationId 为空时仍保存（用 URL 作为 key）
      const convId = this.conversationId || location.href;
      const turnEl = findParentTurn(span, this.platform);
      const turns = findElements('turns', this.platform);
      const turnIndex = turnEl ? turns.indexOf(turnEl) : -1;
      const text = span.textContent || '';
      const parentText = turnEl ? (turnEl.textContent || '') : '';
      const offset = parentText.indexOf(text);
      const data = {
        id: span.getAttribute('data-aice-id'),
        platform: this.platform,
        conversationId: convId,
        turnIndex,
        text,
        contextBefore: parentText.substring(Math.max(0, offset - 60), Math.max(0, offset)),
        contextAfter: parentText.substring(offset + text.length, offset + text.length + 60),
        type: span.getAttribute('data-aice-type') || '',
        highlight: span.getAttribute('data-aice-highlight') || '',
        textColor: span.getAttribute('data-aice-textColor') || '',
        timestamp: Date.now()
      };
      // 删除旧的再保存新的
      if (data.id) {
        try { await deleteAnnotation(data.id, this.platform, convId); } catch (e) { /* ignore */ }
      }
      await saveAnnotation(data);
    }

    // === 恢复标注 ===

    async restoreAll() {
      const convId = this.conversationId || location.href;
      const annotations = await getAnnotations(this.platform, convId);
      if (!annotations.length) return;
      const turns = findElements('turns', this.platform);
      for (const data of annotations) {
        await this._restoreOne(data, turns);
      }
    }

    async _restoreOne(data, turns) {
      if (data.turnIndex < 0 || data.turnIndex >= turns.length) return;
      const turnEl = turns[data.turnIndex];
      if (!turnEl) return;
      const textContent = turnEl.textContent || '';
      let searchStart = 0;
      if (data.contextBefore) {
        const idx = textContent.indexOf(data.contextBefore, searchStart);
        if (idx !== -1) searchStart = idx + data.contextBefore.length;
      }
      const textIdx = textContent.indexOf(data.text, searchStart);
      if (textIdx === -1) return;
      this._wrapTextAtOffset(turnEl, textIdx, data.text.length, data);
    }

    _wrapTextAtOffset(container, offset, length, data) {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          if (node.parentNode && node.parentNode.hasAttribute &&
              node.parentNode.hasAttribute('data-aice-annotation')) return NodeFilter.FILTER_REJECT;
          if (node.parentNode && (node.parentNode.nodeName === 'SCRIPT' || node.parentNode.nodeName === 'STYLE'))
            return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      let currentOffset = 0, targetNode = null, nodeStartOffset = 0;
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const nodeLen = node.textContent.length;
        if (currentOffset + nodeLen > offset) { targetNode = node; nodeStartOffset = currentOffset; break; }
        currentOffset += nodeLen;
      }
      if (!targetNode) return;

      const relativeOffset = offset - nodeStartOffset;
      if (relativeOffset + length <= targetNode.textContent.length) {
        const afterNode = targetNode.splitText(relativeOffset + length);
        const annotationNode = targetNode.splitText(relativeOffset);
        const span = document.createElement('span');
        span.setAttribute('data-aice-annotation', 'true');
        if (data.id) span.setAttribute('data-aice-id', data.id);

        // 恢复多格式
        const types = (data.type || '').split(' ').filter(Boolean);
        types.forEach(t => {
          let c = null;
          if (t === 'highlight') c = data.highlight || data.color;
          if (t === 'textColor') c = data.textColor || data.color;
          this._addFormatToElement(span, t, c);
        });

        if (annotationNode.parentNode) {
          annotationNode.parentNode.replaceChild(span, annotationNode);
          span.appendChild(annotationNode);
        }
      }
    }

    // === 判断选区 ===

    _isInConversation(range) {
      const container = range.commonAncestorContainer;
      const el = container.nodeType === 3 ? container.parentNode : container;
      if (!el) return false;
      // 排除扩展自身 UI
      if (el.closest('.aice-toolbar-host, .aice-timeline-host, .aice-timeline-popover, .aice-prompt-float-host, .aice-copy-host, .aice-followup-notification, .aice-timeline-context-menu, .aice-annotation-tooltip')) return false;
      // 排除导航/侧栏/页脚
      if (el.closest('nav, header[role="banner"], footer, [role="navigation"], [role="banner"], [role="contentinfo"]')) return false;
      // 存在对话轮次容器 → 明确在对话中
      if (findParentTurn(el, this.platform)) return true;
      // 在 main 或 body 中有大量文本内容的区域 → 视为对话
      if (isInConversationArea(el)) return true;
      // 宽松模式：选中的文本在 body 中且不在已知 UI 以外 → 允许标注
      return true;
    }

    // === 点击标注 ===

    _onAnnotationClick(e) {
      const target = e.target;
      if (target.hasAttribute && target.hasAttribute('data-aice-annotation')) {
        e.preventDefault();
        e.stopPropagation();
        if (this._toolbar) {
          this._toolbar.showForAnnotation(target);
        } else {
          this._showAnnotationTooltip(target);
        }
      }
    }

    _showAnnotationTooltip(spanEl) {
      this._removeTooltip();
      const tooltip = document.createElement('div');
      tooltip.className = 'aice-annotation-tooltip';
      tooltip.setAttribute('data-aice-tooltip', 'true');
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'aice-delete-btn';
      deleteBtn.textContent = '删除标注';
      deleteBtn.addEventListener('click', ev => {
        ev.stopPropagation();
        this.removeAnnotation(spanEl);
        this._removeTooltip();
      });
      tooltip.appendChild(deleteBtn);
      document.body.appendChild(tooltip);
      const rect = spanEl.getBoundingClientRect();
      tooltip.style.left = Math.max(5, rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
      tooltip.style.top = (rect.top - tooltip.offsetHeight - 6) + 'px';
      this._tooltipEl = tooltip;
      const closeHandler = ev => {
        if (!tooltip.contains(ev.target) && ev.target !== spanEl) {
          this._removeTooltip();
          document.removeEventListener('click', closeHandler, true);
        }
      };
      setTimeout(() => document.addEventListener('click', closeHandler, true), 10);
    }

    _removeTooltip() {
      if (this._tooltipEl?.parentNode) this._tooltipEl.parentNode.removeChild(this._tooltipEl);
      this._tooltipEl = null;
    }
  }

  ns.AnnotationManager = AnnotationManager;

})(window.AIChatEnhancer);
