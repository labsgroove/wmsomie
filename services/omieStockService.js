// src/services/omieStockService.js
import Stock from '../models/Stock.js';
import Product from '../models/Product.js';
import Location from '../models/Location.js';
import User from '../models/User.js';
import { callOmie } from './omieClient.js';
import logger from '../utils/syncLogger.js';

export async function sendStockToOmie(userId) {
  if (!userId) {
    throw new Error('User ID is required to send stock to Omie');
  }
  
  // Buscar tenantId do usuário
  const user = await User.findById(userId).select('tenantId');
  if (!user || !user.tenantId) {
    throw new Error('User not found or tenantId not configured');
  }
  const tenantId = user.tenantId;
  
  logger.info('Starting stock sync to Omie', { userId, tenantId });
  
  // Buscar produtos com estoque local filtrando por tenant
  const stockAggregates = await Stock.aggregate([
    { $match: { tenantId, quantity: { $gt: 0 }, qualityStatus: 'GOOD' } },
    { 
      $group: {
        _id: '$sku',
        totalQuantity: { $sum: '$quantity' }
      }
    }
  ]);
  
  let successCount = 0;
  let errorCount = 0;

  for (const stock of stockAggregates) {
    try {
      // Buscar produto para obter omieId filtrando por tenant
      const product = await Product.findOne({ tenantId, codigo: stock._id });
      if (!product || !product.omieId) {
        logger.warn(`Product ${stock._id} has no Omie ID or not found for tenant ${tenantId}, skipping`);
        continue;
      }

      await callOmie(
        'estoque/ajuste/',
        'AjustarEstoque',
        {
          codigo_produto: product.omieId,
          quantidade: stock.totalQuantity,
        },
        userId
      );
      
      successCount++;
      logger.logStockSync(product, 'sent_to_omie', stock.totalQuantity);
    } catch (error) {
      errorCount++;
      logger.error(`Failed to sync stock for ${stock._id}`, { error: error.message, tenantId });
    }
  }

  logger.info('Stock sync to Omie completed', { successCount, errorCount, tenantId });
  return successCount;
}

export async function getStockFromOmie(productOmieId, userId) {
  if (!userId) {
    throw new Error('User ID is required to fetch stock from Omie');
  }
  
  logger.debug(`Fetching stock from Omie for product ${productOmieId}`, { userId });
  
  try {
    // Primeiro tenta buscar pelo ID do produto
    const result = await callOmie(
      'estoque/consulta/',
      'PosicaoEstoque',
      {
        id_prod: parseInt(productOmieId),
        codigo_local_estoque: 0, // Todos os locais
        data: new Date().toLocaleDateString('pt-BR')
      },
      userId
    );

    logger.logApiCall('PosicaoEstoque', 'estoque/consulta/', { productOmieId }, result);
    return result;
  } catch (error) {
    logger.logApiCall('PosicaoEstoque', 'estoque/consulta/', { productOmieId }, null, error);
    
    // Se falhar, tenta listar posição de estoque geral
    try {
      const listResult = await callOmie(
        'estoque/consulta/',
        'ListarPosEstoque',
        {
          nPagina: 1,
          nRegPorPagina: 50,
          dDataPosicao: new Date().toLocaleDateString('pt-BR'),
          cExibeTodos: "N",
          codigo_local_estoque: 0
        },
        userId
      );
      
      // Filtrar pelo produto específico
      if (listResult.produtos && listResult.produtosArray) {
        const productStock = listResult.produtosArray.find(
          p => p.id_prod == productOmieId || p.cod_int === productOmieId
        );
        
        if (productStock) {
          logger.logApiCall('ListarPosEstoque', 'estoque/consulta/', { productOmieId }, productStock);
          return productStock;
        }
      }
      
      logger.logApiCall('ListarPosEstoque', 'estoque/consulta/', { productOmieId }, listResult);
      return listResult;
    } catch (listError) {
      logger.logApiCall('ListarPosEstoque', 'estoque/consulta/', { productOmieId }, null, listError);
      throw listError;
    }
  }
}

