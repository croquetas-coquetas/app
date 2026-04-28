@echo off
setlocal enabledelayedexpansion

echo Compilando la web...
bun run build
if !errorlevel! neq 0 (
  echo Error en compilacion de web
  exit /b 1
)

echo Sincronizando...
bunx cap sync
if !errorlevel! neq 0 (
  echo Error en sincronizacion
  exit /b 1
)

echo Compilando la apk...
cd android
call gradlew assembleDebug
if !errorlevel! neq 0 (
  echo Error en compilacion de APK
  cd ..
  exit /b 1
)

echo Copiando APK a la carpeta dist...
cd ..
mkdir dist 2>nul
copy android\app\build\outputs\apk\debug\app-debug.apk dist\smartcook.apk
if !errorlevel! neq 0 (
  echo Error al copiar APK
  exit /b 1
)

echo =====================
echo APK compilada y copiada a dist\smartcook.apk
echo =====================