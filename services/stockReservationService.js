// src/services/stockReservationService.js
import Stock from '../models/Stock.js';
import Picking from '../models/Picking.js';
import Movement from '../models/Movement.js';
import mongoose from 'mongoose';

/**
 * Serviço para gerenciar reservas e atualizações de estoque durante o picking
 */
class StockReservationService {
  
  /**
   * Obtém estoque disponível de um produto distribuído por localizações
   */
  async getAvailableStockByLocation(productSku, tenantId) {
    if (!tenantId) throw new Error('Tenant ID é obrigatório');
    
    const stocks = await Stock.find({
      tenantId,
      sku: productSku,
      availableQuantity: { $gt: 0 }
    });

    return stocks.map(stock => ({
      id: stock._id,
      location: stock.locationCode,
      locationCode: stock.locationCode,
      availableQuantity: stock.availableQuantity,
      totalQuantity: stock.quantity,
      reservedQuantity: stock.reservedQuantity,
      batchNumber: stock.batchNumber,
      expiryDate: stock.expiryDate,
      qualityStatus: stock.qualityStatus
    }));
  }

  /**
   * Sugere melhor distribuição de estoque para uma quantidade necessária
   */
  async suggestStockAllocation(productSku, requiredQuantity, tenantId) {
    if (!tenantId) throw new Error('Tenant ID é obrigatório');
    
    const availableStocks = await this.getAvailableStockByLocation(productSku, tenantId);
    
    // Ordenar por prioridade: FIFO (primeiro a expirar), depois quantidade disponível
    const sortedStocks = availableStocks.sort((a, b) => {
      // Prioridade 1: Data de validade (primeiro a expirar primeiro)
      if (a.expiryDate && b.expiryDate) {
        return new Date(a.expiryDate) - new Date(b.expiryDate);
      }
      if (a.expiryDate) return -1;
      if (b.expiryDate) return 1;
      
      // Prioridade 2: Maior quantidade disponível
      return b.availableQuantity - a.availableQuantity;
    });

    const allocation = [];
    let remaining = requiredQuantity;

    for (const stock of sortedStocks) {
      if (remaining <= 0) break;

      const allocated = Math.min(stock.availableQuantity, remaining);
      allocation.push({
        stockId: stock.id,
        location: stock.location,
        locationCode: stock.locationCode,
        quantity: allocated,
        availableFrom: stock.availableQuantity
      });

      remaining -= allocated;
    }

    if (remaining > 0) {
      throw new Error(`Estoque insuficiente. Necessário: ${requiredQuantity}, Disponível: ${requiredQuantity - remaining}`);
    }

    return {
      allocation,
      totalAllocated: requiredQuantity,
      locationsUsed: allocation.length
    };
  }

