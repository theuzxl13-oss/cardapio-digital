/* Utilidades compartilhadas: formatação, overlays acessíveis, toasts e armazenamento. */
(function () {
  'use strict';

  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const U = {
    $: (sel, root = document) => root.querySelector(sel),
    $$: (sel, root = document) => Array.from(root.querySelectorAll(sel)),

    money: (v) => brl.format(v || 0).replace(/ /g, ' '),

    escape: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),

    /** Remove acentos e caixa para comparar textos na busca. */
    normalize: (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(),

    /** Destaca o termo buscado ignorando acentos, preservando o texto original. */
    highlight(text, term) {
      const safe = U.escape(text);
      if (!term) return safe;
      const norm = U.normalize(text);
      const i = norm.indexOf(term);
      if (i < 0) return safe;
      return U.escape(text.slice(0, i)) + '<mark>' + U.escape(text.slice(i, i + term.length)) + '</mark>' + U.escape(text.slice(i + term.length));
    },

    icons(root) {
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        try { window.lucide.createIcons({ root: root || document, attrs: { 'aria-hidden': 'true' } }); } catch (e) { /* ícones são decorativos */ }
      }
    },

    debounce(fn, ms) {
      let t;
      return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    },

    storage: {
      get(key, fallback) {
        try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
      },
      set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* modo privado ou armazenamento bloqueado */ }
      },
    },

    whatsappUrl(text) {
      const n = window.ATHINA_CONFIG.whatsapp;
      return `https://wa.me/${n}` + (text ? `?text=${encodeURIComponent(text)}` : '');
    },

    prefersReducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };

  /* ------------------------------------------------------------------ Overlays acessíveis */
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const stack = [];

  function background(on) {
    ['topo', 'conteudo', 'mobile-cart-bar'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.inert = on;
    });
    const footer = document.querySelector('body > footer');
    if (footer) footer.inert = on;
  }

  U.overlay = {
    open(el, opts = {}) {
      if (!el || !el.hidden) return;
      const prev = stack[stack.length - 1];
      if (prev) prev.el.inert = true;
      stack.push({ el, returnFocus: opts.returnFocus || document.activeElement, onClose: opts.onClose });
      el.hidden = false;
      background(true);
      document.body.classList.add('no-scroll');
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-open')));
      const target = opts.initialFocus || el.querySelector('[data-autofocus]') || el.querySelector(FOCUSABLE);
      setTimeout(() => target && target.focus({ preventScroll: true }), 60);
    },
    close(el) {
      const i = stack.findIndex((s) => s.el === el);
      if (i < 0) return;
      const [entry] = stack.splice(i, 1);
      el.classList.remove('is-open');
      const done = () => {
        el.hidden = true;
        if (entry.onClose) entry.onClose();
      };
      if (U.prefersReducedMotion()) done(); else setTimeout(done, 380);
      const top = stack[stack.length - 1];
      if (top) top.el.inert = false;
      else { background(false); document.body.classList.remove('no-scroll'); }
      if (entry.returnFocus && entry.returnFocus.focus && document.contains(entry.returnFocus)) {
        entry.returnFocus.focus({ preventScroll: true });
      }
    },
    isOpen: (el) => stack.some((s) => s.el === el),
    top: () => stack[stack.length - 1]?.el,
  };

  document.addEventListener('keydown', (e) => {
    const top = U.overlay.top();
    if (!top) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      U.overlay.close(top);
    } else if (e.key === 'Tab') {
      const items = U.$$(FOCUSABLE, top).filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-close]');
    if (!closer) return;
    const ov = closer.closest('.overlay');
    if (ov) {
      const href = closer.getAttribute('href');
      U.overlay.close(ov);
      if (href && href.startsWith('#')) {
        // fecha o painel e depois rola até a seção
        e.preventDefault();
        setTimeout(() => {
          const t = document.querySelector(href);
          if (t) t.scrollIntoView({ behavior: U.prefersReducedMotion() ? 'auto' : 'smooth' });
          history.replaceState(null, '', href);
        }, 60);
      }
    }
  });

  /* ------------------------------------------------------------------ Toasts */
  U.toast = function (message, opts = {}) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const t = document.createElement('div');
    t.className = 'toast' + (opts.type === 'error' ? ' error' : '');
    t.setAttribute('role', opts.type === 'error' ? 'alert' : 'status');
    const media = opts.image
      ? `<img src="${U.escape(opts.image)}" alt="">`
      : `<span class="t-icon"><i data-lucide="${opts.icon || (opts.type === 'error' ? 'circle-alert' : 'check')}" class="size-4"></i></span>`;
    t.innerHTML = `${media}<div class="min-w-0 flex-1">${message}</div>${opts.action ? `<button type="button">${U.escape(opts.action.label)}</button>` : ''}`;
    if (opts.action) t.querySelector('button').addEventListener('click', () => { opts.action.onClick(); remove(); });
    box.appendChild(t);
    U.icons(t);
    while (box.children.length > 3) box.firstElementChild.remove();
    const remove = () => { t.classList.add('out'); setTimeout(() => t.remove(), 300); };
    setTimeout(remove, opts.duration || 3200);
  };

  window.AthinaUtils = U;
})();
