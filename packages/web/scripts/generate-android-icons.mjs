/**
 * Generates Android launcher mipmaps from public/icons/icon-512.png
 * Run from packages/web: node scripts/generate-android-icons.mjs
 */
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'public/icons/icon-512.png');
const res = join(root, 'android/app/src/main/res');

if (!existsSync(src)) {
  console.error('Missing', src, '— run npm run icons first');
  process.exit(1);
}

/** Launcher icon sizes (px) per density */
const launcher = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

/** Adaptive foreground (108dp × density) */
const foreground = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

async function writePng(input, size, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  await sharp(input)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(outPath);
  console.log('wrote', outPath);
}

for (const [folder, size] of Object.entries(launcher)) {
  const dir = join(res, folder);
  await writePng(src, size, join(dir, 'ic_launcher.png'));
  await writePng(src, size, join(dir, 'ic_launcher_round.png'));
}

for (const [folder, size] of Object.entries(foreground)) {
  const dir = join(res, folder);
  // Safe-zone: scale logo to ~72% of canvas (maskable-ish for adaptive)
  const inner = Math.round(size * 0.72);
  const pad = Math.round((size - inner) / 2);
  const logo = await sharp(src).resize(inner, inner).png().toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 13, g: 17, b: 23, alpha: 1 },
    },
  })
    .composite([{ input: logo, top: pad, left: pad }])
    .png()
    .toFile(join(dir, 'ic_launcher_foreground.png'));
  console.log('wrote', join(dir, 'ic_launcher_foreground.png'));
}

// Update adaptive background color resource
console.log('Android launcher icons OK');
