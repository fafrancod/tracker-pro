/**
 * Generates PNG PWA icons (any + maskable) from inline SVG.
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../public/icons');
mkdirSync(outDir, { recursive: true });

/** Meteora mark: mountain range (not a $). */
function mountainGroup() {
  return `<path d="M64 416 L160 176 L256 336 L352 112 L448 416 Z" fill="#58a6ff"/>
  <path d="M288 416 L352 112 L448 416 Z" fill="#3fb950"/>
  <circle cx="400" cy="128" r="24" fill="#e6edf3"/>`;
}

/** Full-bleed icon (for purpose: any). */
function svgAny(size) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#0d1117"/>
  ${mountainGroup()}
</svg>`;
}

/**
 * Maskable: logo stays inside ~80% safe zone (10% padding each side).
 * Outer full-bleed background required by Android adaptive icons.
 */
function svgMaskable(size) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0d1117"/>
  <g transform="translate(56,56) scale(0.78)">
    ${mountainGroup()}
  </g>
</svg>`;
}

async function renderPng(svg, outPath) {
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(outPath, buf);
  console.log('wrote', outPath, buf.length, 'bytes');
}

const jobs = [
  [192, 'icon-192.png', svgAny],
  [512, 'icon-512.png', svgAny],
  [192, 'icon-192-maskable.png', svgMaskable],
  [512, 'icon-512-maskable.png', svgMaskable],
  [180, 'apple-touch-icon.png', svgAny],
];

for (const [size, name, factory] of jobs) {
  await renderPng(factory(size), join(outDir, name));
}
console.log('PWA icons OK');
