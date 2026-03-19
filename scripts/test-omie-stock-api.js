// scripts/test-omie-stock-api.js
import { getStockFromOmie, syncAllStockFromOmie } from '../services/omieStockService.js';
import Product from '../models/Product.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function testOmieStockAPI() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wmsomie');
    
    console.log('📦 Getting a product to test...');
    const product = await Product.findOne({ omieId: { $exists: true, $ne: null } });
    
    if (!product) {
      console.log('❌ No products found with Omie ID. Please sync products first.');
      return;
    }
    
    console.log(`🧪 Testing stock API for product: ${product.codigo} (Omie ID: ${product.omieId})`);
    
    try {
      const stockData = await getStockFromOmie(product.omieId);
      console.log('✅ Stock API call successful!');
      console.log('📊 Stock data:', JSON.stringify(stockData, null, 2));
      
      // Tentar extrair quantidade de diferentes formatos de resposta
      let quantity = 0;
      if (stockData.estoque_atual !== undefined) {
        quantity = stockData.estoque_atual;
      } else if (stockData.saldo_estoque !== undefined) {
        quantity = stockData.saldo_estoque;
      } else if (stockData.quantidade !== undefined) {
        quantity = stockData.quantidade;
      } else if (Array.isArray(stockData.produtosArray)) {
        const productStock = stockData.produtosArray.find(p => 
          p.id_prod == product.omieId || p.cod_int === product.codigo
        );
        if (productStock) {
          quantity = productStock.saldo_estoque || productStock.quantidade || 0;
        }
      }
      
      console.log(`📈 Extracted quantity: ${quantity}`);
      
    } catch (stockError) {
      console.log('❌ Stock API call failed:', stockError.message);
      
      if (stockError.message.includes('not exists')) {
        console.log('\n⚠️  API method still not found. Checking available methods...');
        console.log('The correct methods should be:');
        console.log('- PosicaoEstoque (for specific product)');
        console.log('- ListarPosEstoque (for all products)');
        console.log('- ListarMovimentoEstoque (for movements)');
      }
    }
    
    console.log('\n🔄 Testing full stock sync...');
    try {
      const syncResult = await syncAllStockFromOmie();
      console.log('✅ Stock sync completed!');
      console.log(`📊 Synced ${syncResult.syncedCount} products`);
      if (syncResult.errors.length > 0) {
        console.log(`⚠️  ${syncResult.errors.length} errors occurred`);
      }
    } catch (syncError) {
      console.log('❌ Stock sync failed:', syncError.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Executar teste
testOmieStockAPI().catch(console.error);
