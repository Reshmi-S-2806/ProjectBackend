// test-cart-delete.js
const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'shopeasy',
    password: 'postgres123',
    port: 5432,
});

async function testCart() {
    try {
        await client.connect();
        console.log('✅ Connected to database');
        
        // Check all cart items
        const result = await client.query('SELECT * FROM cart');
        console.log(`\n📦 Cart items in database: ${result.rows.length}`);
        
        if (result.rows.length > 0) {
            console.log('\nCart contents:');
            result.rows.forEach((item, index) => {
                console.log(`  ${index + 1}. ID: ${item.id}, User: ${item.user_id}, Product: ${item.product_id}, Quantity: ${item.quantity}`);
            });
            
            // Ask if you want to clear
            console.log('\n⚠️  If you want to clear the cart, run:');
            console.log('   DELETE FROM cart;');
        } else {
            console.log('✅ Cart is empty - good!');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.end();
    }
}

testCart();