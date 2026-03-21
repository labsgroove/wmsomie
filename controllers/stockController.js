// src/controllers/stockController.js
import * as stockService from '../services/stockService.js';
import * as movementService from '../services/movementService.js';
import Product from '../models/Product.js';
import Location from '../models/Location.js';

export async function inbound(req, res) {
  try {
    const { sku, locationCode, quantity, options = {} } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    // Validar parâmetros
    if (!sku || !locationCode || !quantity) {
      return res.status(400).json({ 
        error: 'Missing required parameters: sku, locationCode, quantity' 
      });
    }
    
    if (quantity <= 0) {
      return res.status(400).json({ 
        error: 'Quantity must be greater than 0' 
      });
    }
    
    const result = await stockService.addStockToLocation(sku, locationCode, quantity, options, tenantId);
    
    // Registrar movimento se solicitado
    if (options.registerMovement !== false) {
      await movementService.inboundBySku(sku, locationCode, quantity, options, req.user._id);
    }
    
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function outbound(req, res) {
  try {
    const { sku, locationCode, quantity, options = {} } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    // Validar parâmetros
    if (!sku || !locationCode || !quantity) {
      return res.status(400).json({ 
        error: 'Missing required parameters: sku, locationCode, quantity' 
      });
    }
    
    if (quantity <= 0) {
      return res.status(400).json({ 
        error: 'Quantity must be greater than 0' 
      });
    }
    
    const result = await stockService.removeStockFromLocation(sku, locationCode, quantity, options, tenantId);
    
    // Registrar movimento se solicitado
    if (options.registerMovement !== false) {
      await movementService.outboundBySku(sku, locationCode, quantity, options, req.user._id);
    }
    
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function transfer(req, res) {
  try {
    const { sku, fromLocationCode, toLocationCode, quantity, options = {} } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    // Validar parâmetros
    if (!sku || !fromLocationCode || !toLocationCode || !quantity) {
      return res.status(400).json({ 
        error: 'Missing required parameters: sku, fromLocationCode, toLocationCode, quantity' 
      });
    }
    
    if (quantity <= 0) {
      return res.status(400).json({ 
        error: 'Quantity must be greater than 0' 
      });
    }
    
    if (fromLocationCode === toLocationCode) {
      return res.status(400).json({ 
        error: 'Source and target locations must be different' 
      });
    }
    
    const result = await stockService.transferStock(sku, fromLocationCode, toLocationCode, quantity, options, tenantId);
    
    // Registrar movimento se solicitado
    if (options.registerMovement !== false) {
      await movementService.transferBySku(sku, fromLocationCode, toLocationCode, quantity, options, req.user._id);
    }
    
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function reserve(req, res) {
  try {
    const { sku, locationCode, quantity, options = {} } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    if (!sku || !locationCode || !quantity) {
      return res.status(400).json({ 
        error: 'Missing required parameters: sku, locationCode, quantity' 
      });
    }
    
    const result = await stockService.reserveStock(sku, locationCode, quantity, options, tenantId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function consume(req, res) {
  try {
    const { sku, locationCode, quantity, options = {} } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    if (!sku || !locationCode || !quantity) {
      return res.status(400).json({ 
        error: 'Missing required parameters: sku, locationCode, quantity' 
      });
    }
    
    const result = await stockService.consumeStock(sku, locationCode, quantity, options, tenantId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function getStockBySku(req, res) {
  try {
    const { sku } = req.params;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const result = await stockService.getStockBySku(sku, tenantId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function getStockByLocation(req, res) {
  try {
    const { locationCode } = req.params;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const result = await stockService.getStockByLocation(locationCode, tenantId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function findAvailableStock(req, res) {
  try {
    const { sku } = req.params;
    const { quantity, locationCodes, minQuantity } = req.query;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const options = {
      quantity: quantity ? parseInt(quantity) : undefined,
      locationCodes: locationCodes ? (Array.isArray(locationCodes) ? locationCodes : [locationCodes]) : undefined,
      minQuantity: minQuantity ? parseInt(minQuantity) : undefined
    };
    
    const result = await stockService.findAvailableStock(sku, options, tenantId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function getStockSummary(req, res) {
  try {
    const { sku, locationCode } = req.query;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const filters = {};
    if (sku) filters.sku = sku;
    if (locationCode) filters.locationCode = locationCode;
    
    const result = await stockService.getStockSummary(filters, tenantId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// Funções legadas para compatibilidade (usam productId em vez de sku) - com tenant
export async function inboundLegacy(req, res) {
  try {
    const { productId, locationId, quantity, options = {} } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    // Buscar produto e localização para converter para SKU e código
    const product = await Product.findOne({ _id: productId, tenantId });
    const location = await Location.findOne({ _id: locationId, tenantId });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    const result = await stockService.addStockToLocation(
      product.codigo, 
      location.code, 
      quantity, 
      options,
      tenantId
    );
    
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function outboundLegacy(req, res) {
  try {
    const { productId, locationId, quantity, options = {} } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    // Buscar produto e localização para converter para SKU e código
    const product = await Product.findOne({ _id: productId, tenantId });
    const location = await Location.findOne({ _id: locationId, tenantId });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    const result = await stockService.removeStockFromLocation(
      product.codigo, 
      location.code, 
      quantity, 
      options,
      tenantId
    );
    
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function transferLegacy(req, res) {
  try {
    const { productId, fromLocation, toLocation, quantity, options = {} } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    // Buscar produto e localizações para converter para SKU e código
    const product = await Product.findOne({ _id: productId, tenantId });
    const fromLoc = await Location.findOne({ _id: fromLocation, tenantId });
    const toLoc = await Location.findOne({ _id: toLocation, tenantId });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    if (!fromLoc || !toLoc) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    const result = await stockService.transferStock(
      product.codigo, 
      fromLoc.code, 
      toLoc.code, 
      quantity, 
      options,
      tenantId
    );
    
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}