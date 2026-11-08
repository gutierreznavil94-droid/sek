package ar.sek.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * La alarma sonando: sonido en bucle (canal de alarma: suena aunque esté en No molestar o en silencio, como el reloj),
 * vibración y la pantalla completa {@link AlarmaActivity}. Sigue hasta «Apagar» o «Posponer 5 min», o 10 minutos.
 */
public class AlarmaServicio extends Service {
    static final String SONAR = "ar.sek.app.ALARMA_SERVICIO_SONAR";
    static final String APAGAR = "ar.sek.app.ALARMA_APAGAR";
    static final String POSPONER = "ar.sek.app.ALARMA_POSPONER";
    static final String FIN = "ar.sek.app.ALARMA_FIN";
    static final String EXTRA_ALARMA = "alarma";
    static final String CANAL = "sek-alarma-sonando";
    static final int NOTI = 4242;
    static final long MAXIMO_MS = 10 * 60_000L;
    static final int POSPONER_MIN = 5;

    private MediaPlayer reproductor;
    private Vibrator vibrador;
    private PowerManager.WakeLock despierto;
    private JSONObject actual;
    private final Handler manejador = new Handler(Looper.getMainLooper());
    private final Runnable cortar = this::detener;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String accion = intent == null ? null : intent.getAction();
        if (APAGAR.equals(accion)) {
            detener();
            return START_NOT_STICKY;
        }
        if (POSPONER.equals(accion)) {
            posponer();
            return START_NOT_STICKY;
        }
        if (SONAR.equals(accion)) {
            try {
                sonar(new JSONObject(intent.getStringExtra(EXTRA_ALARMA)));
            } catch (Exception e) {
                detener();
            }
            return START_NOT_STICKY;
        }
        stopSelf();
        return START_NOT_STICKY;
    }

    private void sonar(JSONObject a) {
        // Si ya sonaba otra, se reemplaza.
        pararSonido();
        actual = a;
        crearCanal(this);
        Notification n = notificacion(a);
        int tipo = 0;
        if (Build.VERSION.SDK_INT >= 34) {
            tipo = Alarmas.puedeExactas(this) ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SYSTEM_EXEMPTED : ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK;
        }
        try {
            ServiceCompat.startForeground(this, NOTI, n, tipo);
        } catch (Exception e) {
            // Último recurso: notificación común (sin servicio en primer plano el sonido puede cortarse).
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(NOTI, n);
        }
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            despierto = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "sek:alarma");
            despierto.acquire(MAXIMO_MS + 5_000);
        }
        reproducir(a.optString("sonido", "sek"));
        if (a.optBoolean("vibrar", true)) vibrar();
        // Abre la pantalla completa también si el celu está desbloqueado y en uso.
        try {
            startActivity(pantalla(this, a).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (Exception ignorado) {
            // Android 10+ puede no dejar abrirla desde atrás: queda la notificación de pantalla completa.
        }
        manejador.removeCallbacks(cortar);
        manejador.postDelayed(cortar, MAXIMO_MS);
    }

    static Uri uriSonido(Context c, String sonido) {
        if (sonido == null || sonido.isEmpty() || "sek".equals(sonido)) return Uri.parse("android.resource://" + c.getPackageName() + "/" + R.raw.sek_gong);
        if ("celu".equals(sonido)) {
            Uri u = RingtoneManager.getActualDefaultRingtoneUri(c, RingtoneManager.TYPE_ALARM);
            return u != null ? u : RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        }
        return Uri.parse(sonido);
    }

    private void reproducir(String sonido) {
        AudioAttributes attrs = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
        Uri[] opciones = { uriSonido(this, sonido), RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION) };
        for (Uri u : opciones) {
            if (u == null) continue;
            try {
                MediaPlayer m = new MediaPlayer();
                m.setAudioAttributes(attrs);
                m.setDataSource(this, u);
                m.setLooping(true);
                m.prepare();
                m.start();
                reproductor = m;
                return;
            } catch (Exception e) {
                // Probar el siguiente sonido.
            }
        }
    }

    private void vibrar() {
        vibrador = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrador == null || !vibrador.hasVibrator()) return;
        long[] patron = { 0, 600, 400, 600, 1200 };
        AudioAttributes attrs = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build();
        if (Build.VERSION.SDK_INT >= 26) vibrador.vibrate(VibrationEffect.createWaveform(patron, 0), attrs);
        else vibrador.vibrate(patron, 0, attrs);
    }

    private void pararSonido() {
        if (reproductor != null) {
            try { reproductor.stop(); } catch (Exception ignorado) { /* ya parado */ }
            reproductor.release();
            reproductor = null;
        }
        if (vibrador != null) vibrador.cancel();
        if (despierto != null && despierto.isHeld()) despierto.release();
        despierto = null;
    }

    private void posponer() {
        if (actual != null) {
            try {
                JSONObject otra = new JSONObject(actual.toString());
                otra.put("instante", System.currentTimeMillis() + POSPONER_MIN * 60_000L);
                otra.put("id", actual.optString("id") + ":pospuesta");
                otra.put("cuerpo", "Pospuesta " + POSPONER_MIN + " min · " + actual.optString("cuerpo"));
                Alarmas.programar(this, otra);
            } catch (JSONException ignorado) {
                // Sin posponer.
            }
        }
        detener();
    }

    private void detener() {
        manejador.removeCallbacks(cortar);
        pararSonido();
        actual = null;
        sendBroadcast(new Intent(FIN).setPackage(getPackageName()));
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(NOTI);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        manejador.removeCallbacks(cortar);
        pararSonido();
        super.onDestroy();
    }

    // ---------- Notificación y pantalla completa ----------

    static void crearCanal(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CANAL) != null) return;
        NotificationChannel ch = new NotificationChannel(CANAL, "Alarma sonando", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("La alarma de SEK mientras suena (Apagar o Posponer)");
        ch.setSound(null, null);
        ch.enableVibration(false);
        ch.setBypassDnd(true);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    static Intent pantalla(Context c, JSONObject a) {
        Intent i = new Intent(c, AlarmaActivity.class);
        i.putExtra(EXTRA_ALARMA, a.toString());
        i.addFlags(Intent.FLAG_ACTIVITY_NO_USER_ACTION);
        return i;
    }

    private Notification notificacion(JSONObject a) {
        PendingIntent completa = PendingIntent.getActivity(this, 1, pantalla(this, a), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent apagar = PendingIntent.getService(this, 2, new Intent(this, AlarmaServicio.class).setAction(APAGAR), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent posponer = PendingIntent.getService(this, 3, new Intent(this, AlarmaServicio.class).setAction(POSPONER), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String hora = new SimpleDateFormat("HH:mm", Locale.US).format(new Date());
        return new NotificationCompat.Builder(this, CANAL)
                .setSmallIcon(R.drawable.ic_stat_alarma)
                .setContentTitle(a.optString("titulo", "SEK"))
                .setContentText(hora + " · " + a.optString("cuerpo"))
                .setStyle(new NotificationCompat.BigTextStyle().bigText(a.optString("cuerpo")))
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setContentIntent(completa)
                .setFullScreenIntent(completa, true)
                .addAction(0, "Posponer " + POSPONER_MIN + " min", posponer)
                .addAction(0, "Apagar", apagar)
                .build();
    }
}
