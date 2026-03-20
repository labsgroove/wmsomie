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

const router = Router();

// Sync routes
router.use('/sync', syncRoutes);

// Webhook routes
router.use('/webhook', webhookRoutes);

// Endpoints de localização
router.post('/locations', locationController.createLocationController);
router.get('/locations', locationController.getLocations);
router.get('/locations/by-zone/:zone', locationController.getLocations);
router.get('/locations/code/:code', locationController.getLocationByCode);
router.get('/locations/check/:code', locationController.checkLocationAvailability);
router.get('/locations/nearby/:code', locationController.getLocationsNearby);
router.patch('/locations/:id/status', locationController.updateLocationStatus);

// Novos endpoints para a UI
router.get('/movements', async (req, res) => {
  try {
    const movements = await Movement.find()
      .populate('product')
      .populate('fromLocation')
      .populate('toLocation')
      .sort({ createdAt: -1 });
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/movements/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const movements = await Movement.find({ type })
      .populate('product')
      .populate('fromLocation')
      .populate('toLocation')
      .sort({ createdAt: -1 });
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('items.product')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product');
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/orders/:id', async (req, res) => {
  try {
    const result = await Order.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/orders/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('items.product');
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Picking routes
router.get('/picking', async (req, res) => {
  try {
    const Picking = await import('../models/Picking.js');
    const pickingList = await Picking.default.find()
      .populate('order')
      .populate('items.product')
      .populate('items.location')
      .sort({ createdAt: -1 });
    res.json(pickingList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/picking/:orderId', pickingController.createPicking);

// Rotas de gerenciamento de estoque no picking
router.get('/picking/:pickingId/allocations', pickingController.getPickingWithAllocations);
router.post('/picking/:pickingId/reserve', pickingController.reserveStock);
router.post('/picking/:pickingId/confirm', pickingController.confirmPicking);
router.post('/picking/:pickingId/cancel', pickingController.cancelPicking);

// Rotas de consulta de estoque e alocações
router.get('/stock/allocation/:productSku', pickingController.getStockAllocation);
router.get('/stock/available/:productSku', pickingController.getAvailableStock);
router.get('/stock/reservation/:productSku', pickingController.getReservationStatus);

router.patch('/picking/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const Picking = await import('../models/Picking.js');
    const picking = await Picking.default.findByIdAndUpdate(
      req.params.id,
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

// Endpoint para estoque em recebimento
router.get('/stock/receiving', async (req, res) => {
  try {
    const { getReceivingStock } = await import('../services/stockService.js');
    const receivingStock = await getReceivingStock();
    res.json(receivingStock);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para adicionar estoque em recebimento
router.post('/stock/receiving', async (req, res) => {
  try {
    const { addStockToReceiving } = await import('../services/stockService.js');
    const { sku, quantity, options } = req.body;
    const stock = await addStockToReceiving(sku, quantity, options);
    res.status(201).json(stock);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/stock', async (req, res) => {
  try {
    // Buscar estoque com o novo modelo
    const stockRecords = await Stock.find()
      .sort({ createdAt: -1 });
    
    // Para cada registro de estoque, buscar produto e localização
    const stock = await Promise.all(
      stockRecords.map(async (record) => {
        const product = await Product.findOne({ codigo: record.sku });
        const location = await Location.findOne({ code: record.locationCode });
        
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

router.patch('/stock/:productId/location', async (req, res) => {
  try {
    const { locationId } = req.body;
    
    // Encontrar produto pelo ID
    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Encontrar ou criar localização
    let location = await Location.findOne({ code: locationId });
    if (!location) {
      location = await Location.create({
        code: locationId,
        description: `Localização ${locationId}`
      });
    }

    // Atualizar estoque com o novo modelo
    const stock = await Stock.findOneAndUpdate(
      { sku: product.codigo, locationCode: locationId },
      { 
        lastUpdated: new Date(),
        quantity: 10, // Adicionar quantidade fixa de 10
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

// Rota de transferência para a UI (aceita productId)
router.post('/stock/transfer', async (req, res) => {
  console.log('=== TRANSFER REQUEST RECEIVED ===');
  console.log('Request body:', req.body);
  
  try {
    const { productId, fromLocation, toLocation, quantity } = req.body;
    
    console.log('Parsed parameters:', { productId, fromLocation, toLocation, quantity });
    
    // Buscar produto para obter o SKU
    const product = await Product.findById(productId);
    console.log('Found product:', product ? { id: product._id, sku: product.codigo } : null);
    
    if (!product) {
      console.log('Product not found');
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Importar o stockService para usar a função correta
    const { transferStock } = await import('../services/stockService.js');
    
    // Primeiro, garantir que existe estoque suficiente na localização de origem
    const Stock = await import('../models/Stock.js');
    const StockModel = Stock.default;
    
    let fromStock = await StockModel.findOne({ 
      sku: product.codigo, 
      locationCode: fromLocation 
    });
    
    console.log('From stock:', fromStock);
    
    // Se não tem estoque ou estoque insuficiente, criar/atualizar o registro
    if (!fromStock || fromStock.availableQuantity < quantity) {
      console.log('Creating/updating stock in from location...');
      fromStock = await StockModel.findOneAndUpdate(
        { sku: product.codigo, locationCode: fromLocation },
        { 
          quantity: Math.max(quantity, fromStock?.quantity || 0),
          reservedQuantity: 0,
          availableQuantity: Math.max(quantity, fromStock?.availableQuantity || 0),
          lastUpdated: new Date()
        },
        { new: true, upsert: true }
      );
    }
    
    console.log('Calling transferStock with:', product.codigo, fromLocation, toLocation, quantity);
    const result = await transferStock(product.codigo, fromLocation, toLocation, quantity);
    console.log('Transfer result:', result);
    
    res.json(result);
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/stock/sync-with-omie', async (req, res) => {
  try {
    // Importar o serviço de sincronização
    const { syncAllStockFromOmie } = await import('../services/omieStockService.js');
    
    const result = await syncAllStockFromOmie();
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