// ui/src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Adicionar interceptor para debugging
api.interceptors.response.use(
  response => {
    console.log('API Response:', response.config.url, response.data);
    return response;
  },
  error => {
    console.error('API Error:', error.config?.url, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;

export const movementApi = {
  getMovements: () => api.get('/movements'),
  getInbound: () => api.get('/movements?type=IN'),
  getOutbound: () => api.get('/movements?type=OUT'),
  getTransfer: () => api.get('/movements?type=TRANSFER'),
};

export const orderApi = {
  getOrders: () => api.get('/orders'),
  getOrder: (id) => api.get(`/orders/${id}`),
  updateOrderStatus: (id, status) => api.patch(`/orders/${id}`, { status }),
};

export const pickingApi = {
  // Gera picking a partir do pedido (retorna picking com referências; a UI usa a listagem para populates)
  createPicking: (orderId) => api.post(`/picking/${orderId}`),
  // Lista pickings com populate de order, items.product e items.location
  listPickings: () => api.get('/picking'),
};

export const stockApi = {
  getStock: () => api.get('/stock'),
  updateLocation: (productId, locationId) => api.patch(`/stock/${productId}/location`, { locationId }),
  syncWithOmie: () => api.post('/stock/sync-with-omie'),
  transfer: (productId, fromLocation, toLocation, quantity) => api.post('/stock/transfer', {
    productId,
    fromLocation,
    toLocation,
    quantity
  }),
};