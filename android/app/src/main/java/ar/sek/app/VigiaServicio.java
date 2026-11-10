package ar.sek.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Mira cada 20 s qué app está adelante. Si es una de las elegidas y hoy ya pasó sus minutos,
 * abre SEK encima con la escena de Tensión (y vuelve a llamar cada «repetir» minutos mientras sigas).
 */
public class VigiaServicio extends Service {
    static final String CANAL = "sek-vigia";
    static final String CANAL_LLAMADO = "sek-vigia-llamado";
    static final int NOTI = 4343;
    static final int NOTI_LLAMADO = 4344;
    static final long CADA_MS = 20_000L;

    private final Handler manejador = new Handler(Looper.getMainLooper());
    private final Runnable mirar = new Runnable() {
        @Override
        public void run() {
            try { revisar(); } catch (Exception ignorado) { /* sigue la próxima vuelta */ }
            manejador.postDelayed(this, CADA_MS);
        }
    };

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        canales();
        Intent abrir = new Intent(this, MainActivity.class).putExtra("ruta", "vigia").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pi = PendingIntent.getActivity(this, 7, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new NotificationCompat.Builder(this, CANAL)
                .setSmallIcon(R.drawable.ic_stat_alarma)
                .setContentTitle("SEK te cuida")
                .setContentText("Mira el tiempo en las apps que elegiste")
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setContentIntent(pi)
                .build();
        int tipo = Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
        try {
            ServiceCompat.startForeground(this, NOTI, n, tipo);
        } catch (Exception e) {
            android.util.Log.e("SekVigia", "No pudo quedar en primer plano", e);
            stopSelf();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!Vigia.activo(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        manejador.removeCallbacks(mirar);
        manejador.post(mirar);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        manejador.removeCallbacks(mirar);
        super.onDestroy();
    }

    private void revisar() {
        if (!Vigia.activo(this)) { stopSelf(); return; }
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null && !pm.isInteractive()) return;
        JSONObject k = Vigia.config(this);
        JSONArray apps = k.optJSONArray("apps");
        if (apps == null) apps = new JSONArray();
        Vigia.Uso uso = Vigia.usoDeHoy(this);
        if (uso.adelante == null) return;
        if (revisarJuego(k, uso)) return;
        if (!k.optBoolean("activo", false)) return;
        for (int i = 0; i < apps.length(); i++) {
            JSONObject a = apps.optJSONObject(i);
            if (a == null || !uso.adelante.equals(a.optString("paquete"))) continue;
            long limite = Math.max(1, a.optInt("minutos", 30));
            Long ms = uso.ms.get(uso.adelante);
            long min = ms == null ? 0 : ms / 60_000L;
            if (min < limite) return;
            int repetir = Math.max(1, k.optInt("repetir", 10));
            String clave = "ultimo:" + hoy() + ":" + uso.adelante;
            SharedPreferences p = Vigia.prefs(this);
            long ultimo = p.getLong(clave, -1);
            if (ultimo >= 0 && min < ultimo + repetir) return;
            p.edit().putLong(clave, min).apply();
            String nombre = a.optString("nombre", Vigia.nombreDe(this, uso.adelante));
            llamar(nombre, min);
            return;
        }
    }

    /**
     * Juego que cuenta solo: si lo que está adelante es un juego del celu, suma sus minutos de hoy con lo
     * manual (que manda SEK) y avisa al 50 % y, al 100 %, el Tajo (o SEK). Devuelve true si era un juego.
     */
    private boolean revisarJuego(JSONObject k, Vigia.Uso uso) {
        java.util.Set<String> juegos = Vigia.paquetesDeJuego(k);
        if (!juegos.contains(uso.adelante)) return false;
        String fecha = hoy();
        JSONObject limites = k.optJSONObject("limitesJuego");
        int limite = limites == null ? 0 : limites.optInt(fecha, 0);
        if (limite <= 0) return true;
        long msCelu = 0;
        JSONArray t = Vigia.tramos(this, juegos, Vigia.inicioDelDia(), System.currentTimeMillis());
        for (int i = 0; i < t.length(); i++) { JSONArray x = t.optJSONArray(i); if (x != null) msCelu += x.optLong(1) - x.optLong(0); }
        JSONObject manual = k.optJSONObject("manualJuego");
        long min = msCelu / 60_000L + (manual == null ? 0 : manual.optLong(fecha, 0));
        SharedPreferences p = Vigia.prefs(this);
        int porcentaje = Math.max(1, Math.min(99, k.optInt("avisoJuego", 50)));
        String claveMitad = "juego-mitad:" + fecha;
        if (min * 100 >= (long) limite * porcentaje && min < limite && !p.getBoolean(claveMitad, false)) {
            p.edit().putBoolean(claveMitad, true).apply();
            avisoSuave("Juego: vas por el " + porcentaje + " %", "Llevás " + min + " de " + limite + " min de juego hoy.");
            return true;
        }
        if (min < limite) return true;
        int repetir = Math.max(1, k.optInt("repetir", 10));
        String clave = "juego-limite:" + fecha;
        long ultimo = p.getLong(clave, -1);
        if (ultimo >= 0 && min < ultimo + repetir) return true;
        p.edit().putLong(clave, min).apply();
        String nombre = "juego";
        JSONArray j = k.optJSONArray("juegos");
        if (j != null) for (int i = 0; i < j.length(); i++) {
            JSONObject o = j.optJSONObject(i);
            if (o != null && uso.adelante.equals(o.optString("paquete"))) nombre = o.optString("nombre", nombre);
        }
        llamar(nombre, min);
        return true;
    }

    private void avisoSuave(String titulo, String texto) {
        Intent abrir = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pi = PendingIntent.getActivity(this, 9, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new NotificationCompat.Builder(this, CANAL_LLAMADO)
                .setSmallIcon(R.drawable.ic_stat_alarma)
                .setContentTitle(titulo)
                .setContentText(texto)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTI_LLAMADO + 1, n);
    }

    private static String hoy() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    /** Abre SEK encima (permiso «Mostrar sobre otras apps»); si no lo hay, aviso a pantalla completa. */
    private void llamar(String nombre, long minutos) {
        String ruta = "tension|" + nombre.replace('|', ' ') + "|" + minutos;
        Datos.prefs(this).edit().putString(Datos.CLAVE_RUTA, ruta).apply();
        Intent abrir = new Intent(this, MainActivity.class)
                .putExtra("ruta", ruta)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        if (Vigia.puedeEncima(this)) {
            try {
                // Shinobi: el Tajo corta la pantalla de la otra app y sale la mano; al tocarla, SEK con Tensión.
                if (Vigia.config(this).optBoolean("tajo", false)) {
                    startActivity(new Intent(this, TajoActivity.class)
                            .putExtra(TajoActivity.EXTRA_APP, nombre).putExtra(TajoActivity.EXTRA_MIN, minutos)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION));
                    return;
                }
                startActivity(abrir);
                return;
            } catch (Exception ignorado) {
                // Sigue con el aviso.
            }
        }
        PendingIntent pi = PendingIntent.getActivity(this, 8, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new NotificationCompat.Builder(this, CANAL_LLAMADO)
                .setSmallIcon(R.drawable.ic_stat_alarma)
                .setContentTitle("Llevás " + minutos + " min en " + nombre)
                .setContentText("Dudar es fracasar. Tocá y volvé a lo tuyo.")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setFullScreenIntent(pi, true)
                .build();
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTI_LLAMADO, n);
    }

    private void canales() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel quieto = new NotificationChannel(CANAL, "SEK te cuida (siempre activo)", NotificationManager.IMPORTANCE_MIN);
        quieto.setShowBadge(false);
        nm.createNotificationChannel(quieto);
        NotificationChannel fuerte = new NotificationChannel(CANAL_LLAMADO, "Te pasaste de tiempo en una app", NotificationManager.IMPORTANCE_HIGH);
        nm.createNotificationChannel(fuerte);
    }
}
