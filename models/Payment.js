import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tenantId: {
    type: String,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  credits: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'expired', 'cancelled', 'refunded'],
    default: 'pending',
    index: true
  },
  gateway: {
    type: String,
    enum: ['mercadopago'],
    default: 'mercadopago'
  },
  externalId: {
    type: String,
    required: true,
    index: true
  },
  pix: {
    qrCode: String,
    qrCodeBase64: String,
    copyPasteCode: String,
    expirationDate: Date
  },
  paidAt: Date,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Índice composto para buscar pagamentos pendentes por usuário
paymentSchema.index({ userId: 1, status: 1, createdAt: -1 });

// Método para verificar se o pagamento ainda está válido
paymentSchema.methods.isValid = function() {
  if (this.status !== 'pending') return false;
  if (!this.pix?.expirationDate) return false;
  return new Date() < this.pix.expirationDate;
};

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
