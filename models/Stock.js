// src/models/Stock.js
import mongoose from 'mongoose';

const StockSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  // Referências por SKU em vez de ObjectId
  sku: { type: String, required: true, ref: 'Product' },
  locationCode: { type: String, required: true, ref: 'Location' },
  
  // Quantidades
  quantity: { type: Number, default: 0, min: 0 },
  reservedQuantity: { type: Number, default: 0, min: 0 },
  availableQuantity: { type: Number, default: 0, min: 0 },
  
  // Controle de lote (opcional)
  batchNumber: String,
  expiryDate: Date,
  
  // Controle de qualidade
  qualityStatus: { 
    type: String, 
    enum: ['GOOD', 'DAMAGED', 'QUARANTINE', 'EXPIRED'], 
    default: 'GOOD' 
  },
  
  // Metadados
  lastUpdated: { type: Date, default: Date.now },
  lastMovementDate: Date,
  omieSyncedAt: Date,
  
  // Origem do estoque
  source: {
    type: String,
    enum: ['PURCHASE', 'PRODUCTION', 'TRANSFER', 'ADJUSTMENT', 'RETURN'],
    default: 'PURCHASE'
  },
  sourceDocument: String, // ID do documento de origem
}, { timestamps: true });

// Índices compostos para permitir múltiplos registros
StockSchema.index({ tenantId: 1, sku: 1, locationCode: 1, batchNumber: 1 }, { unique: true });
StockSchema.index({ tenantId: 1, sku: 1 });
StockSchema.index({ tenantId: 1, locationCode: 1 });
StockSchema.index({ tenantId: 1, qualityStatus: 1 });
StockSchema.index({ expiryDate: 1 });
StockSchema.index({ lastUpdated: 1 });

// Middleware para calcular quantidade disponível
StockSchema.pre('save', function(next) {
  this.availableQuantity = Math.max(0, this.quantity - this.reservedQuantity);
  this.lastUpdated = new Date();
  
  if (this.reservedQuantity > this.quantity) {
    return next(new Error('Reserved quantity cannot exceed total quantity'));
  }
  
  next();
});

// Método estático para buscar todo estoque de um SKU
StockSchema.statics.findBySku = function(sku, tenantId) {
  const query = { sku: sku };
  if (tenantId) query.tenantId = tenantId;
  return this.find(query).sort({ lastUpdated: -1 });
};

// Método estático para buscar estoque disponível de um SKU
StockSchema.statics.findAvailableBySku = function(sku, tenantId) {
  const query = { 
    sku: sku, 
    availableQuantity: { $gt: 0 },
    qualityStatus: 'GOOD'
  };
  if (tenantId) query.tenantId = tenantId;
  return this.find(query).sort({ lastUpdated: -1 });
};

// Método estático para buscar estoque em uma localização
StockSchema.statics.findByLocation = function(locationCode, tenantId) {
  const query = { locationCode: locationCode };
  if (tenantId) query.tenantId = tenantId;
  return this.find(query).sort({ sku: 1 });
};

// Método estático para buscar produtos em recebimento (sem localização definida)
StockSchema.statics.getReceivingStock = async function(tenantId) {
  const matchStage = { locationCode: 'RECEBIMENTO', qualityStatus: 'GOOD' };
  if (tenantId) matchStage.tenantId = tenantId;
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$sku',
        totalQuantity: { $sum: '$quantity' },
        totalReserved: { $sum: '$reservedQuantity' },
        totalAvailable: { $sum: '$availableQuantity' },
        batches: { $addToSet: '$batchNumber' },
        lastUpdated: { $max: '$lastUpdated' }
      }
    },
    {
      $project: {
        _id: 0,
        sku: '$_id',
        totalQuantity: 1,
        totalReserved: 1,
        totalAvailable: 1,
        batchCount: { $size: '$batches' },
        lastUpdated: 1
      }
    },
    { $sort: { lastUpdated: -1 } }
  ]);
};

// Método estático para buscar total de estoque por SKU (incluindo recebimento)
StockSchema.statics.getTotalBySku = async function(sku, tenantId) {
  const matchStage = { sku: sku, qualityStatus: 'GOOD' };
  if (tenantId) matchStage.tenantId = tenantId;
  const result = await this.aggregate([
    { $match: matchStage },
    { 
      $group: {
        _id: '$sku',
        totalQuantity: { $sum: '$quantity' },
        totalReserved: { $sum: '$reservedQuantity' },
        totalAvailable: { $sum: '$availableQuantity' },
        locationCount: { $sum: 1 },
        inReceiving: {
          $sum: {
            $cond: [{ $eq: ['$locationCode', 'RECEBIMENTO'] }, '$quantity', 0]
          }
        }
      }
    }
  ]);
  
  return result[0] || {
    _id: sku,
    totalQuantity: 0,
    totalReserved: 0,
    totalAvailable: 0,
    locationCount: 0,
    inReceiving: 0
  };
};

// Método estático para buscar ocupação por localização
StockSchema.statics.getOccupancyByLocation = async function(locationCode, tenantId) {
  const matchStage = { locationCode: locationCode, qualityStatus: 'GOOD' };
  if (tenantId) matchStage.tenantId = tenantId;
  const result = await this.aggregate([
    { $match: matchStage },
    { 
      $group: {
        _id: '$locationCode',
        totalQuantity: { $sum: '$quantity' },
        skuCount: { $addToSet: '$sku' }
      }
    },
    { 
      $project: {
        _id: 1,
        totalQuantity: 1,
        skuCount: { $size: '$skuCount' }
      }
    }
  ]);
  
  return result[0] || {
    _id: locationCode,
    totalQuantity: 0,
    skuCount: 0
  };
};

// Método para mover estoque entre localizações
StockSchema.methods.moveToLocation = function(newLocationCode, quantity) {
  if (quantity > this.availableQuantity) {
    throw new Error('Insufficient available quantity for transfer');
  }
  
  return this.constructor.findOneAndUpdate(
    { 
      tenantId: this.tenantId,
      sku: this.sku, 
      locationCode: newLocationCode,
      batchNumber: this.batchNumber || null
    },
    { 
      tenantId: this.tenantId,
      sku: this.sku,
      locationCode: newLocationCode,
      $inc: { quantity: quantity },
      lastUpdated: new Date(),
      source: 'TRANSFER',
      sourceDocument: this._id.toString(),
      qualityStatus: this.qualityStatus
    },
    { upsert: true, new: true }
  ).then(async (newStock) => {
    // Reduzir quantidade original
    this.quantity -= quantity;
    await this.save();
    
    // Se a quantidade ficou 0, remover o registro
    if (this.quantity === 0) {
      await this.constructor.deleteOne({ _id: this._id });
    }
    
    return newStock;
  });
};

// Método para reservar estoque
StockSchema.methods.reserve = function(quantity) {
  if (quantity > this.availableQuantity) {
    throw new Error('Insufficient available quantity for reservation');
  }
  
  this.reservedQuantity += quantity;
  return this.save();
};

// Método para liberar reserva
StockSchema.methods.releaseReservation = function(quantity) {
  if (quantity > this.reservedQuantity) {
    throw new Error('Cannot release more than reserved quantity');
  }
  
  this.reservedQuantity -= quantity;
  return this.save();
};

// Método para consumir estoque
StockSchema.methods.consume = function(quantity) {
  if (quantity > this.availableQuantity) {
    throw new Error('Insufficient available quantity for consumption');
  }
  
  this.reservedQuantity -= quantity;
  this.quantity -= quantity;
  this.lastMovementDate = new Date();
  return this.save();
};

export default mongoose.model('Stock', StockSchema);