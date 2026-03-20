# WMS Omie Integration

Sistema de Warehouse Management System (WMS) integrado com a API Omie para gestão completa de estoque, pedidos e picking.

## 🚀 Funcionalidades

### ✅ Integração Omie
- **Webhook Omie**: Recebe eventos em tempo real da Omie
- **Sincronização de Produtos**: Importa e mantém produtos atualizados
- **Sincronização de Pedidos**: Sincroniza pedidos automaticamente
- **Sincronização de Estoque**: Mantém estoque alinhado com Omie
- **Ajustes de Estoque**: Processa ajustes de estoque via webhook

### 📦 Gestão de Estoque
- **Controle de Localizações**: Sistema de endereçamento de estoque
- **Controle de Lotes**: Rastreamento de lotes e validade
- **Reserva de Estoque**: Sistema inteligente de reserva
- **Transferências**: Movimentação entre localizações
- **Ajustes Manuais**: Ajustes de estoque com motivo

### 🛒 Gestão de Pedidos
- **Importação Automática**: Pedidos sincronizados da Omie
- **Status Tracking**: Acompanhamento de status dos pedidos
- **Itens do Pedido**: Gestão detalhada de itens
- **Validação de Estoque**: Verificação automática de disponibilidade

### 📋 Picking e Separação
- **Geração Automática**: Picking gerado automaticamente para pedidos confirmados
- **Alocação Inteligente**: Sugestão de melhores localizações
- **Otimização de Rotas**: Ordenação eficiente de localizações
- **Confirmação de Picking**: Baixa automática de estoque
- **Relatórios**: Relatórios de separação

## 🛠️ Instalação

### Pré-requisitos
- Node.js 18+
- MongoDB 5.0+
- npm ou yarn

### Configuração
1. Clone o repositório:
```bash
git clone <repository-url>
cd wmsomie
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:
```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/wmsomie

# Omie API
OMIE_APP_ID=seu_app_id
OMIE_APP_SECRET=seu_app_secret

# Webhook
OMIE_WEBHOOK_SECRET=sua_webhook_secret

# Porta do servidor
PORT=3000
```

### Execução
1. Inicie o MongoDB:
```bash
mongod
```

2. Inicie a aplicação:
```bash
npm start
```

A aplicação estará disponível em `http://localhost:3000`

## 📡 Configuração do Webhook Omie

### 1. Configure o Webhook na Omie
- Acesse o painel Omie
- Vá em: Desenvolvedores > Webhooks
- Configure a URL: `https://seu-dominio.com/api/webhook/omie`
- Adicione os seguintes eventos:
  - `Produto.AjusteEstoque`
  - `pedido.confirmado`
  - `estoque.baixado`
  - `estoque.acrescido`
  - `estoque.transferido`

### 2. Eventos Suportados
- **Produto.AjusteEstoque**: Ajustes de estoque manual
- **pedido.confirmado**: Confirmação de pedidos
- **estoque.baixado**: Baixa de estoque
- **estoque.acrescido**: Acréscimo de estoque
- **estoque.transferido**: Transferência entre locais

## 📚 API Endpoints

### Pedidos
- `GET /api/orders` - Listar pedidos
- `GET /api/orders/:id` - Obter pedido específico

### Produtos
- `GET /api/products` - Listar produtos
- `GET /api/products/:id` - Obter produto específico

### Estoque
- `GET /api/stock` - Listar estoque
- `GET /api/stock/available/:sku` - Estoque disponível por SKU
- `GET /api/stock/allocation/:sku` - Sugestão de alocação
- `POST /api/stock/receiving` - Adicionar estoque em recebimento
- `POST /api/stock/transfer` - Transferir estoque

### Picking
- `GET /api/picking` - Listar pickings
- `GET /api/picking/:id` - Obter picking específico
- `POST /api/picking/:orderId` - Gerar picking para pedido
- `POST /api/picking/:id/reserve` - Reservar estoque
- `POST /api/picking/:id/confirm` - Confirmar picking
- `POST /api/picking/:id/cancel` - Cancelar picking

### Localizações
- `GET /api/locations` - Listar localizações
- `GET /api/locations/:id` - Obter localização específica

### Webhook
- `POST /api/webhook/omie` - Receber eventos da Omie
- `GET /api/webhook/events` - Listar eventos recebidos

### Sincronização
- `POST /api/sync/stock/from-omie` - Sincronizar estoque da Omie
- `POST /api/sync/orders/from-omie` - Sincronizar pedidos da Omie

## 🔄 Fluxo de Trabalho

