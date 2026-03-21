// src/config/omie.js
import dotenv from 'dotenv';
dotenv.config();

export const omieConfig = {
  appKey: process.env.OMIE_APP_KEY,
  appSecret: process.env.OMIE_APP_SECRET,
  baseURL: process.env.OMIE_BASE_URL || 'https://app.omie.com.br/api/v1/',
  timeout: parseInt(process.env.OMIE_TIMEOUT) || 30000,
};