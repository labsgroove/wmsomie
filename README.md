# WMS Omie

Sistema de Gerenciamento de Armazém (WMS) integrado com Omie API.

## Estrutura do Projeto

- **Backend**: Node.js + Express + MongoDB (porta 3000)
- **Frontend**: React + Vite (porta 5173)
- **Integração**: API Omie para sincronização de dados

## Instalação

### Instalar todas as dependências (backend + frontend):
```bash
npm run install:all
```

### Ou instalar separadamente:
```bash
# Backend
npm install

# Frontend
cd ui
npm install
```

## Execução

### Desenvolvimento (Backend + Frontend simultâneo):
```bash
npm run dev:all
```
Isso iniciará:
- Backend em http://localhost:3000
- Frontend em http://localhost:5173

### Parar serviços:
```bash
npm run stop
```

### Produção:
```bash
npm run start:all
```
Isso irá:
1. Buildar o frontend
2. Iniciar o backend em produção

### Executar serviços separadamente:

#### Backend apenas:
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

#### Frontend apenas:
```bash
cd ui

# Desenvolvimento
npm run dev

# Build para produção
npm run build
```

## Variáveis de Ambiente

Configure o arquivo `.env` na raiz do projeto:

```
PORT=3000
MONGODB_URI=sua_string_de_conexao_mongodb
OMIE_APP_KEY=sua_app_key_omie
OMIE_APP_SECRET=sua_app_secret_omie
```

## Funcionalidades

### Interface Intuitiva de Movimentos
- **Dashboard Principal**: Visualização em tempo real dos movimentos do Omie divididos em 3 áreas:
  - **Recebimento**: Produtos entrando no estoque
  - **Separação**: Pedidos aguardando separação
  - **Expedição**: Produtos sendo enviados
  - **Transferências Internas**: Movimentação entre locais

### Gestão de Estoque
- **Endereçamento de Produtos**: Todo produto que entra no estoque deve ser endereçado
- **Status Visual**: Indicadores claros de produtos endereçados vs pendentes
- **Edição Inline**: Atualização rápida de localizações diretamente na tabela

### Sistema de Picking
- **Lista de Pedidos**: Visualização de todos os pedidos com status (Pendente, Separando, Concluído)
- **Busca Integrada**: Filtro rápido por número do pedido ou status
- **Interface de Separação**: Checklist de itens com localizações e quantidades
- **Controle de Status**: Atualização automática do status do pedido

### Características Técnicas
- **Design Responsivo**: Interface moderna com TailwindCSS
- **Ícones Intuitivos**: Lucide React para melhor UX
- **Navegação Moderna**: Menu com indicadores de página ativa
- **Carregamento Assíncrono**: Experiência fluida com loading states

### Integração Omie
- Sincronização automática de dados
- Gestão de produtos e pedidos
- Movimentação de estoque em tempo real

## Comandos Úteis

- `npm run dev:all` - Inicia backend e frontend em desenvolvimento
- `npm run start:all` - Build e inicia em produção
- `npm run stop` - Para todos os serviços
- `npm run install:all` - Instala dependências de ambos os projetos
- `npm run seed` - Popula o banco com dados iniciais de teste
- `npm run seed:more` - Adiciona mais dados de teste (produtos, movimentos, pedidos)
- `npm run cleanup` - Remove coleções duplicadas e garante uso apenas do banco wmsomie

## Dados de Teste

O projeto inclui scripts automáticos para popular o banco de dados com dados realistas:

### Dados Iniciais (`npm run seed`)
- **10 Produtos**: Notebooks, mouses, teclados, monitores, etc.
- **10 Localizações**: Estrutura de armazém (A01-01-01, B01-01-01, etc.)
- **15 Movimentos**: Entradas, saídas e transferências
- **8 Registros de Estoque**: Produtos endereçados
- **5 Pedidos**: Com diferentes status (Pendente, Separando, Concluído)

### Dados Adicionais (`npm run seed:more`)
- **+20 Produtos**: Smartphones, tablets, fones, SSDs, etc.
- **+10 Localizações**: Expansão do armazém
- **+50 Movimentos**: Diversas operações
- **+15 Pedidos**: Mais exemplos para picking
- **Estoque Completo**: Todos os produtos com localização

### Estrutura dos Dados
- **Produtos**: Nome, SKU, ID Omie
- **Localizações**: Código estruturado (Corredor-Prateleira-Nível)
- **Movimentos**: IN (entrada), OUT (saída), TRANSFER (interna)
- **Pedidos**: Status PENDING → PICKING → DONE
- **Estoque**: Produto + Localização + Quantidade

## Manutenção do Banco de Dados

### Limpeza de Coleções (`npm run cleanup`)
Este script garante que apenas o banco de dados `wmsomie` seja utilizado:
- ✅ Remove coleções inválidas ou duplicadas
- ✅ Elimina o banco `wms` se existir
- ✅ Mantém apenas as coleções válidas: `products`, `locations`, `stocks`, `movements`, `orders`
- ✅ Exibe contagem de documentos para verificação

### Boas Práticas
1. **Antes de usar**: Execute `npm run cleanup` para garantir ambiente limpo
2. **Após testes**: Use `npm run cleanup` para remover dados de teste
3. **Em produção**: O script pode ser usado para manutenção periódica
