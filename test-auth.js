// test-auth.js
const fetch = require('node-fetch');

async function testLogin() {
    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'superadmin@shopeasy.com',
                password: 'Superadmin$123',
                otp: '1234'
            })
        });

        const data = await response.json();
        console.log('Login Response:', data);
        
        if (response.ok) {
            console.log('✅ Login successful!');
            console.log('Token:', data.token.substring(0, 20) + '...');
        } else {
            console.log('❌ Login failed:', data.error);
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

testLogin();