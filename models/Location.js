// src/models/Location.js
import mongoose from 'mongoose';

const LocationSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  code: { type: String, required: true }, // código flexível (ex: A1, PISO1-A, RACK-01-POS-A, etc.)
  description: String,
  omieId: String,
  zone: String, // zona do armazém (opcional)
  type: { type: String, enum: ['storage', 'picking', 'receiving', 'shipping', 'quarantine'], default: 'storage' }, // tipo de localização
  isActive: { type: Boolean, default: true },
  
  // Lista de SKUs armazenados nesta localização
  skus: [{
    codigo: { type: String, required: true }, // SKU do produto
    quantity: { type: Number, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    lastUpdated: { type: Date, default: Date.now }
  }],
  
  // Capacidade da localização (opcional)
  maxCapacity: Number,
  currentOccupancy: { type: Number, default: 0 },
  
  // Metadados
  lastStockUpdate: { type: Date, default: Date.now }
}, { timestamps: true });

// Índices compostos
LocationSchema.index({ tenantId: 1, code: 1 }, { unique: true });
LocationSchema.index({ tenantId: 1, omieId: 1 });
LocationSchema.index({ tenantId: 1, zone: 1 });
LocationSchema.index({ tenantId: 1, type: 1 });
LocationSchema.index({ 'skus.codigo': 1 });
LocationSchema.index({ isActive: 1 });

// Método para adicionar/atualizar SKU na localização
LocationSchema.methods.updateSku = function(codigo, quantity, reservedQuantity = 0) {
  const skuIndex = this.skus.findIndex(s => s.codigo === codigo);
  
  if (skuIndex >= 0) {
    this.skus[skuIndex].quantity = quantity;
    this.skus[skuIndex].reservedQuantity = reservedQuantity;
    this.skus[skuIndex].lastUpdated = new Date();
  } else {
    this.skus.push({
      codigo,
      quantity,
      reservedQuantity,
      lastUpdated: new Date()
    });
  }
  
  this.lastStockUpdate = new Date();
  this.updateOccupancy();
  return this.save();
};

// Método para remover SKU da localização
LocationSchema.methods.removeSku = function(codigo) {
  this.skus = this.skus.filter(s => s.codigo !== codigo);
  this.lastStockUpdate = new Date();
  this.updateOccupancy();
  return this.save();
};

// Método para atualizar ocupação total
LocationSchema.methods.updateOccupancy = function() {
  this.currentOccupancy = this.skus.reduce((total, sku) => total + sku.quantity, 0);
};

// Método para buscar SKU específico
LocationSchema.methods.getSku = function(codigo) {
  return this.skus.find(s => s.codigo === codigo);
};

// Método estático para buscar localizações por SKU
LocationSchema.statics.findBySku = function(codigo, tenantId) {
  const query = { 
    'skus.codigo': codigo, 
    isActive: true 
  };
  if (tenantId) query.tenantId = tenantId;
  return this.find(query);
};

// Método estático para buscar localização específica de um SKU
LocationSchema.statics.findSkuLocation = function(codigo, locationCode, tenantId) {
  const query = { 
    code: locationCode,
    'skus.codigo': codigo,
    isActive: true 
  };
  if (tenantId) query.tenantId = tenantId;
  return this.findOne(query);
};

export default mongoose.model('Location', LocationSchema);