// Script para testar endpoints específicos da API Omie
import { callOmie } from './services/omieClient.js';

async function testProductEndpoint() {
  try {
    console.log('=== Testando Endpoint de Produtos ===');
    
    const response = await callOmie(
      'geral/produtos/',
      'ListarProdutos',
      { 
        pagina: 1, 
        registros_por_pagina: 5,
        apenas_importado_api: "N",
        filtrar_apenas_omiepdv: "N"
      }
    );
    
    console.log('Resposta da API:', JSON.stringify(response, null, 2));
    
    if (response.produto_servico_cadastro && response.produto_servico_cadastro.length > 0) {
      const firstProduct = response.produto_servico_cadastro[0];
      console.log('\n=== Testando Estoque do Primeiro Produto ===');
      console.log(`Produto: ${firstProduct.codigo_produto} - ${firstProduct.descricao}`);
      
      try {
        const stock = await callOmie(
          'estoque/consulta/',
          'ConsultarEstoque',
          {
            codigo_produto: firstProduct.codigo_produto
          }
        );
        console.log('Resposta do estoque:', JSON.stringify(stock, null, 2));
      } catch (stockError) {
        console.log('❌ Erro ao consultar estoque:', stockError.message);
        
        // Tentar outro endpoint
        console.log('\n=== Tentando Endpoint Alternativo ===');
        try {
          const stockPosition = await callOmie(
            'estoque/',
            'ListarPosicaoEstoque',
            {
              codigo_produto: firstProduct.codigo_produto
            }
          );
          console.log('Posição de estoque:', JSON.stringify(stockPosition, null, 2));
        } catch (posError) {
          console.log('❌ Erro na posição de estoque:', posError.message);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testProductEndpoint();
