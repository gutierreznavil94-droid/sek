# Cómo compilar la app Android (APK de prueba)

Esta carpeta es el proyecto Android generado con Capacitor. La app es la misma
versión web (`dist/`) corriendo dentro de una app Android, más las alarmas
reales del teléfono (notificaciones locales programadas).

**En el entorno donde se preparó no había SDK de Android, así que el APK no se
compiló.** Pasos para compilarlo en una computadora:

1. Instalar **Android Studio** (https://developer.android.com/studio). Al abrirlo
   por primera vez instala el SDK solo. También hace falta **Node.js** (LTS).
2. En la carpeta `sistema-progreso` (la del código fuente), ejecutar:
   ```
   npm install
   npm run build
   npx cap sync android
   npx cap open android
   ```
   El último comando abre el proyecto en Android Studio.
3. En Android Studio: menú **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
   Al terminar aparece «locate»: el archivo queda en
   `android/app/build/outputs/apk/debug/app-debug.apk`.
4. Pasar ese archivo al teléfono (cable, Drive o WhatsApp a vos mismo) y abrirlo.
   Android pide permiso para instalar apps de origen desconocido: aceptar.
5. Dentro de la app: **Más → Alarmas de la app → Activar alarmas**. Android
   pregunta por notificaciones y por alarmas exactas: decir que sí a las dos.

Alternativa sin Android Studio (solo terminal, con el SDK instalado):
```
cd android && ./gradlew assembleDebug
```

## Qué está preparado
- `capacitor.config.ts`: nombre «Progreso 90», id `ar.progreso90.app`, carpeta `dist`.
- `@capacitor/local-notifications` instalado y permisos en `AndroidManifest.xml`
  (POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM, USE_EXACT_ALARM, RECEIVE_BOOT_COMPLETED).
- `src/reminders/recordatorios.ts`: en Android usa el plugin; en la web sigue igual.
- `src/services/alarmas.ts`: calcula las alarmas (entrenamiento del día, 20:50,
  21:15 y 21:20) desde los horarios de Más y las reprograma solas al cambiarlos.

## Pruebas para hacer en el teléfono (no se pueden hacer acá)
Nadie comprobó todavía que suenen a la hora exacta. Probar, con una alarma
puesta 2 minutos adelante desde Más → Entrenamiento y descanso:
1. Pantalla apagada y app cerrada del todo (deslizada de «recientes»).
2. Modo ahorro de batería activado.
3. Después de reiniciar el teléfono, sin abrir la app.
4. Con «No molestar» activado (ver si igual se oye).
Si alguna falla, en Ajustes de Android → Aplicaciones → Progreso 90 → Batería
elegir «Sin restricciones», y volver a probar.
