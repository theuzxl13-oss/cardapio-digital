/**
 * CARDÁPIO DEMONSTRATIVO — Athina Bistrô & Restaurante
 *
 * Pratos, descrições, fotos e preços abaixo são CONTEÚDO DE DEMONSTRAÇÃO,
 * criados para apresentar o funcionamento do site até o envio do cardápio oficial.
 *
 * Como editar um prato:
 *  - id: identificador único, sem espaços (usado também no nome dos arquivos).
 *  - categoria: entradas | autorais | executivos | massas | sobremesas | bebidas
 *  - porcao: 'individual' ou 'duas' (serve duas pessoas)
 *  - preco: número em reais (use ponto para centavos: 89.9)
 *  - imagem: caminho base da foto, sem o sufixo "-480.webp"/"-960.webp"
 *  - modelo: arquivo .glb em assets/models/ (null = prato sem modelo 3D)
 *  - modeloIos: opcional, arquivo .usdz próprio para iPhone/iPad (se vazio, é gerado automaticamente)
 *  - modeloPlaceholder: true enquanto o modelo for ilustrativo; false quando for o modelo real do prato
 */
window.ATHINA_CATEGORIAS = [
  { id: 'todos', nome: 'Todos' },
  { id: 'entradas', nome: 'Entradas' },
  { id: 'autorais', nome: 'Pratos Autorais' },
  { id: 'executivos', nome: 'Executivos' },
  { id: 'massas', nome: 'Massas & Risotos' },
  { id: 'sobremesas', nome: 'Sobremesas' },
  { id: 'bebidas', nome: 'Bebidas & Vinhos' },
];

