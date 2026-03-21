// src/services/omieMovementService.js
import Movement from '../models/Movement.js';
import Product from '../models/Product.js';
import Location from '../models/Location.js';
import Stock from '../models/Stock.js';
import User from '../models/User.js';
import { callOmie } from './omieClient.js';
import { adjustStock } from './stockService.js';
import logger from '../utils/syncLogger.js';
import mongoose from 'mongoose';

export async function getMovementsFromOmie(startDate, endDate, productOmieId, userId) {
  if (!userId) {
    throw new Error('User ID is required to fetch movements from Omie');
  }
  
  logger.debug('Fetching movements from Omie', { startDate, endDate, productOmieId, userId });
  
  try {
    const params = {
      data_inicial: startDate,
      data_final: endDate,
    };

    if (productOmieId) {
      params.codigo_produto = productOmieId;
    }

    const result = await callOmie(
      'estoque/movestoque/',
      'ConsultarMovimentoEstoque',
      params,
      userId
    );

    logger.logApiCall('ConsultarMovimentoEstoque', 'estoque/movestoque/', params, result);
    return result;
  } catch (error) {
    logger.logApiCall('ConsultarMovimentoEstoque', 'estoque/movestoque/', { startDate, endDate, productOmieId }, null, error);
    throw error;
  }
}

export async function syncMovementsFromOmie(startDate, endDate, userId) {
  if (!userId) {
    throw new Error('User ID is required to sync movements from Omie');
  }
  
  // Buscar tenantId do usuário
  const user = await User.findById(userId).select('tenantId');
  if (!user || !user.tenantId) {
    throw new Error('User not found or tenantId not configured');
  }
  const tenantId = user.tenantId;
  
  logger.info('Starting movement sync from Omie', { startDate, endDate, userId, tenantId });
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Buscar produtos apenas do tenant atual
    const products = await Product.find({ 
      tenantId,
      omieId: { $exists: true, $ne: null } 
    }).session(session);
    
    // Buscar localização padrão do tenant
    const locations = await Location.find({ tenantId }).session(session);
    const defaultLocation = locations[0];

    if (!defaultLocation) {
      const error = new Error('No default location found. Please create a location first.');
      logger.error('Movement sync failed - no default location', { tenantId });
      throw error;
    }

    let syncedCount = 0;
    const errors = [];

    for (const product of products) {
      try {
        const omieMovements = await getMovementsFromOmie(startDate, endDate, product.omieId, userId);
        
        if (omieMovements && omieMovements.movimento_estoque) {
          for (const omieMov of omieMovements.movimento_estoque) {
            // Verificar se movimento já existe para este tenant
            const existingMovement = await Movement.findOne({
              tenantId,
              omieId: omieMov.codigo_movimento_estoque
            }).session(session);

            if (!existingMovement) {
              let movementType = 'TRANSFER';
              if (omieMov.tipo_movimento === 'E') {
                movementType = 'IN';
              } else if (omieMov.tipo_movimento === 'S') {
                movementType = 'OUT';
              }

              const movement = await Movement.create([{
                tenantId,
                type: movementType,
                product: product._id,
                fromLocation: movementType === 'OUT' ? defaultLocation._id : null,
                toLocation: movementType === 'IN' ? defaultLocation._id : null,
                quantity: Math.abs(omieMov.quantidade),
                omieId: omieMov.codigo_movimento_estoque,
                date: new Date(omieMov.data_movimento),
                description: omieMov.descricao || `Movimento sincronizado do Omie`
              }], { session });

              if (movementType === 'IN') {
                await adjustStock(product._id, defaultLocation._id, Math.abs(omieMov.quantidade), tenantId);
              } else if (movementType === 'OUT') {
                await adjustStock(product._id, defaultLocation._id, -Math.abs(omieMov.quantidade), tenantId);
              }

              syncedCount++;
              logger.logMovementSync(movement[0], 'synced_from_omie');
            }
          }
        }
      } catch (error) {
        errors.push({ product: product.sku, error: error.message });
        logger.error('Failed to sync movements for product', { product: product.sku, error: error.message, tenantId });
      }
    }

    await session.commitTransaction();
    logger.logSyncResult('movements_from_omie', { syncedCount, errors, tenantId });
    return { syncedCount, errors };
  } catch (error) {
    await session.abortTransaction();
    logger.error('Movement sync transaction failed', { error: error.message, tenantId });
    throw error;
  } finally {
    session.endSession();
  }
}

