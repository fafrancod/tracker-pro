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
  'bundle',
  'release',
  'app-release.aab'
);
const targetDir = path.join(root, 'releases', 'android');
const target = path.join(targetDir, 'meteora-release.aab');

if (!existsSync(source)) {
  console.error(
    `No se encontró AAB en ${source}. Ejecuta npm run android:build:release primero.`
  );
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
const sizeMb = (statSync(target).size / (1024 * 1024)).toFixed(1);
console.log(`AAB copiado a ${target} (${sizeMb} MB)`);
