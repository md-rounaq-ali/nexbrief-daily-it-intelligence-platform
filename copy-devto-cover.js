const fs = require('fs');
const path = require('path');

const src = `C:\\Users\\Md Rounaq Ali\\.gemini\\antigravity\\brain\\3ff8d732-737c-4f29-bf83-2f1b1647f0ca\\nexbrief_devto_cover_1781196216093.png`;
const dest = path.join(__dirname, 'public', 'images', 'devto_cover.png');

try {
  fs.copyFileSync(src, dest);
  console.log('✅ dev.to Cover Image copied successfully to: C:\\nexbrief\\public\\images\\devto_cover.png');
} catch (err) {
  console.error('❌ Error copying cover image:', err.message);
}
