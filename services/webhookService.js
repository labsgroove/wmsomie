// src/services/webhookService.js
import WebhookEvent from '../models/WebhookEvent.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { syncProductFromOmie } from './omieProductService.js';
import { syncOrderFromOmie } from './omieOrderService.js';

class WebhookService {
  /**
   * Processa um evento recebido do webhook da Omie
   * @param {Object} eventData - Dados do evento recebido
   * @returns {Promise<Object>} - Resultado do processamento
   */
  async processWebhookEvent(eventData) {
    try {
      console.log('Processing webhook event:', eventData.event);
      
      // Salvar o evento no banco primeiro (recomendação da Omie)
      const webhookEvent = await WebhookEvent.create({
        eventType: eventData.topic, // Corrigido: usar topic em vez de event
        eventId: eventData.id || `${Date.now()}-${Math.random()}`,
        payload: eventData,
        appId: eventData.appKey || process.env.OMIE_APP_ID, // Corrigido: usar appKey em vez de appId
        timestamp: new Date(eventData.timestamp || Date.now()),
        status: 'received'
      });

      // Processar o evento de forma assíncrona
      this.processEventAsync(webhookEvent).catch(error => {
        console.error('Error processing webhook event asynchronously:', error);
      });

      return {
        success: true,
        eventId: webhookEvent._id,
        message: 'Event received and queued for processing'
      };

    } catch (error) {
      console.error('Error saving webhook event:', error);
      throw error;
    }
  }

  /**
   * Processa um evento de forma assíncrona
   * @param {WebhookEvent} webhookEvent - Evento salvo no banco
   */
  async processEventAsync(webhookEvent) {
    try {
      // Atualizar status para processing
      webhookEvent.status = 'processing';
      await webhookEvent.save();

      const { eventType, payload } = webhookEvent;
      
      // Router para diferentes tipos de eventos
      switch (eventType) {
        case 'produto.incluido':
        case 'produto.alterado':
        case 'produto.excluido':
        case 'produto.ajustado': // Adicionado para ajuste de estoque
          await this.handleProductEvent(eventType, payload, webhookEvent);
          break;
          
        case 'pedido.incluido':
        case 'pedido.alterado':
        case 'pedido.excluido':
        case 'pedido.confirmado':
        case 'pedido.cancelado':
          await this.handleOrderEvent(eventType, payload, webhookEvent);
          break;
          
        case 'estoque.baixado':
        case 'estoque.acrescido':
        case 'estoque.transferido':
          await this.handleStockEvent(eventType, payload, webhookEvent);
          break;
          
        default:
          console.log(`Unhandled event type: ${eventType}`);
          await webhookEvent.markAsProcessed(`Unhandled event type: ${eventType}`);
      }

    } catch (error) {
      console.error(`Error processing webhook event ${webhookEvent._id}:`, error);
      await webhookEvent.markAsProcessed(error.message);
    }
  }

  /**
   * Manipula eventos de produto
   */
  async handleProductEvent(eventType, payload, webhookEvent) {
    // Para ajuste de estoque, o ID do produto está em id_prod
    const productCode = payload.codigo_produto || payload.id_prod;
    
    if (!productCode) {
      throw new Error('Product code not found in payload');
    }

    switch (eventType) {
      case 'produto.incluido':
      case 'produto.alterado':
        console.log(`Syncing product ${productCode} from Omie`);
        await syncProductFromOmie(productCode);
        break;
        
      case 'produto.excluido':
        console.log(`Marking product ${productCode} as inactive`);
        await Product.updateOne(
          { codigo: productCode },
          { isActive: false, lastSyncAt: new Date() }
        );
        break;
        
      case 'produto.ajustado':
        console.log(`Processing stock adjustment for product ${productCode}`);
        console.log(`Action: ${payload.acao}, Quantity: ${payload.quantidade}`);
        
        // Buscar o produto local para obter o omieId correto
        const product = await Product.findOne({ 
          $or: [
            { codigo: productCode },
            { omieId: productCode }
          ]
        });
        
        if (product) {
          // Usar o omieId para sincronizar com a Omie
          if (product.omieId) {
            console.log(`Syncing product ${productCode} (Omie ID: ${product.omieId}) from Omie`);
            await syncProductFromOmie(product.omieId);
          } else {
            console.warn(`Product ${productCode} has no omieId, cannot sync from Omie`);
          }
        } else {
          console.warn(`Product ${productCode} not found in local database, skipping stock adjustment`);
        }
        break;
    }

    await webhookEvent.markAsProcessed();
  }

