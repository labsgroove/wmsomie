import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Senha é obrigatória'],
    minlength: [6, 'Senha deve ter pelo menos 6 caracteres'],
    select: false
  },
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true
  },
  companyName: {
    type: String,
    trim: true,
    default: ''
  },
  tenantId: {
    type: String,
    sparse: true
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'admin'
  },
  omieConfig: {
    appKey: {
      type: String,
      default: ''
    },
    appSecret: {
      type: String,
      default: ''
    },
    isConfigured: {
      type: Boolean,
      default: false
    }
  },
  settings: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    language: {
      type: String,
      default: 'pt-BR'
    },
    notifications: {
      email: { type: Boolean, default: true },
      webhook: { type: Boolean, default: true }
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'pro', 'enterprise'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'cancelled'],
      default: 'active'
    },
    expiresAt: Date,
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    credits: {
      type: Number,
      default: 0,
      min: 0
    },
    lastPurchaseAt: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLoginAt: Date,
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerifiedAt: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  return obj;
};

const User = mongoose.model('User', userSchema);

export default User;
