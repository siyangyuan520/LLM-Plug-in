// AI Chat Enhancer - 公式/表格悬停复制（多格式导出）
window.AIChatEnhancer = window.AIChatEnhancer || {};

(function(ns) {
  'use strict';

  const { debounce } = ns.utils;
  const { detectPlatform, findElement, findParentTurn } = ns.platforms;
  const { getPref, setPref } = ns.storage;

  // === 公式/表格选择器 ===

  const FORMULA_SELECTORS = [
    '.katex', '.katex-display', '.katex-inline',
    'mjx-container', 'mjx-assistive-mml',
    'math[display], math',
    '.MathJax', '.math-inline', '.math-display',
    '[data-latex]'
  ].join(',');

  const TABLE_SELECTOR = 'table';

  // === 提取函数 ===

  function extractLaTeX(el) {
    const tex = el.getAttribute('data-mjx-tex') || el.getAttribute('data-latex');
    if (tex) return tex;

    const annot = el.querySelector('annotation[encoding="application/x-tex"]');
    if (annot) return annot.textContent.trim();

    // KaTeX 内部
    const mathML = el.querySelector('.katex-mathml');
    if (mathML) {
      const ka = mathML.querySelector('annotation[encoding="application/x-tex"]');
      if (ka) return ka.textContent.trim();
    }

    // 尝试从 math 元素取 annotation
    if (el.tagName === 'MATH') {
      const ma = el.querySelector('annotation[encoding="application/x-tex"]');
      if (ma) return ma.textContent.trim();
    }

    return null;
  }

  function extractMathML(el) {
    if (el.tagName === 'MATH') return el.outerHTML;

    // MathJax 内部 <math>
    const mjMath = el.querySelector('math');
    if (mjMath) return mjMath.outerHTML;

    // KaTeX 隐藏 MathML
    const km = el.querySelector('.katex-mathml math');
    if (km) return km.outerHTML;

    // script 方式
    const script = el.querySelector('script[type="math/mml"], script[type="math/tex"]');
    if (script) return script.textContent.trim();

    return null;
  }

  function extractFormulaPlainText(el) {
    return (el.textContent || '').trim();
  }

  function tableToCSV(table) {
    const rows = table.querySelectorAll('tr');
    return Array.from(rows).map(row => {
      const cells = row.querySelectorAll('th, td');
      return Array.from(cells).map(cell => {
        let text = cell.textContent.trim();
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
          text = '"' + text.replace(/"/g, '""') + '"';
        }
        return text;
      }).join(',');
    }).join('\n');
  }

  function tableToMarkdown(table) {
    const rows = table.querySelectorAll('tr');
    const lines = [];
    rows.forEach((row, i) => {
      const cells = row.querySelectorAll('th, td');
      const texts = Array.from(cells).map(c => c.textContent.trim());
      lines.push('| ' + texts.join(' | ') + ' |');
      if (i === 0) {
        lines.push('| ' + texts.map(() => '---').join(' | ') + ' |');
      }
    });
    return lines.join('\n');
  }

  function tableToPlainText(table) {
    const rows = table.querySelectorAll('tr');
    return Array.from(rows).map(row => {
      const cells = row.querySelectorAll('th, td');
      return Array.from(cells).map(c => c.textContent.trim()).join('\t');
    }).join('\n');
  }

  // === 公式/表格检测 ===

  function isInConversation(el, platform) {
    if (!el) return false;
    const turn = findParentTurn(el, platform);
    return !!turn;
  }

  // === 主类 ===

  class FormulaTableCopy {
    constructor() {
      this._platform = null;
      this._host = null;
      this._buttonEl = null;
      this._dropdownEl = null;
      this._toastEl = null;
      this._currentTarget = null;
      this._currentType = null; // 'formula' | 'table'
      this._hideTimer = null;
      this._toastTimer = null;
      this._dropdownVisible = false;
      this._iconEl = null;
      this._checkTimer = null;

      this._formulaFormats = [
        { id: 'mathml',  label: 'MathML' },
        { id: 'latex',   label: 'LaTeX 原文' },
        { id: 'text',    label: '纯文本' }
      ];
      this._tableFormats = [
        { id: 'csv',      label: 'CSV' },
        { id: 'html',     label: 'HTML 表格' },
        { id: 'markdown', label: 'Markdown' },
        { id: 'text',     label: '纯文本' }
      ];

      this._formulaDefault = 'mathml';
      this._tableDefault = 'csv';

      // bound handlers
      this._onMouseOver = this._onMouseOver.bind(this);
      this._onMouseOut = this._onMouseOut.bind(this);
      this._onClick = this._onClick.bind(this);
      this._onScroll = null;
    }

    async init() {
      this._platform = detectPlatform();

      this._formulaDefault = await getPref('formula_copy_format', 'mathml');
      this._tableDefault = await getPref('table_copy_format', 'csv');

      this._createDOM();
      document.addEventListener('mouseover', this._onMouseOver, true);
      document.addEventListener('mouseout', this._onMouseOut, true);
      document.addEventListener('click', this._onClick, true);

      // 滚动时隐藏
      this._onScroll = debounce(() => {
        if (!this._dropdownVisible) this._hide(true);
      }, 100);
      window.addEventListener('scroll', this._onScroll, true);

      console.log('[AI Chat Enhancer] 公式/表格复制已就绪');
    }

    destroy() {
      document.removeEventListener('mouseover', this._onMouseOver, true);
      document.removeEventListener('mouseout', this._onMouseOut, true);
      document.removeEventListener('click', this._onClick, true);
      if (this._onScroll) window.removeEventListener('scroll', this._onScroll, true);
      if (this._host?.parentNode) this._host.parentNode.removeChild(this._host);
      this._clearTimers();
    }

    // === DOM 创建 ===

    _createDOM() {
      this._host = document.createElement('div');
      this._host.className = 'aice-copy-host';
      this._host.style.display = 'none';
      this._host.innerHTML = `
        <div class="aice-copy-btn">
          <span class="aice-copy-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </span>
          <span class="aice-copy-default-label"></span>
          <span class="aice-copy-arrow">▾</span>
        </div>
        <div class="aice-copy-dropdown"></div>
        <div class="aice-copy-toast"></div>
      `;
      this._buttonEl = this._host.querySelector('.aice-copy-btn');
      this._dropdownEl = this._host.querySelector('.aice-copy-dropdown');
      this._toastEl = this._host.querySelector('.aice-copy-toast');
      this._iconEl = this._host.querySelector('.aice-copy-icon');
      this._labelEl = this._host.querySelector('.aice-copy-default-label');

      document.body.appendChild(this._host);
    }

    // === 事件处理 ===

    _onMouseOver(e) {
      if (this._dropdownVisible) return;

      const target = e.target;
      if (this._host && this._host.contains(target)) {
        if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
        return;
      }

      const formulaEl = target.closest(FORMULA_SELECTORS);
      if (formulaEl && isInConversation(formulaEl, this._platform)) {
        this._show(formulaEl, 'formula');
        return;
      }

      const tableEl = target.closest(TABLE_SELECTOR);
      if (tableEl && isInConversation(tableEl, this._platform)) {
        this._show(tableEl, 'table');
        return;
      }
    }

    _onMouseOut(e) {
      if (this._dropdownVisible) return;
      if (this._host && this._host.contains(e.relatedTarget)) return;
      if (this._currentTarget && this._currentTarget.contains(e.relatedTarget)) return;
      this._scheduleHide();
    }

    _onClick(e) {
      if (!this._buttonEl) return;

      // 点击箭头区域 → 展开/收起下拉菜单
      const arrowEl = this._host.querySelector('.aice-copy-arrow');
      if (arrowEl && arrowEl.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        this._toggleDropdown();
        return;
      }

      // 点击复制按钮主体 → 直接用默认格式复制
      if (this._buttonEl.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        const defaultFormat = this._currentType === 'formula' ? this._formulaDefault : this._tableDefault;
        this._copyAndClose(defaultFormat);
        return;
      }

      // 点击下拉项 → 复制并关闭
      if (this._dropdownEl && this._dropdownEl.contains(e.target)) {
        const item = e.target.closest('[data-format]');
        if (item) {
          e.preventDefault();
          e.stopPropagation();
          const format = item.getAttribute('data-format');
          this._copyAndClose(format);
        }
        return;
      }

      // 点击外部 → 关闭
      if (this._dropdownVisible) {
        this._closeDropdown();
      }
    }

    // === 显示/隐藏 ===

    _show(target, type) {
      if (this._hideTimer) clearTimeout(this._hideTimer);
      if (this._currentTarget === target) return;

      this._currentTarget = target;
      this._currentType = type;
      const defaultFormat = type === 'formula' ? this._formulaDefault : this._tableDefault;

      // 更新按钮标签
      const formats = type === 'formula' ? this._formulaFormats : this._tableFormats;
      const def = formats.find(f => f.id === defaultFormat);
      if (this._labelEl) this._labelEl.textContent = def ? def.label : defaultFormat;

      // 先显示再定位，确保获取正确的按钮宽度
      this._host.style.display = '';
      this._dropdownEl.style.display = 'none';
      this._dropdownVisible = false;
      this._positionButton(target);
    }

    _scheduleHide() {
      if (this._hideTimer) clearTimeout(this._hideTimer);
      this._hideTimer = setTimeout(() => this._hide(false), 350);
    }

    _hide(immediate) {
      if (this._hideTimer) clearTimeout(this._hideTimer);
      if (this._dropdownVisible) return;
      if (immediate) {
        this._host.style.display = 'none';
        this._currentTarget = null;
        this._currentType = null;
      } else {
        this._host.style.display = 'none';
        this._currentTarget = null;
        this._currentType = null;
      }
    }

    _positionButton(target) {
      const rect = target.getBoundingClientRect();
      const btnWidth = this._buttonEl.offsetWidth || 100;
      let top = rect.top - 28;
      let left = rect.right - btnWidth;

      // 确保在视口内
      if (top < 4) top = rect.bottom + 4;
      if (left < 4) left = 4;
      if (left + btnWidth > window.innerWidth - 4) {
        left = window.innerWidth - btnWidth - 4;
      }

      this._host.style.top = top + 'px';
      this._host.style.left = left + 'px';
    }

    // === 下拉菜单 ===

    _toggleDropdown() {
      if (this._dropdownVisible) {
        this._closeDropdown();
        return;
      }
      this._openDropdown();
    }

    _openDropdown() {
      const formats = this._currentType === 'formula' ? this._formulaFormats : this._tableFormats;
      const defaultFormat = this._currentType === 'formula' ? this._formulaDefault : this._tableDefault;

      let html = '';
      formats.forEach(f => {
        const isDefault = f.id === defaultFormat;
        html += `<div class="aice-copy-dropdown-item${isDefault ? ' aice-copy-default' : ''}" data-format="${f.id}">
          <span>${f.label}</span>
          ${isDefault ? '<span class="aice-copy-check">✓</span>' : ''}
        </div>`;
      });

      this._dropdownEl.innerHTML = html;
      this._dropdownEl.style.display = 'block';
      this._dropdownVisible = true;
      this._buttonEl.classList.add('aice-copy-btn-open');

      // 确保下拉在视口内
      const dRect = this._dropdownEl.getBoundingClientRect();
      if (dRect.bottom > window.innerHeight - 8) {
        this._dropdownEl.style.top = 'auto';
        this._dropdownEl.style.bottom = '100%';
      } else {
        this._dropdownEl.style.top = '100%';
        this._dropdownEl.style.bottom = 'auto';
      }
    }

    _closeDropdown() {
      const wasOpen = this._dropdownVisible;
      this._dropdownEl.style.display = 'none';
      this._dropdownVisible = false;
      this._buttonEl.classList.remove('aice-copy-btn-open');
      // 只有真正展开过下拉时才延迟隐藏按钮
      if (wasOpen) {
        this._scheduleHide();
      }
    }

    // === 复制操作 ===

    async _copyAndClose(format) {
      const content = this._extract(format);
      if (!content) {
        this._closeDropdown();
        return;
      }

      try {
        await navigator.clipboard.writeText(content);
      } catch (e) {
        this._fallbackCopy(content);
      }

      // 保存默认格式并更新按钮标签
      const formats = this._currentType === 'formula' ? this._formulaFormats : this._tableFormats;
      if (this._currentType === 'formula') {
        this._formulaDefault = format;
        await setPref('formula_copy_format', format);
      } else {
        this._tableDefault = format;
        await setPref('table_copy_format', format);
      }

      // 更新按钮显示为新默认格式
      const fmt = formats.find(f => f.id === format);
      if (this._labelEl && fmt) {
        this._labelEl.textContent = fmt.label;
      }

      // 图标变为对勾
      this._showCheckmark();
      this._closeDropdown();
    }

    _showCheckmark() {
      if (!this._iconEl) return;
      if (this._checkTimer) clearTimeout(this._checkTimer);

      this._iconEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      this._iconEl.style.color = '#34c759';

      this._checkTimer = setTimeout(() => {
        if (this._iconEl) {
          this._iconEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
          this._iconEl.style.color = '';
        }
      }, 1500);
    }

    _extract(format) {
      if (!this._currentTarget) return null;

      if (this._currentType === 'formula') {
        switch (format) {
          case 'mathml': return extractMathML(this._currentTarget);
          case 'latex':  return extractLaTeX(this._currentTarget) || extractFormulaPlainText(this._currentTarget);
          case 'text':   return extractFormulaPlainText(this._currentTarget);
          default:       return extractMathML(this._currentTarget) || extractFormulaPlainText(this._currentTarget);
        }
      } else {
        switch (format) {
          case 'html':     return this._currentTarget.outerHTML;
          case 'csv':      return tableToCSV(this._currentTarget);
          case 'markdown': return tableToMarkdown(this._currentTarget);
          case 'text':     return tableToPlainText(this._currentTarget);
          default:         return tableToCSV(this._currentTarget);
        }
      }
    }

    _fallbackCopy(text) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
    }

    _clearTimers() {
      if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
      if (this._checkTimer) { clearTimeout(this._checkTimer); this._checkTimer = null; }
    }
  }

  ns.FormulaTableCopy = FormulaTableCopy;

})(window.AIChatEnhancer);
