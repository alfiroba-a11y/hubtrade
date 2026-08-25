// Usage: npm run make-admin -- someone@example.com
require('dotenv').config();
const { Users } = require('../src/models');

const email = process.argv[2];
if (!email) {
  console.error('Usage: npm run make-admin -- <email>');
  process.exit(1);
}

const user = Users.findByEmail.get(email);
if (!user) {
  console.error(`No user found with email ${email}. Register that account first, then rerun this.`);
  process.exit(1);
}

Users.setRole.run('admin', user.id);
console.log(`${email} is now an admin.`);
