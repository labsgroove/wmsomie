// scripts/fix-tenantid-index.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixTenantIdIndex() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wmsomie');
    
    const db = mongoose.connection.db;
    const collection = db.collection('users');
    
    console.log('Step 1: Checking current indexes...');
    const indexes = await collection.indexInformation();
    console.log('Current indexes:', Object.keys(indexes));
    
    // Verificar se existe o índice tenantId_1 problemático
    if (indexes.tenantId_1) {
      console.log('❌ Found problematic index: tenantId_1');
      console.log('Index details:', indexes.tenantId_1);
      console.log('Step 2: Dropping tenantId_1 index...');
      
      try {
        await collection.dropIndex('tenantId_1');
        console.log('✅ Successfully dropped tenantId_1 index');
      } catch (dropError) {
        console.log('⚠️  Could not drop tenantId_1 index:', dropError.message);
      }
    } else {
      console.log('✅ No tenantId_1 index found - nothing to fix');
    }
    
    console.log('Step 3: Verifying final state...');
    const finalIndexes = await collection.indexInformation();
    console.log('Final indexes:', Object.keys(finalIndexes));
    
    // Verificar se ainda existe índice único no tenantId
    const stillHasUniqueTenantId = Object.entries(finalIndexes).some(([name, info]) => {
      if (name.includes('tenantId')) {
        const isUnique = info.unique || (info[0] && info[0].unique);
        if (isUnique) {
          console.log(`⚠️  Found unique tenantId index: ${name}`);
          return true;
        }
      }
      return false;
    });
    
    if (!stillHasUniqueTenantId) {
      console.log('\n🎉 Success! No unique index on tenantId remains.');
      console.log('You can now create multiple users per tenant.');
    } else {
      console.log('\n⚠️  Warning: Unique index on tenantId may still exist.');
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Executar correção
fixTenantIdIndex().catch(console.error);
