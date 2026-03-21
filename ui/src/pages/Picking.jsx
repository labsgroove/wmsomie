// ui/src/pages/Picking.jsx
import { useState, useEffect } from 'react';
import { Package, MapPin, CheckCircle, Clock, Search, Play, Eye, Printer, RefreshCw } from 'lucide-react';
import { orderApi, pickingApi, syncApi } from '../services/api';

// Função para ordenar itens por localização
function sortItemsByLocation(items) {
  return items.sort((a, b) => {
    try {
      const locA = a.location?.code || '';
      const locB = b.location?.code || '';
      
      if (!locA && !locB) return 0;
      if (!locA) return 1; // Item sem localização vai para o final
      if (!locB) return -1; // Item sem localização vai para o final
      
      // Parse dos códigos de localização
      const parseCode = (code) => {
        const trimmed = code.trim().toUpperCase();
        
        // Regex para formatos comuns
        const patterns = [
          // Formato: AA1, AB2, CD3 (letras + números)
          /^([A-Z]+)(\d+)$/,
          // Formato: RACK-01-POS-A
          /^.*?(\d+).*?([A-Z]+).*?(\d+)$/,
          // Formato: PISO1-A1
          /^(\d+)-([A-Z]+)(\d+)$/,
          // Formato: 1-A-01
          /^(\d+)-([A-Z]+)-(\d+)$/
        ];
        
        for (const pattern of patterns) {
          const match = trimmed.match(pattern);
          if (match) {
            if (match.length === 3) {
              // Formato simples: letras + números
              return {
                aisle: match[1],
                position: parseInt(match[2]),
                level: 0,
                zone: null
              };
            } else if (match.length === 4) {
              // Formato complexo: zona + corredor + posição
              return {
                zone: match[1],
                aisle: match[2],
                position: parseInt(match[3]),
                level: 0
              };
            }
          }
        }
        
        // Fallback
        return {
          aisle: trimmed,
          position: 0,
          level: 0,
          zone: null
        };
      };
      
      const parsedA = parseCode(locA);
      const parsedB = parseCode(locB);
      
      // Primeiro ordena por zona (se existir)
      if (parsedA.zone && parsedB.zone) {
        const zoneCompare = parsedA.zone.localeCompare(parsedB.zone);
        if (zoneCompare !== 0) return zoneCompare;
      } else if (parsedA.zone) {
        return 1;
      } else if (parsedB.zone) {
        return -1;
      }
      
      // Depois por corredor
      const aisleCompare = parsedA.aisle.localeCompare(parsedB.aisle);
      if (aisleCompare !== 0) return aisleCompare;
      
      // Depois por posição
      if (parsedA.position !== parsedB.position) {
        return parsedA.position - parsedB.position;
      }
      
      // Finalmente por nível
      return parsedA.level - parsedB.level;
    } catch (error) {
      // Fallback para ordenação alfabética
      return (a.location?.code || '').localeCompare(b.location?.code || '');
    }
  });
}

