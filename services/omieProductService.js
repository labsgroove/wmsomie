// src/services/omieProductService.js
import Product from '../models/Product.js';
import User from '../models/User.js';
import { callOmie } from './omieClient.js';
import logger from '../utils/syncLogger.js';

export async function syncProducts(userId) {
  if (!userId) {
    throw new Error('User ID is required to sync products');
  }
  
  // Buscar tenantId do usuário
  const user = await User.findById(userId).select('tenantId');
  if (!user || !user.tenantId) {
    throw new Error('User not found or tenantId not configured');
  }
  const tenantId = user.tenantId;
  
  logger.info('Starting product sync from Omie', { userId, tenantId });
  
  let allProducts = [];
  let page = 1;
  const pageSize = 50;
  let hasMore = true;
  let syncedCount = 0;
  const errors = [];

  try {
    while (hasMore) {
      logger.debug(`Fetching products page ${page}`);
      
      const response = await callOmie(
        'geral/produtos/',
        'ListarProdutos',
        { 
          pagina: page, 
          registros_por_pagina: pageSize,
          apenas_importado_api: "N",
          filtrar_apenas_omiepdv: "N"
        },
        userId
      );

      const produtos = response.produto_servico_cadastro || [];
      logger.debug(`Found ${produtos.length} products on page ${page}`);
      
      if (produtos.length === 0) {
        hasMore = false;
      } else {
        allProducts = allProducts.concat(produtos);
        
        const totalPages = response.total_paginas || 1;
        if (page >= totalPages) {
          hasMore = false;
        }
        
        page++;
      }
    }

    logger.info(`Total products found: ${allProducts.length}`);

    // Sincronizar produtos com tenantId
    for (const p of allProducts) {
      try {
        await Product.createFromOmie(p, tenantId);
        
        syncedCount++;
        logger.debug(`Product synced: ${p.codigo} - ${p.descricao}`);
      } catch (error) {
        errors.push({ product: p.codigo, error: error.message });
        logger.error(`Failed to sync product ${p.codigo}`, { error: error.message });
      }
    }

    logger.logSyncResult('products_from_omie', { syncedCount, errors, tenantId });
    return syncedCount;
    
  } catch (error) {
    logger.error('Failed to sync products from Omie', { error: error.message, tenantId });
    throw error;
  }
}

export async function getProductFromOmie(productOmieId, userId) {
  if (!userId) {
    throw new Error('User ID is required to fetch product from Omie');
  }
  
  logger.debug(`Fetching product from Omie: ${productOmieId}`);
  
  try {
    const result = await callOmie(
      'geral/produtos/',
      'ConsultarProduto',
      {
        codigo_produto: productOmieId
      },
      userId
    );

    logger.logApiCall('ConsultarProduto', 'geral/produtos/', { productOmieId }, result);
    return result;
  } catch (error) {
    logger.logApiCall('ConsultarProduto', 'geral/produtos/', { productOmieId }, null, error);
    throw error;
  }
}

export async function searchProductsInOmie(query = '', userId) {
  if (!userId) {
    throw new Error('User ID is required to search products in Omie');
  }
  
  logger.debug(`Searching products in Omie: ${query}`);
  
  try {
    const result = await callOmie(
      'geral/produtos/',
      'ListarProdutos',
      { 
        pagina: 1, 
        registros_por_pagina: 20,
        pesquisa: query,
        apenas_importado_api: 'N',
        exibir: 'T'
      },
      userId
    );

    logger.logApiCall('ListarProdutos', 'geral/produtos/', { query }, result);
    return result;
  } catch (error) {
    logger.logApiCall('ListarProdutos', 'geral/produtos/', { query }, null, error);
    throw error;
  }
}

export async function syncProductFromOmie(productCode, userId) {
  if (!userId) {
    throw new Error('User ID is required to sync product from Omie');
  }
  
  try {
    // Buscar tenantId do usuário
    const user = await User.findById(userId).select('tenantId');
    if (!user || !user.tenantId) {
      throw new Error('User not found or tenantId not configured');
    }
    const tenantId = user.tenantId;
    
    logger.debug(`Syncing individual product ${productCode} from Omie`, { tenantId });
    
    const result = await callOmie(
      'geral/produtos/',
      'ConsultarProduto',
      {
        codigo_produto: productCode
      },
      userId
    );

    const productData = result.produto_servico_cadastro;
    if (!productData) {
      throw new Error(`Product ${productCode} not found in Omie`);
    }

    // Criar/atualizar o produto com tenantId
    await Product.createFromOmie(productData, tenantId);
    
    const product = await Product.findOne({ tenantId, codigo: productCode });
    
    logger.debug(`Product ${productCode} synced successfully`, { tenantId });
    return product;

  } catch (error) {
    logger.error(`Failed to sync product ${productCode}`, { error: error.message });
    throw error;
  }
}