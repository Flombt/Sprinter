const QRCode = require('qrcode');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const args = process.argv.slice(2);
const lan = Object.values(os.networkInterfaces()).flat().find(ip => ip && ip.family === 'IPv4' && !ip.internal && /^192\.168\./.test(ip.address));
const url = args[0] || `exp://${lan?.address || '127.0.0.1'}:8081`;
const directory = path.resolve(__dirname, '../artifacts');
fs.mkdirSync(directory, { recursive: true });
QRCode.toFile(path.join(directory, 'expo-go.png'), url, { width: 360, margin: 3, errorCorrectionLevel: 'M' })
  .then(() => { fs.writeFileSync(path.join(directory, 'expo-url.txt'), url + '\n'); console.log(`Expo Go: ${url}`); })
  .catch(error => { console.error(error.message); process.exitCode = 1; });
