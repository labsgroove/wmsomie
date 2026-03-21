// src/models/Movement.js
import mongoose from 'mongoose';

const MovementSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  type: { type: String, enum: ['IN', 'OUT', 'TRANSFER'], required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  fromLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  toLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  quantity: { type: Number, required: true, min: 0 },
  omieId: String,
  date: { type: Date, default: Date.now },
  description: { type: String, maxlength: 500 },
  syncedAt: Date,
}, { timestamps: true });

MovementSchema.index({ tenantId: 1, omieId: 1 });
MovementSchema.index({ tenantId: 1, product: 1, date: -1 });

MovementSchema.pre('save', function(next) {
  if (this.type === 'TRANSFER' && (!this.fromLocation || !this.toLocation)) {
    return next(new Error('Transfer movements require both fromLocation and toLocation'));
  }
  if ((this.type === 'IN' || this.type === 'OUT') && !this.toLocation && !this.fromLocation) {
    return next(new Error('IN/OUT movements require at least one location'));
  }
  next();
});

export default mongoose.model('Movement', MovementSchema);