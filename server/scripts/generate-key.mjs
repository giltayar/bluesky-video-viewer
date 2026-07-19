// Generate an ES256 (P-256) private key in PKCS#8 PEM format for the confidential
// OAuth client. Run: `npm run generate-key --workspace server`
//
// Copy the printed PEM into a Railway variable named PRIVATE_KEY_1 (and add
// PRIVATE_KEY_2 / PRIVATE_KEY_3 for key rotation). Keep these secret; never commit them.
import { generateKeyPairSync } from 'node:crypto';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trim();

console.log(pem);
