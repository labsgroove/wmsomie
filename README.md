# WMS Omie

Sistema de Gerenciamento de Armazém (WMS) integrado com Omie API.

## 🚀 Instalação

### Pré-requisitos
- Node.js 18+
- MongoDB
- Credenciais da API Omie

### Instalar dependências
```bash
npm run install:all
```

### Configurar variáveis de ambiente
```bash
cp .env.example .env
```

Edite o arquivo `.env`:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/wmsomie
OMIE_APP_KEY=sua_app_key_omie
OMIE_APP_SECRET=sua_app_secret_omie
```

## 🏃‍♂️ Execução

### Desenvolvimento (Backend + Frontend)
```bash
npm run dev:all
```
- Backend: http://localhost:3000
- Frontend: http://localhost:5173

### Produção
```bash
npm run start:all
```

### Parar serviços
```bash
npm run stop
```

## 📋 Funcionalidades

- **Gestão de Estoque**: Controlar entrada, saída e transferências
- **Sistema de Picking**: Separação de pedidos com checklist
- **Endereçamento**: Localização automática de produtos
- **Integração Omie**: Sincronização automática de dados
- **Dashboard**: Interface moderna com React + TailwindCSS

## 🔧 Comandos Úteis

```bash
npm run seed          # Popular banco com dados de teste
npm run cleanup       # Limpar banco de dados
npm run dev           # Apenas backend em desenvolvimento
npm start             # Apenas backend em produção
```

## 📊 Estrutura

- **Backend**: Node.js + Express + MongoDB
- **Frontend**: React + Vite + TailwindCSS
- **Integração**: API Omie para sincronização

## 🔗 Endpoints Principais

- `GET /api/products` - Listar produtos
- `GET /api/locations` - Listar localizações
- `GET /api/movements` - Listar movimentações
- `GET /api/orders` - Listar pedidos
- `POST /api/sync/full` - Sincronização completa com Omie

## 📝 Licença

MIT
