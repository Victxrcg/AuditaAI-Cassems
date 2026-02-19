/**
 * Configuração Plaud – gravação de reuniões e extração de demandas para cronograma.
 * Documentação: https://docs.plaud.ai/documentation/get_started/overview
 */
module.exports = {
  baseUrl: process.env.PLAUD_BASE_URL || 'https://platform.plaud.ai',
  clientId: process.env.PLAUD_CLIENT_ID,
  secretKey: process.env.PLAUD_SECRET_KEY,
  webhookSecret: process.env.PLAUD_WEBHOOK_SECRET,
  enabled: !!(process.env.PLAUD_CLIENT_ID && process.env.PLAUD_SECRET_KEY),
};
