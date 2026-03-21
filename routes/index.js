// src/routes/index.js
import { Router } from 'express';
import * as stockController from '../controllers/stockController.js';
import * as pickingController from '../controllers/pickingController.js';
import * as locationController from '../controllers/locationController.js';
import Movement from '../models/Movement.js';
import Order from '../models/Order.js';
import Stock from '../models/Stock.js';
import Product from '../models/Product.js';
import Location from '../models/Location.js';
import syncRoutes from './sync.js';
import webhookRoutes from './webhook.js';
import authRoutes from './auth.js';
import teamRoutes from './team.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Auth routes (públicas)
router.use('/auth', authRoutes);

// Sync routes (protegidas)
router.use('/sync', protect, syncRoutes);

// Webhook routes (públicas - webhooks externas precisam acessar)
router.use('/webhook', webhookRoutes);

// Team routes (protegidas - middleware de admin está dentro das rotas)
router.use('/team', teamRoutes);

// Endpoints de localização (protegidos)
router.post('/locations', protect, locationController.createLocationController);
router.get('/locations', protect, locationController.getLocations);
router.get('/locations/by-zone/:zone', protect, locationController.getLocations);
router.get('/locations/code/:code', protect, locationController.getLocationByCode);
router.get('/locations/check/:code', protect, locationController.checkLocationAvailability);
router.get('/locations/nearby/:code', protect, locationController.getLocationsNearby);
router.patch('/locations/:id/status', protect, locationController.updateLocationStatus);

