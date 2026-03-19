// src/services/stockService.js
import Stock from '../models/Stock.js';
import Product from '../models/Product.js';
import Location from '../models/Location.js';
import logger from '../utils/syncLogger.js';
import mongoose from 'mongoose';

export async function addStockToLocation(sku, locationCode, quantity, options = {}) {
  logger.debug(`Adding stock: SKU ${sku}, Location ${locationCode}, Quantity ${quantity}`);
  
  try {
    // Validar produto
    const product = await Product.findBySku(sku);
    if (!product) {
      throw new Error(`Product with SKU ${sku} not found`);
    }
    
    // Validar localização
    const location = await Location.findOne({ code: locationCode, isActive: true });
    if (!location) {
      throw new Error(`Location ${locationCode} not found or inactive`);
    }
    
    // Criar ou atualizar registro de estoque
    const stock = await Stock.findOneAndUpdate(
      { 
        sku: sku, 
        locationCode: locationCode,
        batchNumber: options.batchNumber || null
      },
      { 
        $inc: { quantity: quantity },
        lastUpdated: new Date(),
        lastMovementDate: new Date(),
        source: options.source || 'ADJUSTMENT',
        qualityStatus: options.qualityStatus || 'GOOD'
      },
      { upsert: true, new: true }
    );
    
    // Atualizar localização
    await location.updateSku(sku, stock.quantity, stock.reservedQuantity);
    
    logger.info(`Stock added successfully`, { sku, locationCode, quantity, totalStock: stock.quantity });
    return stock;
    
  } catch (error) {
    logger.error(`Failed to add stock`, { sku, locationCode, quantity, error: error.message });
    throw error;
  }
}

export async function removeStockFromLocation(sku, locationCode, quantity, options = {}) {
  logger.debug(`Removing stock: SKU ${sku}, Location ${locationCode}, Quantity ${quantity}`);
  
  try {
    // Buscar estoque atual
    const stock = await Stock.findOne({ 
      sku: sku, 
      locationCode: locationCode,
      batchNumber: options.batchNumber || null
    });
    
    if (!stock) {
      throw new Error(`No stock found for SKU ${sku} at location ${locationCode}`);
    }
    
    if (stock.quantity < quantity) {
      throw new Error(`Insufficient stock. Available: ${stock.quantity}, Requested: ${quantity}`);
    }
    
    // Atualizar quantidade
    stock.quantity -= quantity;
    stock.lastUpdated = new Date();
    stock.lastMovementDate = new Date();
    await stock.save();
    
    // Atualizar localização
    const location = await Location.findOne({ code: locationCode });
    if (location) {
      if (stock.quantity === 0) {
        await location.removeSku(sku);
      } else {
        await location.updateSku(sku, stock.quantity, stock.reservedQuantity);
      }
    }
    
    logger.info(`Stock removed successfully`, { sku, locationCode, quantity, remainingStock: stock.quantity });
    return stock;
    
  } catch (error) {
    logger.error(`Failed to remove stock`, { sku, locationCode, quantity, error: error.message });
    throw error;
  }
}

export async function transferStock(sku, fromLocationCode, toLocationCode, quantity, options = {}) {
  logger.debug(`Transferring stock: SKU ${sku}, From ${fromLocationCode}, To ${toLocationCode}, Quantity ${quantity}`);
  
  try {
    // Validar localizações
    const [fromLocation, toLocation] = await Promise.all([
      Location.findOne({ code: fromLocationCode, isActive: true }),
      Location.findOne({ code: toLocationCode, isActive: true })
    ]);
    
    if (!fromLocation) throw new Error(`Source location ${fromLocationCode} not found`);
    if (!toLocation) throw new Error(`Target location ${toLocationCode} not found`);
    
    // Buscar estoque de origem
    const fromStock = await Stock.findOne({ 
      sku: sku, 
      locationCode: fromLocationCode,
      batchNumber: options.batchNumber || null
    });
    
    if (!fromStock || fromStock.availableQuantity < quantity) {
      throw new Error(`Insufficient available stock at ${fromLocationCode}. Available: ${fromStock?.availableQuantity || 0}, Requested: ${quantity}`);
    }
    
    // Mover estoque
    const toStock = await fromStock.moveToLocation(toLocationCode, quantity);
    
    // Atualizar localizações
    await Promise.all([
      fromLocation.updateSku(sku, fromStock.quantity, fromStock.reservedQuantity),
      toLocation.updateSku(sku, toStock.quantity, toStock.reservedQuantity)
    ]);
    
    logger.info(`Stock transferred successfully`, { 
      sku, 
      fromLocationCode, 
      toLocationCode, 
      quantity,
      remainingFromStock: fromStock.quantity,
      newToStock: toStock.quantity
    });
    
    return { fromStock, toStock };
    
  } catch (error) {
    logger.error(`Failed to transfer stock`, { sku, fromLocationCode, toLocationCode, quantity, error: error.message });
    throw error;
  }
}

