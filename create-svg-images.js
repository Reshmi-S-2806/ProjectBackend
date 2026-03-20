// create-svg-images.js
const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, 'frontend/src/assets/products');

// Create directory if it doesn't exist
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log('✅ Created directory:', imagesDir);
}

const products = [
    { id: 1, name: 'Smartphone X', category: 'Electronics', price: '₹59,999', color: '#3498db' },
    { id: 2, name: 'Laptop Pro', category: 'Electronics', price: '₹89,999', color: '#2ecc71' },
    { id: 3, name: 'Wireless Headphones', category: 'Fashion', price: '₹2,999', color: '#9b59b6' },
    { id: 4, name: 'Smart Watch', category: 'Fashion', price: '₹3,999', color: '#e67e22' },
    { id: 5, name: 'Tablet Plus', category: 'Electronics', price: '₹24,999', color: '#e74c3c' },
    { id: 6, name: 'Digital Camera', category: 'Electronics', price: '₹45,999', color: '#1abc9c' }
];

products.forEach(product => {
    // Create SVG content
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="400" fill="${product.color}" />
    <text x="50" y="150" font-family="Arial" font-size="24" font-weight="bold" fill="white">${product.name}</text>
    <text x="50" y="200" font-family="Arial" font-size="20" font-weight="bold" fill="white">${product.category}</text>
    <text x="50" y="280" font-family="Arial" font-size="28" font-weight="bold" fill="#ffd700">${product.price}</text>
    <text x="120" y="350" font-family="Arial" font-size="16" fill="white">🛒 ShopEasy</text>
    <circle cx="300" cy="100" r="40" fill="rgba(255,255,255,0.2)" />
    <circle cx="320" cy="80" r="15" fill="rgba(255,255,255,0.3)" />
</svg>`;
    
    // Save as SVG (works in all modern browsers)
    const svgPath = path.join(imagesDir, `product${product.id}.svg`);
    fs.writeFileSync(svgPath, svg);
    console.log(`✅ Created: product${product.id}.svg`);
    
    // Also create a simple text file as backup
    const txtPath = path.join(imagesDir, `product${product.id}.txt`);
    fs.writeFileSync(txtPath, `${product.name}\n${product.category}\n${product.price}\nShopEasy`);
    console.log(`✅ Created: product${product.id}.txt (backup)`);
});

console.log('\n🎉 All product images created as SVG!');
console.log('📁 Location:', imagesDir);
console.log('\n⚠️  IMPORTANT: Update your database to use .svg files:');
console.log('UPDATE products SET image_url = \'assets/products/product1.svg\' WHERE id = 1;');
console.log('UPDATE products SET image_url = \'assets/products/product2.svg\' WHERE id = 2;');
console.log('UPDATE products SET image_url = \'assets/products/product3.svg\' WHERE id = 3;');
console.log('UPDATE products SET image_url = \'assets/products/product4.svg\' WHERE id = 4;');
console.log('UPDATE products SET image_url = \'assets/products/product5.svg\' WHERE id = 5;');
console.log('UPDATE products SET image_url = \'assets/products/product6.svg\' WHERE id = 6;');