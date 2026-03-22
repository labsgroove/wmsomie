// scripts/setup-locations.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Location from '../models/Location.js';
import { createLocationSequence } from '../services/locationService.js';

dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/wmsomie')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    try {
      // Limpar localizações existentes
      await Location.deleteMany({});
      console.log('Cleared existing locations');
      
      // Criar sequência de localizações padrão
      const locations = await createLocationSequence({
        startCode: 'AA1',
        quantity: 20,
        maxPosition: 10,
        zone: 'Principal',
        descriptionTemplate: 'Endereço {code} - Zona Principal'
      });
      
      console.log(`Created ${locations.length} locations:`);
      locations.forEach((loc, idx) => {
        console.log(`  ${idx + 1}. ${loc.code} - ${loc.description}`);
      });
      
      console.log('\nLocation setup completed successfully!');
      
    } catch (error) {
      console.error('Error setting up locations:', error);
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