export default function Picking() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [pickingList, setPickingList] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [generatingPicking, setGeneratingPicking] = useState(false);
  const [error, setError] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [isUnifiedPicking, setIsUnifiedPicking] = useState(false);
  const [syncingOrders, setSyncingOrders] = useState(false);

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
      setIsUnifiedPicking(false);

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

  const generateUnifiedPicking = async () => {
    const selectedOrders = orders.filter((o) => selectedOrderIds.has(o._id));
    if (selectedOrders.length === 0) return;

    try {
      setError('');
      setGeneratingPicking(true);
      setIsUnifiedPicking(true);
      setPickingList(null);

      // Gera picking para cada pedido selecionado.
      for (const ord of selectedOrders) {
        // Pode lançar erro para algum pedido; deixamos cair no catch global.
        // Se quiser resiliência por pedido, podemos ajustar para try/catch por item.
        await pickingApi.createPicking(ord._id);
      }

      const pickingsRes = await pickingApi.listPickings();
      const pickings = pickingsRes.data || [];

      // Para cada pedido, pega o picking mais recente (evita retornar picking antigo).
      const latestByOrderId = new Map();
      for (const ord of selectedOrders) {
        const related = pickings.filter((p) => p.order?._id === ord._id);
        related.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        latestByOrderId.set(ord._id, related[0] || null);
      }

      // Unifica itens (agrupa por produto + local, somando quantidades).
      const grouped = new Map();

      const addItem = (item) => {
        const productSku = item.product?.codigo || item.product?.sku || item.product?._id || 'unknown';
        const locationKey = item.location?.code || item.location?._id || 'NO_LOCATION';
        const key = `${productSku}|${locationKey}`;

        if (!grouped.has(key)) {
          grouped.set(key, {
            product: item.product || null,
            location: item.location || null,
            quantity: 0
          });
        }

        grouped.get(key).quantity += item.quantity || 0;
      };

      for (const ord of selectedOrders) {
        const picking = latestByOrderId.get(ord._id);
        if (!picking?.items) continue;
        picking.items.forEach(addItem);
      }

      setPickingList({
        order: { omieId: `Unificada (${selectedOrders.length} pedidos)` },
        items: Array.from(grouped.values())
      });
      setSelectedOrder(selectedOrders[0]);
    } catch (err) {
      console.error('Error generating unified picking:', err);
      setError(err?.response?.data?.error || err.message || 'Erro ao gerar picking unificado');
      setIsUnifiedPicking(false);
      setPickingList(null);
    } finally {
      setGeneratingPicking(false);
    }
  };

  const syncOrders = async () => {
    try {
      setSyncingOrders(true);
      setError('');
      const response = await syncApi.syncOrders();
      await loadOrders();
      alert(`Sincronização concluída! ${response.data.syncedCount} pedidos sincronizados.`);
    } catch (err) {
      console.error('Error syncing orders:', err);
      setError(err?.response?.data?.error || err.message || 'Erro ao sincronizar pedidos');
    } finally {
      setSyncingOrders(false);
    }
  };

  const completePicking = async () => {
    try {
      if (isUnifiedPicking) {
        const ids = Array.from(selectedOrderIds);
        if (ids.length === 0) return;
        await Promise.all(ids.map((id) => orderApi.updateOrderStatus(id, 'DONE')));
      } else {
        if (!selectedOrder) return;
        await orderApi.updateOrderStatus(selectedOrder._id, 'DONE');
      }
      await loadOrders();
      setSelectedOrder(null);
      setPickingList(null);
      setIsUnifiedPicking(false);
      setSelectedOrderIds(new Set());
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

  const items = sortItemsByLocation(pickingList?.items || []);
  const selectedCount = selectedOrderIds.size;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* UI interativa (oculta na hora de imprimir) */}
      <div className="no-print p-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Separação de Pedidos</h1>
          <button
            type="button"
            onClick={syncOrders}
            disabled={syncingOrders}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncingOrders ? 'animate-spin' : ''}`} />
            {syncingOrders ? 'Sincronizando...' : 'Sincronizar Pedidos'}
          </button>
        </div>

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

              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-xs text-gray-600">
                  Selecionados: <span className="font-semibold">{selectedCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOrderIds(new Set())}
                    disabled={selectedCount === 0 || generatingPicking}
                    className="px-3 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    onClick={generateUnifiedPicking}
                    disabled={selectedCount === 0 || generatingPicking}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Unificar
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 pr-1 space-y-2">
                {filteredOrders.map((order) => {
                  const disabled = order.status === 'DONE';
                  const isChecked = selectedOrderIds.has(order._id);

                  return (
                    <div
                      key={order._id}
                      className={[
                        'w-full border rounded-lg p-3 transition-shadow',
                        disabled ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white hover:shadow-md',
                        isChecked ? 'ring-2 ring-blue-500' : ''
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={disabled}
                            checked={isChecked}
                            onChange={() => {
                              if (disabled) return;
                              setSelectedOrderIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(order._id)) next.delete(order._id);
                                else next.add(order._id);
                                return next;
                              });
                              // Se o usuário estiver unificando, manter seleção pode fazer sentido,
                              // então não alteramos `isUnifiedPicking` aqui.
                            }}
                            className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                          />

                          <div>
                            <div className="font-semibold text-gray-900">Pedido #{order.omieId || 'Local'}</div>
                            <div className="text-sm text-gray-600">{order.items?.length || 0} itens</div>
                          </div>
                        </label>

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

                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-sm text-blue-700">
                          <Eye className="w-4 h-4 inline-block mr-1 -mt-0.5 text-blue-700" />
                          <span>{disabled ? 'Finalizado' : 'Ver picking'}</span>
                        </div>
                        <button
                          type="button"
                          disabled={disabled || generatingPicking}
                          onClick={() => generatePicking(order)}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Abrir
                        </button>
                      </div>
                    </div>
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
                      {isUnifiedPicking ? `Lista de Separação Unificada` : `Lista de Separação - Pedido #${orderNumber}`}
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
            {isUnifiedPicking ? 'Pedidos' : 'Pedido'}: <span className="font-semibold">{orderNumber}</span>
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