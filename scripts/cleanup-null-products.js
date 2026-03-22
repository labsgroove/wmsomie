// scripts/cleanup-null-products.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.js';

dotenv.config();

async function cleanupNullProducts() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/wmsomie');
    
    console.log('Finding products with null/empty codigo...');
    
    // Encontrar produtos com codigo null, undefined ou vazio
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
    
    if (nullProducts.length === 0) {
      console.log('No products to clean up. Exiting...');
      return;
    }
    
    // Para cada produto, tentar corrigir ou remover
    for (const product of nullProducts) {
      console.log(`Processing product: ${product._id} (omieId: ${product.omieId})`);
      
      try {
        // Se tiver omieId, usar como codigo
        if (product.omieId && product.omieId.trim() !== '') {
          await Product.findByIdAndUpdate(product._id, {
            codigo: product.omieId.trim(),
            descricao: product.descricao || `Produto ${product.omieId}`
          });
          console.log(`✅ Fixed product ${product._id} - set codigo to ${product.omieId}`);
        } else {
          // Se não tiver omieId, remover o produto (não é válido)
          await Product.findByIdAndDelete(product._id);
          console.log(`🗑️  Removed invalid product ${product._id}`);
        }
      } catch (error) {
        console.error(`❌ Error processing product ${product._id}:`, error.message);
      }
    }
    
    // Verificar se ainda existem produtos com null codigo
    const remainingNullProducts = await Product.countDocuments({
      $or: [
        { codigo: null },
        { codigo: undefined },
        { codigo: { $exists: false } },
        { codigo: '' },
        { codigo: { $regex: /^\s*$/ } }
      ]
    });
    
    console.log(`\nCleanup completed. ${remainingNullProducts} products still have null/empty codigo`);
    
  } catch (error) {
    console.error('Cleanup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Executar cleanup
cleanupNullProducts().catch(console.error);
