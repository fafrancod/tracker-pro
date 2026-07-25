#!/usr/bin/env node
/**
 * Sincroniza la versión SemVer en monorepo.
 *
 * Uso:
 *   node scripts/bump-version.mjs 2.1.3
 *   node scripts/bump-version.mjs patch   # 2.1.3 → 2.1.4
 *   node scripts/bump-version.mjs minor   # 2.1.3 → 2.2.0
 *   node scripts/bump-version.mjs major   # 2.1.3 → 3.0.0
 *
 * Convención (MAJOR.MINOR.PATCH):
 *   MAJOR — cambio estructural grande (arquitectura, breaking, rediseño fuerte)
 *   MINOR — feature grande (nueva capacidad de producto)
 *   PATCH — mejora pequeña, fix, copy, polish
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PKG_PATHS = [
  'package.json',
  'packages/web/package.json',
  'packages/api/package.json',
  'packages/core/package.json',
];

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-[\w.]+)?$/;

function readRootVersion() {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  return pkg.version ?? '0.0.0';
}

function parse(v) {
  const m = SEMVER_RE.exec(v);
  if (!m) throw new Error(`Versión inválida: ${v} (esperado MAJOR.MINOR.PATCH)`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function format({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function bump(kind, current) {
  const p = parse(current);
  if (kind === 'major') return format({ major: p.major + 1, minor: 0, patch: 0 });
  if (kind === 'minor') return format({ major: p.major, minor: p.minor + 1, patch: 0 });
  if (kind === 'patch') return format({ major: p.major, minor: p.minor, patch: p.patch + 1 });
  throw new Error(`Tipo de bump desconocido: ${kind}`);
}

function writeAll(version) {
  parse(version); // validate
  for (const rel of PKG_PATHS) {
    const path = resolve(root, rel);
    const pkg = JSON.parse(readFileSync(path, 'utf8'));
    pkg.version = version;
    writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`  ${rel} → ${version}`);
  }
}

const arg = process.argv[2];
if (!arg) {
  console.error(`Uso: node scripts/bump-version.mjs <version|major|minor|patch>
Actual: ${readRootVersion()}`);
  process.exit(1);
}

const current = readRootVersion();
const next =
  arg === 'major' || arg === 'minor' || arg === 'patch' ? bump(arg, current) : arg;

console.log(`Version: ${current} → ${next}`);
writeAll(next);
console.log('Listo. Incluye el bump en el commit de ship y menciónalo en el PR.');
