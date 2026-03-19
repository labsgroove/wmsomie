// ui/src/pages/Picking.jsx
import { useState, useEffect } from 'react';
import { Package, MapPin, CheckCircle, Clock, Search, Play, Eye } from 'lucide-react';
import { orderApi } from '../services/api';

export default function Picking() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [pickingList, setPickingList] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const response = await orderApi.getOrders();
      setOrders(response.data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePicking = async (order) => {
    try {
      const response = await orderApi.getOrder(order._id);
      setPickingList(response.data);
      setSelectedOrder(order);
    } catch (error) {
      console.error('Error generating picking:', error);
    }
  };

  const completePicking = async () => {
    try {
      await orderApi.updateOrderStatus(selectedOrder._id, 'DONE');
      await loadOrders();
      setSelectedOrder(null);
      setPickingList(null);
    } catch (error) {
      console.error('Error completing picking:', error);
    }
  };

  const filteredOrders = orders.filter(order => 
    (order.omieId && order.omieId.toLowerCase().includes(searchTerm.toLowerCase())) ||
    order.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Separação de Pedidos</h1>
      
      {/* Lista de Pedidos */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Package className="w-6 h-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-800">Pedidos para Separar</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar pedidos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">Pedido #{order.omieId || 'Local'}</h3>
                  <p className="text-sm text-gray-600">{order.items?.length || 0} itens</p>
                </div>
                <div className="flex items-center">
                  {order.status === 'PENDING' ? (
                    <>
                      <Clock className="w-4 h-4 text-yellow-500 mr-1" />
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        Pendente
                      </span>
                    </>
                  ) : order.status === 'PICKING' ? (
                    <>
                      <Play className="w-4 h-4 text-blue-500 mr-1" />
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        Separando
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Concluído
                      </span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => generatePicking(order)}
                  disabled={order.status === 'DONE'}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Ver Picking
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nenhum pedido encontrado</p>
          </div>
        )}
      </div>

      {/* Lista de Picking */}
      {pickingList && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Package className="w-6 h-6 text-green-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-800">
                Lista de Picking - Pedido #{pickingList.omieId}
              </h2>
            </div>
            <button
              onClick={completePicking}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Concluir Separação
            </button>
          </div>

          <div className="space-y-4">
            {pickingList.items?.map((item, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {item.product?.descricao || item.product?.name || 'N/A'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      SKU: {item.product?.codigo || item.product?.sku || 'N/A'} | Quantidade: {item.quantity}
                    </p>
                    <div className="flex items-center mt-2">
                      <MapPin className="w-4 h-4 text-gray-400 mr-1" />
                      <span className="text-sm text-gray-700">
                        Local: {item.location?.name || 'Não endereçado'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                      onChange={(e) => {
                        // Lógica para marcar item como separado
                        console.log('Item marcado:', idx, e.target.checked);
                      }}
                    />
                    <label className="text-sm text-gray-600">Separado</label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}