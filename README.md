# Athina Bistrô & Restaurante — site e cardápio digital

Site do **Athina Bistrô & Restaurante** (gastronomia autoral desde 2010, Embu-Guaçu - SP) com catálogo digital, sacola de pedidos enviada pelo WhatsApp e visualização dos pratos em **3D e realidade aumentada (AR)**.

- Site publicado: https://theuzxl13-oss.github.io/cardapio-digital/
- Sem backend: HTML + Tailwind CSS (CDN) + JavaScript puro, compatível com GitHub Pages.

## Estrutura

```
index.html                 página única (Início, Cardápio, O Bistrô, Localização)
assets/css/styles.css      componentes visuais da marca
assets/js/config.js        WhatsApp, endereço, Instagram, iFood, Band, aviso de demonstração
assets/js/menu-data.js     cardápio (pratos, preços, categorias, modelos 3D)
assets/js/cart.js          sacola, modalidades (retirada/entrega/reserva) e mensagem do WhatsApp
assets/js/viewer.js        visualizador 3D/AR (Google model-viewer)
assets/js/app.js           catálogo, busca, filtros, cabeçalho e inicialização
assets/js/utils.js         utilidades (modais acessíveis, toasts, formatação)
assets/images/pratos/      fotos dos pratos (<id>-480.webp e <id>-960.webp)
assets/images/casa/        fotos do hero e da seção O Bistrô
assets/models/             um modelo 3D por prato (<id>.glb)
tools/generate_placeholder_models.py   gera os modelos 3D ilustrativos
```

## Conteúdo demonstrativo (substituir)

- **Pratos, descrições e preços** em `assets/js/menu-data.js` são demonstrativos. O aviso "Cardápio demonstrativo" aparece enquanto `cardapioDemonstrativo: true` em `config.js`.
- **Fotos**: imagens ilustrativas do banco Unsplash (licença Unsplash). Substitua pelas fotos reais mantendo os mesmos nomes de arquivo (`<id>-480.webp` com ~480 px e `<id>-960.webp` com ~960 px de largura, proporção 4:3).
- **Modelos 3D**: os arquivos em `assets/models/` são **placeholders ilustrativos** gerados por código (formas simples que lembram cada prato). Cada prato tem o seu, mas nenhum é uma representação fiel. O visualizador mostra o selo "Modelo 3D ilustrativo" enquanto `modeloPlaceholder` for `true`.

## Como atualizar

### Editar ou adicionar um prato
1. Abra `assets/js/menu-data.js` e copie um bloco existente.
2. Defina `id` (sem espaços/acentos), `nome`, `categoria`, `descricao`, `ingredientes`, `porcao` (`individual` ou `duas`) e `preco`.
3. Coloque as fotos em `assets/images/pratos/<id>-480.webp` e `<id>-960.webp`.
4. Coloque o modelo em `assets/models/<id>.glb` (ou `modelo: null` se ainda não houver; o site mostra "Modelo 3D em produção").

### Substituir um modelo 3D pelo modelo real
1. Gere o modelo do prato real (fotogrametria — ex.: Polycam, RealityScan, Luma — ou modelagem 3D), exportando em **GLB** em **escala real (metros)**, com o eixo Y para cima e a base apoiada em y = 0. Mantenha até ~5 MB e texturas de até 2048 px.
2. Salve como `assets/models/<id>.glb` (mesmo nome).
3. Em `menu-data.js`, marque `modeloPlaceholder: false` no prato.
4. Opcional (iPhone/iPad): um `.usdz` próprio em `assets/models/<id>.usdz` e `modeloIos: 'assets/models/<id>.usdz'`. Sem ele, o model-viewer gera o USDZ automaticamente a partir do GLB.

### Contatos e links oficiais
Edite `assets/js/config.js`:
- `ifoodUrl`: link oficial do iFood (o botão "Pedir pelo iFood" aparece automaticamente).
- `bandUrl`: link da reportagem "Athina na Band" (o selo vira link).
- `cardapioDemonstrativo: false` quando o cardápio oficial estiver cadastrado.

### Publicar
Faça commit na branch `main`. O GitHub Pages (Settings → Pages → *Deploy from a branch* → `main` / `(root)`) republica em 1–2 minutos.

## Realidade aumentada — como funciona

- Usa o [Google model-viewer](https://modelviewer.dev/) com `ar-modes="webxr scene-viewer quick-look"`:
  - **Android**: WebXR no Chrome (ARCore) ou Scene Viewer (Google Play Services para RA).
  - **iPhone/iPad**: AR Quick Look no Safari (iOS 12+).
  - **Computador ou aparelho sem suporte**: visualização 3D com rotação e zoom e instrução para abrir no celular.
- `ar-placement="floor"` (superfícies horizontais como mesas) e `ar-scale="fixed"` (tamanho real).
- Exige HTTPS (o GitHub Pages já usa).
- A câmera só é solicitada quando o cliente toca em "Abrir câmera e ver na minha mesa".
- Link direto para um prato (útil em QR Codes na mesa): `https://theuzxl13-oss.github.io/cardapio-digital/?prato=moqueca-athina&modo=ar`

## Desenvolvimento local

```bash
python3 -m http.server 8000
```

Abra http://localhost:8000. Para regenerar os modelos ilustrativos: `python3 tools/generate_placeholder_models.py` (requer numpy).