window.ATHINA_CARDAPIO = [
  // ---------------------------------------------------------------- ENTRADAS
  {
    id: 'almondegas-da-casa',
    nome: 'Almôndegas da Casa ao Sugo',
    categoria: 'entradas',
    descricao: 'Almôndegas artesanais de carne bovina, douradas na frigideira e finalizadas em molho sugo de tomates italianos cozido lentamente. Servidas com lascas de parmesão e manjericão fresco — ótimas para abrir o apetite ou dividir à mesa.',
    ingredientes: ['Carne bovina', 'Tomate italiano', 'Parmesão', 'Manjericão', 'Alho'],
    porcao: 'individual',
    preco: 42.0,
  },
  {
    id: 'salada-tropical',
    nome: 'Salada Tropical Athina',
    categoria: 'entradas',
    descricao: 'Bowl generoso de folhas verdes com abacate fatiado, tomates-cereja, grão-de-bico tostado, abóbora assada e repolho roxo. Acompanha vinagrete cítrico da casa, leve e refrescante.',
    ingredientes: ['Mix de folhas', 'Abacate', 'Tomate-cereja', 'Grão-de-bico', 'Abóbora', 'Repolho roxo'],
    porcao: 'individual',
    preco: 38.0,
    tags: ['Vegetariano'],
  },
  {
    id: 'salada-morna-frutas-vermelhas',
    nome: 'Salada Morna com Frutas Vermelhas',
    categoria: 'entradas',
    descricao: 'Lascas de frango grelhado sobre folhas tenras, framboesas frescas e fatias de pera, regadas com redução balsâmica. O contraste entre o morno e o fresco que define a cozinha do bistrô.',
    ingredientes: ['Frango grelhado', 'Folhas tenras', 'Framboesa', 'Pera', 'Redução balsâmica'],
    porcao: 'individual',
    preco: 46.0,
  },

  // ---------------------------------------------------------------- PRATOS AUTORAIS
  {
    id: 'file-mignon-ao-vinho',
    nome: 'Filé Mignon ao Molho de Vinho Tinto',
    categoria: 'autorais',
    descricao: 'Medalhão alto de filé mignon selado na manteiga, servido sobre molho de vinho tinto reduzido com fundo escuro. Acompanha aspargos grelhados e purê rústico de batatas.',
    ingredientes: ['Filé mignon', 'Vinho tinto', 'Aspargos', 'Batata', 'Manteiga'],
    porcao: 'individual',
    preco: 98.0,
    destaque: true,
  },
  {
    id: 'bisteca-com-maca',
    nome: 'Bisteca Suína com Maçã Caramelizada',
    categoria: 'autorais',
    descricao: 'Bisteca suína alta, grelhada e suculenta, coberta com cubos de maçã caramelizada na manteiga e toque de tomilho. Servida com batatas douradas e brócolis salteado.',
    ingredientes: ['Bisteca suína', 'Maçã', 'Tomilho', 'Batata', 'Brócolis'],
    porcao: 'individual',
    preco: 79.0,
  },
  {
    id: 'salmao-em-crosta-de-ervas',
    nome: 'Salmão em Crosta de Ervas',
    categoria: 'autorais',
    descricao: 'Posta de salmão assada com crosta crocante de ervas finas e farinha panko, sobre legumes salteados — cenoura, vagem e abobrinha. Finalizado com limão-siciliano.',
    ingredientes: ['Salmão', 'Ervas finas', 'Cenoura', 'Vagem', 'Limão-siciliano'],
    porcao: 'individual',
    preco: 89.0,
    destaque: true,
  },
  {
    id: 'moqueca-athina',
    nome: 'Moqueca Athina',
    categoria: 'autorais',
    descricao: 'Postas de peixe branco cozidas lentamente em leite de coco, azeite de dendê, tomates, pimentões e coentro. Servida borbulhante na panela, com arroz branco e pirão.',
    ingredientes: ['Peixe branco', 'Leite de coco', 'Dendê', 'Pimentões', 'Coentro', 'Arroz', 'Pirão'],
    porcao: 'duas',
    preco: 168.0,
    destaque: true,
  },
  {
    id: 'costela-barbecue',
    nome: 'Costela Suína Barbecue',
    categoria: 'autorais',
    descricao: 'Costela suína assada por horas até soltar do osso, pincelada com barbecue artesanal defumado. Servida na tábua com tomates, picles da casa e molho extra para acompanhar.',
    ingredientes: ['Costela suína', 'Barbecue artesanal', 'Tomate', 'Picles'],
    porcao: 'duas',
    preco: 149.0,
  },

  // ---------------------------------------------------------------- EXECUTIVOS
  {
    id: 'executivo-contrafile-fritas',
    nome: 'Executivo Contrafilé com Fritas Rústicas',
    categoria: 'executivos',
    descricao: 'Contrafilé grelhado no ponto de sua preferência, fatiado e servido com batatas rústicas crocantes temperadas com alecrim e sal grosso. O clássico do almoço, feito com capricho.',
    ingredientes: ['Contrafilé', 'Batata', 'Alecrim', 'Sal grosso'],
    porcao: 'individual',
    preco: 49.0,
  },
  {
    id: 'executivo-camarao-curry',
    nome: 'Executivo Camarão ao Curry',
    categoria: 'executivos',
    descricao: 'Camarões salteados em molho cremoso de curry suave e leite de coco, servidos com arroz branco soltinho e coentro fresco. Aromático e reconfortante.',
    ingredientes: ['Camarão', 'Curry', 'Leite de coco', 'Arroz', 'Coentro'],
    porcao: 'individual',
    preco: 56.0,
  },

  // ---------------------------------------------------------------- MASSAS & RISOTOS
  {
    id: 'risoto-de-parmesao',
    nome: 'Risoto de Parmesão e Limão-Siciliano',
    categoria: 'massas',
    descricao: 'Arroz arbóreo cozido lentamente em caldo de legumes, finalizado na manteiga com parmesão e raspas de limão-siciliano. Cremoso, perfumado e delicado.',
    ingredientes: ['Arroz arbóreo', 'Parmesão', 'Limão-siciliano', 'Manteiga', 'Caldo de legumes'],
    porcao: 'individual',
    preco: 72.0,
    tags: ['Vegetariano'],
  },
  {
    id: 'spaghetti-ao-camarao',
    nome: 'Spaghetti ao Camarão e Tomate-Cereja',
    categoria: 'massas',
    descricao: 'Spaghetti al dente salteado na frigideira com camarões, tomates-cereja confitados, alho, azeite extravirgem e salsinha. Servido na própria frigideira.',
    ingredientes: ['Spaghetti', 'Camarão', 'Tomate-cereja', 'Alho', 'Azeite', 'Salsinha'],
    porcao: 'individual',
    preco: 84.0,
  },
  {
    id: 'fettuccine-funghi-mignon',
    nome: 'Fettuccine ao Funghi com Mignon',
    categoria: 'massas',
    descricao: 'Fettuccine envolvido em molho cremoso de funghi secchi e cogumelos frescos, com cubos de mignon selados. Uma massa intensa, para quem gosta de sabores marcantes.',
    ingredientes: ['Fettuccine', 'Funghi secchi', 'Cogumelos', 'Filé mignon', 'Creme de leite'],
    porcao: 'individual',
    preco: 88.0,
  },
  {
    id: 'penne-a-bolonhesa',
    nome: 'Penne à Bolonhesa da Nonna',
    categoria: 'massas',
    descricao: 'Penne com ragu de carne cozido por horas em tomates e vinho, à moda da nonna. Finalizado com parmesão ralado na hora.',
    ingredientes: ['Penne', 'Carne bovina', 'Tomate', 'Vinho', 'Parmesão'],
    porcao: 'individual',
    preco: 64.0,
  },

  // ---------------------------------------------------------------- SOBREMESAS
  {
    id: 'tiramisu-da-casa',
    nome: 'Tiramisù da Casa',
    categoria: 'sobremesas',
    descricao: 'Camadas de biscoito embebido em café espresso e creme de mascarpone, finalizadas com cacau em pó. Leve, aveludado e servido bem gelado.',
    ingredientes: ['Mascarpone', 'Café espresso', 'Biscoito champanhe', 'Cacau'],
    porcao: 'individual',
    preco: 29.0,
  },
  {
    id: 'bolo-trufado-de-chocolate',
    nome: 'Bolo Trufado de Chocolate',
    categoria: 'sobremesas',
    descricao: 'Fatia alta de bolo de chocolate meio amargo com recheio trufado e cobertura de ganache brilhante. Para os apaixonados por chocolate.',
    ingredientes: ['Chocolate meio amargo', 'Ganache', 'Creme de leite', 'Cacau'],
    porcao: 'individual',
    preco: 26.0,
  },
  {
    id: 'panna-cotta-de-morango',
    nome: 'Trio de Panna Cotta com Morangos',
    categoria: 'sobremesas',
    descricao: 'Três copinhos de panna cotta de baunilha com calda de frutas vermelhas e morangos frescos. Delicada e perfeita para compartilhar.',
    ingredientes: ['Creme de leite', 'Baunilha', 'Morango', 'Frutas vermelhas'],
    porcao: 'duas',
    preco: 34.0,
  },

  // ---------------------------------------------------------------- BEBIDAS & VINHOS
  {
    id: 'taca-vinho-tinto',
    nome: 'Taça de Vinho Tinto da Casa',
    categoria: 'bebidas',
    descricao: 'Tinto seco selecionado para harmonizar com as carnes e massas do bistrô. Consulte os rótulos disponíveis no dia. Bebida alcoólica — venda proibida para menores de 18 anos.',
    ingredientes: ['Vinho tinto seco', '150 ml'],
    porcao: 'individual',
    preco: 34.0,
    alcoolica: true,
  },
  {
    id: 'gin-laranja-alecrim',
    nome: 'Gin Tônica de Laranja e Alecrim',
    categoria: 'bebidas',
    descricao: 'Gin, água tônica, rodela de laranja e ramo de alecrim levemente tostado, servido com bastante gelo. Bebida alcoólica — venda proibida para menores de 18 anos.',
    ingredientes: ['Gin', 'Água tônica', 'Laranja', 'Alecrim'],
    porcao: 'individual',
    preco: 36.0,
    alcoolica: true,
  },
  {
    id: 'cha-gelado-de-limao',
    nome: 'Chá Gelado de Limão',
    categoria: 'bebidas',
    descricao: 'Chá preto gelado preparado na casa, com limão-taiti espremido na hora e um toque de hortelã. Refrescante e sem álcool.',
    ingredientes: ['Chá preto', 'Limão-taiti', 'Hortelã', 'Gelo'],
    porcao: 'individual',
    preco: 14.0,
    tags: ['Sem álcool'],
  },

  // ---------------------------------------------------------------- TESTES (ocultos do cardápio)
  // Acessível apenas por link: ?prato=teste-camarao-na-panela&modo=ar
  {
    id: 'teste-camarao-na-panela',
    nome: 'Teste · Camarão na panela (foto do restaurante)',
    categoria: 'autorais',
    descricao: 'Modelo 3D provisório criado a partir de uma única foto enviada pelo restaurante, para testar escala e realidade aumentada.',
    ingredientes: ['Camarão', 'Molho de tomate', 'Cheiro-verde'],
    porcao: 'duas',
    preco: 0,
    oculto: true,
  },
].map((p) => ({
  // Valores padrão derivados do id — mantém o cadastro curto e os caminhos sempre relativos.
  imagem: `assets/images/pratos/${p.id}`,
  modelo: `assets/models/${p.id}.glb`,
  modeloIos: '',
  modeloPlaceholder: true,
  tags: [],
  ...p,
}));
