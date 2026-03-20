// src/routes/webhook.js
import { Router } from 'express';
import webhookController from '../controllers/webhookController.js';

const router = Router();

/**
 * Rota principal para receber webhooks da Omie
 * POST /api/webhook/omie
 */
router.post('/omie', webhookController.handleOmieWebhook);

/**
 * Health check do webhook
 * GET /api/webhook/health
 */
router.get('/health', webhookController.healthCheck);

/**
 * Listar eventos (para debugging e monitoramento)
 * GET /api/webhook/events
 */
router.get('/events', webhookController.listEvents);

/**
 * Reprocessar eventos falhados manualmente
 * POST /api/webhook/reprocess
 */
router.post('/reprocess', webhookController.reprocessEvents);

/**
 * Limpar eventos antigos
 * POST /api/webhook/cleanup
 */
router.post('/cleanup', webhookController.cleanupEvents);

export default router;