  /**
   * Reserva estoque para um picking
   */
  async reserveStockForPicking(pickingId, allocations, tenantId) {
    if (!tenantId) throw new Error('Tenant ID é obrigatório');
    
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Buscar picking filtrado por tenant
      const picking = await Picking.findOne({ _id: pickingId, tenantId }).session(session);
      if (!picking) {
        throw new Error('Picking não encontrado para este tenant');
      }

      const reservationResults = [];

      for (const allocation of allocations) {
        const stock = await Stock.findById(allocation.stockId).session(session);
        
        if (!stock) {
          throw new Error(`Estoque ${allocation.stockId} não encontrado`);
        }

        if (stock.availableQuantity < allocation.quantity) {
          throw new Error(`Estoque insuficiente em ${stock.locationCode}. Disponível: ${stock.availableQuantity}, Solicitado: ${allocation.quantity}`);
        }

        // Atualizar reserva
        stock.reservedQuantity += allocation.quantity;
        stock.lastMovementDate = new Date();
        await stock.save({ session });

        reservationResults.push({
          stockId: stock._id,
          locationCode: stock.locationCode,
          reservedQuantity: allocation.quantity,
          previousReserved: stock.reservedQuantity - allocation.quantity,
          newReserved: stock.reservedQuantity
        });
      }

      // Atualizar status do picking para IN_PROGRESS
      picking.status = 'IN_PROGRESS';
      await picking.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        pickingId,
        reservations: reservationResults,
        message: 'Estoque reservado com sucesso'
      };

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Confirma o picking e atualiza o estoque (baixa real)
   */
  async confirmPicking(pickingId, allocations, tenantId) {
    if (!tenantId) throw new Error('Tenant ID é obrigatório');
    
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Buscar picking filtrado por tenant
      const picking = await Picking.findOne({ _id: pickingId, tenantId }).populate('items.product').session(session);
      if (!picking) {
        throw new Error('Picking não encontrado para este tenant');
      }

      if (picking.status !== 'IN_PROGRESS') {
        throw new Error('Picking não está em progresso');
      }

      const movementResults = [];

      for (const allocation of allocations) {
        const stock = await Stock.findById(allocation.stockId).session(session);
        
        if (!stock) {
          throw new Error(`Estoque ${allocation.stockId} não encontrado`);
        }

        // Validar se há estoque reservado suficiente
        if (stock.reservedQuantity < allocation.quantity) {
          throw new Error(`Reserva insuficiente em ${stock.locationCode}. Reservado: ${stock.reservedQuantity}, Solicitado: ${allocation.quantity}`);
        }

        // Criar movimento de saída com tenantId
        const movement = await Movement.create([{
          tenantId,
          type: 'OUT',
          product: stock.sku,
          fromLocation: stock.locationCode,
          quantity: allocation.quantity,
          reason: 'PICKING_CONFIRMED',
          documentId: pickingId,
          documentType: 'PICKING',
          timestamp: new Date()
        }], { session });

        // Atualizar estoque
        stock.quantity -= allocation.quantity;
        stock.reservedQuantity -= allocation.quantity;
        stock.lastMovementDate = new Date();
        await stock.save({ session });

        movementResults.push({
          stockId: stock._id,
          locationCode: stock.locationCode,
          quantity: allocation.quantity,
          movementId: movement[0]._id,
          newQuantity: stock.quantity,
          newReserved: stock.reservedQuantity
        });
      }

      // Atualizar status do picking para DONE
      picking.status = 'DONE';
      picking.confirmedAt = new Date();
      await picking.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        pickingId,
        movements: movementResults,
        message: 'Picking confirmado e estoque atualizado com sucesso'
      };

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Cancela um picking e libera as reservas de estoque
   */
  async cancelPicking(pickingId, tenantId) {
    if (!tenantId) throw new Error('Tenant ID é obrigatório');
    
    const session = mongoose.startSession();
    session.startTransaction();

    try {
      // Buscar picking filtrado por tenant
      const picking = await Picking.findOne({ _id: pickingId, tenantId }).session(session);
      if (!picking) {
        throw new Error('Picking não encontrado para este tenant');
      }

      if (picking.status === 'DONE') {
        throw new Error('Não é possível cancelar um picking já concluído');
      }

      // Buscar todas as reservas associadas a este picking (filtrado por tenant)
      const movements = await Movement.find({
        tenantId,
        documentId: pickingId,
        documentType: 'PICKING',
        reason: 'STOCK_RESERVED'
      }).session(session);

      for (const movement of movements) {
        const stock = await Stock.findOne({
          tenantId,
          sku: movement.product,
          locationCode: movement.fromLocation
        }).session(session);

        if (stock) {
          // Liberar reserva
          stock.reservedQuantity -= movement.quantity;
          stock.lastMovementDate = new Date();
          await stock.save({ session });
        }
      }

      // Atualizar status do picking
      picking.status = 'CANCELLED';
      picking.cancelledAt = new Date();
      await picking.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        pickingId,
        message: 'Picking cancelado e reservas liberadas'
      };

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Obtém status detalhado das reservas de um produto
   */
  async getStockReservationStatus(productSku, tenantId) {
    if (!tenantId) throw new Error('Tenant ID é obrigatório');
    
    const stocks = await Stock.find({ tenantId, sku: productSku });

    return stocks.map(stock => ({
      locationCode: stock.locationCode,
      totalQuantity: stock.quantity,
      reservedQuantity: stock.reservedQuantity,
      availableQuantity: stock.availableQuantity,
      utilizationRate: stock.quantity > 0 ? (stock.reservedQuantity / stock.quantity * 100).toFixed(2) : 0
    }));
  }
}

export default new StockReservationService();
