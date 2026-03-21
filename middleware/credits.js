import User from '../models/User.js';
import syncLogger from '../utils/syncLogger.js';

/**
 * Middleware para verificar e consumir créditos do usuário
 * Custo: 1 crédito por operação de picking (impressão/geração)
 */
export const requireCredits = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    const credits = user.subscription?.credits || 0;

    if (credits < 1) {
      return res.status(403).json({
        success: false,
        message: 'Créditos insuficientes. Compre créditos para continuar.',
        code: 'INSUFFICIENT_CREDITS',
        credits: 0
      });
    }

    // Armazenar créditos atuais no request para uso posterior
    req.currentCredits = credits;
    req.userDocument = user;
    
    next();
  } catch (error) {
    syncLogger.error('Erro ao verificar créditos', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar créditos'
    });
  }
};

/**
 * Consome 1 crédito do usuário
 * Deve ser chamado após a operação bem-sucedida
 */
export const consumeCredit = async (req, res, next) => {
  try {
    const user = req.userDocument || req.user;
    
    if (!user || !user._id) {
      syncLogger.warn('Tentativa de consumir crédito sem usuário');
      return next();
    }

    // Decrementar créditos
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $inc: { 'subscription.credits': -1 } },
      { new: true }
    );

    const newCredits = updatedUser?.subscription?.credits || 0;

    syncLogger.info('Crédito consumido', {
      userId: user._id,
      previousCredits: req.currentCredits,
      newCredits,
      operation: req.path || 'picking'
    });

    // Adicionar informação de créditos consumidos na resposta
    res.locals.creditsConsumed = true;
    res.locals.remainingCredits = newCredits;

    next();
  } catch (error) {
    syncLogger.error('Erro ao consumir crédito', { error: error.message });
    // Não bloquear a resposta se falhar ao consumir crédito
    next();
  }
};

/**
 * Retorna os créditos em caso de erro (rollback)
 */
export const rollbackCredit = async (userId, reason = 'unknown') => {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { 'subscription.credits': 1 } },
      { new: true }
    );

    syncLogger.info('Crédito restaurado (rollback)', {
      userId,
      reason,
      newCredits: user?.subscription?.credits
    });

    return user?.subscription?.credits || 0;
  } catch (error) {
    syncLogger.error('Erro ao restaurar crédito', { error: error.message, userId });
    return null;
  }
};
