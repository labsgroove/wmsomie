// src/models/WebhookEvent.js
import mongoose from 'mongoose';

const WebhookEventSchema = new mongoose.Schema({
  // Dados do evento recebido
  eventType: { type: String, required: true, trim: true }, // ex: produto.alterado, pedido.incluido
  eventId: { type: String, required: true, trim: true }, // ID único do evento na Omie
  
  // Dados completos do payload recebido
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  
  // Metadados do webhook
  appId: { type: String, required: true, trim: true }, // ID do aplicativo Omie
  timestamp: { type: Date, required: true }, // Timestamp do evento
  
  // Status de processamento
  status: { 
    type: String, 
    enum: ['received', 'processing', 'processed', 'failed'], 
    default: 'received' 
  },
  
  // Resultado do processamento
  processedAt: { type: Date },
  error: { type: String },
  retryCount: { type: Number, default: 0 },
  
  // Dados extraídos do payload (para consultas rápidas)
  entityType: { type: String, trim: true }, // ex: product, order, invoice
  entityId: { type: String, trim: true }, // ID da entidade afetada
  entityData: { type: mongoose.Schema.Types.Mixed }, // Dados relevantes da entidade
}, { 
  timestamps: true,
  // Adiciona índices para performance
  index: { 
    eventType: 1, 
    status: 1, 
    createdAt: -1 
  }
});

// Índices adicionais para performance
WebhookEventSchema.index({ eventId: 1 }, { unique: true });
WebhookEventSchema.index({ entityType: 1, entityId: 1 });
WebhookEventSchema.index({ status: 1, createdAt: -1 });
WebhookEventSchema.index({ appId: 1 });

// Middleware para extrair dados relevantes antes de salvar
WebhookEventSchema.pre('save', function(next) {
  if (this.isNew && this.payload) {
    // Extrair tipo de entidade e ID baseado no tipo de evento
    this.extractEntityInfo();
  }
  next();
});

// Método para extrair informações da entidade do payload
WebhookEventSchema.methods.extractEntityInfo = function() {
  const event = this.eventType;
  const payload = this.payload;
  
  // Mapeamento de eventos para tipos de entidade
  const eventMappings = {
    'produto': { type: 'product', idField: 'codigo_produto' },
    'pedido': { type: 'order', idField: 'codigo_pedido' },
    'conta_pagar': { type: 'payable', idField: 'codigo_conta_pagar' },
    'conta_receber': { type: 'receivable', idField: 'codigo_conta_receber' },
    'cliente': { type: 'customer', idField: 'codigo_cliente' },
    'fornecedor': { type: 'supplier', idField: 'codigo_fornecedor' },
    'os': { type: 'service_order', idField: 'codigo_os' }
  };
  
  // Identificar o tipo de evento baseado no prefixo
  for (const [key, mapping] of Object.entries(eventMappings)) {
    if (event.startsWith(key)) {
      this.entityType = mapping.type;
      
      // Extrair ID do payload
      if (payload && payload[mapping.idField]) {
        this.entityId = payload[mapping.idField];
      }
      
      // Armazenar dados relevantes da entidade
      this.entityData = {
        id: this.entityId,
        type: this.entityType,
        event: event,
        payload: payload
      };
      
      break;
    }
  }
};

// Método para marcar como processado
WebhookEventSchema.methods.markAsProcessed = function(error = null) {
  this.status = error ? 'failed' : 'processed';
  this.processedAt = new Date();
  if (error) {
    this.error = error;
  }
  return this.save();
};

// Método estático para buscar eventos não processados
WebhookEventSchema.statics.findUnprocessed = function(limit = 50) {
  return this.find({ status: 'received' })
    .sort({ createdAt: 1 })
    .limit(limit);
};

// Método estático para buscar eventos por tipo de entidade
WebhookEventSchema.statics.findByEntity = function(entityType, entityId) {
  return this.find({ entityType, entityId })
    .sort({ createdAt: -1 });
};

const WebhookEvent = mongoose.model('WebhookEvent', WebhookEventSchema);

export default WebhookEvent;
