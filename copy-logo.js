const fs = require('fs');
const path = require('path');

const src = `C:\\Users\\Md Rounaq Ali\\.gemini\\antigravity\\brain\\3ff8d732-737c-4f29-bf83-2f1b1647f0ca\\nexbrief_logo_pro_1780910511097.png`;
const destDir = path.join(__dirname, 'public', 'images');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const destLogo = path.join(destDir, 'logo.png');
const destFavicon = path.join(destDir, 'favicon.png');

try {
  fs.copyFileSync(src, destLogo);
  fs.copyFileSync(src, destFavicon);
  console.log('✅ Professional Logo and Favicon copied successfully to C:\\nexbrief\\public\\images\\');
} catch (err) {
  console.error('❌ Error copying logo:', err.message);
}
