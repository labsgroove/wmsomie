// src/services/omieClient.js
import axios from 'axios';
import { omieConfig } from '../config/omie.js';
import User from '../models/User.js';

const axiosInstance = axios.create({
  timeout: omieConfig.timeout,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'WMS-Omie-Integration/1.0'
  }
});

export async function getUserOmieCredentials(userId) {
  if (!userId) {
    throw new Error('User ID is required to fetch Omie credentials');
  }
  
  const user = await User.findById(userId).select('omieConfig');
  
  if (!user || !user.omieConfig?.appKey || !user.omieConfig?.appSecret) {
    return null;
  }
  
  return {
    appKey: user.omieConfig.appKey,
    appSecret: user.omieConfig.appSecret
  };
}

export async function callOmie(endpoint, call, param = {}, userId = null) {
  let creds = null;
  
  if (userId) {
    creds = await getUserOmieCredentials(userId);
  }
  
  if (!creds || !creds.appKey || !creds.appSecret) {
    throw new Error('Omie credentials not configured for this user. Please configure your Omie API key and secret in Settings.');
  }

  const payload = {
    call,
    app_key: creds.appKey,
    app_secret: creds.appSecret,
    param: [param],
  };

  try {
    const { data } = await axiosInstance.post(
      `${omieConfig.baseURL}${endpoint}`,
      payload
    );

    if (data.faultstring) {
      throw new Error(`Omie API Error: ${data.faultstring}`);
    }

    if (data.status && data.status !== 'OK') {
      throw new Error(`Omie API Status: ${data.status}`);
    }

    return data;
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.faultstring || error.response.data?.message || 'Unknown API error';
      throw new Error(`Omie API Error (${status}): ${message}`);
    } else if (error.request) {
      throw new Error('Omie API: No response received');
    } else {
      throw error;
    }
  }
}

export async function callOmieWithUser(userId, endpoint, call, param = {}) {
  return callOmie(endpoint, call, param, userId);
}