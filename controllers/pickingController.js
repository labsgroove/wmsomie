// src/controllers/pickingController.js
import { generatePicking } from '../services/pickingService.js';
import stockReservationService from '../services/stockReservationService.js';
import Picking from '../models/Picking.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import syncLogger from '../utils/syncLogger.js';

async function consumeUserCredit(userId, operation) {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { 'subscription.credits': -1 } },
      { new: true }
    );
    
    syncLogger.info('Crédito consumido', {
      userId,
      operation,
      remainingCredits: user?.subscription?.credits || 0
    });
    
    return user?.subscription?.credits || 0;
  } catch (error) {
    syncLogger.error('Erro ao consumir crédito', { error: error.message, userId });
    return null;
  }
}

export async function createPicking(req, res) {
  try {
    const { orderId } = req.params;
    const tenantId = req.user.tenantId;
    const userId = req.user._id || req.user.id;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    // Verificar créditos do usuário
    const user = await User.findById(userId);
    const credits = user?.subscription?.credits || 0;
    
    if (credits < 1) {
      return res.status(403).json({ 
        success: false,
        error: 'Créditos insuficientes. Compre créditos para gerar listas de picking.',
        code: 'INSUFFICIENT_CREDITS',
        credits: 0
      });
    }
    
    // Verificar se o pedido pertence ao tenant
    const order = await Order.findOne({ _id: orderId, tenantId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found for this tenant' });
    }
    
    const picking = await generatePicking(orderId, tenantId);
    
    // Consumir crédito após sucesso
    const remainingCredits = await consumeUserCredit(userId, 'picking_create');
    
    res.json({
      ...picking.toObject(),
      creditsConsumed: true,
      remainingCredits
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/**
 * Obtém sugestão de alocação de estoque para um produto
 */
export async function getStockAllocation(req, res) {
  try {
    const { productSku } = req.params;
    const { quantity } = req.query;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }

    if (!quantity || isNaN(quantity)) {
      return res.status(400).json({ error: 'Quantity parameter is required' });
    }

    const allocation = await stockReservationService.suggestStockAllocation(
      productSku, 
      parseInt(quantity),
      tenantId
    );

    res.json(allocation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

/**
 * Obtém estoque disponível por localização para um produto
 */
export async function getAvailableStock(req, res) {
  try {
    const { productSku } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }

    const stocks = await stockReservationService.getAvailableStockByLocation(productSku, tenantId);
    res.json(stocks);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

/**
 * Reserva estoque para um picking com alocações específicas
 */
export async function reserveStock(req, res) {
  try {
    const { pickingId } = req.params;
    const { allocations } = req.body;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }

    if (!allocations || !Array.isArray(allocations)) {
      return res.status(400).json({ error: 'Allocations array is required' });
    }

    // Validar formato das alocações
    for (const allocation of allocations) {
      if (!allocation.stockId || !allocation.quantity || allocation.quantity <= 0) {
        return res.status(400).json({ 
          error: 'Invalid allocation format. Each allocation must have stockId and quantity > 0' 
        });
      }
    }

    const result = await stockReservationService.reserveStockForPicking(pickingId, allocations, tenantId);
    res.json(result);

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

/**
 * Confirma o picking e atualiza o estoque
 */
export async function confirmPicking(req, res) {
  try {
    const { pickingId } = req.params;
    const { allocations } = req.body;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }

    if (!allocations || !Array.isArray(allocations)) {
      return res.status(400).json({ error: 'Allocations array is required' });
    }

    // Validar formato das alocações
    for (const allocation of allocations) {
      if (!allocation.stockId || !allocation.quantity || allocation.quantity <= 0) {
        return res.status(400).json({ 
          error: 'Invalid allocation format. Each allocation must have stockId and quantity > 0' 
        });
      }
    }

    const result = await stockReservationService.confirmPicking(pickingId, allocations, tenantId);
    res.json(result);

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

/**
 * Cancela um picking e libera as reservas
 */
export async function cancelPicking(req, res) {
  try {
    const { pickingId } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }

    const result = await stockReservationService.cancelPicking(pickingId, tenantId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

/**
 * Obtém status detalhado das reservas de um produto
 */
export async function getReservationStatus(req, res) {
  try {
    const { productSku } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }

    const status = await stockReservationService.getStockReservationStatus(productSku, tenantId);
    res.json(status);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

/**
 * Obtém picking com detalhes completos incluindo alocações sugeridas
 */
export async function getPickingWithAllocations(req, res) {
  try {
    const { pickingId } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const picking = await Picking.findOne({ _id: pickingId, tenantId })
      .populate('order')
      .populate('items.product');

    if (!picking) {
      return res.status(404).json({ error: 'Picking not found' });
    }

    // Para cada item, obter sugestões de alocação
    const itemsWithAllocations = await Promise.all(
      picking.items.map(async (item) => {
        const product = await item.product;
        const allocation = await stockReservationService.suggestStockAllocation(
          product.codigo,
          item.quantity,
          tenantId
        );

        return {
          ...item.toObject(),
          product: product,
          suggestedAllocation: allocation
        };
      })
    );

    res.json({
      ...picking.toObject(),
      items: itemsWithAllocations
    });

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}