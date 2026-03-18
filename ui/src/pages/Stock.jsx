// ui/src/pages/Stock.jsx
import { useState, useEffect } from 'react';
import { Package, MapPin, Edit2, Save, X } from 'lucide-react';
import { stockApi } from '../services/api';

export default function Stock() {
  const [stock, setStock] = useState([]);
  const [editing, setEditing] = useState(null);
  const [newLocation, setNewLocation] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStock();
  }, []);

  const loadStock = async () => {
    try {
      const response = await stockApi.getStock();
      setStock(response.data);
    } catch (error) {
      console.error('Error loading stock:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationUpdate = async (productId) => {
    try {
      await stockApi.updateLocation(productId, newLocation);
      await loadStock();
      setEditing(null);
      setNewLocation('');
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Gerenciamento de Estoque</h1>
      
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center mb-6">
          <Package className="w-6 h-6 text-blue-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-800">Produtos em Estoque</h2>
        </div>

        <div className="overflow-x-auto">
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
              {stock.map((item, idx) => (
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
                    {editing === item.product._id ? (
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
                          {item.location?.name || 'Não endereçado'}
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
                        Pendente
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {!item.location && (
                      <button
                        onClick={() => {
                          setEditing(item.product._id);
                          setNewLocation('');
                        }}
                        className="text-blue-600 hover:text-blue-900 flex items-center"
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Endereçar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
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