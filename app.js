// src/app.js
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import routes from './routes/index.js';

const app = express();

// Habilitar CORS
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/wmsomie', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use('/api', routes);

export default app;