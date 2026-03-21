// src/services/pickingService.js
import Picking from '../models/Picking.js';
import Order from '../models/Order.js';
import Stock from '../models/Stock.js';
import Location from '../models/Location.js';
import { sortLocations } from '../utils/locationSorter.js';

export async function generatePicking(orderId, tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  // Buscar pedido filtrado por tenant
  const order = await Order.findOne({ _id: orderId, tenantId });
  if (!order) throw new Error('Order not found for this tenant');

  // Popular os produtos manualmente
  const populatedOrder = await Order.findOne({ _id: orderId, tenantId }).populate('items.product');

  const pickingItems = [];

  for (const item of populatedOrder.items) {
    let remaining = item.quantity;

    // Tentar encontrar estoque por SKU primeiro, depois por código do produto
    let stocks = [];
    
    // Se o item tiver SKU, usar SKU (filtrado por tenant)
    if (item.sku) {
      stocks = await Stock.find({
        tenantId,
        sku: item.sku,
        quantity: { $gt: 0 },
      });
    }
    
    // Se não encontrar por SKU, tentar pelo código do produto
    if (stocks.length === 0 && item.product.codigo) {
      stocks = await Stock.find({
        tenantId,
        sku: item.product.codigo,
        quantity: { $gt: 0 },
      });
    }
    
    // Se ainda não encontrar, tentar pelo _id do produto
    if (stocks.length === 0) {
      stocks = await Stock.find({
        tenantId,
        product: item.product._id,
        quantity: { $gt: 0 },
      });
    }

    const sortedStocks = sortLocations(stocks);

    for (const s of sortedStocks) {
      if (remaining <= 0) break;

      const take = Math.min(s.quantity, remaining);
      
      // Buscar a localização pelo código (filtrado por tenant)
      const location = await Location.findOne({ tenantId, code: s.locationCode || 'RECEBIMENTO' });

      pickingItems.push({
        product: item.product._id,
        location: location ? location._id : null,
        quantity: take,
      });

      remaining -= take;
    }

    if (remaining > 0) {
      const identifier = item.sku || item.product.codigo || item.product.descricao || 'unknown';
      throw new Error(`Insufficient stock for ${identifier}`);
    }
  }

  // Criar picking com tenantId
  const picking = await Picking.create({
    tenantId,
    order: order._id,
    items: pickingItems,
  });

  return picking;
}