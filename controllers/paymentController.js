import PaymentService from '../services/paymentService.js';

class PaymentController {
  static async getPackages(req, res) {
    try {
      const packages = PaymentService.getCreditPackages();
      res.json({ success: true, packages });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createPayment(req, res) {
    try {
      const { packageId } = req.body;
      const userId = req.user.id;

      if (!packageId) {
        return res.status(400).json({ success: false, message: 'Pacote é obrigatório' });
      }

      const payment = await PaymentService.createPixPayment(userId, packageId);
      res.json({ success: true, payment });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async checkStatus(req, res) {
    try {
      const { paymentId } = req.params;
      const status = await PaymentService.checkPaymentStatus(paymentId);
      res.json({ success: true, ...status });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getHistory(req, res) {
    try {
      const userId = req.user.id;
      const history = await PaymentService.getPaymentHistory(userId);
      res.json({ success: true, payments: history });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async handleWebhook(req, res) {
    try {
      const result = await PaymentService.processWebhook(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default PaymentController;
