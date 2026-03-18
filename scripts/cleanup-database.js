// scripts/cleanup-database.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/wmsomie';

async function cleanupDatabase() {
  try {
    console.log('🔧 Conectando ao MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado com sucesso');

    // Listar todas as coleções no banco atual
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log('\n📋 Coleções encontradas:');
    collections.forEach(collection => {
      console.log(`  - ${collection.name}`);
    });

    // Verificar se existe alguma coleção que não deveria existir
    const validCollections = ['products', 'locations', 'stocks', 'movements', 'orders'];
    const invalidCollections = collections.filter(c => !validCollections.includes(c.name));
    
    if (invalidCollections.length > 0) {
      console.log('\n🗑️  Removendo coleções inválidas:');
      for (const collection of invalidCollections) {
        await db.collection(collection.name).drop();
        console.log(`  ✅ Removida: ${collection.name}`);
      }
    } else {
      console.log('\n✅ Nenhuma coleção inválida encontrada');
    }

    // Verificar se existe banco de dados 'wms' e remover se existir
    const admin = mongoose.connection.db.admin();
    const databases = await admin.listDatabases();
    const wmsDatabase = databases.databases.find(db => db.name === 'wms');
    
    if (wmsDatabase) {
      console.log('\n⚠️  Banco de dados "wms" encontrado! Removendo...');
      
      // Conectar diretamente ao banco wms para removê-lo
      const wmsClient = new mongoose.Mongoose();
      await wmsClient.connect('mongodb://localhost:27017/wms');
      
      const wmsDb = wmsClient.connection.db;
      const wmsCollections = await wmsDb.listCollections().toArray();
      
      for (const collection of wmsCollections) {
        await wmsDb.collection(collection.name).drop();
        console.log(`  ✅ Removida coleção: ${collection.name}`);
      }
      
      await wmsClient.disconnect();
      console.log('✅ Banco de dados "wms" removido com sucesso');
    } else {
      console.log('\n✅ Nenhum banco de dados "wms" encontrado');
    }

    // Contar documentos nas coleções válidas
    console.log('\n📊 Contagem de documentos em coleções válidas:');
    for (const collectionName of validCollections) {
      try {
        const count = await db.collection(collectionName).countDocuments();
        console.log(`  - ${collectionName}: ${count} documentos`);
      } catch (error) {
        console.log(`  - ${collectionName}: 0 documentos (coleção não existe)`);
      }
    }

    console.log('\n🎉 Limpeza concluída com sucesso! Apenas o banco "wmsomie" está em uso.');

  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado do MongoDB');
  }
}

cleanupDatabase();
