/* Aplicação principal: dados do restaurante, cabeçalho, catálogo (busca e filtros) e integração com sacola e 3D/AR. */
(function () {
  'use strict';
  const U = window.AthinaUtils;
  const CFG = window.ATHINA_CONFIG;
  const TODOS = window.ATHINA_CARDAPIO;
  // Itens com `oculto: true` (ex.: testes de modelos 3D) não aparecem no cardápio, só por link direto.
  const MENU = TODOS.filter((p) => !p.oculto);
  const CATS = window.ATHINA_CATEGORIAS;
  const catName = (id) => (CATS.find((c) => c.id === id) || {}).nome || '';

  const state = { categoria: 'todos', termo: '' };

  /* ------------------------------------------------------------------ Dados do restaurante na página */
  function fillInfo() {
    U.$$('[data-whatsapp]').forEach((a) => {
      a.href = U.whatsappUrl('Olá, Athina! Vim pelo site e gostaria de mais informações.');
    });
    U.$$('[data-whatsapp-numero]').forEach((a) => { a.textContent = CFG.whatsappExibicao; });
    U.$$('[data-instagram]').forEach((a) => { a.href = CFG.instagramUrl; });
    U.$$('[data-instagram-usuario]').forEach((a) => { a.textContent = '@' + CFG.instagramUsuario; });
    U.$$('[data-endereco]').forEach((e) => { e.textContent = CFG.endereco.completo; });
    U.$$('[data-funcionamento]').forEach((e) => { e.textContent = CFG.funcionamento; });
    U.$$('[data-funcionamento-detalhe]').forEach((e) => { e.textContent = CFG.funcionamentoDetalhe; });
    U.$$('[data-ano]').forEach((e) => { e.textContent = new Date().getFullYear(); });

    const destino = encodeURIComponent(CFG.endereco.completo);
    document.getElementById('rota').href = `https://www.google.com/maps/dir/?api=1&destination=${destino}`;

    // iFood: botão só aparece quando o link oficial for configurado.
    const slot = document.getElementById('ifood-slot');
    slot.innerHTML = CFG.ifoodUrl
      ? `<a href="${U.escape(CFG.ifoodUrl)}" target="_blank" rel="noopener" class="btn btn-outline-light w-full justify-center"><i data-lucide="bike" class="size-5"></i> Pedir pelo iFood</a>`
      : `<p class="ifood-card"><i data-lucide="bike" class="size-5 text-mostarda"></i> Também estamos no iFood — procure “Athina Bistrô” no app.</p>`;

    if (CFG.bandUrl) {
      U.$$('.band-seal').forEach((s) => {
        const a = document.createElement('a');
        a.href = CFG.bandUrl; a.target = '_blank'; a.rel = 'noopener';
        a.className = s.className; a.innerHTML = s.innerHTML; a.title = 'Assistir: Athina na Band';
        s.replaceWith(a);
      });
    }

    document.getElementById('aviso-demo').hidden = !CFG.cardapioDemonstrativo;

    // Mapa só carrega quando o visitante pede (privacidade e desempenho).
    const btn = document.getElementById('mapa-carregar');
    btn.addEventListener('click', () => {
      const frame = document.createElement('iframe');
      frame.src = `https://www.google.com/maps?q=${destino}&output=embed`;
      frame.title = `Mapa: ${CFG.endereco.completo}`;
      frame.loading = 'lazy';
      frame.referrerPolicy = 'no-referrer-when-downgrade';
      frame.allowFullscreen = true;
      document.getElementById('mapa').appendChild(frame);
      btn.remove();
      frame.focus();
    });
  }

  /* ------------------------------------------------------------------ Cabeçalho */
  function header() {
    const h = document.getElementById('topo');
    let lastY = window.scrollY;
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      const goingDown = y > lastY;
      let s = y < 40 ? 'top' : 'scrolled';
      // Esconde ao descer (mais espaço no celular) e reaparece ao subir.
      // (apenas no celular, onde a barra inferior do pedido fica sempre visível)
      if (window.innerWidth < 768 && y > 600 && goingDown && y - lastY > 4 && !document.body.classList.contains('no-scroll')) s = 'hidden';
      if (h.dataset.state !== s) h.dataset.state = s;
      lastY = y;
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
    h.addEventListener('focusin', () => { if (h.dataset.state === 'hidden') h.dataset.state = 'scrolled'; });
    update();

    // Menu mobile
    const menu = document.getElementById('mobile-menu');
    const mb = document.getElementById('menu-button');
    mb.addEventListener('click', () => {
      mb.setAttribute('aria-expanded', 'true');
      U.overlay.open(menu, { onClose: () => mb.setAttribute('aria-expanded', 'false') });
    });

    // Link ativo conforme a seção visível
    const links = U.$$('.nav-link');
    const sections = ['inicio', 'cardapio', 'bistro', 'localizacao'].map((id) => document.getElementById(id));
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          links.forEach((l) => l.setAttribute('aria-current', String(l.getAttribute('href') === '#' + en.target.id)));
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      sections.forEach((s) => s && io.observe(s));
    }
  }

  /* ------------------------------------------------------------------ Catálogo */
  function matches(p, termo) {
    if (!termo) return true;
    const hay = U.normalize([p.nome, p.descricao, catName(p.categoria), ...(p.ingredientes || []), ...(p.tags || [])].join(' '));
    return termo.split(/\s+/).every((t) => hay.includes(t));
  }

  function filtered() {
    return MENU.filter((p) => (state.categoria === 'todos' || p.categoria === state.categoria) && matches(p, state.termo));
  }

  function renderFilters() {
    const box = document.getElementById('filtros');
    box.innerHTML = CATS.map((c) => {
      const n = c.id === 'todos' ? MENU.length : MENU.filter((p) => p.categoria === c.id).length;
      return `<button type="button" class="chip" data-cat="${c.id}" aria-pressed="${state.categoria === c.id}">${U.escape(c.nome)} <span class="count">${n}</span></button>`;
    }).join('');
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]');
      if (!b || b.dataset.cat === state.categoria) return;
      state.categoria = b.dataset.cat;
      U.$$('[data-cat]', box).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: U.prefersReducedMotion() ? 'auto' : 'smooth' });
      renderGrid(true);
    });
  }

  function card(p, i) {
    const t = state.termo;
    const termoIngred = (ing) => (t && t.split(/\s+/).some((w) => U.normalize(ing).includes(w)) ? U.highlight(ing, t.split(/\s+/).find((w) => U.normalize(ing).includes(w))) : U.escape(ing));
    const tags = (p.tags || []).map((tg) => `<span class="badge badge-light">${U.escape(tg)}</span>`).join('');
    return `
    <article class="dish" style="--i:${i}" data-id="${p.id}" aria-labelledby="t-${p.id}">
      <div class="dish-media skeleton">
        <img src="${p.imagem}-480.webp" srcset="${p.imagem}-480.webp 480w, ${p.imagem}-960.webp 960w" sizes="(min-width:1100px) 31vw, (min-width:640px) 46vw, 92vw"
             alt="${U.escape(p.nome)} (foto ilustrativa)" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async" class="is-loading" width="480" height="360">
        <div class="dish-badges">
          <span class="flex flex-wrap gap-1.5">${p.destaque ? '<span class="badge badge-gold"><i data-lucide="star" class="size-3"></i> Destaque</span>' : ''}${tags}</span>
          ${p.porcao === 'duas' ? '<span class="badge badge-red"><i data-lucide="users" class="size-3"></i> Para 2</span>' : ''}
        </div>
        ${p.modelo ? '<span class="dish-3d-hint"><i data-lucide="box" class="size-3.5"></i> 3D · AR</span>' : ''}
      </div>
      <div class="dish-body">
        <p class="dish-cat">${U.escape(catName(p.categoria))}</p>
        <h3 class="dish-title" id="t-${p.id}">${U.highlight(p.nome, t)}</h3>
        <p class="dish-desc" id="d-${p.id}">${U.escape(p.descricao)}</p>
        <button type="button" class="more-btn" data-more aria-expanded="false" aria-controls="d-${p.id}">Ler mais</button>
        <ul class="ingredients" aria-label="Ingredientes">${p.ingredientes.map((ing) => `<li>${termoIngred(ing)}</li>`).join('')}</ul>
        <div class="dish-foot">
          <div class="dish-price">
            <strong>${U.money(p.preco)}</strong>
            <span><i data-lucide="${p.porcao === 'duas' ? 'users' : 'user'}" class="size-3.5"></i>${p.porcao === 'duas' ? 'Serve 2 pessoas' : 'Porção individual'}</span>
          </div>
          <div class="dish-actions">
            <button type="button" class="btn btn-gold add" data-add><i data-lucide="plus" class="size-5"></i> <span>Adicionar ao Pedido</span></button>
            <button type="button" class="btn btn-soft" data-view="3d" aria-label="Visualizar ${U.escape(p.nome)} em 3D"><i data-lucide="rotate-3d" class="size-4"></i> Ver em 3D</button>
            <button type="button" class="btn btn-soft ar" data-view="ar" aria-label="Ver ${U.escape(p.nome)} na minha mesa com realidade aumentada"><i data-lucide="scan-line" class="size-4"></i> Ver na Minha Mesa</button>
          </div>
        </div>
      </div>
    </article>`;
  }

  let switchTimer;
  function renderGrid(animate) {
    const grid = document.getElementById('grade');
    const list = filtered();
    const draw = () => {
      grid.innerHTML = list.map(card).join('');
      U.icons(grid);
      U.$$('.dish-media img', grid).forEach((img) => {
        const done = () => { img.classList.remove('is-loading'); img.parentElement.classList.remove('skeleton'); };
        if (img.complete && img.naturalWidth) done();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', () => { img.srcset = ''; img.src = 'assets/images/placeholder-prato.svg'; done(); }, { once: true });
      });
      // "Ler mais" apenas quando o texto estiver de fato cortado
      requestAnimationFrame(() => U.$$('.dish-desc', grid).forEach((d) => {
        const btn = d.nextElementSibling;
        if (d.scrollHeight <= d.clientHeight + 2) btn.hidden = true;
      }));
      grid.classList.remove('is-switching');
    };
    const cat = state.categoria === 'todos' ? '' : ` em ${catName(state.categoria)}`;
    document.getElementById('contagem').textContent = list.length
      ? `${list.length} ${list.length === 1 ? 'prato' : 'pratos'}${cat}${state.termo ? ` para “${document.getElementById('busca').value.trim()}”` : ''}`
      : '';
    document.getElementById('vazio').hidden = list.length > 0;

    clearTimeout(switchTimer);
    if (animate && !U.prefersReducedMotion()) {
      grid.classList.add('is-switching');
      switchTimer = setTimeout(draw, 200);
    } else draw();
  }

  function catalogEvents() {
    const grid = document.getElementById('grade');
    grid.addEventListener('click', (e) => {
      const art = e.target.closest('.dish');
      if (!art) return;
      const p = MENU.find((x) => x.id === art.dataset.id);
      const more = e.target.closest('[data-more]');
      if (more) {
        const d = art.querySelector('.dish-desc');
        const open = d.classList.toggle('is-expanded');
        more.textContent = open ? 'Ler menos' : 'Ler mais';
        more.setAttribute('aria-expanded', String(open));
        return;
      }
      const add = e.target.closest('[data-add]');
      if (add) {
        window.AthinaCart.add(p.id);
        add.classList.add('added');
        add.querySelector('span').textContent = 'Adicionado!';
        setTimeout(() => { add.classList.remove('added'); add.querySelector('span').textContent = 'Adicionar ao Pedido'; }, 1400);
        return;
      }
      const view = e.target.closest('[data-view]');
      if (view) window.AthinaViewer.open(p, { mode: view.dataset.view });
    });

    const input = document.getElementById('busca');
    const clear = document.getElementById('busca-limpar');
    const run = U.debounce(() => { state.termo = U.normalize(input.value); renderGrid(false); }, 160);
    input.addEventListener('input', () => { clear.hidden = !input.value; run(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape' && input.value) { e.stopPropagation(); clear.click(); } });
    clear.addEventListener('click', () => { input.value = ''; clear.hidden = true; state.termo = ''; renderGrid(false); input.focus(); });

    document.getElementById('vazio-limpar').addEventListener('click', () => {
      input.value = ''; clear.hidden = true; state.termo = '';
      state.categoria = 'todos';
      U.$$('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.cat === 'todos')));
      renderGrid(true);
    });
  }

  /* ------------------------------------------------------------------ Destaque do hero */
  function heroFeature() {
    const p = MENU.find((x) => x.destaque) || MENU[0];
    const box = document.getElementById('hero-feature');
    box.innerHTML = `
      <div class="feature-card">
        <img src="${p.imagem}-960.webp" alt="${U.escape(p.nome)} (foto ilustrativa)" loading="lazy" decoding="async">
        <div class="p-5">
          <p class="eyebrow text-mostarda">Experimente em 3D</p>
          <p class="mt-1 font-display text-2xl font-semibold leading-tight">${U.escape(p.nome)}</p>
          <div class="mt-4 flex items-center justify-between gap-3">
            <span class="font-display text-2xl text-mostarda">${U.money(p.preco)}</span>
            <button type="button" class="btn btn-outline-light text-sm" data-hero-ar><i data-lucide="scan-line" class="size-4"></i> Ver na Minha Mesa</button>
          </div>
        </div>
      </div>`;
    box.querySelector('[data-hero-ar]').addEventListener('click', () => window.AthinaViewer.open(p, { mode: 'ar' }));
  }

  /* ------------------------------------------------------------------ Animações de entrada */
  function reveal() {
    const items = U.$$('.reveal');
    if (!('IntersectionObserver' in window) || U.prefersReducedMotion()) { items.forEach((i) => i.classList.add('is-visible')); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach((i) => io.observe(i));
  }

  /* ------------------------------------------------------------------ Links diretos (?prato=id&modo=ar) — úteis para QR Codes nas mesas */
  function deepLink() {
    const q = new URLSearchParams(location.search);
    const id = q.get('prato');
    if (!id) return;
    const p = TODOS.find((x) => x.id === id);
    if (!p) return;
    document.getElementById('cardapio').scrollIntoView();
    setTimeout(() => window.AthinaViewer.open(p, { mode: q.get('modo') === 'ar' ? 'ar' : '3d' }), 300);
  }

  /* ------------------------------------------------------------------ Inicialização */
  function start() {
    fillInfo();
    header();
    renderFilters();
    renderGrid(false);
    catalogEvents();
    heroFeature();
    window.AthinaCart.init();
    window.AthinaViewer.init();
    window.AthinaCart.onChange((info) => {
      if (info.added) {
        U.toast(`<strong>${U.escape(info.added.nome)}</strong> adicionado ao pedido.`, {
          image: `${info.added.imagem}-480.webp`,
          action: { label: 'Ver sacola', onClick: () => window.AthinaCart.open() },
        });
        U.$$('[data-cart-count]').forEach((b) => { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); });
      }
    });
    reveal();
    U.icons();
    deepLink();
  }

  // Lucide é carregado com "defer": inicializa quando o DOM estiver pronto.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  window.addEventListener('load', () => U.icons());
})();
