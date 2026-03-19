// scripts/test-stock-api.js
import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';

async function testStockAPI() {
  try {
    console.log('🧪 Testing Stock API endpoints...');
    
    // Test 1: Get all stock
    console.log('\n1️⃣ Testing GET /stock');
    const stockResponse = await axios.get(`${API_BASE}/stock`);
    console.log('Status:', stockResponse.status);
    console.log('Stock count:', stockResponse.data.length);
    
    if (stockResponse.data.length > 0) {
      console.log('Sample stock item:');
      console.log(JSON.stringify(stockResponse.data[0], null, 2));
    }
    
    // Test 2: Sync with Omie
    console.log('\n2️⃣ Testing POST /stock/sync-with-omie');
    const syncResponse = await axios.post(`${API_BASE}/stock/sync-with-omie`);
    console.log('Status:', syncResponse.status);
    console.log('Sync result:', syncResponse.data);
    
    // Test 3: Get stock after sync
    console.log('\n3️⃣ Testing GET /stock after sync');
    const afterSyncResponse = await axios.get(`${API_BASE}/stock`);
    console.log('Status:', afterSyncResponse.status);
    console.log('Stock count after sync:', afterSyncResponse.data.length);
    
    if (afterSyncResponse.data.length > 0) {
      console.log('Products with stock:');
      afterSyncResponse.data.forEach(item => {
        console.log(`- ${item.product?.name}: ${item.quantity} units at ${item.location?.code || 'Unlocated'}`);
      });
    }
    
    console.log('\n✅ All API tests completed successfully!');
    
  } catch (error) {
    console.error('❌ API test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Executar teste
testStockAPI();
