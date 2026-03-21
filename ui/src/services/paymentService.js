import api from './api';

export const paymentService = {
  // Buscar pacotes de créditos disponíveis
  async getPackages() {
    const response = await api.get('/payments/packages');
    return response.data;
  },

  // Criar pagamento PIX
  async createPayment(packageId) {
    const response = await api.post('/payments/create', { packageId });
    return response.data;
  },

  // Verificar status do pagamento
  async checkStatus(paymentId) {
    const response = await api.get(`/payments/status/${paymentId}`);
    return response.data;
  },

  // Histórico de pagamentos
  async getHistory() {
    const response = await api.get('/payments/history');
    return response.data;
  }
};
