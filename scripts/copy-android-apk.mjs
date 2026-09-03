import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(
  root,
  'packages',
  'web',
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  'debug',
  'app-debug.apk'
);
const targetDir = path.join(root, 'releases', 'android');
const target = path.join(targetDir, 'meteora-debug.apk');

if (!existsSync(source)) {
  console.error(
    `No se encontró APK en ${source}. Ejecuta npm run android:build:debug primero.`
  );
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
const sizeMb = (statSync(target).size / (1024 * 1024)).toFixed(1);
console.log(`APK copiado a ${target} (${sizeMb} MB)`);
