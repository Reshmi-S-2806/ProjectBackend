const bcrypt = require('bcryptjs');

const testPassword = 'Reshmi$123';
const hashFromDb = '$2a$10$DElZMf0htn0TNDiCE2hw.O3L9Vtfb.20RAi.CimruBc/wVHsb.dSm';

bcrypt.compare(testPassword, hashFromDb).then(result => {
    console.log('Password match:', result);
    if (result) {
        console.log('✅ The hash is correct for Reshmi$123');
    } else {
        console.log('❌ The hash is NOT correct for Reshmi$123');
    }
});