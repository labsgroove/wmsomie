// scripts/fix-duplicate-index.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.js';

dotenv.config();

async function fixDuplicateIndex() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/wmsomie');
    
    const db = mongoose.connection.db;
    const collection = db.collection('products');
    
    console.log('Step 1: Checking current indexes...');
    const indexes = await collection.indexInformation();
    console.log('Current indexes:', indexes);
    
    // Verificar se existe o índice sku_1 problemático
    if (indexes.sku_1) {
      console.log('❌ Found problematic index: sku_1');
      console.log('Step 2: Dropping sku_1 index...');
      
      try {
        await collection.dropIndex('sku_1');
        console.log('✅ Successfully dropped sku_1 index');
      } catch (dropError) {
        console.log('⚠️  Could not drop sku_1 index (may not exist):', dropError.message);
      }
    }
    
    console.log('Step 3: Finding and fixing products with null/empty codigo...');
    
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
    
    if (nullProducts.length > 0) {
      for (const product of nullProducts) {
        console.log(`Processing product: ${product._id} (omieId: ${product.omieId})`);
        
        try {
          if (product.omieId && product.omieId.trim() !== '') {
            // Usar omieId como codigo
            await Product.findByIdAndUpdate(product._id, {
              codigo: product.omieId.trim(),
              descricao: product.descricao || `Produto ${product.omieId}`
            });
            console.log(`✅ Fixed product ${product._id}`);
          } else {
            // Remover produto inválido
            await Product.findByIdAndDelete(product._id);
            console.log(`🗑️  Removed invalid product ${product._id}`);
          }
        } catch (error) {
          console.error(`❌ Error processing product ${product._id}:`, error.message);
        }
      }
    }
    
    console.log('Step 4: Verifying no duplicate codigos exist...');
    const duplicateCodigos = await Product.aggregate([
      { $match: { codigo: { $ne: null, $ne: '' } } },
      { $group: { _id: '$codigo', count: { $sum: 1 }, docs: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    
    if (duplicateCodigos.length > 0) {
      console.log('⚠️  Found duplicate codigos:', duplicateCodigos);
      
      // Remover duplicatas, mantendo a mais recente
      for (const duplicate of duplicateCodigos) {
        const docs = duplicate.docs.sort((a, b) => b - a); // IDs maiores são mais recentes
        const toKeep = docs[0];
        const toRemove = docs.slice(1);
        
        console.log(`Keeping ${toKeep}, removing ${toRemove.length} duplicates for codigo: ${duplicate._id}`);
        
        for (const docId of toRemove) {
          await Product.findByIdAndDelete(docId);
        }
      }
    }
    
    console.log('Step 5: Recreating indexes...');
    await Product.createIndexes();
    console.log('✅ Indexes recreated');
    
    console.log('Step 6: Final verification...');
    const finalIndexes = await collection.indexInformation();
    console.log('Final indexes:', Object.keys(finalIndexes));
    
    const remainingNullProducts = await Product.countDocuments({
      $or: [
        { codigo: null },
        { codigo: undefined },
        { codigo: { $exists: false } },
        { codigo: '' },
        { codigo: { $regex: /^\s*$/ } }
      ]
    });
    
    console.log(`\n🎉 Fix completed! ${remainingNullProducts} products still have null/empty codigo`);
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Executar correção
fixDuplicateIndex().catch(console.error);
