import express from 'express';
import {
  register,
  login,
  getProfile,
  updateProfile,
  updatePassword,
  updateOmieConfig,
  updateSettings,
  deleteAccount,
  getCredits
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

router.get('/profile', protect, getProfile);
router.get('/credits', protect, getCredits);
router.patch('/profile', protect, updateProfile);
router.patch('/password', protect, updatePassword);
router.patch('/omie-config', protect, updateOmieConfig);
router.patch('/settings', protect, updateSettings);
router.delete('/account', protect, deleteAccount);

export default router;
