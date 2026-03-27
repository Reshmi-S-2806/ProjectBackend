// test-cart-api.js
const fetch = require('node-fetch');

async function testCartAPI() {
    console.log('🔍 Testing Cart API\n');
    
    // First login to get token
    console.log('1. Logging in...');
    const loginResponse = await fetch('http://localhost:30002/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'superadmin@shopeasy.com',
            password: 'Superadmin$123',
            otp: '1234'
        })
    });
    
    const loginData = await loginResponse.json();
    
    if (!loginResponse.ok) {
        console.log('❌ Login failed:', loginData.error);
        return;
    }
    
    console.log('✅ Login successful');
    console.log('📝 Token:', loginData.token.substring(0, 30) + '...');
    
    // Test cart with token
    console.log('\n2. Testing cart API with token...');
    const cartResponse = await fetch('http://localhost:30002/api/cart', {
        headers: {
            'Authorization': `Bearer ${loginData.token}`
        }
    });
    
    if (cartResponse.ok) {
        const cartData = await cartResponse.json();
        console.log('✅ Cart API working!');
        console.log('📦 Cart items:', cartData);
    } else {
        const errorText = await cartResponse.text();
        console.log('❌ Cart API failed:', errorText);
    }
    
    // Test add to cart
    console.log('\n3. Testing add to cart...');
    const addResponse = await fetch('http://localhost:3000/api/cart', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${loginData.token}`
        },
        body: JSON.stringify({ productId: 1, quantity: 1 })
    });
    
    if (addResponse.ok) {
        const addData = await addResponse.json();
        console.log('✅ Add to cart working!');
        console.log('➕ Response:', addData);
    } else {
        const errorText = await addResponse.text();
        console.log('❌ Add to cart failed:', errorText);
    }
}

testCartAPI();
