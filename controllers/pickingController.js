// src/controllers/pickingController.js
import { generatePicking } from '../services/pickingService.js';
import stockReservationService from '../services/stockReservationService.js';
import Picking from '../models/Picking.js';
import Order from '../models/Order.js';

export async function createPicking(req, res) {
  try {
    const { orderId } = req.params;
    const picking = await generatePicking(orderId);
    res.json(picking);
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

    if (!quantity || isNaN(quantity)) {
      return res.status(400).json({ error: 'Quantity parameter is required' });
    }

    const allocation = await stockReservationService.suggestStockAllocation(
      productSku, 
      parseInt(quantity)
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
    const stocks = await stockReservationService.getAvailableStockByLocation(productSku);
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

    const result = await stockReservationService.reserveStockForPicking(pickingId, allocations);
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

    const result = await stockReservationService.confirmPicking(pickingId, allocations);
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
    const result = await stockReservationService.cancelPicking(pickingId);
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
    const status = await stockReservationService.getStockReservationStatus(productSku);
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
    
    const picking = await Picking.findById(pickingId)
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
          item.quantity
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