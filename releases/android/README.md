# Meteora Android APK (debug)

| Campo | Valor |
| --- | --- |
| Archivo | `meteora-debug.apk` (generado localmente, no se commitea) |
| Package | `com.cerebrostudios.dailytracker` |
| Build | debug (sin firma Play Store) |
| API base | `https://www.mymeteora.com` |

## Instalar

```powershell
adb install -r releases/android/meteora-debug.apk
```

O copia el APK al teléfono e instálalo (orígenes desconocidos).

## Reconstruir (mismo flujo que finanzas-pro)

```powershell
$env:JAVA_HOME='D:\AndroidStudio\jbr'
$env:ANDROID_HOME='D:\AndroidSDK'
$env:VITE_API_BASE_URL='https://www.mymeteora.com'
npm run android:package:debug
```

`packages/web/android/local.properties` debe existir con `sdk.dir=D:/AndroidSDK` (no se commitea). Copia `local.properties.example` si falta.

## AAB release (Play Store)

```powershell
$env:JAVA_HOME='D:\AndroidStudio\jbr'
$env:ANDROID_HOME='D:\AndroidSDK'
$env:VITE_API_BASE_URL='https://www.mymeteora.com'
npm run android:package:release
```

Requiere `keystore.properties` (ver `docs/PLAY_STORE.md`).
