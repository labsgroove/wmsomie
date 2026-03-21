import { MercadoPagoConfig, Payment as MPPayment } from 'mercadopago';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import syncLogger from '../utils/syncLogger.js';

const mpConfig = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
  options: { timeout: 5000 }
});

const paymentClient = new MPPayment(mpConfig);

const CREDIT_PACKAGES = [
  { id: 'starter', credits: 1000, price: 29.90, name: 'Pacote Inicial' },
  { id: 'pro', credits: 5000, price: 99.90, name: 'Pacote Profissional' },
  { id: 'enterprise', credits: 20000, price: 299.90, name: 'Pacote Empresarial' }
];

class PaymentService {
  static getCreditPackages() {
    return CREDIT_PACKAGES.map(pkg => ({
      id: pkg.id,
      credits: pkg.credits,
      price: pkg.price,
      name: pkg.name,
      pricePerCredit: (pkg.price / pkg.credits).toFixed(3)
    }));
  }

  static async createPixPayment(userId, packageId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('Usuário não encontrado');

      const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
      if (!pkg) throw new Error('Pacote inválido');

      // Construir payload base
      const paymentBody = {
        transaction_amount: pkg.price,
        description: `${pkg.name} - ${pkg.credits} créditos`,
        payment_method_id: 'pix',
        payer: {
          email: user.email,
          first_name: user.name?.split(' ')[0] || 'Cliente',
          last_name: user.name?.split(' ').slice(1).join(' ') || ''
        },
        external_reference: `${userId}_${Date.now()}`,
        metadata: {
          userId: userId.toString(),
          tenantId: user.tenantId,
          packageId: pkg.id,
          credits: pkg.credits
        }
      };

      // Só adicionar notification_url se for uma URL válida (não localhost)
      const apiUrl = process.env.API_URL;
      if (apiUrl && !apiUrl.includes('localhost') && !apiUrl.includes('127.0.0.1')) {
        paymentBody.notification_url = `${apiUrl}/webhooks/mercadopago`;
      }

      const mpResponse = await paymentClient.create({ body: paymentBody });

      const payment = await Payment.create({
        userId,
        tenantId: user.tenantId,
        amount: pkg.price,
        credits: pkg.credits,
        status: 'pending',
        externalId: mpResponse.id.toString(),
        pix: {
          qrCode: mpResponse.point_of_interaction?.transaction_data?.qr_code,
          qrCodeBase64: mpResponse.point_of_interaction?.transaction_data?.qr_code_base64,
          copyPasteCode: mpResponse.point_of_interaction?.transaction_data?.ticket_url,
          expirationDate: new Date(Date.now() + 30 * 60 * 1000)
        },
        metadata: {
          packageId: pkg.id,
          externalReference: mpResponse.external_reference
        }
      });

      syncLogger.info('Pix payment created', { 
        paymentId: payment._id, 
        externalId: mpResponse.id,
        userId 
      });

      return {
        paymentId: payment._id,
        externalId: mpResponse.id,
        qrCode: payment.pix.qrCode,
        qrCodeBase64: payment.pix.qrCodeBase64,
        copyPasteCode: payment.pix.copyPasteCode,
        expiresAt: payment.pix.expirationDate,
        amount: pkg.price,
        credits: pkg.credits
      };
    } catch (error) {
      syncLogger.error('Failed to create pix payment', { error: error.message, userId, packageId });
      throw error;
    }
  }

  static async processWebhook(paymentData) {
    try {
      const { data } = paymentData;
      const paymentId = data.id;

      const mpPayment = await paymentClient.get({ id: paymentId });
      const paymentRecord = await Payment.findOne({ externalId: paymentId.toString() });

      if (!paymentRecord) {
        syncLogger.warn('Payment not found for webhook', { externalId: paymentId });
        return { success: false, message: 'Payment not found' };
      }

      const status = mpPayment.status;
      const wasPaid = status === 'approved' && paymentRecord.status !== 'paid';

      if (status === 'approved') {
        paymentRecord.status = 'paid';
        paymentRecord.paidAt = new Date();
      } else if (status === 'cancelled' || status === 'refunded') {
        paymentRecord.status = status === 'cancelled' ? 'cancelled' : 'refunded';
      }

      await paymentRecord.save();

      if (wasPaid) {
        await User.findByIdAndUpdate(
          paymentRecord.userId,
          { 
            $inc: { 'subscription.credits': paymentRecord.credits },
            $set: { 'subscription.lastPurchaseAt': new Date() }
          }
        );

        syncLogger.info('Credits added to user', {
          userId: paymentRecord.userId,
          credits: paymentRecord.credits,
          paymentId: paymentRecord._id
        });
      }

      return { success: true, processed: wasPaid };
    } catch (error) {
      syncLogger.error('Webhook processing failed', { error: error.message });
      throw error;
    }
  }

  static async checkPaymentStatus(paymentId) {
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) throw new Error('Pagamento não encontrado');

      if (payment.status === 'paid') {
        return { status: 'paid', credits: payment.credits };
      }

      if (!payment.isValid()) {
        payment.status = 'expired';
        await payment.save();
        return { status: 'expired' };
      }

      const mpPayment = await paymentClient.get({ id: payment.externalId });
      
      if (mpPayment.status === 'approved' && payment.status !== 'paid') {
        payment.status = 'paid';
        payment.paidAt = new Date();
        await payment.save();

        await User.findByIdAndUpdate(
          payment.userId,
          { $inc: { 'subscription.credits': payment.credits } }
        );

        return { status: 'paid', credits: payment.credits };
      }

      return { status: payment.status };
    } catch (error) {
      syncLogger.error('Check payment status failed', { error: error.message, paymentId });
      throw error;
    }
  }

  static async getPaymentHistory(userId) {
    return Payment.find({ userId })
      .sort({ createdAt: -1 })
      .select('-pix.qrCodeBase64')
      .lean();
  }
}

export default PaymentService;
