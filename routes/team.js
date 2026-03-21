import express from 'express';
import {
  getTeamMembers,
  getAllTenantUsers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  resetTeamMemberPassword
} from '../controllers/teamController.js';
import { protect, restrictToAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/members', restrictToAdmin, getTeamMembers);
router.get('/all', restrictToAdmin, getAllTenantUsers);
router.post('/members', restrictToAdmin, createTeamMember);
router.patch('/members/:userId', restrictToAdmin, updateTeamMember);
router.delete('/members/:userId', restrictToAdmin, deleteTeamMember);
router.patch('/members/:userId/reset-password', restrictToAdmin, resetTeamMemberPassword);

export default router;
