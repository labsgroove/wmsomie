import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';

export const register = async (req, res) => {
  try {
    const { email, password, name, companyName } = req.body;
    
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
    
    const tenantId = `tenant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      name,
      companyName: companyName || '',
      tenantId,
      role: 'admin',
      subscription: {
        credits: 42, // Créditos iniciais gratuitos para teste
        plan: 'free'
      }
    });
    
    const token = generateToken(user._id);
    
    res.status(201).json({
      success: true,
      message: 'Conta criada com sucesso',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          companyName: user.companyName,
          tenantId: user.tenantId,
          role: user.role,
          subscription: user.subscription,
          omieConfig: user.omieConfig,
          settings: user.settings
        },
        token
      }
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar conta',
      error: error.message
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email e senha são obrigatórios'
      });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Email ou senha inválidos'
      });
    }
    
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Conta desativada. Entre em contato com o suporte.'
      });
    }
    
    user.lastLoginAt = new Date();
    await user.save();
    
    const token = generateToken(user._id);
    
    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          companyName: user.companyName,
          tenantId: user.tenantId,
          role: user.role,
          subscription: user.subscription,
          omieConfig: user.omieConfig,
          settings: user.settings,
          lastLoginAt: user.lastLoginAt
        },
        token
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao realizar login',
      error: error.message
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar perfil',
      error: error.message
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, companyName, email } = req.body;
    const updates = {};
    
    if (name) updates.name = name;
    if (companyName !== undefined) updates.companyName = companyName;
    if (email) updates.email = email.toLowerCase();
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );
    
    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: { user }
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar perfil',
      error: error.message
    });
  }
};

export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Senha atual e nova senha são obrigatórias'
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Nova senha deve ter pelo menos 6 caracteres'
      });
    }
    
    const user = await User.findById(req.user._id).select('+password');
    
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({
        success: false,
        message: 'Senha atual incorreta'
      });
    }
    
    user.password = newPassword;
    await user.save();
    
    res.json({
      success: true,
      message: 'Senha atualizada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar senha',
      error: error.message
    });
  }
};

export const updateOmieConfig = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Apenas administradores podem configurar a API'
      });
    }
    
    const { appKey, appSecret } = req.body;
    
    const updates = {
      'omieConfig.appKey': appKey || '',
      'omieConfig.appSecret': appSecret || '',
      'omieConfig.isConfigured': !!(appKey && appSecret)
    };
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true }
    );
    
    res.json({
      success: true,
      message: 'Configuração Omie atualizada com sucesso',
      data: {
        omieConfig: user.omieConfig
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar configuração Omie:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar configuração',
      error: error.message
    });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const { theme, language, notifications } = req.body;
    const updates = {};
    
    if (theme) updates['settings.theme'] = theme;
    if (language) updates['settings.language'] = language;
    if (notifications) {
      if (notifications.email !== undefined) updates['settings.notifications.email'] = notifications.email;
      if (notifications.webhook !== undefined) updates['settings.notifications.webhook'] = notifications.webhook;
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true }
    );
    
    res.json({
      success: true,
      message: 'Configurações atualizadas com sucesso',
      data: {
        settings: user.settings
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar configurações',
      error: error.message
    });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Apenas administradores podem excluir contas'
      });
    }
    
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Senha é obrigatória para excluir a conta'
      });
    }
    
    const user = await User.findById(req.user._id).select('+password');
    
    if (!(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Senha incorreta'
      });
    }
    
    await User.findByIdAndDelete(req.user._id);
    
    res.json({
      success: true,
      message: 'Conta excluída com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir conta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir conta',
      error: error.message
    });
  }
};

export const getCredits = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('subscription.credits subscription.plan');
    
    res.json({
      success: true,
      data: {
        credits: user?.subscription?.credits || 0,
        plan: user?.subscription?.plan || 'free'
      }
    });
  } catch (error) {
    console.error('Erro ao buscar créditos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar saldo de créditos',
      error: error.message
    });
  }
};
