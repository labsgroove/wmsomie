// src/controllers/webhookController.js
import webhookService from '../services/webhookService.js';
import crypto from 'crypto';

/**
 * Valida a assinatura do webhook (opcional, mas recomendado)
 */
function validateSignature(req) {
  // Se não tiver configuração de webhook secret, pular validação
  if (!process.env.OMIE_WEBHOOK_SECRET) {
    return { valid: true };
  }

  const signature = req.headers['x-omie-signature'];
  const timestamp = req.headers['x-omie-timestamp'];
  
  if (!signature || !timestamp) {
    return { 
      valid: false, 
      error: 'Missing signature headers' 
    };
  }

  // Verificar se o timestamp não é muito antigo (previne replay attacks)
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  const timeDiff = Math.abs(now - requestTime);
  
  if (timeDiff > 300000) { // 5 minutos
    return { 
      valid: false, 
      error: 'Timestamp too old' 
    };
  }

  // Construir a string para assinatura
  const payload = JSON.stringify(req.body);
  const signedPayload = `${timestamp}.${payload}`;
  
  // Calcular assinatura esperada
  const expectedSignature = crypto
    .createHmac('sha256', process.env.OMIE_WEBHOOK_SECRET)
    .update(signedPayload)
    .digest('hex');

  // Comparar assinaturas (timing-safe comparison)
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  return {
    valid: isValid,
    error: isValid ? null : 'Invalid signature'
  };
}

/**
 * Controller para gerenciar webhooks da Omie
 */
class WebhookController {
  /**
   * Recebe eventos do webhook da Omie
   * Seguindo as recomendações da Omie: retornar 2XX rapidamente e processar depois
   */
  async handleOmieWebhook(req, res) {
    try {
      console.log('=== WEBHOOK RECEIVED ===');
      console.log('Headers:', req.headers);
      console.log('Body:', req.body);
      
      // Validação básica do payload
      if (!req.body || !req.body.event) {
        // Verificar se é um ping de teste da Omie
        if (req.body && req.body.ping === 'omie') {
          console.log('🏓 Received Omie ping test');
          return res.status(200).json({
            success: true,
            message: 'Pong! Webhook endpoint is active',
            timestamp: new Date().toISOString()
          });
        }
        
        console.error('Invalid webhook payload: missing event');
        return res.status(400).json({
          error: 'Invalid payload',
          message: 'Event field is required'
        });
      }

      // Validação de assinatura (se configurada)
      const signatureValidation = validateSignature(req);
      if (!signatureValidation.valid) {
        console.error('Invalid webhook signature:', signatureValidation.error);
        return res.status(401).json({
          error: 'Invalid signature',
          message: signatureValidation.error
        });
      }

      // Processar o evento (salvar e enfileirar para processamento assíncrono)
      const result = await webhookService.processWebhookEvent(req.body);
      
      // Retornar resposta rápida conforme recomendação da Omie
      res.status(200).json({
        success: true,
        eventId: result.eventId,
        message: 'Event received successfully'
      });

    } catch (error) {
      console.error('Error handling webhook:', error);
      
      // Mesmo em caso de erro, tentar retornar 200 para não perder o evento
      // A Omie tentará novamente se não receber 2XX
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Event could not be processed'
      });
    }
  }

  /**
   * Endpoint para testar se o webhook está ativo
   */
  async healthCheck(req, res) {
    try {
      const stats = await webhookService.getEventStats();
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        stats
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error.message
      });
    }
  }

  /**
   * Lista eventos recentes (para debugging)
   */
  async listEvents(req, res) {
    try {
      const { limit = 50, status, eventType } = req.query;
      
      const WebhookEvent = await import('../models/WebhookEvent.js');
      const query = {};
      
      if (status) query.status = status;
      if (eventType) query.eventType = eventType;
      
      const events = await WebhookEvent.default.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .select('eventType status createdAt processedAt error retryCount entityId entityType');

      res.json({
        events,
        total: events.length
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Reprocessa eventos falhados manualmente
   */
  async reprocessEvents(req, res) {
    try {
      const { limit = 10 } = req.body;
      const result = await webhookService.reprocessFailedEvents(limit);
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Limpa eventos antigos
   */
  async cleanupEvents(req, res) {
    try {
      const { daysOld = 30 } = req.body;
      const result = await webhookService.cleanupOldEvents(daysOld);
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new WebhookController();
