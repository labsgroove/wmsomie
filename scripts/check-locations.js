// scripts/check-locations.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Location from '../models/Location.js';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wmsomie')
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
        console.log('Creating default location...');
        
        const defaultLocation = await Location.create({
          code: 'DEFAULT',
          description: 'Default location for stock operations',
          omieId: '1'
        });
        
        console.log('Default location created:', defaultLocation);
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