export async function reserveStock(sku, locationCode, quantity, options = {}) {
  logger.debug(`Reserving stock: SKU ${sku}, Location ${locationCode}, Quantity ${quantity}`);
  
  try {
    const stock = await Stock.findOne({ 
      sku: sku, 
      locationCode: locationCode,
      qualityStatus: 'GOOD'
    });
    
    if (!stock) {
      throw new Error(`No stock found for SKU ${sku} at location ${locationCode}`);
    }
    
    await stock.reserve(quantity);
    
    // Atualizar localização
    const location = await Location.findOne({ code: locationCode });
    if (location) {
      await location.updateSku(sku, stock.quantity, stock.reservedQuantity);
    }
    
    logger.info(`Stock reserved successfully`, { sku, locationCode, quantity, availableStock: stock.availableQuantity });
    return stock;
    
  } catch (error) {
    logger.error(`Failed to reserve stock`, { sku, locationCode, quantity, error: error.message });
    throw error;
  }
}

export async function consumeStock(sku, locationCode, quantity, options = {}) {
  logger.debug(`Consuming stock: SKU ${sku}, Location ${locationCode}, Quantity ${quantity}`);
  
  try {
    const stock = await Stock.findOne({ 
      sku: sku, 
      locationCode: locationCode,
      qualityStatus: 'GOOD'
    });
    
    if (!stock) {
      throw new Error(`No stock found for SKU ${sku} at location ${locationCode}`);
    }
    
    await stock.consume(quantity);
    
    // Atualizar localização
    const location = await Location.findOne({ code: locationCode });
    if (location) {
      if (stock.quantity === 0) {
        await location.removeSku(sku);
      } else {
        await location.updateSku(sku, stock.quantity, stock.reservedQuantity);
      }
    }
    
    logger.info(`Stock consumed successfully`, { sku, locationCode, quantity, remainingStock: stock.quantity });
    return stock;
    
  } catch (error) {
    logger.error(`Failed to consume stock`, { sku, locationCode, quantity, error: error.message });
    throw error;
  }
}

export async function getStockBySku(sku) {
  logger.debug(`Getting stock for SKU ${sku}`);
  
  try {
    const stocks = await Stock.findBySku(sku);
    const total = await Stock.getTotalBySku(sku);
    
    return {
      stocks,
      summary: total
    };
    
  } catch (error) {
    logger.error(`Failed to get stock for SKU ${sku}`, { error: error.message });
    throw error;
  }
}

export async function getStockByLocation(locationCode) {
  logger.debug(`Getting stock for location ${locationCode}`);
  
  try {
    const stocks = await Stock.findByLocation(locationCode);
    const occupancy = await Stock.getOccupancyByLocation(locationCode);
    
    return {
      stocks,
      summary: occupancy
    };
    
  } catch (error) {
    logger.error(`Failed to get stock for location ${locationCode}`, { error: error.message });
    throw error;
  }
}

export async function findAvailableStock(sku, quantity, options = {}) {
  logger.debug(`Finding available stock: SKU ${sku}, Quantity ${quantity}`);
  
  try {
    const availableStocks = await Stock.findAvailableBySku(sku);
    
    // Filtrar por localizações específicas se solicitado
    if (options.locationCodes && options.locationCodes.length > 0) {
      return availableStocks.filter(stock => 
        options.locationCodes.includes(stock.locationCode)
      );
    }
    
    // Filtrar por quantidade mínima se solicitado
    if (options.minQuantity) {
      return availableStocks.filter(stock => 
        stock.availableQuantity >= options.minQuantity
      );
    }
    
    return availableStocks;
    
  } catch (error) {
    logger.error(`Failed to find available stock`, { sku, quantity, error: error.message });
    throw error;
  }
}

export async function getStockSummary(filters = {}) {
  logger.debug(`Getting stock summary`, filters);
  
  try {
    let matchStage = { qualityStatus: 'GOOD' };
    
    if (filters.sku) {
      matchStage.sku = filters.sku;
    }
    
    if (filters.locationCode) {
      matchStage.locationCode = filters.locationCode;
    }
    
    const summary = await Stock.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalProducts: { $addToSet: '$sku' },
          totalLocations: { $addToSet: '$locationCode' },
          totalQuantity: { $sum: '$quantity' },
          totalReserved: { $sum: '$reservedQuantity' },
          totalAvailable: { $sum: '$availableQuantity' },
          stockRecords: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          totalProducts: { $size: '$totalProducts' },
          totalLocations: { $size: '$totalLocations' },
          totalQuantity: 1,
          totalReserved: 1,
          totalAvailable: 1,
          stockRecords: 1
        }
      }
    ]);
    
    return summary[0] || {
      totalProducts: 0,
      totalLocations: 0,
      totalQuantity: 0,
      totalReserved: 0,
      totalAvailable: 0,
      stockRecords: 0
    };
    
  } catch (error) {
    logger.error(`Failed to get stock summary`, { filters, error: error.message });
    throw error;
  }
}

export async function adjustStock(productId, locationId, qtyChange, options = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Buscar produto e localização para obter SKU e código
    const product = await Product.findById(productId);
    const location = await Location.findById(locationId);
    
    if (!product || !location) {
      throw new Error('Product or Location not found');
    }
    
    if (qtyChange > 0) {
      return await addStockToLocation(product.codigo, location.code, qtyChange, options);
    } else {
      return await removeStockFromLocation(product.codigo, location.code, Math.abs(qtyChange), options);
    }
    
    await session.commitTransaction();
    
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}