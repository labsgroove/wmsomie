fetch('http://localhost:3000/api/orders')
  .then(response => response.json())
  .then(orders => {
    console.log('Testando resposta da API:');
    
    // Pegar o primeiro pedido da Omie
    const omieOrder = orders.find(o => o.omieId && o.omieId.toString().match(/^\d+$/));
    
    if (omieOrder && omieOrder.items && omieOrder.items.length > 0) {
      const item = omieOrder.items[0];
      console.log('\n=== Pedido da Omie ===');
      console.log('Pedido ID:', omieOrder.omieId);
      console.log('Item product ID:', item.product);
      console.log('Item product type:', typeof item.product);
      
      if (typeof item.product === 'object') {
        console.log('Product object keys:', Object.keys(item.product));
        console.log('Product codigo:', item.product.codigo);
        console.log('Product descricao:', item.product.descricao);
        console.log('Product sku:', item.product.sku);
      }
    } else {
      console.log('Nenhum pedido da Omie encontrado com itens');
    }
  })
  .catch(error => console.error('Erro:', error));