// Movimentos (protegidos) - filtrados por tenant
router.get('/movements', protect, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const movements = await Movement.find({ tenantId })
      .populate('product')
      .populate('fromLocation')
      .populate('toLocation')
      .sort({ createdAt: -1 });
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/movements/:type', protect, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const { type } = req.params;
    const movements = await Movement.find({ tenantId, type })
      .populate('product')
      .populate('fromLocation')
      .populate('toLocation')
      .sort({ createdAt: -1 });
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Orders (protegidos) - filtrados por tenant
router.get('/orders', protect, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const orders = await Order.find({ tenantId })
      .populate('items.product')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/orders/:id', protect, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const order = await Order.findOne({ _id: req.params.id, tenantId })
      .populate('items.product');
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/orders/:id', protect, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const result = await Order.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!result) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/orders/:id', protect, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const { status } = req.body;
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { status },
      { new: true }
    ).populate('items.product');
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Picking routes (protegidos) - filtrados por tenant
router.get('/picking', protect, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const Picking = await import('../models/Picking.js');
    const pickingList = await Picking.default.find({ tenantId })
      .populate('order')
      .populate('items.product')
      .populate('items.location')
      .sort({ createdAt: -1 });
    res.json(pickingList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/picking/:orderId', protect, pickingController.createPicking);

// Rotas de gerenciamento de estoque no picking (protegidas)
router.get('/picking/:pickingId/allocations', protect, pickingController.getPickingWithAllocations);
router.post('/picking/:pickingId/reserve', protect, pickingController.reserveStock);
router.post('/picking/:pickingId/confirm', protect, pickingController.confirmPicking);
router.post('/picking/:pickingId/cancel', protect, pickingController.cancelPicking);

// Rotas de consulta de estoque e alocações (protegidas)
router.get('/stock/allocation/:productSku', protect, pickingController.getStockAllocation);
router.get('/stock/available/:productSku', protect, pickingController.getAvailableStock);
router.get('/stock/reservation/:productSku', protect, pickingController.getReservationStatus);

router.patch('/picking/:id/status', protect, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const { status } = req.body;
    const Picking = await import('../models/Picking.js');
    const picking = await Picking.default.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { status },
      { new: true }
    ).populate('order').populate('items.product').populate('items.location');
    
    if (!picking) {
      return res.status(404).json({ error: 'Picking not found' });
    }
    
    res.json(picking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para estoque em recebimento (protegido) - com tenant
router.get('/stock/receiving', protect, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const receivingStock = await Stock.getReceivingStock(tenantId);
    res.json(receivingStock);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para adicionar estoque em recebimento (protegido) - com tenant
router.post('/stock/receiving', protect, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const { addStockToReceiving } = await import('../services/stockService.js');
    const { sku, quantity, options } = req.body;
    const stock = await addStockToReceiving(sku, quantity, options, tenantId);
    res.status(201).json(stock);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Stock (protegido) - filtrado por tenant
router.get('/stock', protect, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    // Buscar estoque apenas do tenant
    const stockRecords = await Stock.find({ tenantId })
      .sort({ createdAt: -1 });
    
    // Para cada registro de estoque, buscar produto e localização do tenant
    const stock = await Promise.all(
      stockRecords.map(async (record) => {
        const product = await Product.findOne({ tenantId, codigo: record.sku });
        const location = await Location.findOne({ tenantId, code: record.locationCode });
        
        return {
          _id: record._id,
          quantity: record.quantity,
          reservedQuantity: record.reservedQuantity,
          availableQuantity: record.availableQuantity,
          product: product ? {
            _id: product._id,
            name: product.descricao,
            sku: product.codigo,
            omieId: product.omieId
          } : null,
          location: location ? {
            _id: location._id,
            code: location.code,
            description: location.description
          } : null,
          lastUpdated: record.lastUpdated,
          qualityStatus: record.qualityStatus
        };
      })
    );
    
    // Filtrar apenas registros com produto válido
    const validStock = stock.filter(item => item.product !== null);
    
    res.json(validStock);
  } catch (error) {
    console.error('Error loading stock:', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/stock/:productId/location', protect, async (req, res) => {
  try {
    const { locationId } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    // Encontrar produto pelo ID e tenant
    const product = await Product.findOne({ _id: req.params.productId, tenantId });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Encontrar ou criar localização com tenant
    let location = await Location.findOne({ tenantId, code: locationId });
    if (!location) {
      location = await Location.create({
        tenantId,
        code: locationId,
        description: `${locationId}`
      });
    }

    // Atualizar estoque com tenantId
    const stock = await Stock.findOneAndUpdate(
      { tenantId, sku: product.codigo, locationCode: locationId },
      { 
        tenantId,
        sku: product.codigo,
        locationCode: locationId,
        lastUpdated: new Date(),
        quantity: 10,
        reservedQuantity: 0,
        availableQuantity: 10
      },
      { new: true, upsert: true }
    );
    
    // Atualizar localização para incluir o SKU
    await location.updateSku(product.codigo, stock.quantity, stock.reservedQuantity);
    
    // Retornar formato compatível com a UI
    const response = {
      _id: stock._id,
      quantity: stock.quantity,
      reservedQuantity: stock.reservedQuantity,
      availableQuantity: stock.availableQuantity,
      product: {
        _id: product._id,
        name: product.descricao,
        sku: product.codigo,
        omieId: product.omieId
      },
      location: {
        _id: location._id,
        code: location.code,
        description: location.description
      },
      lastUpdated: stock.lastUpdated,
      qualityStatus: stock.qualityStatus
    };

    res.json(response);
  } catch (error) {
    console.error('Error updating stock location:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota de transferência para a UI (aceita productId) - com tenant
router.post('/stock/transfer', protect, async (req, res) => {
  console.log('=== TRANSFER REQUEST RECEIVED ===');
  console.log('Request body:', req.body);
  
  try {
    const { productId, fromLocation, toLocation, quantity } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    console.log('Parsed parameters:', { productId, fromLocation, toLocation, quantity, tenantId });
    
    // Buscar produto para obter o SKU (filtrado por tenant)
    const product = await Product.findOne({ _id: productId, tenantId });
    console.log('Found product:', product ? { id: product._id, sku: product.codigo } : null);
    
    if (!product) {
      console.log('Product not found for tenant:', tenantId);
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Importar o stockService para usar a função correta
    const { transferStock } = await import('../services/stockService.js');
    
    // Primeiro, garantir que existe estoque suficiente na localização de origem
    const Stock = await import('../models/Stock.js');
    const StockModel = Stock.default;
    
    let fromStock = await StockModel.findOne({ 
      tenantId,
      sku: product.codigo, 
      locationCode: fromLocation 
    });
    
    console.log('From stock:', fromStock);
    
    // Se não tem estoque ou estoque insuficiente, criar/atualizar o registro
    if (!fromStock || fromStock.availableQuantity < quantity) {
      console.log('Creating/updating stock in from location...');
      fromStock = await StockModel.findOneAndUpdate(
        { tenantId, sku: product.codigo, locationCode: fromLocation },
        { 
          tenantId,
          sku: product.codigo,
          locationCode: fromLocation,
          quantity: Math.max(quantity, fromStock?.quantity || 0),
          reservedQuantity: 0,
          availableQuantity: Math.max(quantity, fromStock?.availableQuantity || 0),
          lastUpdated: new Date()
        },
        { new: true, upsert: true }
      );
    }
    
    console.log('Calling transferStock with:', product.codigo, fromLocation, toLocation, quantity, tenantId);
    const result = await transferStock(product.codigo, fromLocation, toLocation, quantity, {}, tenantId);
    console.log('Transfer result:', result);
    
    res.json(result);
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/stock/sync-with-omie', protect, async (req, res) => {
  try {
    // Importar o serviço de sincronização
    const { syncAllStockFromOmie } = await import('../services/omieStockService.js');
    
    const result = await syncAllStockFromOmie(req.user._id);
    res.json({
      success: true,
      syncedCount: result.syncedCount,
      errors: result.errors,
      message: `Sincronizados ${result.syncedCount} produtos do Omie`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;