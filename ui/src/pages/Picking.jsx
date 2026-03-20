// ui/src/pages/Picking.jsx
import { useState, useEffect } from 'react';
import { Package, MapPin, CheckCircle, Clock, Search, Play, Eye, Printer } from 'lucide-react';
import { orderApi, pickingApi } from '../services/api';

export default function Picking() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [pickingList, setPickingList] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [generatingPicking, setGeneratingPicking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const response = await orderApi.getOrders();
      setOrders(response.data);
    } catch (error) {
      console.error('Error loading orders:', error);
      setError(error?.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePicking = async (order) => {
    try {
      setError('');
      setGeneratingPicking(true);

      // Gera picking para obter location em cada item.
      await pickingApi.createPicking(order._id);

      // A listagem já vem com populate (order, items.product e items.location).
      const pickingsRes = await pickingApi.listPickings();
      const picking = pickingsRes.data?.find(
        (p) => p.order?._id === order._id || (order.omieId && p.order?.omieId === order.omieId)
      );

      setPickingList(picking || null);
      setSelectedOrder(order);
    } catch (error) {
      console.error('Error generating picking:', error);
      setError(error?.response?.data?.error || error.message);
      // Fallback: exibir itens do pedido mesmo que não consiga gerar picking com local.
      try {
        const orderRes = await orderApi.getOrder(order._id);
        const orderData = orderRes.data;

        setSelectedOrder(orderData);
        setPickingList({
          order: { omieId: orderData.omieId },
          items: (orderData.items || []).map((it) => ({
            product: it.product,
            location: null,
            quantity: it.quantity
          }))
        });
      } catch (fallbackError) {
        console.error('Picking fallback error:', fallbackError);
        setPickingList(null);
      }
    }
    finally {
      setGeneratingPicking(false);
    }
  };

  const completePicking = async () => {
    try {
      if (!selectedOrder) return;
      await orderApi.updateOrderStatus(selectedOrder._id, 'DONE');
      await loadOrders();
      setSelectedOrder(null);
      setPickingList(null);
    } catch (error) {
      console.error('Error completing picking:', error);
      setError(error?.response?.data?.error || error.message);
    }
  };

  const printPicking = () => {
    // O CSS em `index.css` já esconde a UI interativa e mostra apenas `.print-only`.
    window.print();
  };

  const filteredOrders = orders.filter(order => 
    (order.omieId && order.omieId.toLowerCase().includes(searchTerm.toLowerCase())) ||
    order.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  }

  const orderNumber =
    pickingList?.order?.omieId ||
    selectedOrder?.omieId ||
    'Local';

  const items = pickingList?.items || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* UI interativa (oculta na hora de imprimir) */}
      <div className="no-print p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Separação de Pedidos</h1>

        <div className="flex gap-6">
          {/* Barra lateral esquerda: lista de pedidos */}
          <aside className="w-96 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-lg p-4 h-[calc(100vh-140px)] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <Package className="w-6 h-6 text-blue-600 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-800">Pedidos</h2>
                </div>
              </div>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar pedidos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="overflow-y-auto flex-1 pr-1 space-y-2">
                {filteredOrders.map((order) => {
                  const isSelected = selectedOrder?._id === order._id;
                  const disabled = order.status === 'DONE';

                  return (
                    <button
                      key={order._id}
                      type="button"
                      disabled={disabled}
                      onClick={() => generatePicking(order)}
                      className={[
                        'w-full text-left border rounded-lg p-3 transition-shadow',
                        disabled ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : 'border-gray-200 bg-white hover:shadow-md',
                        isSelected ? 'ring-2 ring-blue-500' : ''
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-gray-900">Pedido #{order.omieId || 'Local'}</div>
                          <div className="text-sm text-gray-600">{order.items?.length || 0} itens</div>
                        </div>

                        <div className="flex items-center">
                          {order.status === 'PENDING' ? (
                            <>
                              <Clock className="w-4 h-4 text-yellow-500 mr-1" />
                              <span className="px-2 py-1 text-[11px] font-medium rounded-full bg-yellow-100 text-yellow-800">
                                Pendente
                              </span>
                            </>
                          ) : order.status === 'PICKING' ? (
                            <>
                              <Play className="w-4 h-4 text-blue-500 mr-1" />
                              <span className="px-2 py-1 text-[11px] font-medium rounded-full bg-blue-100 text-blue-800">
                                Separando
                              </span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                              <span className="px-2 py-1 text-[11px] font-medium rounded-full bg-green-100 text-green-800">
                                Concluído
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center text-sm text-blue-700">
                        <Eye className="w-4 h-4 mr-1" />
                        <span>{disabled ? 'Finalizado' : generatingPicking && isSelected ? 'Gerando...' : 'Selecionar'}</span>
                      </div>
                    </button>
                  );
                })}

                {filteredOrders.length === 0 && (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Nenhum pedido encontrado</p>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Painel à direita: itens do pedido / lista de separação */}
          <section className="flex-1">
            {!pickingList ? (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="text-gray-700 text-sm">
                  Selecione um pedido na barra da esquerda para visualizar a lista de separação e imprimir.
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <Package className="w-6 h-6 text-green-600 mr-2" />
                    <h2 className="text-xl font-semibold text-gray-800">
                      Lista de Separação - Pedido #{orderNumber}
                    </h2>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={printPicking}
                      className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 flex items-center"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Imprimir
                    </button>

                    <button
                      type="button"
                      onClick={completePicking}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Concluir Separação
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
                    {error}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-2 px-3 font-medium">Produto</th>
                        <th className="py-2 px-3 font-medium">SKU</th>
                        <th className="py-2 px-3 font-medium">Local</th>
                        <th className="py-2 px-3 font-medium">Qtd</th>
                        <th className="py-2 px-3 font-medium">Separado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {items.map((item, idx) => (
                        <tr key={idx} className="align-top">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-gray-900">
                              {item.product?.descricao || item.product?.name || 'N/A'}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-gray-700">
                            {item.product?.codigo || item.product?.sku || 'N/A'}
                          </td>
                          <td className="py-3 px-3 text-gray-700">
                            <div className="flex items-center">
                              <MapPin className="w-4 h-4 text-gray-400 mr-1" />
                              <span>
                                {item.location?.description || item.location?.code || 'Não endereçado'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-gray-700">{item.quantity}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                onChange={() => {}}
                              />
                              <span className="text-sm text-gray-600">Separado</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 px-3 text-gray-500 text-center">
                            Nenhum item na lista de separação.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Área de impressão (apenas essa aparece no PDF) */}
      <div className="print-only p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-sm text-gray-600 mb-2">
            WMS Omie
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Lista de Separação
          </h2>

          <div className="text-sm text-gray-700 mb-6">
            Pedido: <span className="font-semibold">{orderNumber}</span>
            <span className="mx-2">|</span>
            Emitido em: <span className="font-semibold">{new Date().toLocaleString('pt-BR')}</span>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left">Produto</th>
                <th className="border border-gray-300 px-2 py-2 text-left">SKU</th>
                <th className="border border-gray-300 px-2 py-2 text-left">Local</th>
                <th className="border border-gray-300 px-2 py-2 text-right">Qtd</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td className="border border-gray-300 px-2 py-2 align-top">
                    <div className="font-semibold">{item.product?.descricao || 'N/A'}</div>
                  </td>
                  <td className="border border-gray-300 px-2 py-2 align-top">
                    {item.product?.codigo || 'N/A'}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 align-top">
                    {item.location?.description || item.location?.code || 'Não endereçado'}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-right">
                    {item.quantity}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="border border-gray-300 px-2 py-6 text-center text-gray-500">
                    Nenhum item para imprimir.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}