export async function sendMovementToOmie(movement, userId) {
  if (!userId) {
    throw new Error('User ID is required to send movement to Omie');
  }
  
  logger.debug('Sending movement to Omie', { movementId: movement._id, type: movement.type, userId });
  
  try {
    const product = await Product.findById(movement.product);
    if (!product.omieId) {
      const error = new Error('Product does not have Omie ID');
      logger.logMovementSync(movement, 'send_to_omie_failed', error);
      throw error;
    }

    let callType, endpoint, params;

    switch (movement.type) {
      case 'IN':
        endpoint = 'estoque/movestoque/';
        callType = 'IncluirMovimentoEstoque';
        params = {
          codigo_produto: product.omieId,
          tipo_movimento: 'E', // Entrada
          quantidade: movement.quantity,
          data_movimento: movement.date || new Date(),
          descricao: movement.description || 'Entrada de estoque WMS'
        };
        break;

      case 'OUT':
        endpoint = 'estoque/movestoque/';
        callType = 'IncluirMovimentoEstoque';
        params = {
          codigo_produto: product.omieId,
          tipo_movimento: 'S', // Saída
          quantidade: movement.quantity,
          data_movimento: movement.date || new Date(),
          descricao: movement.description || 'Saída de estoque WMS'
        };
        break;

      case 'TRANSFER':
        // For transfers, we create an OUT movement followed by an IN movement
        await createTransferMovements(movement, product, userId);
        logger.logMovementSync(movement, 'sent_to_omie');
        return { success: true, message: 'Transfer created as two movements' };

      default:
        const error = new Error('Invalid movement type');
        logger.logMovementSync(movement, 'send_to_omie_failed', error);
        throw error;
    }

    const result = await callOmie(endpoint, callType, params, userId);
    
    // Update movement with Omie ID
    if (result.codigo_movimento_estoque) {
      movement.omieId = result.codigo_movimento_estoque;
      movement.syncedAt = new Date();
      await movement.save();
    }

    logger.logApiCall(callType, endpoint, params, result);
    logger.logMovementSync(movement, 'sent_to_omie');
    return result;
  } catch (error) {
    logger.logMovementSync(movement, 'send_to_omie_failed', error);
    throw error;
  }
}

async function createTransferMovements(movement, product, userId) {
  if (!userId) {
    throw new Error('User ID is required to create transfer movements in Omie');
  }
  
  logger.debug('Creating transfer movements in Omie', { movementId: movement._id, userId });
  
  try {
    // Create OUT movement
    const outResult = await callOmie(
      'estoque/movestoque/',
      'IncluirMovimentoEstoque',
      {
        codigo_produto: product.omieId,
        tipo_movimento: 'S',
        quantidade: movement.quantity,
        data_movimento: movement.date || new Date(),
        descricao: `Transferência OUT: ${movement.description || 'Transferência WMS'}`
      },
      userId
    );

    // Create IN movement
    const inResult = await callOmie(
      'estoque/movestoque/',
      'IncluirMovimentoEstoque',
      {
        codigo_produto: product.omieId,
        tipo_movimento: 'E',
        quantidade: movement.quantity,
        data_movimento: movement.date || new Date(),
        descricao: `Transferência IN: ${movement.description || 'Transferência WMS'}`
      },
      userId
    );

    // Update movement with Omie IDs
    movement.omieId = `${outResult.codigo_movimento_estoque}-${inResult.codigo_movimento_estoque}`;
    movement.syncedAt = new Date();
    await movement.save();

    logger.info('Transfer movements created in Omie', { 
      movementId: movement._id,
      outId: outResult.codigo_movimento_estoque,
      inId: inResult.codigo_movimento_estoque
    });

    return { outResult, inResult };
  } catch (error) {
    logger.logMovementSync(movement, 'transfer_creation_failed', error);
    throw error;
  }
}

export async function getLocationsFromOmie(userId) {
  if (!userId) {
    throw new Error('User ID is required to fetch locations from Omie');
  }
  
  logger.debug('Fetching locations from Omie', { userId });
  
  try {
    const result = await callOmie(
      'estoque/local/',
      'ListarLocaisEstoque',
      {},
      userId
    );

    logger.logApiCall('ListarLocaisEstoque', 'estoque/local/', {}, result);
    return result;
  } catch (error) {
    logger.logApiCall('ListarLocaisEstoque', 'estoque/local/', {}, null, error);
    throw error;
  }
}

export async function syncLocationsFromOmie(userId) {
  if (!userId) {
    throw new Error('User ID is required to sync locations from Omie');
  }
  
  // Buscar tenantId do usuário
  const user = await User.findById(userId).select('tenantId');
  if (!user || !user.tenantId) {
    throw new Error('User not found or tenantId not configured');
  }
  const tenantId = user.tenantId;
  
  logger.info('Starting location sync from Omie', { userId, tenantId });
  
  try {
    const omieLocations = await getLocationsFromOmie(userId);
    let syncedCount = 0;

    if (omieLocations && omieLocations.locais_estoque) {
      for (const omieLoc of omieLocations.locais_estoque) {
        // Verificar se localização já existe para este tenant
        const existingLocation = await Location.findOne({ 
          tenantId, 
          omieId: omieLoc.codigo_local_estoque 
        });
        
        if (!existingLocation) {
          await Location.create({
            tenantId,
            code: omieLoc.codigo_local_estoque,
            description: omieLoc.descricao || omieLoc.codigo_local_estoque,
            omieId: omieLoc.codigo_local_estoque
          });
          syncedCount++;
          logger.info('Location synced from Omie', { 
            code: omieLoc.codigo_local_estoque,
            description: omieLoc.descricao,
            tenantId
          });
        }
      }
    }

    logger.logSyncResult('locations_from_omie', { syncedCount, errors: [], tenantId });
    return syncedCount;
  } catch (error) {
    logger.error('Failed to sync locations from Omie', { error: error.message, tenantId });
    throw error;
  }
}
