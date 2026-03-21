import { useState, useEffect } from 'react';
import { Coins, CreditCard, Package, Zap, Crown, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { paymentService } from '../services/paymentService';
import api from '../services/api';

const PACKAGES = [
  { id: 'starter', credits: 1000, price: 29.90, name: 'Pacote Inicial', icon: Package, color: 'bg-blue-500' },
  { id: 'pro', credits: 5000, price: 99.90, name: 'Pacote Profissional', icon: Zap, color: 'bg-purple-500' },
  { id: 'enterprise', credits: 20000, price: 299.90, name: 'Pacote Empresarial', icon: Crown, color: 'bg-amber-500' }
];

export default function Credits() {
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadCredits();
  }, []);

  const loadCredits = async () => {
    try {
      const response = await api.get('/auth/credits');
      setCredits(response.data.data.credits);
    } catch (err) {
      console.error('Erro ao carregar créditos:', err);
    }
  };

  const handleBuy = async (packageId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await paymentService.createPayment(packageId);
      setPayment(response.payment);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao criar pagamento');
    } finally {
      setLoading(false);
    }
  };

  const copyPixCode = () => {
    if (payment?.qrCode) {
      navigator.clipboard.writeText(payment.qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const checkPayment = async () => {
    if (!payment) return;
    setChecking(true);
    try {
      const response = await paymentService.checkStatus(payment.paymentId);
      if (response.status === 'paid') {
        setCredits(response.credits);
        setPayment(null);
        alert(`Pagamento confirmado! ${response.credits} créditos adicionados.`);
      } else {
        alert('Pagamento ainda pendente. Aguarde alguns instantes e tente novamente.');
      }
    } catch (err) {
      console.error('Erro ao verificar pagamento:', err);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header com saldo */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 mb-8 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">Meus Créditos</h1>
              <p className="text-blue-100">Use créditos para gerar listas de picking</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 mb-1">
                <Coins className="w-8 h-8" />
                <span className="text-4xl font-bold">{credits}</span>
              </div>
              <p className="text-blue-100">créditos disponíveis</p>
            </div>
          </div>
        </div>

        {/* Informação sobre uso */}
        <div className="bg-white rounded-lg p-4 mb-6 shadow-sm border border-gray-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm text-gray-600">
                <strong>Como funciona:</strong> Cada sincronização ou lista de picking gerada consome <strong>1 crédito</strong>. 
                Quando seus créditos acabarem, você precisa comprar mais para continuar gerando listas de separação e atualizando seu estoque.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Modal de pagamento PIX */}
        {payment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Pagamento via PIX</h3>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 text-yellow-800">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Código expira em 30 minutos</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">QR Code PIX</label>
                  {payment.qrCodeBase64 && (
                    <img 
                      src={`data:image/png;base64,${payment.qrCodeBase64}`} 
                      alt="QR Code PIX" 
                      className="mx-auto w-48 h-48"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Código Copia e Cola</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={payment.qrCode} 
                      readOnly 
                      className="flex-1 px-3 py-2 border rounded-lg text-sm bg-gray-50"
                    />
                    <button 
                      onClick={copyPixCode}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium transition"
                    >
                      {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={checkPayment}
                    disabled={checking}
                    className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    {checking ? 'Verificando...' : 'Já paguei'}
                  </button>
                  <button 
                    onClick={() => setPayment(null)}
                    className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pacotes */}
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Comprar Créditos</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {PACKAGES.map((pkg) => {
            const Icon = pkg.icon;
            const pricePerCredit = (pkg.price / pkg.credits).toFixed(3);
            
            return (
              <div key={pkg.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition">
                <div className={`${pkg.color} p-4 text-white`}>
                  <Icon className="w-8 h-8 mb-2" />
                  <h3 className="font-semibold text-lg">{pkg.name}</h3>
                </div>
                
                <div className="p-6">
                  <div className="text-center mb-6">
                    <div className="text-3xl font-bold text-gray-900">{pkg.credits}</div>
                    <div className="text-gray-500">créditos</div>
                  </div>
                  
                  <div className="text-center mb-6">
                    <div className="text-2xl font-bold text-blue-600">R$ {pkg.price.toFixed(2)}</div>
                    <div className="text-sm text-gray-500">R$ {pricePerCredit} por crédito</div>
                  </div>

                  <ul className="text-sm text-gray-600 space-y-2 mb-6">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      {pkg.credits} listas de picking
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Válido por 12 meses
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Pagamento via PIX
                    </li>
                  </ul>

                  <button 
                    onClick={() => handleBuy(pkg.id)}
                    disabled={loading}
                    className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    {loading ? 'Processando...' : 'Comprar Agora'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Histórico (placeholder) */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Como usar seus créditos</h3>
          <div className="text-gray-600 space-y-2 text-sm">
            <p>1. Um credito será consumido para cada sincronização de pedidos</p>
            <p>2. Selecione um pedido para gerar a lista de picking</p>
            <p>3. Clique em <strong>Abrir</strong> - Sua lista de separação será gerada e 1 crédito será consumido</p>
            <p>4. Imprima ou visualize a lista de separação</p>
          </div>
        </div>
      </div>
    </div>
  );
}
