// src/models/Order.js
import mongoose from 'mongoose';

const OrderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  quantity: Number,
});

const OrderSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  omieId: { type: String, required: true },
  status: {
    type: String,
    enum: ['PENDING', 'PICKING', 'DONE'],
    default: 'PENDING',
  },
  items: [OrderItemSchema],
}, { timestamps: true });

// Índices compostos
OrderSchema.index({ tenantId: 1, omieId: 1 }, { unique: true });
OrderSchema.index({ tenantId: 1, status: 1 });

export default mongoose.model('Order', OrderSchema);