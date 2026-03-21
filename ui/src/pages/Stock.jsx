// ui/src/pages/Stock.jsx
import { useState, useEffect } from 'react';
import { Package, MapPin, Edit2, Save, X, Search, RefreshCw, ArrowRight } from 'lucide-react';
import { stockApi } from '../services/api';

export default function Stock() {
  const [stock, setStock] = useState([]);
  const [filteredStock, setFilteredStock] = useState([]);
  const [editing, setEditing] = useState(null);
  const [newLocation, setNewLocation] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [moving, setMoving] = useState(null);
  const [moveData, setMoveData] = useState({ fromLocation: '', toLocation: '', quantity: 1 });

  useEffect(() => {
    loadStock();
  }, []);

  useEffect(() => {
    const filtered = stock.filter(item => 
      item.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product?.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location?.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location?.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredStock(filtered);
  }, [stock, searchTerm]);

  const loadStock = async () => {
    try {
      console.log('Carregando dados de estoque...');
      const response = await stockApi.getStock();
      console.log('Resposta da API de estoque:', response.status);
      console.log('Dados brutos do estoque:', response.data);
      console.log('Estrutura do primeiro item:', response.data[0]);
      setStock(response.data || []);
    } catch (error) {
      console.error('Error loading stock:', error);
      console.error('Detalhes do erro:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationUpdate = async (productId) => {
    // Verificar se o campo de localização está preenchido
    if (!newLocation || newLocation.trim() === '') {
      console.error('Location field is empty');
      alert('Por favor, digite uma localização antes de salvar.');
      return;
    }

    try {
      console.log('Atualizando localização do produto...', { productId, newLocation });
      const response = await stockApi.updateLocation(productId, newLocation.trim());
      console.log('Resposta da API de atualização de localização:', response.status);
      console.log('Dados brutos da atualização de localização:', response.data);
      
      // Mostrar feedback de sucesso
      alert('Localização atualizada com sucesso!');
      
      await loadStock();
      setEditing(null);
      setNewLocation('');
    } catch (error) {
      console.error('Error updating location:', error);
      console.error('Detalhes do erro:', error.response?.data || error.message);
      
      // Mostrar feedback de erro
      alert(`Erro ao atualizar localização: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleSyncWithOmie = async () => {
    setSyncing(true);
    try {
      const response = await stockApi.syncWithOmie();
      console.log('Sincronização com Omie:', response.data);
      await loadStock();
    } catch (error) {
      console.error('Error syncing with Omie:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleInternalMove = async (itemIndex) => {
    const item = filteredStock[itemIndex];
    
    // Verificar se todos os campos estão preenchidos
    if (!moveData.fromLocation || !moveData.toLocation || !moveData.quantity) {
      alert('Por favor, preencha todos os campos para mover o produto.');
      return;
    }

    if (moveData.fromLocation === moveData.toLocation) {
      alert('A localização de origem e destino devem ser diferentes.');
      return;
    }

    try {
      console.log('Movendo produto...', { productId: item.product._id, moveData });
      const response = await stockApi.transfer(item.product._id, moveData.fromLocation, moveData.toLocation, moveData.quantity);
      console.log('Movimentação interna:', response.data);
      
      // Mostrar feedback de sucesso
      alert('Produto movido com sucesso!');
      
      await loadStock();
      setMoving(null);
      setMoveData({ fromLocation: '', toLocation: '', quantity: 1 });
    } catch (error) {
      console.error('Error in internal move:', error);
      console.error('Detalhes do erro:', error.response?.data || error.message);
      
      // Mostrar feedback de erro
      alert(`Erro ao mover produto: ${error.response?.data?.error || error.message}`);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Gerenciamento de Estoque</h1>
      
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Package className="w-6 h-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-800">Produtos em Estoque</h2>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Pesquisar produto, SKU ou localização..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleSyncWithOmie}
              disabled={syncing}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar com Omie'}
            </button>
          </div>
        </div>

        {/* Layout Desktop - Tabela */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Produto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Localização
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStock.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {item.product?.name || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-500">
                      SKU: {item.product?.sku || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{item.quantity}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editing === idx ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={newLocation}
                          onChange={(e) => setNewLocation(e.target.value)}
                          placeholder="Nova localização"
                          className="block w-32 px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => handleLocationUpdate(item.product._id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditing(null);
                            setNewLocation('');
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 text-gray-400 mr-1" />
                        <span className="text-sm text-gray-900">
                          {item.location?.code || item.location?.description || 'Não endereçado'}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.location ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Endereçado
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Não endereçado
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {moving === idx ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          placeholder="De"
                          value={moveData.fromLocation}
                          onChange={(e) => setMoveData({...moveData, fromLocation: e.target.value})}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Para"
                          value={moveData.toLocation}
                          onChange={(e) => setMoveData({...moveData, toLocation: e.target.value})}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <input
                          type="number"
                          min="1"
                          max={item.quantity}
                          value={moveData.quantity}
                          onChange={(e) => setMoveData({...moveData, quantity: parseInt(e.target.value) || 1})}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <button
                          onClick={() => handleInternalMove(idx)}
                          className="text-green-600 hover:text-green-900"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setMoving(null);
                            setMoveData({ fromLocation: '', toLocation: '', quantity: 1 });
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        {!item.location && (
                          <button
                            onClick={() => {
                              // Verificar se já está editando outro item do mesmo produto
                              const sameProductItems = filteredStock.filter(i => 
                                i.product._id === item.product._id && i.location
                              );
                              
                              if (sameProductItems.length > 0) {
                                alert(`Este produto já está endereçado em ${sameProductItems.length} localização(ões). Edite uma por vez.`);
                                return;
                              }
                              
                              setEditing(idx);
                              setNewLocation('');
                            }}
                            className="text-blue-600 hover:text-blue-900 flex items-center"
                          >
                            <Edit2 className="w-4 h-4 mr-1" />
                            Endereçar
                          </button>
                        )}
                        {item.location && (
                          <button
                            onClick={() => {
                              setMoving(idx);
                              setMoveData({ fromLocation: item.location?.code || '', toLocation: '', quantity: 1 });
                            }}
                            className="text-purple-600 hover:text-purple-900 flex items-center"
                          >
                            <ArrowRight className="w-4 h-4 mr-1" />
                            Mover
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Layout Mobile - Cards */}
        <div className="lg:hidden space-y-4">
          {filteredStock.map((item, idx) => (
            <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm">{item.product?.name || 'N/A'}</h3>
                  <p className="text-xs text-gray-500 mt-1">SKU: {item.product?.sku || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-600">{item.quantity}</div>
                  <div className="text-xs text-gray-500">unidades</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Localização:</span>
                  {editing === idx ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={newLocation}
                        onChange={(e) => setNewLocation(e.target.value)}
                        placeholder="Nova localização"
                        className="block w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => handleLocationUpdate(item.product._id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        <Save className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          setEditing(null);
                          setNewLocation('');
                        }}
                        className="text-red-600 hover:text-red-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <MapPin className="w-3 h-3 text-gray-400 mr-1" />
                      <span className="text-xs text-gray-900">
                        {item.location?.code || item.location?.description || 'Não endereçado'}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Status:</span>
                  {item.location ? (
                    <span className="px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full bg-green-100 text-green-800">
                      Endereçado
                    </span>
                  ) : (
                    <span className="px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Não endereçado
                    </span>
                  )}
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                  {moving === idx ? (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          placeholder="De"
                          value={moveData.fromLocation}
                          onChange={(e) => setMoveData({...moveData, fromLocation: e.target.value})}
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                        />
                        <ArrowRight className="w-3 h-3 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Para"
                          value={moveData.toLocation}
                          onChange={(e) => setMoveData({...moveData, toLocation: e.target.value})}
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          max={item.quantity}
                          value={moveData.quantity}
                          onChange={(e) => setMoveData({...moveData, quantity: parseInt(e.target.value) || 1})}
                          className="w-16 px-2 py-1 text-xs border border-gray-300 rounded"
                          placeholder="Qtd"
                        />
                        <button
                          onClick={() => handleInternalMove(idx)}
                          className="flex-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => {
                            setMoving(null);
                            setMoveData({ fromLocation: '', toLocation: '', quantity: 1 });
                          }}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex space-x-2">
                      {!item.location && (
                        <button
                          onClick={() => {
                            // Verificar se já está editando outro item do mesmo produto
                            const sameProductItems = filteredStock.filter(i => 
                              i.product._id === item.product._id && i.location
                            );
                            
                            if (sameProductItems.length > 0) {
                              alert(`Este produto já está endereçado em ${sameProductItems.length} localização(ões). Edite uma por vez.`);
                              return;
                            }
                            
                            setEditing(idx);
                            setNewLocation('');
                          }}
                          className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center"
                        >
                          <Edit2 className="w-3 h-3 mr-1" />
                          Endereçar
                        </button>
                      )}
                      {item.location && (
                        <button
                          onClick={() => {
                            setMoving(idx);
                            setMoveData({ fromLocation: item.location?.code || '', toLocation: '', quantity: 1 });
                          }}
                          className="flex-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center justify-center"
                        >
                          <ArrowRight className="w-3 h-3 mr-1" />
                          Mover
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {stock.length === 0 && (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum produto em estoque</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}