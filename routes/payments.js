import express from 'express';
import { protect } from '../middleware/auth.js';
import PaymentController from '../controllers/paymentController.js';

const router = express.Router();

// Rotas públicas
router.post('/webhooks/mercadopago', PaymentController.handleWebhook);

// Rotas autenticadas
router.get('/packages', protect, PaymentController.getPackages);
router.post('/create', protect, PaymentController.createPayment);
router.get('/history', protect, PaymentController.getHistory);
router.get('/status/:paymentId', protect, PaymentController.checkStatus);

export default router;
