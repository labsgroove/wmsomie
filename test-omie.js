// Script para testar conexão com API Omie
import { callOmie } from './services/omieClient.js';

async function testOmieConnection() {
  try {
    console.log('Testando conexão com Omie...');
    
    // Testar consulta de produtos
    console.log('1. Testando consulta de produtos...');
    const products = await callOmie('produtos/produto/', 'ListarProdutos', {
      pagina: 1,
      registros_por_pagina: 10,
      apenas_importado_api: 'N'
    });
    console.log('✅ Produtos:', products.total_produtos || 'N/A');
    
    // Testar consulta de estoque para um produto específico
    if (products.produto_servico && products.produto_servico.length > 0) {
      const firstProduct = products.produto_servico[0];
      console.log(`2. Testando consulta de estoque para produto ${firstProduct.codigo_produto}...`);
      
      try {
        const stock = await callOmie('estoque/consulta/', 'ConsultarEstoque', {
          codigo_produto: firstProduct.codigo_produto
        });
        console.log('✅ Estoque:', stock);
      } catch (stockError) {
        console.log('❌ Erro ao consultar estoque:', stockError.message);
        
        // Tentar com endpoint diferente
        console.log('3. Tentando endpoint de consulta de estoque completo...');
        try {
          const fullStock = await callOmie('estoque/', 'ListarPosicaoEstoque', {
            codigo_produto: firstProduct.codigo_produto
          });
          console.log('✅ Estoque completo:', fullStock);
        } catch (fullStockError) {
          console.log('❌ Erro no endpoint completo:', fullStockError.message);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Erro na conexão:', error.message);
    console.error('Detalhes:', error);
  }
}

testOmieConnection();
