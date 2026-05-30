// AI Chat Enhancer - 选中文字浮动工具栏
window.AIChatEnhancer = window.AIChatEnhancer || {};

(function(ns) {
  'use strict';

  const { debounce } = ns.utils;
  const { detectPlatform, findElement, getSelector } = ns.platforms;
  const { getPref, setPref } = ns.storage;

  const COLORS_PREF_KEY = 'annotation_colors';
  const DEFAULT_COLORS = ['#F6E268', '#FC7D9F', '#6BD66B', '#68B5FB'];

  class SelectionToolbar {
    constructor(annotationManager, followUpMonitor) {
      this.annotationMgr = annotationManager;
      this._followUpMonitor = followUpMonitor || null;
      this.platform = null;
      this.host = null;
      this.toolbar = null;
      this.visible = false;
      this._colors = [...DEFAULT_COLORS];
      this._activeAnnotationEl = null;
      this._textColorBtns = [];
      this._highlightBtns = [];
      this._underlineBtn = null;
      this._boldBtn = null;

      this._onMouseUp = this._onMouseUp.bind(this);
      this._onMouseDown = this._onMouseDown.bind(this);
      this._onClick = this._onClick.bind(this);
    }

    async init() {
      this.platform = detectPlatform();
      if (this.platform === 'unknown') return;
      await this._loadColors();
      this._createDOM();
      document.addEventListener('mouseup', this._onMouseUp);
      document.addEventListener('mousedown', this._onMouseDown);
      document.addEventListener('click', this._onClick);
    }

    destroy() {
      document.removeEventListener('mouseup', this._onMouseUp);
      document.removeEventListener('mousedown', this._onMouseDown);
      document.removeEventListener('click', this._onClick);
      if (this.host?.parentNode) this.host.parentNode.removeChild(this.host);
    }

    async _loadColors() {
      try {
        const saved = await getPref(COLORS_PREF_KEY, null);
        if (saved && Array.isArray(saved) && saved.length > 0) {
          this._colors = saved.filter(c => /^#[0-9a-fA-F]{6}$/.test(c));
          if (this._colors.length === 0) this._colors = [...DEFAULT_COLORS];
        }
      } catch (e) { this._colors = [...DEFAULT_COLORS]; }
    }

    _topColors() { return this._colors.slice(0, 4); }

    _createDOM() {
      this.host = document.createElement('div');
      this.host.className = 'aice-toolbar-host';
      this.host.style.display = 'none';
      this.toolbar = document.createElement('div');
      this.toolbar.className = 'aice-toolbar';
      this._buildToolbar();
      this.host.appendChild(this.toolbar);
      document.body.appendChild(this.host);
    }

    _buildToolbar() {
      this._addQuoteBtn();
      this._addSeparator();
      this._underlineBtn = this._addSvgBtn('underline', this._svgUnderline(), () => this._handleAnnotation('underline'));
      this._boldBtn = this._addSvgBtn('bold', this._svgBold(), () => this._handleAnnotation('bold'));
      this._addSeparator();
      const topColors = this._topColors();
      topColors.forEach((color, i) => {
        const btn = this._addTextColorButton(color, i, () => this._handleAnnotation('textColor', color));
        this._textColorBtns.push(btn);
      });
      this._addSeparator();
      topColors.forEach((color, i) => {
        const btn = this._addHighlightButton(color, i, () => this._handleAnnotation('highlight', color));
        this._highlightBtns.push(btn);
      });
    }

    _addQuoteBtn() {
      const btn = document.createElement('button');
      btn.className = 'aice-toolbar-btn';
      btn.setAttribute('data-action', 'quote');
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 3.5v4a1.5 1.5 0 0 1-1.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 3.5v4a1.5 1.5 0 0 1-1.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      btn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
      btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); this._handleQuote(); });
      this.toolbar.appendChild(btn);
    }

    _addSvgBtn(name, svg, onClick) {
      const btn = document.createElement('button');
      btn.className = 'aice-toolbar-btn';
      btn.setAttribute('data-action', name);
      btn.innerHTML = svg;
      btn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
      btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); onClick(e); });
      this.toolbar.appendChild(btn);
      return btn;
    }

    _svgUnderline() {
      return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 13.5h10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M4 2.5v5a4 4 0 0 0 8 0v-5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
    }

    _svgBold() {
      return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4.5 3h4a3 3 0 0 1 0 6H4.5V3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M4.5 9h4.5a3 3 0 0 1 0 6H4.5V9z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    }

    _addTextColorButton(color, index, onClick) {
      const btn = document.createElement('button');
      btn.className = 'aice-toolbar-btn aice-text-color-btn';
      btn.setAttribute('data-action', 'textColor-' + index);
      btn.setAttribute('data-color', color);
      btn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
      btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); onClick(e); });
      // 统一 16×16 图标：大写 A + 底部颜色横条
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <text x="8" y="11" text-anchor="middle" font-size="13" font-weight="600" fill="${color}" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif">A</text>
        <rect x="2" y="13" width="12" height="2.5" rx="1.25" fill="${color}"/>
      </svg>`;
      this.toolbar.appendChild(btn);
      return btn;
    }

    _addHighlightButton(color, index, onClick) {
      const btn = document.createElement('button');
      btn.className = 'aice-toolbar-btn aice-highlight-btn';
      btn.setAttribute('data-action', 'highlight-' + index);
      btn.setAttribute('data-color', color);
      btn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
      btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); onClick(e); });
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" fill="${color}" stroke="rgba(0,0,0,0.1)" stroke-width="0.5"/>
      </svg>`;
      this.toolbar.appendChild(btn);
      return btn;
    }

    _addSeparator() {
      const sep = document.createElement('span');
      sep.className = 'aice-toolbar-sep';
      this.toolbar.appendChild(sep);
    }

    // === 颜色 API ===

    async updateColors(newColors) {
      this._colors = newColors.filter(c => /^#[0-9a-fA-F]{6}$/.test(c));
      if (this._colors.length === 0) this._colors = [...DEFAULT_COLORS];
      await setPref(COLORS_PREF_KEY, this._colors);
      this.toolbar.innerHTML = '';
      this._textColorBtns = [];
      this._highlightBtns = [];
      this._underlineBtn = null;
      this._boldBtn = null;
      this._buildToolbar();
    }

    getColors() { return [...this._colors]; }

    // === 显示/隐藏 ===

    _onMouseUp(e) {
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        if (!range || range.collapsed) return;
        const text = selection.toString().trim();
        if (!text) return;
        if (this.host && this.host.contains(range.commonAncestorContainer)) return;
        this._activeAnnotationEl = null;
        this._updateSelectedState(null);
        this._showAtSelection(range);
      }, 10);
    }

    _onMouseDown(e) {
      if (this.host && !this.host.contains(e.target)) this.hide();
    }

    _onClick(e) {
      if (this.host && !this.host.contains(e.target)) {
        if (e.target.hasAttribute && e.target.hasAttribute('data-aice-annotation')) return;
        this.hide();
      }
    }

    _showAtSelection(range) {
      const rect = range.getBoundingClientRect();
      if (!rect || rect.width === 0) { this.hide(); return; }
      this._positionAt(rect);
    }

    _positionAt(rect) {
      // 出现在选中文本上方 50px，完全不遮挡选中内容
      let top = rect.top - this.toolbar.offsetHeight - 50;
      if (top < 12) top = rect.bottom + 50;
      this.host.style.display = '';
      const w = this.toolbar.offsetWidth || 300;
      let left = rect.left + rect.width / 2;
      if (left - w / 2 < 12) left = 12 + w / 2;
      if (left + w / 2 > window.innerWidth - 12) left = window.innerWidth - 12 - w / 2;
      this.host.style.left = left + 'px';
      this.host.style.top = top + 'px';
      this.host.style.transform = 'translateX(-50%)';
      this.visible = true;
    }

    hide() {
      if (this.host) this.host.style.display = 'none';
      this.visible = false;
      this._activeAnnotationEl = null;
      this._updateSelectedState(null);
    }

    // === 点击标注 → 显示工具栏（支持多格式） ===

    showForAnnotation(spanEl) {
      this._activeAnnotationEl = spanEl;
      const typesStr = spanEl.getAttribute('data-aice-type') || '';
      const types = typesStr.split(' ').filter(Boolean);
      const cls = spanEl.className || '';

      // 兼容旧格式
      let resolvedTypes = types.length ? types : [];
      if (!resolvedTypes.length) {
        if (cls.includes('aice-underline')) resolvedTypes.push('underline');
        if (cls.includes('aice-bold')) resolvedTypes.push('bold');
        if (cls.includes('aice-highlight')) resolvedTypes.push('highlight');
        if (cls.includes('aice-text-color')) resolvedTypes.push('textColor');
      }

      const colors = {};
      const highlightColor = spanEl.getAttribute('data-aice-highlight');
      const textColor = spanEl.getAttribute('data-aice-textColor');
      if (highlightColor) colors.highlight = highlightColor;
      if (textColor) colors.textColor = textColor;

      // 兼容旧格式
      if (!colors.highlight && resolvedTypes.includes('highlight')) {
        const oldMap = { yellow: '#F6E268', blue: '#68B5FB', red: '#FC7D9F', green: '#6BD66B' };
        for (const [name, hex] of Object.entries(oldMap)) {
          if (cls.includes('aice-highlight-' + name)) { colors.highlight = hex; break; }
        }
      }

      this._updateSelectedState(resolvedTypes, colors);
      const rect = spanEl.getBoundingClientRect();
      this._positionAt(rect);
    }

    _updateSelectedState(types, activeColors) {
      this._textColorBtns.forEach(b => b.classList.remove('aice-btn-selected'));
      this._highlightBtns.forEach(b => b.classList.remove('aice-btn-selected'));
      if (this._underlineBtn) this._underlineBtn.classList.remove('aice-btn-selected');
      if (this._boldBtn) this._boldBtn.classList.remove('aice-btn-selected');

      if (!types || !types.length) return;
      const list = Array.isArray(types) ? types : [types];
      const colors = activeColors || {};

      list.forEach(t => {
        if (t === 'underline' && this._underlineBtn) this._underlineBtn.classList.add('aice-btn-selected');
        if (t === 'bold' && this._boldBtn) this._boldBtn.classList.add('aice-btn-selected');
        if (t === 'textColor') {
          const c = colors.textColor;
          if (c) {
            const idx = this._topColors().indexOf(c);
            if (idx >= 0 && this._textColorBtns[idx]) this._textColorBtns[idx].classList.add('aice-btn-selected');
          }
        }
        if (t === 'highlight') {
          const c = colors.highlight;
          if (c) {
            const idx = this._topColors().indexOf(c);
            if (idx >= 0 && this._highlightBtns[idx]) this._highlightBtns[idx].classList.add('aice-btn-selected');
          }
        }
      });
    }

    // === 操作处理（多格式叠加/切换） ===

    _handleAnnotation(type, color) {
      if (this._activeAnnotationEl) {
        const typesStr = this._activeAnnotationEl.getAttribute('data-aice-type') || '';
        const currentTypes = typesStr.split(' ').filter(Boolean);
        if (currentTypes.includes(type)) {
          // 颜色类格式：同色则移除，异色则更新
          if (type === 'textColor' || type === 'highlight') {
            const attr = 'data-aice-' + type;
            const currentColor = this._activeAnnotationEl.getAttribute(attr);
            const newHex = this.annotationMgr._toHex(color);
            if (currentColor === newHex) {
              this.annotationMgr.removeFormatFromSpan(this._activeAnnotationEl, type);
            } else {
              this.annotationMgr.updateFormatOnSpan(this._activeAnnotationEl, type, color);
            }
          } else {
            // 无颜色格式（underline/bold）：切换
            this.annotationMgr.removeFormatFromSpan(this._activeAnnotationEl, type);
          }
        } else {
          this.annotationMgr.addFormatToSpan(this._activeAnnotationEl, type, color);
        }
        this._activeAnnotationEl = null;
        this.hide();
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) { this.hide(); return; }
      this.annotationMgr.applyAnnotation(type, color);
      this.hide();
    }

    _handleQuote() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const text = selection.toString().trim();
      if (!text) return;
      const inputSelector = getSelector('inputArea', this.platform);
      const inputEl = document.querySelector(inputSelector);
      if (inputEl) {
        const quoteText = `> ${text}\n\n`;
        if (inputEl.isContentEditable) {
          inputEl.focus();
          const sel = window.getSelection();
          if (sel.rangeCount) {
            const r = sel.getRangeAt(0);
            r.deleteContents();
            const tn = document.createTextNode(quoteText);
            r.insertNode(tn); r.setStartAfter(tn); r.collapse(true);
            sel.removeAllRanges(); sel.addRange(r);
          }
        } else if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
          inputEl.focus();
          const start = inputEl.selectionStart || 0;
          const val = inputEl.value || '';
          inputEl.value = val.substring(0, start) + quoteText + val.substring(start);
          inputEl.selectionStart = inputEl.selectionEnd = start + quoteText.length;
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else {
        navigator.clipboard.writeText(quoteText).catch(() => {});
      }
      if (this._followUpMonitor) this._followUpMonitor.start(text);
      this.hide();
    }
  }

  ns.SelectionToolbar = SelectionToolbar;

})(window.AIChatEnhancer);
