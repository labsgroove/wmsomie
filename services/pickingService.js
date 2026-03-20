// src/services/pickingService.js
import Picking from '../models/Picking.js';
import Order from '../models/Order.js';
import Stock from '../models/Stock.js';
import Location from '../models/Location.js';
import { sortLocations } from '../utils/locationSorter.js';

export async function generatePicking(orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');

  // Popular os produtos manualmente
  const populatedOrder = await Order.findById(orderId).populate('items.product');

  const pickingItems = [];

  for (const item of populatedOrder.items) {
    let remaining = item.quantity;

    // Tentar encontrar estoque por SKU primeiro, depois por código do produto
    let stocks = [];
    
    // Se o item tiver SKU, usar SKU
    if (item.sku) {
      stocks = await Stock.find({
        sku: item.sku,
        quantity: { $gt: 0 },
      });
    }
    
    // Se não encontrar por SKU, tentar pelo código do produto
    if (stocks.length === 0 && item.product.codigo) {
      stocks = await Stock.find({
        sku: item.product.codigo,
        quantity: { $gt: 0 },
      });
    }
    
    // Se ainda não encontrar, tentar pelo _id do produto
    if (stocks.length === 0) {
      stocks = await Stock.find({
        product: item.product._id,
        quantity: { $gt: 0 },
      });
    }

    const sortedStocks = stocks; // Temporariamente sem ordenação

    for (const s of sortedStocks) {
      if (remaining <= 0) break;

      const take = Math.min(s.quantity, remaining);
      
      // Buscar a localização pelo código
      const location = await Location.findOne({ code: s.locationCode || 'RECEBIMENTO' });

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

  const picking = await Picking.create({
    order: order._id,
    items: pickingItems,
  });

  return picking;
}