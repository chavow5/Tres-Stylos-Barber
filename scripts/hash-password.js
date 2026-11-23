/* Genera un hash seguro (scrypt con salt) para guardar en AUTH_PASS_HASH */
const { hashPassword } = require("../api/_auth.js");

const input = process.argv[2];
if (!input) {
  console.error("Uso: node scripts/hash-password.js <DNI>");
  process.exit(1);
}

console.log(hashPassword(String(input).trim()));
