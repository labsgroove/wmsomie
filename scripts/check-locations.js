// scripts/check-locations.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Location from '../models/Location.js';

dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/wmsomie')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    try {
      const count = await Location.countDocuments();
      const locations = await Location.find();
      console.log('Location count: ' + count);
      
      if (locations.length > 0) {
        console.log('Locations:');
        locations.forEach(l => {
          console.log(`  - Code: ${l.code}, Description: ${l.description}, Omie ID: ${l.omieId || 'N/A'}`);
        });
      } else {
        console.log('No locations found in database');
        console.log('Creating default locations with new format...');
        
        // Criar algumas localizações padrão no novo formato
        const defaultLocations = [
          { code: 'AA1', description: 'Corredor A, Posição 1', aisle: 'AA', position: 1, level: 1 },
          { code: 'AA2', description: 'Corredor A, Posição 2', aisle: 'AA', position: 2, level: 1 },
          { code: 'AB1', description: 'Corredor AB, Posição 1', aisle: 'AB', position: 1, level: 1 },
          { code: 'AB2', description: 'Corredor AB, Posição 2', aisle: 'AB', position: 2, level: 1 },
        ];
        
        for (const locData of defaultLocations) {
          const location = await Location.create(locData);
          console.log('Location created:', location);
        }
        
        console.log('Default locations created successfully');
      }
    } catch (error) {
      console.error('Error checking locations:', error);
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
