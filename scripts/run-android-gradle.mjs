/**
 * Gradle wrapper for packages/web/android (Windows gradlew.bat / Unix ./gradlew).
 * Picks JAVA_HOME / ANDROID_HOME like finanzas-pro when unset.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = path.join(root, 'packages', 'web', 'android');
const webPkg = JSON.parse(
  readFileSync(path.join(root, 'packages', 'web', 'package.json'), 'utf8')
);
const version = String(webPkg.version || '0.0.0');
const [maj, min, pat] = version.split('.').map(n => Number.parseInt(n, 10) || 0);
const versionCode = maj * 10000 + min * 100 + pat;

const defaultJava = 'D:\\AndroidStudio\\jbr';
const defaultSdk = 'D:\\AndroidSDK';

if (!process.env.JAVA_HOME && existsSync(defaultJava)) {
  process.env.JAVA_HOME = defaultJava;
}
if (!process.env.ANDROID_HOME && existsSync(defaultSdk)) {
  process.env.ANDROID_HOME = defaultSdk;
}

const isWin = process.platform === 'win32';
const gradlew = path.join(androidDir, isWin ? 'gradlew.bat' : 'gradlew');
if (!existsSync(gradlew)) {
  console.error(`No se encontró ${gradlew}`);
  process.exit(1);
}

const localProps = path.join(androidDir, 'local.properties');
if (!existsSync(localProps)) {
  console.error(
    'Falta packages/web/android/local.properties. Copia local.properties.example y pon sdk.dir.'
  );
  process.exit(1);
}

const args = [...process.argv.slice(2), '--no-daemon'];
const env = {
  ...process.env,
  ANDROID_VERSION_NAME: process.env.ANDROID_VERSION_NAME || version,
  ANDROID_VERSION_CODE: process.env.ANDROID_VERSION_CODE || String(versionCode),
};

console.log(
  `Gradle ${args.filter(a => !a.startsWith('--')).join(' ')} · versionName=${env.ANDROID_VERSION_NAME} versionCode=${env.ANDROID_VERSION_CODE}`
);

const child = spawn(gradlew, args, {
  cwd: androidDir,
  env,
  stdio: 'inherit',
  shell: isWin,
});
child.on('exit', code => process.exit(code ?? 1));
