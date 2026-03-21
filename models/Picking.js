// src/models/Picking.js
import mongoose from 'mongoose';

const PickingItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  quantity: Number,
});

const PickingSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  status: {
    type: String,
    enum: ['CREATED', 'IN_PROGRESS', 'DONE'],
    default: 'CREATED',
  },
  items: [PickingItemSchema],
}, { timestamps: true });

// Índices compostos
PickingSchema.index({ tenantId: 1, order: 1 });
PickingSchema.index({ tenantId: 1, status: 1 });

export default mongoose.model('Picking', PickingSchema);