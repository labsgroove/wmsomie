// src/models/Location.js
import mongoose from 'mongoose';

const LocationSchema = new mongoose.Schema({
  code: { type: String, unique: true, required: true }, // ex: AA1, AA2, AB1...
  description: String,
  omieId: String,
  aisle: { type: String, required: true }, // ex: AA, AB, AC
  position: { type: Number, required: true }, // ex: 1, 2, 3
  level: { type: Number, default: 1 }, // nível vertical (opcional)
  zone: String, // zona do armazém (opcional)
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

// Índices
LocationSchema.index({ omieId: 1 });
LocationSchema.index({ aisle: 1, position: 1 });
LocationSchema.index({ code: 1 });
LocationSchema.index({ 'skus.codigo': 1 });
LocationSchema.index({ isActive: 1 });

// Middleware para gerar código automaticamente
LocationSchema.pre('save', function(next) {
  if (!this.code && this.aisle && this.position) {
    this.code = this.level > 1 ? `${this.aisle}${this.position}-${this.level}` : `${this.aisle}${this.position}`;
  }
  next();
});

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
LocationSchema.statics.findBySku = function(codigo) {
  return this.find({ 
    'skus.codigo': codigo, 
    isActive: true 
  });
};

// Método estático para buscar localização específica de um SKU
LocationSchema.statics.findSkuLocation = function(codigo, locationCode) {
  return this.findOne({ 
    code: locationCode,
    'skus.codigo': codigo,
    isActive: true 
  });
};

export default mongoose.model('Location', LocationSchema);