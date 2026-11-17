/* Sacola de pedidos, formulário de modalidade e geração da mensagem do WhatsApp. */
(function () {
  'use strict';
  const U = window.AthinaUtils;
  const CFG = window.ATHINA_CONFIG;
  const MENU = window.ATHINA_CARDAPIO;
  const KEY = 'athina:sacola:v1';
  const FORM_KEY = 'athina:dados:v1';

  const MODOS = {
    retirada: { nome: 'Retirada no Balcão', botao: 'Enviar pedido pelo WhatsApp' },
    entrega: { nome: 'Entrega', botao: 'Enviar pedido pelo WhatsApp' },
    reserva: { nome: 'Reserva de Mesa', botao: 'Solicitar reserva pelo WhatsApp' },
  };
  const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

  const byId = (id) => MENU.find((p) => p.id === id);

  // Estado: [{ id, qty, nota }]; ignora itens que não existem mais no cardápio.
  let items = U.storage.get(KEY, []).filter((i) => byId(i.id) && i.qty > 0);

  const els = {};
  const listeners = new Set();

  function save() { U.storage.set(KEY, items); }
  function count() { return items.reduce((s, i) => s + i.qty, 0); }
  function subtotal() { return items.reduce((s, i) => s + byId(i.id).preco * i.qty, 0); }
  function modalidade() { return (els.form.querySelector('input[name="modalidade"]:checked') || {}).value || 'retirada'; }

  function changed(opts = {}) {
    save();
    render();
    listeners.forEach((fn) => fn({ count: count(), subtotal: subtotal(), ...opts }));
  }

  const Cart = {
    onChange: (fn) => listeners.add(fn),
    count, subtotal,
    add(id, qty = 1) {
      const p = byId(id);
      if (!p) return;
      const found = items.find((i) => i.id === id);
      if (found) found.qty = Math.min(found.qty + qty, 99);
      else items.push({ id, qty, nota: '' });
      changed({ added: p });
    },
    setQty(id, qty) {
      const it = items.find((i) => i.id === id);
      if (!it) return;
      if (qty <= 0) return Cart.remove(id);
      it.qty = Math.min(qty, 99);
      changed();
    },
    remove(id) {
      const idx = items.findIndex((i) => i.id === id);
      if (idx < 0) return;
      const [removed] = items.splice(idx, 1);
      changed();
      const p = byId(id);
      U.toast(`<strong>${U.escape(p.nome)}</strong> removido da sacola.`, {
        icon: 'trash-2',
        action: { label: 'Desfazer', onClick: () => { items.splice(Math.min(idx, items.length), 0, removed); changed(); } },
      });
    },
    clear() { items = []; changed(); },
    open(opts = {}) {
      if (opts.modo) {
        const r = els.form.querySelector(`input[name="modalidade"][value="${opts.modo}"]`);
        if (r) { r.checked = true; syncMode(); }
      }
      U.overlay.open(els.root, { initialFocus: els.root.querySelector('[data-close].icon-btn') });
    },
    buildMessage,
  };

  /* ------------------------------------------------------------------ Renderização */
  function render() {
    const n = count();
    els.empty.hidden = n > 0;
    els.list.innerHTML = items.map((i) => {
      const p = byId(i.id);
      return `
      <li class="cart-item" data-id="${p.id}">
        <img src="${p.imagem}-480.webp" alt="" loading="lazy" onerror="this.onerror=null;this.src='assets/images/placeholder-prato.svg'">
        <div class="min-w-0">
          <h3>${U.escape(p.nome)}</h3>
          <p class="unit">${U.money(p.preco)} · ${p.porcao === 'duas' ? 'serve 2 pessoas' : 'individual'}</p>
          <div class="cart-item-row">
            <div class="qty" role="group" aria-label="Quantidade de ${U.escape(p.nome)}">
              <button type="button" data-qty="-1" aria-label="Diminuir quantidade"><i data-lucide="${i.qty === 1 ? 'trash-2' : 'minus'}" class="size-4"></i></button>
              <output aria-live="polite">${i.qty}</output>
              <button type="button" data-qty="1" aria-label="Aumentar quantidade"><i data-lucide="plus" class="size-4"></i></button>
            </div>
            <strong class="item-total">${U.money(p.preco * i.qty)}</strong>
          </div>
          <button type="button" class="remove-btn mt-1" data-remove><i data-lucide="x" class="size-3"></i> Remover</button>
        </div>
        <div class="item-note">
          <label class="sr-only" for="nota-${p.id}">Observação para ${U.escape(p.nome)}</label>
          <input id="nota-${p.id}" type="text" maxlength="140" data-nota value="${U.escape(i.nota)}" placeholder="Observação deste item (ex.: sem cebola, ao ponto)">
        </div>
      </li>`;
    }).join('');
    U.icons(els.list);

    const sub = subtotal();
    const isEntrega = modalidade() === 'entrega';
    els.subtotal.textContent = U.money(sub);
    els.total.textContent = U.money(sub) + (isEntrega && n ? ' + entrega' : '');
    els.entregaRow.hidden = !isEntrega || !n;
    els.clear.hidden = !n;

    // Badge, barra mobile e rótulo acessível
    U.$$('[data-cart-count]').forEach((b) => { b.textContent = n; b.hidden = !n; });
    U.$$('[data-cart-total]').forEach((b) => { b.textContent = U.money(sub); });
    U.$$('[data-cart-label]').forEach((b) => { b.textContent = `${n} ${n === 1 ? 'item' : 'itens'} · Ver pedido`; });
    const btn = document.getElementById('cart-button');
    if (btn) btn.setAttribute('aria-label', `Abrir sacola de pedidos, ${n} ${n === 1 ? 'item' : 'itens'}`);
    const bar = document.getElementById('mobile-cart-bar');
    if (bar) bar.hidden = !n;
  }

  function syncMode() {
    const m = modalidade();
    U.$$('[data-mode-panel]', els.form).forEach((p) => { p.hidden = p.dataset.modePanel !== m; });
    els.sendLabel.textContent = MODOS[m].botao;
    clearErrors();
    render();
  }

  /* ------------------------------------------------------------------ Validação */
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function parseLocalDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function setError(name, msg) {
    const input = els.form.elements[name];
    const out = els.form.querySelector(`[data-error-for="${name}"]`);
    if (out) out.textContent = msg || '';
    if (input && input.setAttribute) {
      if (msg) { input.setAttribute('aria-invalid', 'true'); if (out) { out.id = out.id || `erro-${name}`; input.setAttribute('aria-describedby', out.id); } }
      else input.removeAttribute('aria-invalid');
    }
  }
  function clearErrors() { U.$$('[data-error-for]', els.form).forEach((e) => setError(e.dataset.errorFor, '')); }

  function validate() {
    clearErrors();
    const f = els.form.elements;
    const m = modalidade();
    const errors = [];
    const need = (name, cond, msg) => { if (!cond) { setError(name, msg); errors.push(name); } };

    if (m !== 'reserva' && !items.length) {
      U.toast('Adicione pelo menos um prato à sacola para enviar o pedido.', { type: 'error' });
      return false;
    }
    need('nome', f.nome.value.trim().length >= 2, 'Informe seu nome.');
    if (m === 'entrega') {
      need('rua', f.rua.value.trim().length >= 5, 'Informe rua e número para a entrega.');
      need('bairro', f.bairro.value.trim().length >= 2, 'Informe o bairro.');
    }
    if (m === 'reserva') {
      const v = f.data.value;
      if (!v) need('data', false, 'Escolha a data da reserva.');
      else if (v < todayISO()) need('data', false, 'Escolha uma data a partir de hoje.');
      else if (!CFG.diasAbertos.includes(parseLocalDate(v).getDay())) need('data', false, 'Funcionamos de terça a domingo. Escolha outro dia.');
      need('hora', !!f.hora.value, 'Informe o horário desejado.');
      const p = parseInt(f.pessoas.value, 10);
      need('pessoas', p >= 1 && p <= 40, 'Informe de 1 a 40 pessoas.');
    }
    if (errors.length) {
      const first = f[errors[0]];
      if (first && first.focus) { first.focus(); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      return false;
    }
    return true;
  }

  /* ------------------------------------------------------------------ Mensagem */
  function buildMessage() {
    const f = els.form.elements;
    const m = modalidade();
    const L = [];
    L.push(`*${CFG.nome}*`);
    L.push(m === 'reserva' ? 'Olá! Gostaria de solicitar uma reserva de mesa pelo site.' : 'Olá! Gostaria de fazer um pedido pelo site.');
    L.push('');
    L.push(`*Modalidade:* ${MODOS[m].nome}`);
    L.push(`*Nome:* ${f.nome.value.trim()}`);

    if (m === 'reserva') {
      const d = parseLocalDate(f.data.value);
      const dataBR = d.toLocaleDateString('pt-BR');
      L.push('');
      L.push('*Dados da reserva*');
      L.push(`• Data: ${dataBR} (${DIAS[d.getDay()]})`);
      L.push(`• Horário desejado: ${f.hora.value}`);
      L.push(`• Pessoas: ${parseInt(f.pessoas.value, 10)}`);
    }

    if (items.length) {
      L.push('');
      L.push(m === 'reserva' ? '*Pré-pedido*' : '*Itens do pedido*');
      items.forEach((i) => {
        const p = byId(i.id);
        L.push(`• ${i.qty}x ${p.nome}${p.porcao === 'duas' ? ' (serve 2)' : ''} — ${U.money(p.preco * i.qty)}`);
        if (i.nota.trim()) L.push(`   _Obs.: ${i.nota.trim()}_`);
      });
      L.push('');
      L.push(`*Subtotal:* ${U.money(subtotal())}`);
      if (m === 'entrega') {
        L.push('*Taxa de entrega:* a confirmar');
        L.push(`*Total:* ${U.money(subtotal())} + taxa de entrega`);
      } else {
        L.push(`*Total:* ${U.money(subtotal())}`);
      }
    }

    if (m === 'entrega') {
      L.push('');
      L.push('*Endereço de entrega*');
      L.push(`${f.rua.value.trim()} - ${f.bairro.value.trim()}`);
      if (f.complemento.value.trim()) L.push(`Complemento: ${f.complemento.value.trim()}`);
      if (f.referencia.value.trim()) L.push(`Referência: ${f.referencia.value.trim()}`);
    }

    if (f.observacoes.value.trim()) {
      L.push('');
      L.push(`*Observações:* ${f.observacoes.value.trim()}`);
    }
    L.push('');
    L.push(m === 'reserva' ? 'Aguardo a confirmação da reserva. Obrigado!' : 'Aguardo a confirmação do pedido. Obrigado!');
    return L.join('\n');
  }

  function send() {
    if (!validate()) return;
    const url = U.whatsappUrl(buildMessage());
    // Link real clicado dentro do gesto do usuário (evita bloqueio de pop-up).
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    persistForm();
    U.toast('Abrimos o WhatsApp com sua mensagem pronta. <strong>Toque em enviar</strong> — a confirmação vem pela resposta do restaurante.', {
      icon: 'message-circle', duration: 7000,
      action: { label: 'Abrir de novo', onClick: () => window.open(url, '_blank', 'noopener') },
    });
  }

  function persistForm() {
    const f = els.form.elements;
    U.storage.set(FORM_KEY, { nome: f.nome.value, rua: f.rua.value, bairro: f.bairro.value, complemento: f.complemento.value, referencia: f.referencia.value });
  }

  /* ------------------------------------------------------------------ Inicialização */
  function init() {
    els.root = document.getElementById('cart');
    els.list = document.getElementById('cart-items');
    els.empty = document.getElementById('cart-empty');
    els.form = document.getElementById('checkout');
    els.subtotal = U.$('[data-subtotal]', els.root);
    els.total = U.$('[data-total]', els.root);
    els.entregaRow = U.$('[data-entrega-row]', els.root);
    els.clear = document.getElementById('limpar-sacola');
    els.sendLabel = document.getElementById('enviar-label');

    // Restaura dados do cliente (somente neste navegador)
    const saved = U.storage.get(FORM_KEY, {});
    Object.entries(saved).forEach(([k, v]) => { if (els.form.elements[k] && typeof v === 'string') els.form.elements[k].value = v; });

    const dateInput = els.form.elements.data;
    dateInput.min = todayISO();

    els.list.addEventListener('click', (e) => {
      const li = e.target.closest('.cart-item');
      if (!li) return;
      const id = li.dataset.id;
      const it = items.find((i) => i.id === id);
      const q = e.target.closest('[data-qty]');
      if (q && it) {
        Cart.setQty(id, it.qty + Number(q.dataset.qty));
        const again = els.list.querySelector(`.cart-item[data-id="${id}"] [data-qty="${q.dataset.qty}"]`);
        if (again) again.focus();
      }
      if (e.target.closest('[data-remove]')) Cart.remove(id);
    });
    els.list.addEventListener('input', (e) => {
      if (!e.target.matches('[data-nota]')) return;
      const it = items.find((i) => i.id === e.target.closest('.cart-item').dataset.id);
      if (it) { it.nota = e.target.value; save(); }
    });

    els.form.addEventListener('change', (e) => { if (e.target.name === 'modalidade') syncMode(); });
    els.form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid')) setError(e.target.name, ''); });
    els.form.addEventListener('submit', (e) => { e.preventDefault(); send(); });

    U.$$('[data-stepper] [data-step]', els.form).forEach((b) => b.addEventListener('click', () => {
      const inp = els.form.elements.pessoas;
      const v = Math.max(1, Math.min(40, (parseInt(inp.value, 10) || 0) + Number(b.dataset.step)));
      inp.value = v;
      setError('pessoas', '');
    }));

    document.getElementById('enviar-whatsapp').addEventListener('click', send);
    els.clear.addEventListener('click', () => {
      if (!items.length) return;
      const backup = items.map((i) => ({ ...i }));
      Cart.clear();
      U.toast('Sacola esvaziada.', { icon: 'trash-2', action: { label: 'Desfazer', onClick: () => { items = backup; changed(); } } });
    });

    document.addEventListener('click', (e) => {
      const opener = e.target.closest('[data-open-cart]');
      if (opener) { e.preventDefault(); Cart.open({ modo: opener.dataset.openCart || undefined }); }
    });

    syncMode();
  }

  window.AthinaCart = Cart;
  Cart.init = init;
})();