export async function syncAllStockFromOmie(userId) {
  if (!userId) {
    throw new Error('User ID is required to sync stock from Omie');
  }
  
  // Buscar tenantId do usuário
  const user = await User.findById(userId).select('tenantId');
  if (!user || !user.tenantId) {
    throw new Error('User not found or tenantId not configured');
  }
  const tenantId = user.tenantId;
  
  logger.info('Starting full stock sync from Omie', { userId, tenantId });
  
  // Importar produtos para garantir que temos os dados mais recentes
  const { syncProducts } = await import('./omieProductService.js');
  
  logger.info('Syncing products first to get latest data...');
  await syncProducts(userId);
  
  // Buscar produtos apenas do tenant atual
  const products = await Product.find({ 
    tenantId,
    omieId: { $exists: true, $ne: null }, 
    isActive: true 
  });
  
  // Criar localização RECEBIMENTO se não existir (com tenantId)
  let receivingLocation = await Location.findOne({ tenantId, code: 'RECEBIMENTO' });
  if (!receivingLocation) {
    receivingLocation = await Location.create({
      tenantId,
      code: 'RECEBIMENTO',
      description: 'Área de Recebimento',
      type: 'receiving',
      zone: 'Recebimento'
    });
    logger.info('Created RECEBIMENTO location', { tenantId });
  }

  let syncedCount = 0;
  const errors = [];

  for (const product of products) {
    try {
      // Tenta consultar estoque via API específica primeiro
      let stockQuantity = null;
      
      try {
        const omieStock = await getStockFromOmie(product.omieId, userId);
        
        // Extrair quantidade do campo correto 'saldo'
        if (omieStock && omieStock.saldo !== undefined) {
          stockQuantity = omieStock.saldo;
        } else if (omieStock && omieStock.fisico !== undefined) {
          stockQuantity = omieStock.fisico;
        }
      } catch (apiError) {
        logger.warn(`Failed to get stock from API for ${product.codigo}, trying product data...`);
        
        // Se falhar, usa o quantidade_estoque do produto
        if (product.quantidade_estoque !== undefined) {
          stockQuantity = product.quantidade_estoque;
          logger.info(`Using stock quantity from product data for ${product.codigo}: ${stockQuantity}`);
        }
      }
      
      if (stockQuantity !== null && stockQuantity > 0) {
        // Verificar estoque local atual filtrando por tenant
        const currentStock = await Stock.find({ tenantId, sku: product.codigo });
        const localTotal = currentStock.reduce((sum, s) => sum + s.quantity, 0);
        
        // Se houver diferença, atualizar para bater com Omie
        if (localTotal !== stockQuantity) {
          logger.info(`Updating stock for ${product.codigo}: ${localTotal} → ${stockQuantity} (Omie has: ${stockQuantity})`);
          
          if (localTotal > 0) {
            // Atualizar estoque existente
            const difference = stockQuantity - localTotal;
            
            if (currentStock.length > 0) {
              // Distribuir a diferença no primeiro registro
              const firstStock = currentStock[0];
              firstStock.quantity = Math.max(0, firstStock.quantity + difference);
              firstStock.lastUpdated = new Date();
              firstStock.omieSyncedAt = new Date();
              await firstStock.save();
              
              logger.info(`Updated stock record for ${product.codigo} by ${difference > 0 ? '+' : ''}${difference}`);
            }
          } else {
            // Criar/atualizar estoque em RECEBIMENTO com tenantId
            await Stock.findOneAndUpdate(
              { tenantId, sku: product.codigo, locationCode: 'RECEBIMENTO' },
              { 
                tenantId,
                sku: product.codigo,
                locationCode: 'RECEBIMENTO',
                quantity: stockQuantity,
                lastUpdated: new Date(),
                omieSyncedAt: new Date()
              },
              { upsert: true, new: true }
            );
            
            logger.info(`Created stock record for ${product.codigo} with ${stockQuantity} units`);
          }
          
          syncedCount++;
          logger.logStockSync(product, 'updated_to_omie', stockQuantity);
        } else {
          // Estoque já sincronizado
          logger.info(`Stock already synchronized for ${product.codigo}: ${localTotal}`);
          syncedCount++;
          logger.logStockSync(product, 'already_synced', localTotal);
        }
        
        await receivingLocation.updateSku(product.codigo, stockQuantity, 0);
        
        syncedCount++;
        logger.logStockSync(product, 'synced_to_receiving', stockQuantity);
      } else {
        logger.warn(`No stock quantity found for product ${product.codigo}`);
      }
      
    } catch (error) {
      errors.push({ product: product.codigo, error: error.message });
      logger.logStockSync(product, 'sync_from_omie_failed', 0, error);
    }
  }

  logger.logSyncResult('stock_from_omie', { syncedCount, errors, tenantId });
  return { syncedCount, errors };
}

export async function getStockMovementsFromOmie(productOmieId, startDate, endDate, userId) {
  if (!userId) {
    throw new Error('User ID is required to fetch stock movements from Omie');
  }
  
  logger.debug(`Fetching stock movements from Omie for product ${productOmieId}`, { userId });
  
  try {
    // Usar o método correto para listar movimentos
    const result = await callOmie(
      'estoque/consulta/',
      'ListarMovimentoEstoque',
      {
        nPagina: 1,
        nRegPorPagina: 50,
        codigo_local_estoque: 0, // Todos os locais
        idProd: parseInt(productOmieId),
        dDtInicial: startDate,
        dDtFinal: endDate,
        lista_local_estoque: ""
      },
      userId
    );

    logger.logApiCall('ListarMovimentoEstoque', 'estoque/consulta/', { productOmieId, startDate, endDate }, result);
    return result;
  } catch (error) {
    logger.logApiCall('ListarMovimentoEstoque', 'estoque/consulta/', { productOmieId, startDate, endDate }, null, error);
    throw error;
  }
}

export async function adjustStockInOmie(productOmieId, quantity, reason, userId) {
  if (!userId) {
    throw new Error('User ID is required to adjust stock in Omie');
  }
  
  logger.info(`Adjusting stock in Omie for product ${productOmieId}`, { quantity, reason, userId });
  
  try {
    const result = await callOmie(
      'estoque/ajuste/',
      'AjustarEstoque',
      {
        codigo_produto: productOmieId,
        quantidade: quantity,
        motivo: reason,
      },
      userId
    );

    logger.logApiCall('AjustarEstoque', 'estoque/ajuste/', { productOmieId, quantity, reason }, result);
    return result;
  } catch (error) {
    logger.logApiCall('AjustarEstoque', 'estoque/ajuste/', { productOmieId, quantity, reason }, null, error);
    throw error;
  }
}