// ui/src/services/api.js
import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

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

export const stockApi = {
  getStock: () => api.get('/stock'),
  updateLocation: (productId, locationId) => api.patch(`/stock/${productId}/location`, { locationId }),
};