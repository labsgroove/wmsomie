// Script para criar localização padrão e testar sincronização
import mongoose from 'mongoose';
import Location from './models/Location.js';
import Product from './models/Product.js';
import Stock from './models/Stock.js';
import dotenv from 'dotenv';

dotenv.config();

async function createDefaultLocation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wmsomie');
    
    // Verificar se já existe localização
    const existingLocation = await Location.findOne();
    if (existingLocation) {
      console.log('Localização já existe:', existingLocation);
      return existingLocation;
    }
    
    // Criar localização padrão
    const defaultLocation = await Location.create({
      code: 'DEFAULT',
      description: 'Localização Padrão'
    });
    
    console.log('Localização padrão criada:', defaultLocation);
    return defaultLocation;
    
  } catch (error) {
    console.error('Erro ao criar localização:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

async function checkData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wmsomie');
    
    const locations = await Location.find();
    const products = await Product.find();
    const stock = await Stock.find().populate('product').populate('location');
    
    console.log('Localizações:', locations.length);
    console.log('Produtos:', products.length);
    console.log('Estoque:', stock.length);
    
    if (products.length > 0) {
      console.log('Produtos com omieId:', products.filter(p => p.omieId).length);
    }
    
  } catch (error) {
    console.error('Erro ao verificar dados:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Executar based no argumento
const command = process.argv[2];

if (command === 'create-location') {
  createDefaultLocation();
} else if (command === 'check') {
  checkData();
} else {
  console.log('Uso: node fix-stock.js [create-location|check]');
}
