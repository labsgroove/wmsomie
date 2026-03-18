// ui/src/App.jsx
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Package, Home, MapPin, Truck } from 'lucide-react';
import Dashboard from './pages/Dashboard.jsx';
import Stock from './pages/Stock.jsx';
import Picking from './pages/Picking.jsx';

function Navigation() {
  const location = useLocation();
  
  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-gray-900">WMS Omie</h1>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                to="/"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive('/')
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <Home className="w-4 h-4 mr-2" />
                Dashboard
              </Link>
              <Link
                to="/stock"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive('/stock')
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <Package className="w-4 h-4 mr-2" />
                Estoque
              </Link>
              <Link
                to="/picking"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive('/picking')
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <Truck className="w-4 h-4 mr-2" />
                Separação
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/picking" element={<Picking />} />
      </Routes>
    </BrowserRouter>
  );
}