const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'public/images/favicon.png');
const destIco = path.join(__dirname, 'public/favicon.ico');
const destPng = path.join(__dirname, 'public/favicon.png');

try {
  fs.copyFileSync(src, destIco);
  console.log('Successfully copied favicon.png to public/favicon.ico');
  
  fs.copyFileSync(src, destPng);
  console.log('Successfully copied favicon.png to public/favicon.png');
} catch (err) {
  console.error('Error copying favicons:', err);
}
