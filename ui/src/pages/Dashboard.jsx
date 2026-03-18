// ui/src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { Package, ArrowDown, ArrowUp, ArrowRight, Clock, CheckCircle } from 'lucide-react';
import { movementApi, orderApi } from '../services/api';

export default function Dashboard() {
  const [movements, setMovements] = useState({ inbound: [], outbound: [], transfer: [] });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('Carregando dados...');
      const [inboundRes, outboundRes, transferRes, ordersRes] = await Promise.all([
        movementApi.getInbound(),
        movementApi.getOutbound(),
        movementApi.getTransfer(),
        orderApi.getOrders()
      ]);
      
      console.log('Dados recebidos:', {
        inbound: inboundRes.data,
        outbound: outboundRes.data,
        transfer: transferRes.data,
        orders: ordersRes.data
      });
      
      setMovements({
        inbound: inboundRes.data,
        outbound: outboundRes.data,
        transfer: transferRes.data
      });
      setOrders(ordersRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Painel WMS - Movimentos Omie</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recebimento */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center mb-4">
            <ArrowDown className="w-6 h-6 text-green-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-800">Recebimento</h2>
          </div>
          <div className="space-y-3">
            {movements.inbound.slice(0, 5).map((movement, idx) => (
              <div key={idx} className="border-l-4 border-green-500 pl-4 py-2">
                <div className="text-sm font-medium text-gray-900">
                  Produto: {movement.product?.name || 'N/A'}
                </div>
                <div className="text-sm text-gray-600">
                  Qtd: {movement.quantity} | Local: {movement.toLocation?.name || 'Pendente'}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(movement.createdAt).toLocaleString('pt-BR')}
                </div>
              </div>
            ))}
            {movements.inbound.length === 0 && (
              <p className="text-gray-500 text-sm">Nenhum movimento de recebimento</p>
            )}
          </div>
        </div>

        {/* Separação */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center mb-4">
            <Package className="w-6 h-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-800">Separação</h2>
          </div>
          <div className="space-y-3">
            {orders.filter(order => order.status === 'PENDING').slice(0, 5).map((order, idx) => (
              <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="text-sm font-medium text-gray-900">
                  Pedido: {order.omieId}
                </div>
                <div className="text-sm text-gray-600">
                  Itens: {order.items?.length || 0}
                </div>
                <div className="flex items-center mt-1">
                  <Clock className="w-3 h-3 text-yellow-500 mr-1" />
                  <span className="text-xs text-yellow-600">Aguardando separação</span>
                </div>
              </div>
            ))}
            {orders.filter(order => order.status === 'PENDING').length === 0 && (
              <p className="text-gray-500 text-sm">Nenhum pedido pendente</p>
            )}
          </div>
        </div>

        {/* Expedição */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center mb-4">
            <ArrowUp className="w-6 h-6 text-red-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-800">Expedição</h2>
          </div>
          <div className="space-y-3">
            {movements.outbound.slice(0, 5).map((movement, idx) => (
              <div key={idx} className="border-l-4 border-red-500 pl-4 py-2">
                <div className="text-sm font-medium text-gray-900">
                  Produto: {movement.product?.name || 'N/A'}
                </div>
                <div className="text-sm text-gray-600">
                  Qtd: {movement.quantity} | Origem: {movement.fromLocation?.name || 'N/A'}
                </div>
                <div className="flex items-center mt-1">
                  <CheckCircle className="w-3 h-3 text-green-500 mr-1" />
                  <span className="text-xs text-green-600">Expedido</span>
                </div>
              </div>
            ))}
            {movements.outbound.length === 0 && (
              <p className="text-gray-500 text-sm">Nenhuma expedição</p>
            )}
          </div>
        </div>
      </div>

      {/* Transferências */}
      <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center mb-4">
          <ArrowRight className="w-6 h-6 text-purple-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-800">Transferências Internas</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {movements.transfer.slice(0, 6).map((movement, idx) => (
            <div key={idx} className="border border-purple-200 rounded-lg p-3 bg-purple-50">
              <div className="text-sm font-medium text-gray-900">
                {movement.product?.name || 'N/A'}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {movement.fromLocation?.name || 'N/A'} → {movement.toLocation?.name || 'N/A'}
              </div>
              <div className="text-xs text-purple-600 font-medium mt-1">
                Qtd: {movement.quantity}
              </div>
            </div>
          ))}
          {movements.transfer.length === 0 && (
            <p className="text-gray-500 text-sm col-span-full">Nenhuma transferência interna</p>
          )}
        </div>
      </div>
    </div>
  );
}