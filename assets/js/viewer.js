/*
 * Visualizador 3D e Realidade Aumentada (Google <model-viewer>).
 *
 * - Cada prato carrega o SEU modelo (assets/models/<id>.glb) somente quando o visualizador é aberto.
 * - AR: WebXR (Chrome/Android) → Scene Viewer (Android) → Quick Look (iPhone/iPad, USDZ gerado automaticamente
 *   a partir do GLB ou arquivo próprio em `modeloIos`).
 * - O site nunca afirma que a câmera abriu: as mensagens seguem os eventos reais emitidos pelo dispositivo.
 */
(function () {
  'use strict';
  const U = window.AthinaUtils;

  const els = {};
  let mv = null;          // <model-viewer> atual
  let current = null;     // prato aberto
  let mode = '3d';        // '3d' | 'ar'
  let arStarted = false;
  let loadTimer = null;

  const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = () => /Android/i.test(navigator.userAgent);
  const INITIAL_ORBIT = '25deg 62deg auto';

  /* ------------------------------------------------------------------ Estados visuais */
  function state(kind, opts = {}) {
    const box = els.state;
    if (!kind) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    if (kind === 'loading') {
      box.innerHTML = `<div class="spinner" aria-hidden="true"></div><p class="msg" role="status">Carregando o modelo 3D de <strong>${U.escape(current.nome)}</strong>…</p>`;
    } else {
      box.innerHTML = `
        <i data-lucide="${opts.icon || 'circle-alert'}" class="size-9 text-mostarda"></i>
        <h3>${opts.title}</h3>
        <p class="msg">${opts.message}</p>
        ${opts.image ? `<img src="${opts.image}" alt="" class="mt-2 w-56 max-w-full rounded-2xl opacity-90">` : ''}
        ${opts.retry ? '<button type="button" class="btn btn-gold mt-3" data-retry><i data-lucide="refresh-cw" class="size-4"></i> Tentar novamente</button>' : ''}`;
      U.icons(box);
      const r = box.querySelector('[data-retry]');
      if (r) r.addEventListener('click', () => load());
    }
  }

  function arPanel(html) {
    els.ar.innerHTML = html;
    U.icons(els.ar);
  }

  /* ------------------------------------------------------------------ AR: disponibilidade e mensagens */
  function renderArAvailability() {
    if (!mv) return;
    if (!window.isSecureContext) {
      arPanel(`<div class="ar-note warn"><i data-lucide="shield-alert" class="size-5"></i><div>A realidade aumentada exige conexão segura (HTTPS). Abra o site pelo endereço https:// para usar a câmera. A visualização 3D continua disponível.</div></div>`);
      return;
    }
    if (mv.canActivateAR) {
      const how = isIOS()
        ? 'O iPhone/iPad abrirá o AR Quick Look. Aponte a câmera para a mesa e toque para posicionar.'
        : isAndroid()
          ? 'Ao tocar, o celular abre a experiência de realidade aumentada e pode pedir permissão para usar a câmera. Aponte para uma mesa bem iluminada e mova o celular devagar.'
          : 'Seu dispositivo pedirá acesso à câmera para posicionar o prato.';
      arPanel(`
        <button type="button" class="btn ${mode === 'ar' ? 'btn-gold btn-lg' : 'btn-outline-light'} ar-cta" data-activate-ar>
          <i data-lucide="scan-line" class="size-5"></i> ${mode === 'ar' ? 'Abrir câmera e ver na minha mesa' : 'Ver na Minha Mesa (realidade aumentada)'}
        </button>
        <p class="mt-2 text-center text-xs text-creme/55">${how} O prato aparece em tamanho real.</p>`);
      els.ar.querySelector('[data-activate-ar]').addEventListener('click', activateAR);
      return;
    }
    // Sem suporte a AR neste aparelho/navegador → mantém 3D com rotação e zoom.
    if (!isMobile()) {
      arPanel(`<div class="ar-note"><i data-lucide="smartphone" class="size-5"></i><div>
        <strong>Para ver o prato na sua mesa, abra esta página no celular</strong> (Android com Google Play Services para RA ou iPhone/iPad). No computador você pode girar e ampliar o prato em 3D.
        <div class="row"><button type="button" class="btn btn-outline-light mini" data-copy-link><i data-lucide="copy" class="size-4"></i> Copiar link deste prato</button></div>
      </div></div>`);
      els.ar.querySelector('[data-copy-link]').addEventListener('click', copyLink);
    } else {
      const tip = isIOS() ? 'No iPhone/iPad, abra o site pelo Safari.' : 'No Android, use o Google Chrome atualizado e verifique se o “Google Play Services para RA” está instalado.';
      arPanel(`<div class="ar-note"><i data-lucide="info" class="size-5"></i><div>
        <strong>Este dispositivo ou navegador não oferece realidade aumentada.</strong> Você ainda pode girar e ampliar o prato em 3D. ${tip}
      </div></div>`);
    }
  }

  async function copyLink() {
    const url = new URL(location.href);
    url.hash = '';
    url.search = `?prato=${encodeURIComponent(current.id)}&modo=ar`;
    try {
      await navigator.clipboard.writeText(url.toString());
      U.toast('Link copiado! Abra no celular para ver o prato na sua mesa.', { icon: 'copy' });
    } catch (e) {
      window.prompt('Copie o link e abra no celular:', url.toString());
    }
  }

  function activateAR() {
    if (!mv || !mv.canActivateAR) { renderArAvailability(); return; }
    arStarted = false;
    try {
      const r = mv.activateAR();
      if (r && typeof r.catch === 'function') r.catch(onArFailed);
    } catch (e) { onArFailed(); }
    if (isIOS()) {
      arPanel(`<div class="ar-note"><i data-lucide="info" class="size-5"></i><div>Se o AR Quick Look não abrir, verifique se está usando o Safari em um iPhone/iPad compatível (iOS 12 ou superior).
        <div class="row"><button type="button" class="btn btn-outline-light mini" data-again><i data-lucide="scan-line" class="size-4"></i> Tentar novamente</button></div></div></div>`);
      els.ar.querySelector('[data-again]').addEventListener('click', activateAR);
    }
  }

  function onArFailed() {
    arPanel(`<div class="ar-note warn"><i data-lucide="camera-off" class="size-5"></i><div>
      <strong>Não foi possível iniciar a realidade aumentada.</strong> Verifique se a permissão da câmera foi concedida a este site nas configurações do navegador e tente novamente. A visualização 3D continua disponível.
      <div class="row"><button type="button" class="btn btn-outline-light mini" data-again><i data-lucide="refresh-cw" class="size-4"></i> Tentar novamente</button></div>
    </div></div>`);
    els.ar.querySelector('[data-again]').addEventListener('click', activateAR);
  }

  function onArStatus(e) {
    const status = e.detail && e.detail.status;
    if (status === 'session-started') {
      arStarted = true;
      U.toast('Realidade aumentada iniciada. Mova o celular devagar para encontrar a mesa.', { icon: 'scan-line', duration: 4500 });
    } else if (status === 'object-placed') {
      U.toast('Prato posicionado! Caminhe ao redor para ver de outros ângulos.', { icon: 'sparkles', duration: 4000 });
    } else if (status === 'failed') {
      onArFailed();
    } else if (status === 'not-presenting' && arStarted) {
      arStarted = false;
      U.toast('Você saiu da realidade aumentada.', { icon: 'box' });
      renderArAvailability();
    }
  }

  function onArTracking(e) {
    if (e.detail && e.detail.status === 'not-tracking') {
      U.toast('Procurando a superfície… aponte para a mesa e mova o celular lentamente.', { icon: 'scan', duration: 3500 });
    }
  }

  /* ------------------------------------------------------------------ Carregamento do modelo */
  async function ensureModelViewer() {
    if (customElements.get('model-viewer')) return true;
    const timeout = new Promise((res) => setTimeout(() => res(false), 12000));
    return Promise.race([customElements.whenDefined('model-viewer').then(() => true), timeout]);
  }

  async function load() {
    destroyModel();
    els.tools.hidden = true;
    els.badge.hidden = true;
    arPanel('');

    if (!current.modelo) {
      state('message', {
        icon: 'box', title: 'Modelo 3D em produção',
        message: 'Este prato ainda não possui modelo 3D. Em breve você poderá visualizá-lo e colocá-lo na sua mesa.',
        image: `${current.imagem}-480.webp`,
      });
      return;
    }

    state('loading');
    els.progress.hidden = false;
    els.progressBar.style.width = '4%';

    const ok = await ensureModelViewer();
    if (!ok) {
      els.progress.hidden = true;
      state('message', {
        title: 'Visualizador 3D indisponível',
        message: 'Não conseguimos carregar o visualizador 3D. Verifique sua conexão com a internet e tente novamente.',
        retry: true,
      });
      return;
    }
    if (!U.overlay.isOpen(els.root)) return; // usuário fechou enquanto carregava

    mv = document.createElement('model-viewer');
    const attrs = {
      src: current.modelo,
      alt: `Modelo 3D ${current.modeloPlaceholder ? 'ilustrativo ' : ''}do prato ${current.nome}`,
      'camera-controls': '',
      'touch-action': 'pan-y',
      'auto-rotate': '',
      'auto-rotate-delay': '1200',
      'rotation-per-second': '16deg',
      'interaction-prompt': 'auto',
      'camera-orbit': INITIAL_ORBIT,
      'min-camera-orbit': 'auto 5deg auto',
      'max-camera-orbit': 'auto 88deg auto',
      'interpolation-decay': '120',
      'shadow-intensity': '1.1',
      'shadow-softness': '0.85',
      exposure: '1.05',
      'environment-image': 'neutral',
      loading: 'eager',
      reveal: 'auto',
      ar: '',
      'ar-modes': 'webxr scene-viewer quick-look',
      'ar-placement': 'floor',   // superfícies horizontais (mesa ou chão)
      'ar-scale': 'fixed',       // tamanho real do prato
      'xr-environment': '',
    };
    if (current.modeloIos) attrs['ios-src'] = current.modeloIos;
    Object.entries(attrs).forEach(([k, v]) => mv.setAttribute(k, v));
    // Botão AR padrão oculto: usamos o nosso próprio, com mensagens em português.
    mv.innerHTML = '<button slot="ar-button" hidden aria-hidden="true" tabindex="-1"></button>';

    mv.addEventListener('progress', (e) => {
      const p = Math.max(0.04, e.detail.totalProgress || 0);
      els.progressBar.style.width = `${Math.round(p * 100)}%`;
      if (p >= 1) setTimeout(() => { els.progress.hidden = true; }, 250);
    });
    mv.addEventListener('load', onLoaded);
    mv.addEventListener('error', onModelError);
    mv.addEventListener('ar-status', onArStatus);
    mv.addEventListener('ar-tracking', onArTracking);
    els.stage.prepend(mv);

    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => {
      if (mv && !mv.loaded) state('message', { icon: 'loader-circle', title: 'Ainda carregando…', message: 'Sua conexão parece lenta. O modelo continua sendo baixado — aguarde mais um pouco ou tente novamente.', retry: true });
    }, 20000);
  }

  function onLoaded() {
    clearTimeout(loadTimer);
    state(null);
    els.progress.hidden = true;
    els.tools.hidden = false;
    els.badge.hidden = !current.modeloPlaceholder;
    els.rotate.setAttribute('aria-pressed', 'true');
    // A detecção de suporte a AR é assíncrona: aguarda o model-viewer concluir a verificação.
    arPanel('<p class="text-center text-xs text-creme/55">Verificando compatibilidade com realidade aumentada…</p>');
    let tries = 0;
    const check = () => {
      if (!mv) return;
      if (mv.canActivateAR || tries++ > 4) renderArAvailability();
      else setTimeout(check, 200);
    };
    setTimeout(check, 150);
  }

  function onModelError() {
    clearTimeout(loadTimer);
    els.progress.hidden = true;
    destroyModel();
    state('message', {
      title: 'Não foi possível carregar o modelo 3D',
      message: 'O arquivo do modelo deste prato não respondeu. Verifique sua conexão e tente novamente. Enquanto isso, confira a foto no cardápio.',
      image: `${current.imagem}-480.webp`,
      retry: true,
    });
  }

  function destroyModel() {
    if (mv) { mv.remove(); mv = null; }
  }

  /* ------------------------------------------------------------------ API pública */
  const Viewer = {
    open(dish, opts = {}) {
      current = dish;
      mode = opts.mode === 'ar' ? 'ar' : '3d';
      els.title.textContent = dish.nome;
      els.price.textContent = U.money(dish.preco);
      els.modeLabel.textContent = mode === 'ar' ? 'Ver na minha mesa · Realidade aumentada' : 'Visualização 3D';
      U.overlay.open(els.root, { onClose: Viewer.cleanup, initialFocus: els.root.querySelector('[data-close].icon-btn') });
      load();
    },
    cleanup() {
      clearTimeout(loadTimer);
      destroyModel();
      state(null);
      arPanel('');
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    },
  };

  function init() {
    els.root = document.getElementById('viewer');
    els.panel = document.getElementById('viewer-panel');
    els.stage = document.getElementById('viewer-stage');
    els.state = document.getElementById('viewer-state');
    els.progress = document.getElementById('viewer-progress');
    els.progressBar = els.progress.querySelector('span');
    els.badge = document.getElementById('viewer-placeholder-badge');
    els.tools = document.getElementById('viewer-tools');
    els.rotate = document.getElementById('viewer-rotate');
    els.ar = document.getElementById('viewer-ar');
    els.title = document.getElementById('viewer-title');
    els.price = document.getElementById('viewer-price');
    els.modeLabel = document.getElementById('viewer-mode-label');
    const fs = document.getElementById('viewer-fullscreen');

    els.badge.title = 'Representação ilustrativa gerada para demonstração. Será substituída pelo modelo 3D real do prato.';

    U.$$('[data-zoom]', els.tools).forEach((b) => b.addEventListener('click', () => {
      if (mv && typeof mv.zoom === 'function') mv.zoom(Number(b.dataset.zoom) * 3);
    }));
    els.rotate.addEventListener('click', () => {
      if (!mv) return;
      mv.autoRotate = !mv.autoRotate;
      els.rotate.setAttribute('aria-pressed', String(mv.autoRotate));
    });
    document.getElementById('viewer-reset').addEventListener('click', () => {
      if (!mv) return;
      mv.cameraOrbit = INITIAL_ORBIT;
      mv.cameraTarget = 'auto auto auto';
      mv.fieldOfView = 'auto';
    });

    if (document.fullscreenEnabled && els.panel.requestFullscreen) {
      fs.hidden = false;
      fs.addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else els.panel.requestFullscreen().catch(() => U.toast('Tela cheia indisponível neste navegador.', { type: 'error' }));
      });
      document.addEventListener('fullscreenchange', () => {
        const on = !!document.fullscreenElement;
        fs.setAttribute('aria-label', on ? 'Sair da tela cheia' : 'Tela cheia');
        fs.innerHTML = `<i data-lucide="${on ? 'minimize' : 'maximize'}" class="size-5"></i>`;
        U.icons(fs);
      });
    }

    document.getElementById('viewer-add').addEventListener('click', () => {
      if (current) window.AthinaCart.add(current.id);
    });

  }

  window.AthinaViewer = Viewer;
  Viewer.init = init;
})();
