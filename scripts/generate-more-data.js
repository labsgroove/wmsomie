// scripts/generate-more-data.js
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Location from '../models/Location.js';
import Stock from '../models/Stock.js';
import Movement from '../models/Movement.js';
import Order from '../models/Order.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wmsomie';

const productNames = [
  'iPhone 15 Pro', 'Samsung Galaxy S24', 'iPad Air', 'Surface Pro 9',
  'AirPods Pro', 'Samsung Buds Pro', 'Apple Watch Series 9', 'Galaxy Watch 6',
  'MacBook Air M2', 'Dell XPS 13', 'ThinkPad X1 Carbon', 'HP Spectre x360',
  'LG Monitor 27"', 'Samsung Odyssey G7', 'Dell UltraSharp', 'ASUS ProArt',
  'Logitech MX Master 3', 'Magic Mouse', 'Trackball Marble', 'Vertical Mouse',
  'Keychron K2', 'HHKB Professional', 'Realforce R2', 'Leopold FC750R',
  'Samsung T7 SSD', 'SanDisk Extreme', 'Crucial MX500', 'WD Black SN850',
  'JBL Charge 5', 'Sony WH-1000XM5', 'Bose QuietComfort', 'Sennheiser HD 660S',
  'Anker PowerBank', 'Belkin Charger', 'UGREEN Hub', 'CalDigit Dock'
];

const locationCodes = [
  'A01-01-01', 'A01-01-02', 'A01-02-01', 'A01-02-02',
  'B01-01-01', 'B01-01-02', 'B01-02-01', 'B01-02-02',
  'C01-01-01', 'C01-01-02', 'C01-02-01', 'C01-02-02',
  'D01-01-01', 'D01-01-02', 'D01-02-01', 'D01-02-02',
  'RECEPCAO-01', 'RECEPCAO-02', 'EXPEDICAO-01', 'EXPEDICAO-02'
];

async function generateMoreData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado ao MongoDB');

    const existingProducts = await Product.countDocuments();
    const existingLocations = await Location.countDocuments();
    
    if (existingProducts === 0 || existingLocations === 0) {
      console.log('⚠️  Execute primeiro "npm run seed" para criar dados iniciais');
      return;
    }

    // Adicionar mais produtos
    const newProducts = [];
    for (let i = 0; i < 20; i++) {
      const product = await Product.create({
        name: productNames[i],
        sku: `SKU${String(existingProducts + i + 1).padStart(3, '0')}`,
        omieId: `PROD${String(existingProducts + i + 1).padStart(3, '0')}`,
      });
      newProducts.push(product);
    }
    console.log('Novos produtos criados:', newProducts.length);

    // Adicionar mais localizações (apenas as que não existem)
    const newLocations = [];
    const existingLocationCodes = (await Location.find()).map(loc => loc.code);
    
    for (let i = 0; i < locationCodes.length; i++) {
      if (!existingLocationCodes.includes(locationCodes[i])) {
        const location = await Location.create({
          code: locationCodes[i],
          description: `Localização ${locationCodes[i]}`,
        });
        newLocations.push(location);
      }
    }
    console.log('Novas localizações criadas:', newLocations.length);

    // Criar mais movimentos
    const allProducts = await Product.find();
    const allLocations = await Location.find();
    
    for (let i = 0; i < 50; i++) {
      const product = allProducts[Math.floor(Math.random() * allProducts.length)];
      const location = allLocations[Math.floor(Math.random() * allLocations.length)];
      const type = ['IN', 'OUT', 'TRANSFER'][Math.floor(Math.random() * 3)];
      
      const movementData = {
        type,
        product: product._id,
        quantity: Math.floor(Math.random() * 100) + 1,
      };

      if (type === 'IN') {
        movementData.toLocation = location._id;
      } else if (type === 'OUT') {
        movementData.fromLocation = location._id;
      } else {
        const fromLocation = allLocations[Math.floor(Math.random() * allLocations.length)];
        const toLocation = allLocations[Math.floor(Math.random() * allLocations.length)];
        movementData.fromLocation = fromLocation._id;
        movementData.toLocation = toLocation._id;
      }

      await Movement.create(movementData);
    }
    console.log('Movimentos adicionais criados: 50');

    // Criar mais pedidos
    for (let i = 0; i < 15; i++) {
      const numItems = Math.floor(Math.random() * 5) + 1;
      const items = [];
      
      for (let j = 0; j < numItems; j++) {
        const product = allProducts[Math.floor(Math.random() * allProducts.length)];
        items.push({
          product: product._id,
          quantity: Math.floor(Math.random() * 10) + 1,
        });
      }

      const statuses = ['PENDING', 'PICKING', 'DONE'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      await Order.create({
        omieId: `ORD-2024-${String(existingProducts + i + 1).padStart(3, '0')}`,
        status,
        items,
      });
    }
    console.log('Pedidos adicionais criados: 15');

    // Atualizar estoque para todos os produtos
    for (const product of allProducts) {
      const location = allLocations[Math.floor(Math.random() * allLocations.length)];
      
      const existingStock = await Stock.findOne({ product: product._id });
      if (!existingStock) {
        await Stock.create({
          product: product._id,
          location: location._id,
          quantity: Math.floor(Math.random() * 200) + 50,
        });
      }
    }
    console.log('Estoque atualizado');

    console.log('\n✅ Dados adicionais gerados com sucesso!');
    
    const finalCounts = await Promise.all([
      Product.countDocuments(),
      Location.countDocuments(),
      Movement.countDocuments(),
      Stock.countDocuments(),
      Order.countDocuments(),
    ]);

    console.log('\n📊 Resumo Final:');
    console.log(`- Produtos: ${finalCounts[0]}`);
    console.log(`- Localizações: ${finalCounts[1]}`);
    console.log(`- Movimentos: ${finalCounts[2]}`);
    console.log(`- Estoque: ${finalCounts[3]}`);
    console.log(`- Pedidos: ${finalCounts[4]}`);

  } catch (error) {
    console.error('Erro ao gerar dados:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado do MongoDB');
  }
}

generateMoreData();
