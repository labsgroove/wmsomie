// src/services/omieProductService.js
import Product from '../models/Product.js';
import { callOmie } from './omieClient.js';
import logger from '../utils/syncLogger.js';

export async function syncProducts() {
  logger.info('Starting product sync from Omie');
  
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
        }
      );

      const produtos = response.produto_servico_cadastro || [];
      logger.debug(`Found ${produtos.length} products on page ${page}`);
      
      if (produtos.length === 0) {
        hasMore = false;
      } else {
        allProducts = allProducts.concat(produtos);
        
        // Verificar se há mais páginas
        const totalPages = response.total_paginas || 1;
        if (page >= totalPages) {
          hasMore = false;
        }
        
        page++;
      }
    }

    logger.info(`Total products found: ${allProducts.length}`);

    // Sincronizar produtos
    for (const p of allProducts) {
      try {
        await Product.createFromOmie(p);
        
        syncedCount++;
        logger.debug(`Product synced: ${p.codigo} - ${p.descricao}`);
      } catch (error) {
        errors.push({ product: p.codigo, error: error.message });
        logger.error(`Failed to sync product ${p.codigo}`, { error: error.message });
      }
    }

    logger.logSyncResult('products_from_omie', { syncedCount, errors });
    return syncedCount;
    
  } catch (error) {
    logger.error('Failed to sync products from Omie', { error: error.message });
    throw error;
  }
}

export async function getProductFromOmie(productOmieId) {
  logger.debug(`Fetching product from Omie: ${productOmieId}`);
  
  try {
    const result = await callOmie(
      'geral/produtos/',
      'ConsultarProduto',
      {
        codigo_produto: productOmieId
      }
    );

    logger.logApiCall('ConsultarProduto', 'geral/produtos/', { productOmieId }, result);
    return result;
  } catch (error) {
    logger.logApiCall('ConsultarProduto', 'geral/produtos/', { productOmieId }, null, error);
    throw error;
  }
}

export async function searchProductsInOmie(query = '') {
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
      }
    );

    logger.logApiCall('ListarProdutos', 'geral/produtos/', { query }, result);
    return result;
  } catch (error) {
    logger.logApiCall('ListarProdutos', 'geral/produtos/', { query }, null, error);
    throw error;
  }
}

export async function syncProductFromOmie(productCode) {
  try {
    logger.debug(`Syncing individual product ${productCode} from Omie`);
    
    const result = await callOmie(
      'geral/produtos/',
      'ConsultarProduto',
      {
        codigo_produto: productCode
      }
    );

    const productData = result.produto_servico_cadastro;
    if (!productData) {
      throw new Error(`Product ${productCode} not found in Omie`);
    }

    // Usar o método existente para criar/atualizar o produto
    await Product.createFromOmie(productData);
    
    const product = await Product.findOne({ codigo: productCode });
    
    logger.debug(`Product ${productCode} synced successfully`);
    return product;

  } catch (error) {
    logger.error(`Failed to sync product ${productCode}`, { error: error.message });
    throw error;
  }
}