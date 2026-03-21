// src/services/webhookService.js
import WebhookEvent from '../models/WebhookEvent.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { syncProductFromOmie } from './omieProductService.js';
import { syncOrderFromOmie } from './omieOrderService.js';

class WebhookService {
  /**
   * Busca o usuário associado ao appKey do webhook
   * @param {string} appKey - App Key da Omie
   * @returns {Promise<Object|null>} - Objeto com userId e tenantId ou null
   */
  async getUserFromAppKey(appKey) {
    if (!appKey) return null;
    
    const user = await User.findOne({
      'omieConfig.appKey': appKey,
      'omieConfig.isConfigured': true
    }).select('_id tenantId');
    
    return user ? { userId: user._id.toString(), tenantId: user.tenantId } : null;
  }

  /**
   * Processa um evento recebido do webhook da Omie
   * @param {Object} eventData - Dados do evento recebido
   * @returns {Promise<Object>} - Resultado do processamento
   */
  async processWebhookEvent(eventData) {
    try {
      console.log('Processing webhook event:', eventData.event);
      
      // Buscar o usuário associado ao appKey (incluindo tenantId)
      const userData = await this.getUserFromAppKey(eventData.appKey);
      
      if (!userData) {
        console.warn(`No user found for appKey: ${eventData.appKey}`);
        return {
          success: false,
          message: 'No user configured for this appKey'
        };
      }
      
      const { userId, tenantId } = userData;
      
      if (!tenantId) {
        console.warn(`User ${userId} has no tenantId configured`);
        return {
          success: false,
          message: 'User has no tenantId configured'
        };
      }
      
      // Salvar o evento no banco primeiro (recomendação da Omie)
      const webhookEvent = await WebhookEvent.create({
        eventType: eventData.topic,
        eventId: eventData.id || `${Date.now()}-${Math.random()}`,
        payload: eventData,
        appId: eventData.appKey || process.env.OMIE_APP_ID,
        userId: userId,
        tenantId: tenantId,
        timestamp: new Date(eventData.timestamp || Date.now()),
        status: 'received'
      });

      // Processar o evento de forma assíncrona
      this.processEventAsync(webhookEvent, userId, tenantId).catch(error => {
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
   * @param {string} userId - ID do usuário
   */
  async processEventAsync(webhookEvent, userId, tenantId) {
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
        case 'produto.ajustado':
          await this.handleProductEvent(eventType, payload, webhookEvent, userId, tenantId);
          break;
          
        case 'pedido.incluido':
        case 'pedido.alterado':
        case 'pedido.excluido':
        case 'pedido.confirmado':
        case 'pedido.cancelado':
          await this.handleOrderEvent(eventType, payload, webhookEvent, userId, tenantId);
          break;
          
        case 'estoque.baixado':
        case 'estoque.acrescido':
        case 'estoque.transferido':
          await this.handleStockEvent(eventType, payload, webhookEvent, userId, tenantId);
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
  async handleProductEvent(eventType, payload, webhookEvent, userId, tenantId) {
    // Para ajuste de estoque, o ID do produto está em id_prod
    const productCode = payload.codigo_produto || payload.id_prod;
    
    if (!productCode) {
      throw new Error('Product code not found in payload');
    }

    switch (eventType) {
      case 'produto.incluido':
      case 'produto.alterado':
        console.log(`Syncing product ${productCode} from Omie (user: ${userId}, tenant: ${tenantId})`);
        await syncProductFromOmie(productCode, userId);
        break;
        
      case 'produto.excluido':
        console.log(`Marking product ${productCode} as inactive (tenant: ${tenantId})`);
        await Product.updateOne(
          { tenantId, codigo: productCode },
          { isActive: false, lastSyncAt: new Date() }
        );
        break;
        
      case 'produto.ajustado':
        console.log(`Processing stock adjustment for product ${productCode}`);
        console.log(`Action: ${payload.acao}, Quantity: ${payload.quantidade}`);
        
        // Buscar o produto local para obter o omieId correto (filtrado por tenant)
        const product = await Product.findOne({ 
          tenantId,
          $or: [
            { codigo: productCode },
            { omieId: productCode }
          ]
        });
        
        if (product) {
          // Usar o omieId para sincronizar com a Omie
          if (product.omieId) {
            console.log(`Syncing product ${productCode} (Omie ID: ${product.omieId}) from Omie (user: ${userId}, tenant: ${tenantId})`);
            await syncProductFromOmie(product.omieId, userId);
          } else {
            console.warn(`Product ${productCode} has no omieId, cannot sync from Omie`);
          }
        } else {
          console.warn(`Product ${productCode} not found in local database for tenant ${tenantId}, skipping stock adjustment`);
        }
        break;
    }

    await webhookEvent.markAsProcessed();
  }

  /**
   * Manipula eventos de pedido
   */
  async handleOrderEvent(eventType, payload, webhookEvent, userId, tenantId) {
    const orderCode = payload.codigo_pedido;
    
    if (!orderCode) {
      throw new Error('Order code not found in payload');
    }

    switch (eventType) {
      case 'pedido.incluido':
      case 'pedido.alterado':
        console.log(`Syncing order ${orderCode} from Omie (user: ${userId}, tenant: ${tenantId})`);
        const syncedOrder = await syncOrderFromOmie(orderCode, userId);
        
        // Se o pedido já estiver confirmado na Omie, gerar picking
        if (syncedOrder && syncedOrder.status === 'confirmed') {
          try {
            const { generatePicking } = await import('./pickingService.js');
            await generatePicking(syncedOrder._id.toString(), tenantId);
            console.log(`Picking generated for confirmed order ${orderCode}`);
          } catch (pickingError) {
            console.error(`Failed to generate picking for order ${orderCode}:`, pickingError.message);
          }
        }
        break;
        
      case 'pedido.confirmado':
        console.log(`Processing confirmed order ${orderCode} - generating picking (user: ${userId}, tenant: ${tenantId})`);
        
        // Primeiro sincronizar o pedido
        await syncOrderFromOmie(orderCode, userId);
        
        // Depois gerar o picking automaticamente
        const order = await Order.findOne({ tenantId, omieId: orderCode });
        if (order) {
          try {
            const { generatePicking } = await import('./pickingService.js');
            await generatePicking(order._id.toString(), tenantId);
            console.log(`Picking generated successfully for order ${orderCode}`);
          } catch (pickingError) {
            console.error(`Failed to generate picking for order ${orderCode}:`, pickingError.message);
            // Não falhar o webhook inteiro se o picking falhar
          }
        }
        break;
        
      case 'pedido.cancelado':
        console.log(`Updating order ${orderCode} status to cancelled (tenant: ${tenantId})`);
        await Order.updateOne(
          { tenantId, omieId: orderCode },
          { 
            status: 'cancelled',
            updatedAt: new Date()
          }
        );
        break;
        
      case 'pedido.excluido':
        console.log(`Deleting order ${orderCode} (tenant: ${tenantId})`);
        await Order.deleteOne({ tenantId, omieId: orderCode });
        break;
    }

    await webhookEvent.markAsProcessed();
  }

  /**
   * Manipula eventos de estoque
   */
  async handleStockEvent(eventType, payload, webhookEvent, userId, tenantId) {
    const productCode = payload.codigo_produto;
    
    if (!productCode) {
      throw new Error('Product code not found in payload');
    }

    console.log(`Processing stock event ${eventType} for product ${productCode} (user: ${userId}, tenant: ${tenantId})`);
    
    // Buscar o produto local para obter o omieId correto (filtrado por tenant)
    const Product = await import('../models/Product.js');
    const product = await Product.default.findOne({ 
      tenantId,
      $or: [
        { codigo: productCode },
        { omieId: productCode }
      ]
    });
    
    if (!product) {
      console.warn(`Product ${productCode} not found in local database for tenant ${tenantId}, skipping stock event`);
      await webhookEvent.markAsProcessed();
      return;
    }
    
    // Usar o omieId para sincronizar com a Omie
    if (product.omieId) {
      console.log(`Syncing product ${productCode} (Omie ID: ${product.omieId}) from Omie (user: ${userId}, tenant: ${tenantId})`);
      await syncProductFromOmie(product.omieId, userId);
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