  /**
   * Manipula eventos de pedido
   */
  async handleOrderEvent(eventType, payload, webhookEvent) {
    const orderCode = payload.codigo_pedido;
    
    if (!orderCode) {
      throw new Error('Order code not found in payload');
    }

    switch (eventType) {
      case 'pedido.incluido':
      case 'pedido.alterado':
        console.log(`Syncing order ${orderCode} from Omie`);
        const syncedOrder = await syncOrderFromOmie(orderCode);
        
        // Se o pedido já estiver confirmado na Omie, gerar picking
        if (syncedOrder && syncedOrder.status === 'confirmed') {
          try {
            const { generatePicking } = await import('./pickingService.js');
            await generatePicking(syncedOrder._id.toString());
            console.log(`Picking generated for confirmed order ${orderCode}`);
          } catch (pickingError) {
            console.error(`Failed to generate picking for order ${orderCode}:`, pickingError.message);
          }
        }
        break;
        
      case 'pedido.confirmado':
        console.log(`Processing confirmed order ${orderCode} - generating picking`);
        
        // Primeiro sincronizar o pedido
        await syncOrderFromOmie(orderCode);
        
        // Depois gerar o picking automaticamente
        const order = await Order.findOne({ omieId: orderCode });
        if (order) {
          try {
            const { generatePicking } = await import('./pickingService.js');
            await generatePicking(order._id.toString());
            console.log(`Picking generated successfully for order ${orderCode}`);
          } catch (pickingError) {
            console.error(`Failed to generate picking for order ${orderCode}:`, pickingError.message);
            // Não falhar o webhook inteiro se o picking falhar
          }
        }
        break;
        
      case 'pedido.cancelado':
        console.log(`Updating order ${orderCode} status to cancelled`);
        await Order.updateOne(
          { omieId: orderCode },
          { 
            status: 'cancelled',
            updatedAt: new Date()
          }
        );
        break;
        
      case 'pedido.excluido':
        console.log(`Deleting order ${orderCode}`);
        await Order.deleteOne({ omieId: orderCode });
        break;
    }

    await webhookEvent.markAsProcessed();
  }

  /**
   * Manipula eventos de estoque
   */
  async handleStockEvent(eventType, payload, webhookEvent) {
    const productCode = payload.codigo_produto;
    
    if (!productCode) {
      throw new Error('Product code not found in payload');
    }

    console.log(`Processing stock event ${eventType} for product ${productCode}`);
    
    // Buscar o produto local para obter o omieId correto
    const Product = await import('../models/Product.js');
    const product = await Product.default.findOne({ 
      $or: [
        { codigo: productCode },
        { omieId: productCode }
      ]
    });
    
    if (!product) {
      console.warn(`Product ${productCode} not found in local database, skipping stock event`);
      await webhookEvent.markAsProcessed();
      return;
    }
    
    // Usar o omieId para sincronizar com a Omie
    if (product.omieId) {
      console.log(`Syncing product ${productCode} (Omie ID: ${product.omieId}) from Omie`);
      await syncProductFromOmie(product.omieId);
    } else {
      console.warn(`Product ${productCode} has no omieId, cannot sync from Omie`);
    }
    
    await webhookEvent.markAsProcessed();
  }

  /**
   * Busca eventos não processados para reprocessamento
   */
  async getUnprocessedEvents(limit = 50) {
    return await WebhookEvent.findUnprocessed(limit);
  }

  /**
   * Reprocessa eventos falhados
   */
  async reprocessFailedEvents(limit = 10) {
    const failedEvents = await WebhookEvent.find({ 
      status: 'failed',
      retryCount: { $lt: 3 } // Limitar a 3 tentativas
    })
    .sort({ createdAt: 1 })
    .limit(limit);

    for (const event of failedEvents) {
      event.retryCount += 1;
      await event.save();
      
      try {
        await this.processEventAsync(event);
      } catch (error) {
        console.error(`Error reprocessing event ${event._id}:`, error);
      }
    }

    return {
      processed: failedEvents.length,
      events: failedEvents.map(e => ({
        id: e._id,
        eventType: e.eventType,
        retryCount: e.retryCount
      }))
    };
  }

  /**
   * Limpa eventos antigos já processados
   */
  async cleanupOldEvents(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await WebhookEvent.deleteMany({
      status: 'processed',
      processedAt: { $lt: cutoffDate }
    });

    return {
      deletedCount: result.deletedCount,
      message: `Deleted ${result.deletedCount} old processed events`
    };
  }

  /**
   * Obtém estatísticas dos eventos
   */
  async getEventStats() {
    const stats = await WebhookEvent.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          oldest: { $min: '$createdAt' },
          newest: { $max: '$createdAt' }
        }
      }
    ]);

    return stats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        oldest: stat.oldest,
        newest: stat.newest
      };
      return acc;
    }, {});
  }
}

export default new WebhookService();
