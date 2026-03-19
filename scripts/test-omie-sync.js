// scripts/test-omie-sync.js
import { syncProducts } from '../services/omieProductService.js';

async function testOmieSync() {
  try {
    console.log('🚀 Testing Omie product synchronization...');
    
    const syncedCount = await syncProducts();
    
    console.log(`✅ Successfully synced ${syncedCount} products from Omie`);
    console.log('🎉 Omie integration is working correctly!');
    
  } catch (error) {
    console.error('❌ Omie sync failed:', error.message);
    
    if (error.message.includes('duplicate key')) {
      console.log('\n⚠️  Duplicate key error detected. This might be related to:');
      console.log('1. Old indexes still present in MongoDB');
      console.log('2. Invalid product data in Omie');
      console.log('3. Schema conflicts');
    }
    
    if (error.message.includes('Omie credentials')) {
      console.log('\n⚠️  Check your Omie API credentials in .env file');
    }
  }
}

// Executar teste
testOmieSync().catch(console.error);
