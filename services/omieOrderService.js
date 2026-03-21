// src/services/omieOrderService.js
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { callOmie } from './omieClient.js';

export async function syncOrders(userId) {
  if (!userId) {
    throw new Error('User ID is required to sync orders');
  }
  
  // Buscar tenantId do usuário
  const user = await User.findById(userId).select('tenantId');
  if (!user || !user.tenantId) {
    throw new Error('User not found or tenantId not configured');
  }
  const tenantId = user.tenantId;
  
  const response = await callOmie(
    'produtos/pedido/',
    'ListarPedidos',
    { pagina: 1, registros_por_pagina: 50 },
    userId
  );

  const pedidos = response.pedido_venda_produto || [];
  let syncedCount = 0;

  for (const p of pedidos) {
    const items = [];

    // Verificar se o pedido tem itens
    if (!p.det || p.det.length === 0) {
      console.log(`Pedido ${p.cabecalho?.codigo_pedido} não tem itens, ignorando...`);
      continue;
    }

    for (const i of p.det || []) {
      // Buscar produto filtrando por tenantId
      const product = await Product.findOne({ 
        tenantId,
        omieId: i.produto.codigo_produto 
      });
      if (!product) {
        console.log(`Produto ${i.produto.codigo_produto} não encontrado no banco para tenant ${tenantId}, ignorando item...`);
        continue;
      }

      items.push({
        product: product._id,
        quantity: i.produto.quantidade,
      });
    }

    // Apenas sincronizar se tiver itens válidos
    if (items.length > 0) {
      await Order.findOneAndUpdate(
        { tenantId, omieId: p.cabecalho.codigo_pedido },
        {
          tenantId,
          omieId: p.cabecalho.codigo_pedido,
          items,
        },
        { upsert: true }
      );
      syncedCount++;
      console.log(`Pedido ${p.cabecalho.codigo_pedido} sincronizado com ${items.length} itens (tenant: ${tenantId})`);
    }
  }

  return syncedCount;
}

export async function syncOrderFromOmie(orderCode, userId) {
  if (!userId) {
    throw new Error('User ID is required to sync order from Omie');
  }
  
  try {
    // Buscar tenantId do usuário
    const user = await User.findById(userId).select('tenantId');
    if (!user || !user.tenantId) {
      throw new Error('User not found or tenantId not configured');
    }
    const tenantId = user.tenantId;
    
    console.log(`Syncing order ${orderCode} from Omie (tenant: ${tenantId})`);
    
    const response = await callOmie(
      'produtos/pedido/',
      'ConsultarPedido',
      { codigo_pedido: orderCode },
      userId
    );

    const pedido = response.pedido_venda_produto;
    if (!pedido) {
      throw new Error(`Order ${orderCode} not found in Omie`);
    }

    const items = [];

    // Verificar se o pedido tem itens
    if (!pedido.det || pedido.det.length === 0) {
      console.log(`Order ${orderCode} has no items, creating empty order`);
    } else {
      for (const item of pedido.det || []) {
        // Buscar produto filtrando por tenantId
        const product = await Product.findOne({ 
          tenantId,
          codigo: item.produto.codigo_produto 
        });
        
        if (!product) {
          console.log(`Product ${item.produto.codigo_produto} not found for tenant ${tenantId}, skipping item...`);
          continue;
        }

        items.push({
          product: product._id,
          quantity: item.produto.quantidade,
          price: item.produto.valor_unitario,
          total: item.produto.valor_total
        });
      }
    }

    // Criar ou atualizar o pedido com tenantId
    const orderData = {
      tenantId,
      omieId: orderCode,
      items,
      status: pedido.cabecalho?.status || 'open',
      total: pedido.cabecalho?.valor_total || 0,
      customer: pedido.cabecalho?.cliente?.nome || '',
      orderDate: new Date(pedido.cabecalho?.data_previsao || Date.now()),
      updatedAt: new Date()
    };

    const order = await Order.findOneAndUpdate(
      { tenantId, omieId: orderCode },
      orderData,
      { upsert: true, new: true }
    ).populate('items.product');

    console.log(`Order ${orderCode} synced successfully with ${items.length} items (tenant: ${tenantId})`);
    return order;

  } catch (error) {
    console.error(`Error syncing order ${orderCode}:`, error);
    throw error;
  }
}