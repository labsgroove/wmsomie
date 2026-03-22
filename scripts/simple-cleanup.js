// scripts/simple-cleanup.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.js';

dotenv.config();

async function simpleCleanup() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/wmsomie');
    
    console.log('Step 1: Checking for any products with null/empty codigo...');
    
    const nullProducts = await Product.find({
      $or: [
        { codigo: null },
        { codigo: undefined },
        { codigo: { $exists: false } },
        { codigo: '' },
        { codigo: { $regex: /^\s*$/ } }
      ]
    });
    
    console.log(`Found ${nullProducts.length} products with null/empty codigo`);
    
    if (nullProducts.length > 0) {
      for (const product of nullProducts) {
        console.log(`Processing product: ${product._id} (omieId: ${product.omieId})`);
        
        try {
          if (product.omieId && product.omieId.trim() !== '') {
            await Product.findByIdAndUpdate(product._id, {
              codigo: product.omieId.trim(),
              descricao: product.descricao || `Produto ${product.omieId}`
            });
            console.log(`✅ Fixed product ${product._id} - set codigo to ${product.omieId}`);
          } else {
            await Product.findByIdAndDelete(product._id);
            console.log(`🗑️  Removed invalid product ${product._id}`);
          }
        } catch (error) {
          console.error(`❌ Error processing product ${product._id}:`, error.message);
        }
      }
    }
    
    console.log('Step 2: Testing product creation...');
    
    // Tentar criar um produto de teste para verificar se o erro persiste
    try {
      const testProduct = await Product.createFromOmie({
        codigo_produto: 'TEST_' + Date.now(),
        codigo: 'TEST_' + Date.now(),
        descricao: 'Produto Teste'
      });
      
      console.log('✅ Test product created successfully:', testProduct.codigo);
      
      // Remover produto de teste
      await Product.findByIdAndDelete(testProduct._id);
      console.log('🗑️  Test product removed');
      
    } catch (testError) {
      console.error('❌ Test product creation failed:', testError.message);
      
      if (testError.message.includes('duplicate key') && testError.message.includes('sku_1')) {
        console.log('\n⚠️  The old sku_1 index still exists in MongoDB.');
        console.log('You need to manually drop it using MongoDB Compass or shell:');
        console.log('db.products.dropIndex("sku_1")');
      }
    }
    
    console.log('\nStep 3: Final count check...');
    const totalProducts = await Product.countDocuments();
    const validProducts = await Product.countDocuments({
      codigo: { $ne: null, $ne: '', $exists: true }
    });
    
    console.log(`Total products: ${totalProducts}`);
    console.log(`Valid products: ${validProducts}`);
    console.log(`Invalid products: ${totalProducts - validProducts}`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Executar limpeza simples
simpleCleanup().catch(console.error);
