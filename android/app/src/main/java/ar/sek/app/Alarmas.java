package ar.sek.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;

/**
 * Alarmas reales de SEK (Más → Alarmas, modo «Alarma»): se programan con AlarmManager.setAlarmClock, que suena a la
 * hora justa aunque el celu esté en reposo. Al sonar, {@link AlarmaReceptor} arranca {@link AlarmaServicio}
 * (sonido, vibración y pantalla completa hasta «Apagar» o «Posponer 5 min»).
 * Lo programado se guarda para volver a programarlo si el celu se reinicia.
 */
final class Alarmas {
    private Alarmas() {}

    static final String PREFS = "sek_alarmas";
    static final String ACCION_SONAR = "ar.sek.app.ALARMA_SONAR";
    static final String EXTRA_ID = "id";

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static int idNumerico(String id) {
        int h = 0;
        for (int i = 0; i < id.length(); i++) h = h * 31 + id.charAt(i);
        return Math.abs(h % 2_000_000_000) + 1;
    }

    static JSONObject leer(Context c, String id) {
        try {
            String s = prefs(c).getString(id, null);
            return s == null ? null : new JSONObject(s);
        } catch (JSONException e) {
            return null;
        }
    }

    private static PendingIntent alSonar(Context c, String id) {
        Intent i = new Intent(c, AlarmaReceptor.class);
        i.setAction(ACCION_SONAR);
        i.putExtra(EXTRA_ID, id);
        return PendingIntent.getBroadcast(c, idNumerico(id), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Programa (o reprograma) una alarma. {@code a} lleva id, instante, titulo, cuerpo, vibrar y sonido. */
    static void programar(Context c, JSONObject a) {
        String id = a.optString("id");
        long instante = a.optLong("instante");
        if (id.isEmpty() || instante <= System.currentTimeMillis()) return;
        prefs(c).edit().putString(id, a.toString()).apply();
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = alSonar(c, id);
        if (puedeExactas(c)) {
            Intent abrir = new Intent(c, MainActivity.class);
            PendingIntent mostrar = PendingIntent.getActivity(c, 7, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(instante, mostrar), pi);
        } else {
            // Sin permiso de alarmas exactas: lo más cerca posible (puede atrasarse unos minutos).
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, instante, pi);
        }
    }

    static void cancelar(Context c, String id) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(alSonar(c, id));
        prefs(c).edit().remove(id).apply();
    }

    /** Cancela todas las que empiezan con {@code prefijo} ("" = todas). */
    static void cancelarPorPrefijo(Context c, String prefijo) {
        for (String id : prefs(c).getAll().keySet()) if (id.startsWith(prefijo)) cancelar(c, id);
    }

    /** Las programadas que todavía no sonaron, como JSON. */
    static String listar(Context c) {
        JSONArray r = new JSONArray();
        long ahora = System.currentTimeMillis();
        for (Object v : prefs(c).getAll().values()) {
            try {
                JSONObject a = new JSONObject(String.valueOf(v));
                if (a.optLong("instante") > ahora) r.put(a);
            } catch (JSONException ignorado) {
                // Dato roto: se ignora.
            }
        }
        return r.toString();
    }

    /** Después de reiniciar el celu: vuelve a programar las que faltan y borra las vencidas. */
    static void reprogramarTodas(Context c) {
        long ahora = System.currentTimeMillis();
        Iterator<String> it = prefs(c).getAll().keySet().iterator();
        while (it.hasNext()) {
            String id = it.next();
            JSONObject a = leer(c, id);
            if (a == null || a.optLong("instante") <= ahora) prefs(c).edit().remove(id).apply();
            else programar(c, a);
        }
    }

    static boolean puedeExactas(Context c) {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        return am != null && am.canScheduleExactAlarms();
    }
}
