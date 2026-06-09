const fs = require('fs');
const path = require('path');

const src = `C:\\Users\\Md Rounaq Ali\\.gemini\\antigravity\\brain\\3ff8d732-737c-4f29-bf83-2f1b1647f0ca\\nexbrief_linkedin_banner_1780925608438.png`;
const dest = path.join(__dirname, 'public', 'images', 'linkedin_banner.png');

try {
  fs.copyFileSync(src, dest);
  console.log('✅ LinkedIn Launch Banner copied successfully to: C:\\nexbrief\\public\\images\\linkedin_banner.png');
} catch (err) {
  console.error('❌ Error copying banner:', err.message);
}
