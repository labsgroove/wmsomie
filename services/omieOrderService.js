// src/services/omieOrderService.js
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { callOmie } from './omieClient.js';

export async function syncOrders() {
  const response = await callOmie(
    'produtos/pedido/',
    'ListarPedidos',
    { pagina: 1, registros_por_pagina: 50 }
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
      const product = await Product.findOne({ omieId: i.produto.codigo_produto });
      if (!product) {
        console.log(`Produto ${i.produto.codigo_produto} não encontrado no banco, ignorando item...`);
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
        { omieId: p.cabecalho.codigo_pedido },
        {
          omieId: p.cabecalho.codigo_pedido,
          items,
        },
        { upsert: true }
      );
      syncedCount++;
      console.log(`Pedido ${p.cabecalho.codigo_pedido} sincronizado com ${items.length} itens`);
    }
  }

  return syncedCount;
}

export async function syncOrderFromOmie(orderCode) {
  try {
    console.log(`Syncing order ${orderCode} from Omie`);
    
    const response = await callOmie(
      'produtos/pedido/',
      'ConsultarPedido',
      { codigo_pedido: orderCode }
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
        const product = await Product.findOne({ 
          codigo: item.produto.codigo_produto 
        });
        
        if (!product) {
          console.log(`Product ${item.produto.codigo_produto} not found, skipping item...`);
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

    // Criar ou atualizar o pedido
    const orderData = {
      omieId: orderCode,
      items,
      status: pedido.cabecalho?.status || 'open',
      total: pedido.cabecalho?.valor_total || 0,
      customer: pedido.cabecalho?.cliente?.nome || '',
      orderDate: new Date(pedido.cabecalho?.data_previsao || Date.now()),
      updatedAt: new Date()
    };

    const order = await Order.findOneAndUpdate(
      { omieId: orderCode },
      orderData,
      { upsert: true, new: true }
    ).populate('items.product');

    console.log(`Order ${orderCode} synced successfully with ${items.length} items`);
    return order;

  } catch (error) {
    console.error(`Error syncing order ${orderCode}:`, error);
    throw error;
  }
}