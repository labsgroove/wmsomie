import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { 
  User, 
  Lock, 
  Key, 
  Bell, 
  Palette, 
  Trash2, 
  Loader2, 
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Users,
  Plus,
  Edit2,
  X,
  UserCog
} from 'lucide-react';

export default function Settings() {
  const { 
    user, 
    updateProfile, 
    updatePassword, 
    updateOmieConfig, 
    updateSettings, 
    deleteAccount, 
    logout,
    isAdmin,
    getTeamMembers,
    createTeamMember,
    updateTeamMember,
    deleteTeamMember,
    resetTeamMemberPassword
  } = useAuth();
  
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Profile form
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    companyName: user?.companyName || ''
  });
  
  // Password form
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // Omie config form
  const [omieConfig, setOmieConfig] = useState({
    appKey: user?.omieConfig?.appKey || '',
    appSecret: user?.omieConfig?.appSecret || ''
  });
  
  // Settings
  const [settings, setSettings] = useState({
    theme: user?.settings?.theme || 'system',
    notifications: {
      email: user?.settings?.notifications?.email ?? true,
      webhook: user?.settings?.notifications?.webhook ?? true
    }
  });
  
  // Delete account
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Team management state
  const [teamMembers, setTeamMembers] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEditMember, setShowEditMember] = useState(null);
  const [showResetPassword, setShowResetPassword] = useState(null);
  const [newMemberData, setNewMemberData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user'
  });
  const [editMemberData, setEditMemberData] = useState({
    name: '',
    email: '',
    role: '',
    isActive: true
  });
  const [resetPasswordData, setResetPasswordData] = useState('');

  // Load team members when tab changes to team
  useEffect(() => {
    if (activeTab === 'team' && isAdmin) {
      loadTeamMembers();
    }
  }, [activeTab, isAdmin]);

  const loadTeamMembers = async () => {
    setLoading(true);
    const result = await getTeamMembers();
    if (result.success) {
      setTeamMembers(result.data);
    } else {
      setMessage({ type: 'error', text: result.error });
    }
    setLoading(false);
  };

  const handleCreateMember = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    const result = await createTeamMember(newMemberData);
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Membro do time criado com sucesso!' });
      setShowAddMember(false);
      setNewMemberData({ name: '', email: '', password: '', role: 'user' });
      loadTeamMembers();
    } else {
      setMessage({ type: 'error', text: result.error });
    }
    
    setLoading(false);
  };

  const handleUpdateMember = async (e) => {
    e.preventDefault();
    if (!showEditMember) return;
    
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    const result = await updateTeamMember(showEditMember, editMemberData);
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Membro do time atualizado com sucesso!' });
      setShowEditMember(null);
      loadTeamMembers();
    } else {
      setMessage({ type: 'error', text: result.error });
    }
    
    setLoading(false);
  };

  const handleDeleteMember = async (userId) => {
    if (!confirm('Tem certeza que deseja excluir este membro?')) return;
    
    setLoading(true);
    const result = await deleteTeamMember(userId);
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Membro do time excluído com sucesso!' });
      loadTeamMembers();
    } else {
      setMessage({ type: 'error', text: result.error });
    }
    
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!showResetPassword) return;
    
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    const result = await resetTeamMemberPassword(showResetPassword, resetPasswordData);
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Senha redefinida com sucesso!' });
      setShowResetPassword(null);
      setResetPasswordData('');
    } else {
      setMessage({ type: 'error', text: result.error });
    }
    
    setLoading(false);
  };

  const openEditModal = (member) => {
    setShowEditMember(member._id);
    setEditMemberData({
      name: member.name,
      email: member.email,
      role: member.role,
      isActive: member.isActive
    });
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    const result = await updateProfile(profileData);
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
    } else {
      setMessage({ type: 'error', text: result.error });
    }
    
    setLoading(false);
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não coincidem' });
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'A nova senha deve ter pelo menos 6 caracteres' });
      return;
    }
    
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    const result = await updatePassword(passwordData.currentPassword, passwordData.newPassword);
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Senha atualizada com sucesso!' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } else {
      setMessage({ type: 'error', text: result.error });
    }
    
    setLoading(false);
  };

  const handleOmieUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    const result = await updateOmieConfig(omieConfig.appKey, omieConfig.appSecret);
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Configuração Omie atualizada com sucesso!' });
    } else {
      setMessage({ type: 'error', text: result.error });
    }
    
    setLoading(false);
  };

  const handleSettingsUpdate = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    const result = await updateSettings(settings);
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Configurações atualizadas!' });
    } else {
      setMessage({ type: 'error', text: result.error });
    }
    
    setLoading(false);
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setMessage({ type: 'error', text: 'Digite sua senha para confirmar' });
      return;
    }
    
    setLoading(true);
    const result = await deleteAccount(deletePassword);
    
    if (!result.success) {
      setMessage({ type: 'error', text: result.error });
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'password', label: 'Senha', icon: Lock },
    ...(isAdmin ? [{ id: 'team', label: 'Time', icon: Users }] : []),
    ...(isAdmin ? [{ id: 'omie', label: 'API Omie', icon: Key }] : []),
    { id: 'preferences', label: 'Preferências', icon: Palette },
    ...(isAdmin ? [{ id: 'danger', label: 'Zona de Perigo', icon: Trash2, danger: true }] : [])
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-600 mt-1">Gerencie sua conta e preferências</p>
      </div>

      {message.text && (
        <div className={`mb-6 p-4 rounded-lg flex items-center ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 mr-2" />
          ) : (
            <AlertCircle className="w-5 h-5 mr-2" />
          )}
          {message.text}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-64">
          <nav className="space-y-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition ${
                    activeTab === tab.id
                      ? tab.danger 
                        ? 'bg-red-50 text-red-700'
                        : 'bg-blue-50 text-blue-700'
                      : tab.danger
                        ? 'text-red-600 hover:bg-red-50'
                        : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {tab.label}
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </button>
              );
            })}
          </nav>

          {/* Subscription Card */}
          <div className="mt-6 p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl text-white">
            <p className="text-sm opacity-90">Plano atual</p>
            <p className="text-lg font-semibold capitalize">{user?.subscription?.plan || 'Free'}</p>
            <p className="text-xs opacity-75 mt-1">
              Status: {user?.subscription?.status === 'active' ? 'Ativo' : user?.subscription?.status}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações do Perfil</h2>
              
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da empresa
                  </label>
                  <input
                    type="text"
                    value={profileData.companyName}
                    onChange={(e) => setProfileData({ ...profileData, companyName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Sua empresa"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition disabled:opacity-50 flex items-center"
                  >
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Salvar alterações
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Alterar Senha</h2>
              
              <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Senha atual
                  </label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nova senha
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmar nova senha
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition disabled:opacity-50 flex items-center"
                  >
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Atualizar senha
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Team Management Tab */}
          {activeTab === 'team' && isAdmin && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Gestão de Time</h2>
                  <p className="text-sm text-gray-500">Gerencie os usuários do seu tenant</p>
                </div>
                <button
                  onClick={() => setShowAddMember(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Membro
                </button>
              </div>

              {/* Add Member Modal */}
              {showAddMember && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="text-sm font-semibold text-blue-900 mb-4">Novo Membro</h3>
                  <form onSubmit={handleCreateMember} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                        <input
                          type="text"
                          value={newMemberData.name}
                          onChange={(e) => setNewMemberData({ ...newMemberData, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={newMemberData.email}
                          onChange={(e) => setNewMemberData({ ...newMemberData, email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                        <input
                          type="password"
                          value={newMemberData.password}
                          onChange={(e) => setNewMemberData({ ...newMemberData, password: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          required
                          minLength={6}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Perfil</label>
                        <select
                          value={newMemberData.role}
                          onChange={(e) => setNewMemberData({ ...newMemberData, role: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        >
                          <option value="user">Usuário</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 flex items-center"
                      >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Criar Membro
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddMember(false)}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Edit Member Modal */}
              {showEditMember && (
                <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h3 className="text-sm font-semibold text-yellow-900 mb-4">Editar Membro</h3>
                  <form onSubmit={handleUpdateMember} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                        <input
                          type="text"
                          value={editMemberData.name}
                          onChange={(e) => setEditMemberData({ ...editMemberData, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={editMemberData.email}
                          onChange={(e) => setEditMemberData({ ...editMemberData, email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Perfil</label>
                        <select
                          value={editMemberData.role}
                          onChange={(e) => setEditMemberData({ ...editMemberData, role: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        >
                          <option value="user">Usuário</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                          value={editMemberData.isActive}
                          onChange={(e) => setEditMemberData({ ...editMemberData, isActive: e.target.value === 'true' })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        >
                          <option value={true}>Ativo</option>
                          <option value={false}>Inativo</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 flex items-center"
                      >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Salvar Alterações
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEditMember(null)}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Reset Password Modal */}
              {showResetPassword && (
                <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h3 className="text-sm font-semibold text-purple-900 mb-4">Redefinir Senha</h3>
                  <form onSubmit={handleResetPassword} className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
                      <input
                        type="password"
                        value={resetPasswordData}
                        onChange={(e) => setResetPasswordData(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 flex items-center"
                      >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Redefinir Senha
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowResetPassword(null)}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Team Members List */}
              <div className="space-y-3">
                {teamMembers.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Nenhum membro do time encontrado.</p>
                ) : (
                  teamMembers.map((member) => (
                    <div
                      key={member._id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          member.role === 'admin' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {member.role === 'admin' ? <UserCog className="w-5 h-5" /> : <User className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{member.name}</p>
                          <p className="text-sm text-gray-500">{member.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              member.role === 'admin' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {member.role === 'admin' ? 'Admin' : 'Usuário'}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              member.isActive 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {member.isActive ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowResetPassword(member._id)}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                          title="Redefinir senha"
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(member)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteMember(member._id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Omie Config Tab */}
          {activeTab === 'omie' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Configuração API Omie</h2>
                  <p className="text-sm text-gray-500">Configure suas credenciais da API Omie ERP</p>
                </div>
                {user?.omieConfig?.isConfigured && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    Configurado
                  </span>
                )}
              </div>

              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <ExternalLink className="w-4 h-4 inline mr-1" />
                  Para obter suas credenciais, acesse o{' '}
                  <a 
                    href="https://app.omie.com.br/login/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    painel Omie
                  </a>
                  {' '}→ Configurações → API
                </p>
              </div>
              
              <form onSubmit={handleOmieUpdate} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    App Key
                  </label>
                  <input
                    type="text"
                    value={omieConfig.appKey}
                    onChange={(e) => setOmieConfig({ ...omieConfig, appKey: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    App Secret
                  </label>
                  <input
                    type="password"
                    value={omieConfig.appSecret}
                    onChange={(e) => setOmieConfig({ ...omieConfig, appSecret: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono"
                    placeholder="Suas credenciais estão criptografadas"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {user?.omieConfig?.appSecret ? '•••••••• (já configurado)' : 'Digite para atualizar'}
                  </p>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition disabled:opacity-50 flex items-center"
                  >
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Salvar configuração
                  </button>
                  
                  {user?.omieConfig?.isConfigured && (
                    <button
                      type="button"
                      onClick={() => setOmieConfig({ appKey: '', appSecret: '' })}
                      className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Preferências</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tema
                  </label>
                  <div className="flex gap-3">
                    {['light', 'dark', 'system'].map(theme => (
                      <button
                        key={theme}
                        onClick={() => setSettings({ ...settings, theme })}
                        className={`px-4 py-2 rounded-lg border transition ${
                          settings.theme === theme
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {theme === 'light' && 'Claro'}
                        {theme === 'dark' && 'Escuro'}
                        {theme === 'system' && 'Sistema'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Bell className="w-4 h-4 inline mr-1" />
                    Notificações
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.notifications.email}
                        onChange={(e) => setSettings({
                          ...settings,
                          notifications: { ...settings.notifications, email: e.target.checked }
                        })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Receber notificações por email</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.notifications.webhook}
                        onChange={(e) => setSettings({
                          ...settings,
                          notifications: { ...settings.notifications, webhook: e.target.checked }
                        })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Ativar webhooks</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleSettingsUpdate}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition disabled:opacity-50 flex items-center"
                  >
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Salvar preferências
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Danger Zone Tab */}
          {activeTab === 'danger' && (
            <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
              <h2 className="text-lg font-semibold text-red-600 mb-4 flex items-center">
                <AlertCircle className="w-5 h-5 mr-2" />
                Zona de Perigo
              </h2>
              
              <div className="border-t border-red-100 pt-4">
                <h3 className="text-sm font-medium text-gray-900">Excluir conta</h3>
                <p className="text-sm text-gray-500 mt-1 mb-4">
                  Esta ação não pode ser desfeita. Todos os seus dados serão permanentemente removidos.
                </p>

                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition flex items-center"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir minha conta
                  </button>
                ) : (
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-sm text-red-800 mb-3">
                      Digite sua senha para confirmar a exclusão da conta:
                    </p>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="w-full px-4 py-2 border border-red-300 rounded-lg mb-3 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                      placeholder="Sua senha"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={handleDeleteAccount}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 flex items-center"
                      >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Confirmar exclusão
                      </button>
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeletePassword('');
                        }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
