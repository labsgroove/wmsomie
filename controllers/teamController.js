import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';

export const getTeamMembers = async (req, res) => {
  try {
    const members = await User.find({ 
      tenantId: req.tenantId,
      _id: { $ne: req.user._id }
    }).select('-password -resetPasswordToken -resetPasswordExpires');

    res.json({
      success: true,
      data: { members }
    });
  } catch (error) {
    console.error('Erro ao buscar membros do time:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar membros do time',
      error: error.message
    });
  }
};

export const getAllTenantUsers = async (req, res) => {
  try {
    const users = await User.find({ 
      tenantId: req.tenantId 
    }).select('-password -resetPasswordToken -resetPasswordExpires');

    res.json({
      success: true,
      data: { users }
    });
  } catch (error) {
    console.error('Erro ao buscar usuários do tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar usuários do tenant',
      error: error.message
    });
  }
};

export const createTeamMember = async (req, res) => {
  try {
    const { email, password, name, role = 'user' } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email, senha e nome são obrigatórios'
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Este email já está registrado'
      });
    }

    const user = await User.create({
      email: email.toLowerCase(),
      password,
      name,
      tenantId: req.tenantId,
      role: role === 'admin' ? 'admin' : 'user',
      companyName: req.user.companyName,
      omieConfig: {
        appKey: req.user.omieConfig?.appKey || '',
        appSecret: '',
        isConfigured: false
      }
    });

    res.status(201).json({
      success: true,
      message: 'Membro do time criado com sucesso',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          isActive: user.isActive,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Erro ao criar membro do time:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar membro do time',
      error: error.message
    });
  }
};

export const updateTeamMember = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, role, isActive } = req.body;

    const targetUser = await User.findOne({
      _id: userId,
      tenantId: req.tenantId
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Não é possível editar a si mesmo através deste endpoint'
      });
    }

    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email.toLowerCase();
    if (role && ['admin', 'user'].includes(role)) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;

    const user = await User.findByIdAndUpdate(
      userId,
      updates,
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -resetPasswordExpires');

    res.json({
      success: true,
      message: 'Membro do time atualizado com sucesso',
      data: { user }
    });
  } catch (error) {
    console.error('Erro ao atualizar membro do time:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar membro do time',
      error: error.message
    });
  }
};

export const deleteTeamMember = async (req, res) => {
  try {
    const { userId } = req.params;

    const targetUser = await User.findOne({
      _id: userId,
      tenantId: req.tenantId
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Não é possível excluir a própria conta através deste endpoint. Use /auth/account.'
      });
    }

    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: 'Membro do time excluído com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir membro do time:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir membro do time',
      error: error.message
    });
  }
};

export const resetTeamMemberPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Nova senha é obrigatória e deve ter pelo menos 6 caracteres'
      });
    }

    const targetUser = await User.findOne({
      _id: userId,
      tenantId: req.tenantId
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    targetUser.password = newPassword;
    await targetUser.save();

    res.json({
      success: true,
      message: 'Senha do membro do time redefinida com sucesso'
    });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao redefinir senha',
      error: error.message
    });
  }
};
