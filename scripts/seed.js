// scripts/seed.js
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Location from '../models/Location.js';
import Stock from '../models/Stock.js';
import Movement from '../models/Movement.js';
import Order from '../models/Order.js';
import { adjustStock } from '../services/stockService.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wmsomie';

async function seedDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado ao MongoDB');

    // Limpar dados existentes
    await Product.deleteMany({});
    await Location.deleteMany({});
    await Stock.deleteMany({});
    await Movement.deleteMany({});
    await Order.deleteMany({});
    console.log('Dados existentes removidos');

    // Criar localizações
    const locations = await Location.create([
      { code: 'A01-01-01', description: 'Corredor A, Prateleira 01, Nível 01' },
      { code: 'A01-01-02', description: 'Corredor A, Prateleira 01, Nível 02' },
      { code: 'A01-02-01', description: 'Corredor A, Prateleira 02, Nível 01' },
      { code: 'B01-01-01', description: 'Corredor B, Prateleira 01, Nível 01' },
      { code: 'B01-01-02', description: 'Corredor B, Prateleira 01, Nível 02' },
      { code: 'B01-02-01', description: 'Corredor B, Prateleira 02, Nível 01' },
      { code: 'C01-01-01', description: 'Corredor C, Prateleira 01, Nível 01' },
      { code: 'C01-01-02', description: 'Corredor C, Prateleira 01, Nível 02' },
      { code: 'RECEPCAO-01', description: 'Área de Recebimento' },
      { code: 'EXPEDICAO-01', description: 'Área de Expedição' },
    ]);
    console.log('Localizações criadas:', locations.length);

    // Criar produtos
    const products = await Product.create([
      { name: 'Notebook Dell Inspiron 15', sku: 'SKU001', omieId: 'PROD001' },
      { name: 'Mouse Wireless Logitech', sku: 'SKU002', omieId: 'PROD002' },
      { name: 'Teclado Mecânico RGB', sku: 'SKU003', omieId: 'PROD003' },
      { name: 'Monitor LED 24" Full HD', sku: 'SKU004', omieId: 'PROD004' },
      { name: 'Webcam HD 1080p', sku: 'SKU005', omieId: 'PROD005' },
      { name: 'Headset Bluetooth', sku: 'SKU006', omieId: 'PROD006' },
      { name: 'Cabo USB-C 2m', sku: 'SKU007', omieId: 'PROD007' },
      { name: 'Suporte para Notebook', sku: 'SKU008', omieId: 'PROD008' },
      { name: 'HD Externo 1TB', sku: 'SKU009', omieId: 'PROD009' },
      { name: 'Memória RAM 8GB DDR4', sku: 'SKU010', omieId: 'PROD010' },
    ]);
    console.log('Produtos criados:', products.length);

    // Criar movimentos de entrada (inbound)
    const movements = [];
    for (let i = 0; i < 8; i++) {
      const movement = await Movement.create({
        type: 'IN',
        product: products[i]._id,
        toLocation: locations[i]._id,
        quantity: Math.floor(Math.random() * 50) + 10,
      });
      movements.push(movement);
    }
    console.log('Movimentos de entrada criados:', movements.length);

    // Criar movimentos de saída (outbound)
    for (let i = 0; i < 3; i++) {
      const movement = await Movement.create({
        type: 'OUT',
        product: products[i]._id,
        fromLocation: locations[i]._id,
        quantity: Math.floor(Math.random() * 5) + 1,
      });
      movements.push(movement);
    }
    console.log('Movimentos de saída criados: 3');

    // Criar transferências internas
    for (let i = 0; i < 4; i++) {
      const movement = await Movement.create({
        type: 'TRANSFER',
        product: products[i]._id,
        fromLocation: locations[i]._id,
        toLocation: locations[i + 1]._id,
        quantity: Math.floor(Math.random() * 10) + 1,
      });
      movements.push(movement);
    }
    console.log('Transferências criadas: 4');

    // Criar estoque baseado nos movimentos
    for (let i = 0; i < 8; i++) {
      await Stock.create({
        product: products[i]._id,
        location: locations[i]._id,
        quantity: Math.floor(Math.random() * 100) + 20,
      });
    }
    console.log('Registros de estoque criados: 8');

    // Criar pedidos para picking
    const orders = await Order.create([
      {
        omieId: 'ORD-2024-001',
        status: 'PENDING',
        items: [
          { product: products[0]._id, quantity: 2 },
          { product: products[1]._id, quantity: 1 },
        ],
      },
      {
        omieId: 'ORD-2024-002',
        status: 'PENDING',
        items: [
          { product: products[2]._id, quantity: 1 },
          { product: products[3]._id, quantity: 1 },
          { product: products[4]._id, quantity: 2 },
        ],
      },
      {
        omieId: 'ORD-2024-003',
        status: 'PICKING',
        items: [
          { product: products[5]._id, quantity: 1 },
          { product: products[6]._id, quantity: 3 },
        ],
      },
      {
        omieId: 'ORD-2024-004',
        status: 'DONE',
        items: [
          { product: products[7]._id, quantity: 1 },
          { product: products[8]._id, quantity: 2 },
        ],
      },
      {
        omieId: 'ORD-2024-005',
        status: 'PENDING',
        items: [
          { product: products[9]._id, quantity: 4 },
          { product: products[0]._id, quantity: 1 },
        ],
      },
    ]);
    console.log('Pedidos criados:', orders.length);

    console.log('\n✅ Banco de dados populado com sucesso!');
    console.log('\n📊 Resumo:');
    console.log(`- Produtos: ${products.length}`);
    console.log(`- Localizações: ${locations.length}`);
    console.log(`- Movimentos: ${movements.length}`);
    console.log(`- Estoque: 8 registros`);
    console.log(`- Pedidos: ${orders.length}`);

  } catch (error) {
    console.error('Erro ao popular banco de dados:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado do MongoDB');
  }
}

seedDatabase();
