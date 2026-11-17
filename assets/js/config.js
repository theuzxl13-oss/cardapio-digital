/**
 * Configuração do Athina Bistrô & Restaurante.
 * Edite este arquivo para atualizar contatos e links oficiais — o site inteiro usa estes dados.
 */
window.ATHINA_CONFIG = {
  nome: 'Athina Bistrô & Restaurante',
  slogan: 'Gastronomia autoral desde 2010',
  fundacao: 2010,

  // WhatsApp no formato internacional, somente números (55 + DDD + número).
  whatsapp: '5511943992336',
  whatsappExibicao: '(11) 94399-2336',

  instagramUsuario: 'athinabistro',
  instagramUrl: 'https://www.instagram.com/athinabistro/',

  endereco: {
    linha1: 'Rua Emília Pires, 616 - Centro',
    cidade: 'Embu-Guaçu - SP',
    completo: 'Rua Emília Pires, 616 - Centro, Embu-Guaçu - SP',
  },

  // Somente as informações fornecidas pelo restaurante (sem horários inventados).
  funcionamento: 'Terça a domingo, almoço',
  funcionamentoDetalhe: 'De terça-feira a domingo, no horário de almoço.',
  // 0 = domingo, 1 = segunda ... usado para validar datas de reserva.
  diasAbertos: [0, 2, 3, 4, 5, 6],

  // Deixe vazio ('') até receber o link oficial. Quando preenchido, os botões aparecem automaticamente.
  ifoodUrl: '',
  bandUrl: '',

  // true = exibe o aviso de "cardápio demonstrativo". Mude para false ao publicar o cardápio oficial.
  cardapioDemonstrativo: true,
};
