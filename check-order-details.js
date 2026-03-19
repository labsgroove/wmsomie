fetch('http://localhost:3000/api/orders')
  .then(response => response.json())
  .then(orders => {
    console.log('Verificando detalhes dos pedidos:');
    
    orders.slice(0, 2).forEach((order, idx) => {
      console.log(`\n=== Pedido ${idx + 1} ===`);
      console.log('ID:', order._id);
      console.log('OmieID:', order.omieId);
      console.log('Status:', order.status);
      console.log('Itens:', order.items?.length || 0);
      
      if (order.items && order.items.length > 0) {
        order.items.forEach((item, itemIdx) => {
          console.log(`\n  Item ${itemIdx + 1}:`);
          console.log('    - Product ID:', item.product);
          console.log('    - Product Object:', item.product ? 'exists' : 'null');
          console.log('    - Quantity:', item.quantity);
          
          if (item.product) {
            console.log('    - Product Name:', item.product.name || item.product.descricao || 'N/A');
            console.log('    - Product SKU:', item.product.sku || item.product.codigo || 'N/A');
            console.log('    - Product OmieID:', item.product.omieId || 'N/A');
          }
        });
      }
    });
  })
  .catch(error => console.error('Erro:', error));
