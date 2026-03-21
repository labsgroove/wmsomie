// src/jobs/syncJob.js
import cron from 'node-cron';
import { syncProducts } from '../services/omieProductService.js';
import { sendStockToOmie, syncAllStockFromOmie } from '../services/omieStockService.js';
import { syncMovementsFromOmie, syncLocationsFromOmie } from '../services/omieMovementService.js';
import { syncOrders } from '../services/omieOrderService.js';
import { reserveStock } from '../services/orderService.js';
import Order from '../models/Order.js';

// NOTE: These cron jobs are disabled for multi-tenant security.
// Previously, they would use the first available user's Omie credentials,
// which created a security vulnerability where any user's data could be
// accessed by background jobs.
//
// TODO: Refactor to either:
// 1. Iterate over all users with valid Omie credentials and sync for each
// 2. Implement a system user/service account model
// 3. Make jobs user-specific (triggered per-user rather than globally)

export function startSyncJobs() {
  console.log('Sync jobs are currently disabled for security reasons.');
  console.log('Each user must trigger sync operations manually via the API.');
  console.log('Sync jobs disabled. Manual sync via API endpoints is required.');
}