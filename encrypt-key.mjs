// node encrypt-key.mjs ~/claude-auth.txt

/* Read file containing api_key on first line, pass phrase on second line.  Output text
 *  to copy into acrostics.js for browser-side decryption.
 */
import { webcrypto } from 'crypto';
import { readFileSync } from 'fs';


const [api_key, passphrase] = readFileSync(process.argv[2], 'utf8').trim().split('\n');
const crypto = webcrypto;
const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const key_material = await crypto.subtle.importKey(
  'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
  key_material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv }, key, enc.encode(api_key));
const result = {
  salt: btoa(String.fromCharCode(...salt)),
  iv: btoa(String.fromCharCode(...iv)),
  data: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
};
console.log("const ENCRYPTED_KEY = " + JSON.stringify(result) + ";");
