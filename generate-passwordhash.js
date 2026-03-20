// generate-reshmi-hash.js
const bcrypt = require('bcryptjs');

const password = 'Reshmi$123';
const saltRounds = 10;

bcrypt.hash(password, saltRounds).then(hash => {
    console.log('Password:', password);
    console.log('Hash:', hash);
    console.log('\nCopy this SQL command:');
    console.log(`UPDATE users SET password = '${hash}' WHERE email = 'reshmis@gmail.com';`);
});