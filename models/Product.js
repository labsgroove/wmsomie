// src/models/Product.js
import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  // Dados básicos do Omie
  omieId: { type: String, required: true, unique: true, trim: true },
  codigo: { type: String, required: true, unique: true, trim: true }, // SKU do Omie
  descricao: { type: String, required: true, trim: true }, // Nome do produto
  
  // Dados de estoque do Omie
  quantidade_estoque: { type: Number, default: 0 },
  preco_unitario: { type: Number },
  unidade: { type: String, default: 'UN' },
  
  // Metadados de sincronização
  lastSyncAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  
  // Campos adicionais do Omie (opcionais)
  ncm: String,
  cest: String,
  peso: Number,
  altura: Number,
  largura: Number,
  profundidade: Number,
}, { timestamps: true });

// Índices adicionais (unique já definido no schema)
ProductSchema.index({ isActive: 1 });

// Middleware para validar e limpar dados antes de salvar
ProductSchema.pre('save', function(next) {
  // Garantir que codigo não seja nulo ou vazio
  if (!this.codigo || this.codigo.trim() === '') {
    this.codigo = this.omieId; // Fallback para omieId
  }
  
  // Garantir que descricao não seja nula
  if (!this.descricao || this.descricao.trim() === '') {
    this.descricao = `Produto ${this.codigo}`;
  }
  
  // Trim em campos string
  if (this.codigo) this.codigo = this.codigo.trim();
  if (this.descricao) this.descricao = this.descricao.trim();
  
  // Atualizar data de sincronização
  if (this.isModified('omieId') || this.isModified('descricao') || this.isModified('quantidade_estoque')) {
    this.lastSyncAt = new Date();
  }
  
  next();
});

// Middleware para findOneAndUpdate também validar
ProductSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  // Garantir que codigo não seja nulo
  if (update.$set && (!update.$set.codigo || update.$set.codigo.trim() === '')) {
    if (update.$set.omieId) {
      update.$set.codigo = update.$set.omieId;
    }
  }
  
  // Trim em campos string
  if (update.$set) {
    if (update.$set.codigo) update.$set.codigo = update.$set.codigo.trim();
    if (update.$set.descricao) update.$set.descricao = update.$set.descricao.trim();
  }
  
  next();
});

// Método estático para buscar por SKU
ProductSchema.statics.findBySku = function(sku) {
  if (!sku || sku.trim() === '') {
    return null;
  }
  return this.findOne({ codigo: sku.trim(), isActive: true });
};

// Método estático para buscar por Omie ID
ProductSchema.statics.findByOmieId = function(omieId) {
  if (!omieId || omieId.trim() === '') {
    return null;
  }
  return this.findOne({ omieId: omieId.trim(), isActive: true });
};

// Método estático para criar ou atualizar produto com validação
ProductSchema.statics.createFromOmie = function(omieData) {
  if (!omieData || !omieData.codigo_produto) {
    throw new Error('Dados do Omie inválidos: codigo_produto é obrigatório');
  }
  
  const codigo = omieData.codigo || omieData.codigo_produto;
  const descricao = omieData.descricao || `Produto ${codigo}`;
  
  return this.findOneAndUpdate(
    { omieId: omieData.codigo_produto },
    {
      // Dados básicos do Omie
      omieId: omieData.codigo_produto,
      codigo: codigo.trim(),
      descricao: descricao.trim(),
      
      // Dados de estoque do Omie
      quantidade_estoque: omieData.quantidade_estoque || 0,
      preco_unitario: omieData.preco_unitario,
      unidade: omieData.unidade || 'UN',
      
      // Campos adicionais
      ncm: omieData.ncm,
      cest: omieData.cest,
      peso: omieData.peso,
      altura: omieData.altura,
      largura: omieData.largura,
      profundidade: omieData.profundidade,
      
      // Metadados
      lastSyncAt: new Date(),
      isActive: omieData.inativo === "N"
    },
    { upsert: true, new: true }
  );
};

export default mongoose.model('Product', ProductSchema);