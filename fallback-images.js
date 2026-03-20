// fallback-images.js
const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, '../frontend/src/assets/products');

// Create directory
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Create HTML placeholders that actually work
const products = [
  { id: 1, name: 'Smartphone X', category: 'Electronics', price: '₹59,999' },
  { id: 2, name: 'Laptop Pro', category: 'Electronics', price: '₹89,999' },
  { id: 3, name: 'Wireless Headphones', category: 'Electronics/Fashion', price: '₹2,999' },
  { id: 4, name: 'Smart Watch', category: 'Electronics/Fashion', price: '₹3,999' },
  { id: 5, name: 'Tablet Plus', category: 'Electronics', price: '₹24,999' },
  { id: 6, name: 'Digital Camera', category: 'Electronics', price: '₹45,999' }
];

products.forEach(product => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin:0; padding:0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; color: white; text-align: center; }
    .container { padding: 20px; }
    h1 { font-size: 28px; margin-bottom: 10px; }
    p { font-size: 18px; opacity: 0.9; }
    .price { font-size: 24px; font-weight: bold; margin-top: 20px; color: #ffd700; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${product.name}</h1>
    <p>${product.category}</p>
    <div class="price">${product.price}</div>
    <p style="margin-top: 30px; font-size: 14px;">🛒 ShopEasy</p>
  </div>
</body>
</html>
  `;
  
  fs.writeFileSync(path.join(imagesDir, `product${product.id}.jpg`), html);
  console.log(`✅ Created product${product.id}.jpg`);
});

console.log('\n🎉 All product images created!');