### 1. Recebimento de Produtos
1. Produto é cadastrado na Omie
2. Webhook `Produto.AjusteEstoque` é recebido
3. Produto é sincronizado localmente
4. Estoque é atualizado automaticamente

### 2. Processamento de Pedidos
1. Pedido é criado/confirmado na Omie
2. Webhook `pedido.confirmado` é recebido
3. Pedido é sincronizado localmente
4. Picking é gerado automaticamente
5. Estoque é reservado

### 3. Separação e Expedição
1. Operador acessa o picking
2. Sistema sugere melhores localizações
3. Operador confirma separação
4. Estoque é baixado automaticamente
5. Pedido é atualizado na Omie

## 🎯 Características Técnicas

### Arquitetura
- **Backend**: Node.js + Express.js
- **Banco de Dados**: MongoDB com Mongoose
- **API**: RESTful com JSON
- **Webhooks**: Event-driven architecture

### Segurança
- **Validação de Webhook**: HMAC-SHA256
- **CORS**: Configurado para domínios específicos
- **Rate Limiting**: Proteção contra abuso
- **Input Validation**: Validação de dados

### Performance
- **Índices MongoDB**: Otimizados para consultas
- **Caching**: Cache de dados frequentes
- **Async Processing**: Processamento assíncrono de webhooks
- **Batch Operations**: Operações em lote

## 🔧 Manutenção

### Logs
- **Application Logs**: Console e arquivo
- **Webhook Logs**: Registro de todos os eventos
- **Error Logs**: Detalhamento de erros
- **Performance Logs**: Métricas de performance

### Backup
- **MongoDB Backup**: Automático diário
- **Config Backup**: Versionamento de configurações
- **Log Rotation**: Limpeza automática de logs antigos

### Monitoramento
- **Health Checks**: Endpoints de verificação
- **Metrics**: Métricas de uso e performance
- **Alerts**: Notificação de problemas críticos

## 🐛 Troubleshooting

### Problemas Comuns

#### Webhook não está recebendo eventos
- Verifique se a URL está correta e acessível
- Confirme os eventos selecionados na Omie
- Verifique o secret do webhook

#### Estoque não sincronizando
- Verifique as credenciais da Omie
- Confirme se o produto existe na Omie
- Verifique os logs de erro

#### Picking não está sendo gerado
- Verifique se o pedido está confirmado
- Confirme se há estoque disponível
- Verifique se o produto tem localização definida

### Logs Úteis
```bash
# Ver logs da aplicação
npm run logs

# Ver logs de webhook
grep "webhook" logs/app.log

# Ver erros recentes
grep "ERROR" logs/app.log | tail -20
```

## 📈 Escalabilidade

### Horizontal Scaling
- **Load Balancer**: Nginx ou similar
- **Multiple Instances**: Cluster Node.js
- **Database Sharding**: MongoDB sharding
- **Redis Cache**: Cache distribuído

### Vertical Scaling
- **CPU**: Multi-core processing
- **Memory**: Otimização de uso de memória
- **Storage**: SSD para melhor performance
- **Network**: CDN para assets estáticos

## 🤝 Contribuição

### Development Setup
1. Fork o repositório
2. Crie branch de feature: `git checkout -b feature/nova-funcionalidade`
3. Faça as alterações
4. Teste: `npm test`
5. Commit: `git commit -m "Add nova funcionalidade"`
6. Push: `git push origin feature/nova-funcionalidade`
7. Pull Request

### Code Style
- **ESLint**: Configurado e obrigatório
- **Prettier**: Formatação automática
- **Conventional Commits**: Padrão de mensagens
- **TypeScript**: Migrando progressivamente

## 📄 Licença

MIT License - Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 📞 Suporte

- **Issues**: GitHub Issues
- **Email**: support@empresa.com
- **Documentação**: [Wiki do Projeto](wiki-url)
- **Status**: [Status Page](status-url)

---

## 🎉 Resumo da Instalação

Este sistema WMS Omie está **100% funcional** e pronto para uso em produção:

✅ **Webhook Omie**: Configurado e processando eventos em tempo real  
✅ **Sincronização Automática**: Produtos, pedidos e estoque  
✅ **Geração de Picking**: Automática para pedidos confirmados  
✅ **Gestão de Estoque**: Completa com localizações e reservas  
✅ **API RESTful**: Completa e documentada  
✅ **Segurança**: Validação e proteção implementadas  
✅ **Performance**: Otimizada para alto volume  

**O sistema está pronto para operação!** 🚀
