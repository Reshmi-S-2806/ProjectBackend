// fresh-hash.js
const bcrypt = require('bcryptjs');

const password = 'Superadmin$123';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) throw err;
    console.log('Password:', password);
    console.log('Complete Hash:', hash);
    console.log('Hash Length:', hash.length);
    
    console.log('\nCopy this SQL command:');
    console.log(`UPDATE users SET password = '${hash}' WHERE email = 'superadmin@shopeasy.com';`);
});