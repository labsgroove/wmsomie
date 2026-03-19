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

const router = Router();

// Sync routes
router.use('/sync', syncRoutes);

// Endpoints existentes
router.post('/stock/inbound', stockController.inbound);
router.post('/stock/outbound', stockController.outbound);
router.post('/stock/transfer', stockController.transfer);
router.get('/picking/:orderId', pickingController.createPicking);

// Endpoints de localização
router.post('/locations', locationController.createLocationController);
router.post('/locations/sequence', locationController.createLocationSequenceController);
router.get('/locations', locationController.getLocations);
router.get('/locations/grouped', locationController.getLocationsGroupedByAisle);
router.get('/locations/by-aisle/:aisle', locationController.getLocations);
router.get('/locations/by-zone/:zone', locationController.getLocations);
router.get('/locations/code/:code', locationController.getLocationByCode);
router.get('/locations/next', locationController.getNextLocation);
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
        lastUpdated: new Date()
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

router.post('/stock/transfer', async (req, res) => {
  try {
    const { productId, fromLocation, toLocation, quantity } = req.body;
    
    // Importar o movementService
    const { transfer } = await import('../services/movementService.js');
    
    const result = await transfer(productId, fromLocation, toLocation, quantity);
    res.json(result);
  } catch (error) {
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