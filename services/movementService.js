// src/services/movementService.js
import Movement from '../models/Movement.js';
import User from '../models/User.js';
import { adjustStock } from './stockService.js';
import { sendMovementToOmie } from './omieMovementService.js';

export async function inbound(productId, locationId, qty, description, userId) {
  if (!userId) throw new Error('User ID is required');
  
  // Buscar tenantId do usuário
  const user = await User.findById(userId).select('tenantId');
  if (!user || !user.tenantId) throw new Error('User not found or tenantId not configured');
  const tenantId = user.tenantId;
  
  await adjustStock(productId, locationId, qty, {}, tenantId);
  const movement = await Movement.create({ 
    tenantId,
    type: 'IN', 
    product: productId, 
    toLocation: locationId, 
    quantity: qty, 
    description: description || 'Entrada de estoque' 
  });
  try { await sendMovementToOmie(movement, userId); } catch (e) { console.warn('Failed to sync:', e.message); }
  return movement;
}

export async function outbound(productId, locationId, qty, description, userId) {
  if (!userId) throw new Error('User ID is required');
  
  // Buscar tenantId do usuário
  const user = await User.findById(userId).select('tenantId');
  if (!user || !user.tenantId) throw new Error('User not found or tenantId not configured');
  const tenantId = user.tenantId;
  
  await adjustStock(productId, locationId, -qty, {}, tenantId);
  const movement = await Movement.create({ 
    tenantId,
    type: 'OUT', 
    product: productId, 
    fromLocation: locationId, 
    quantity: qty, 
    description: description || 'Saída de estoque' 
  });
  try { await sendMovementToOmie(movement, userId); } catch (e) { console.warn('Failed to sync:', e.message); }
  return movement;
}

export async function transfer(productId, fromLoc, toLoc, qty, description, userId) {
  if (!userId) throw new Error('User ID is required');
  
  // Buscar tenantId do usuário
  const user = await User.findById(userId).select('tenantId');
  if (!user || !user.tenantId) throw new Error('User not found or tenantId not configured');
  const tenantId = user.tenantId;
  
  await adjustStock(productId, fromLoc, -qty, {}, tenantId);
  await adjustStock(productId, toLoc, qty, {}, tenantId);
  const movement = await Movement.create({ 
    tenantId,
    type: 'TRANSFER', 
    product: productId, 
    fromLocation: fromLoc, 
    toLocation: toLoc, 
    quantity: qty, 
    description: description || 'Transferência' 
  });
  try { await sendMovementToOmie(movement, userId); } catch (e) { console.warn('Failed to sync:', e.message); }
  return movement;
}

// Funções wrapper que buscam produto por SKU (com tenant)
export async function inboundBySku(sku, locationCode, qty, options, userId) {
  if (!userId) throw new Error('User ID is required');
  
  const user = await User.findById(userId).select('tenantId');
  if (!user || !user.tenantId) throw new Error('User not found or tenantId not configured');
  const tenantId = user.tenantId;
  
  const Product = await import('../models/Product.js');
  const product = await Product.default.findOne({ tenantId, codigo: sku });
  if (!product) throw new Error(`Product with SKU ${sku} not found for tenant ${tenantId}`);
  return inbound(product._id, locationCode, qty, options?.description, userId);
}

export async function outboundBySku(sku, locationCode, qty, options, userId) {
  if (!userId) throw new Error('User ID is required');
  
  const user = await User.findById(userId).select('tenantId');
  if (!user || !user.tenantId) throw new Error('User not found or tenantId not configured');
  const tenantId = user.tenantId;
  
  const Product = await import('../models/Product.js');
  const product = await Product.default.findOne({ tenantId, codigo: sku });
  if (!product) throw new Error(`Product with SKU ${sku} not found for tenant ${tenantId}`);
  return outbound(product._id, locationCode, qty, options?.description, userId);
}

export async function transferBySku(sku, fromLocCode, toLocCode, qty, options, userId) {
  if (!userId) throw new Error('User ID is required');
  
  const user = await User.findById(userId).select('tenantId');
  if (!user || !user.tenantId) throw new Error('User not found or tenantId not configured');
  const tenantId = user.tenantId;
  
  const Product = await import('../models/Product.js');
  const product = await Product.default.findOne({ tenantId, codigo: sku });
  if (!product) throw new Error(`Product with SKU ${sku} not found for tenant ${tenantId}`);
  return transfer(product._id, fromLocCode, toLocCode, qty, options?.description, userId);
}