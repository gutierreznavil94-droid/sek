package ar.sek.app;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * «Apps que te atrapan»: el usuario elige apps y minutos por día. Al pasarse (con la app abierta),
 * SEK se abre encima con la escena de Tensión. Config: { activo, repetir, apps: [{ paquete, nombre, minutos }] }.
 */
final class Vigia {
    static final String PREFS = "sek_vigia";
    static final String CLAVE_CONFIG = "config";

    private Vigia() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static JSONObject config(Context c) {
        try {
            return new JSONObject(prefs(c).getString(CLAVE_CONFIG, "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    static void guardar(Context c, String json) {
        prefs(c).edit().putString(CLAVE_CONFIG, json).apply();
        arrancarOParar(c);
    }

    static boolean activo(Context c) {
        JSONObject k = config(c);
        JSONArray apps = k.optJSONArray("apps");
        JSONArray juegos = k.optJSONArray("juegos");
        boolean atrapan = k.optBoolean("activo", false) && apps != null && apps.length() > 0;
        boolean conJuegos = juegos != null && juegos.length() > 0;
        return (atrapan || conJuegos) && tienePermisoUso(c);
    }

    /** Paquetes marcados como juego (Juego → «Mis juegos del celu»). */
    static java.util.Set<String> paquetesDeJuego(JSONObject k) {
        java.util.HashSet<String> r = new java.util.HashSet<>();
        JSONArray j = k.optJSONArray("juegos");
        if (j != null) for (int i = 0; i < j.length(); i++) {
            JSONObject o = j.optJSONObject(i);
            if (o != null && !o.optString("paquete").isEmpty()) r.add(o.optString("paquete"));
        }
        return r;
    }

    /**
     * Tramos [desde, hasta] en que alguna de las apps dadas estuvo adelante, entre desde y hasta (unidos, sin
     * solaparse). Se usan para que el tiempo en juegos del celu cuente solo en Juego.
     */
    static JSONArray tramos(Context c, java.util.Set<String> paquetes, long desde, long hasta) {
        JSONArray r = new JSONArray();
        UsageStatsManager u = (UsageStatsManager) c.getSystemService(Context.USAGE_STATS_SERVICE);
        if (u == null || paquetes.isEmpty() || !tienePermisoUso(c)) return r;
        long ahora = Math.min(hasta, System.currentTimeMillis());
        UsageEvents ev = u.queryEvents(desde, ahora);
        Map<String, Long> abiertos = new HashMap<>();
        java.util.ArrayList<long[]> lista = new java.util.ArrayList<>();
        UsageEvents.Event e = new UsageEvents.Event();
        while (ev.hasNextEvent()) {
            ev.getNextEvent(e);
            String p = e.getPackageName();
            int t = e.getEventType();
            if (t == UsageEvents.Event.SCREEN_NON_INTERACTIVE) {
                for (Long d : abiertos.values()) lista.add(new long[]{d, e.getTimeStamp()});
                abiertos.clear();
                continue;
            }
            if (!paquetes.contains(p)) continue;
            if (t == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                if (!abiertos.containsKey(p)) abiertos.put(p, e.getTimeStamp());
            } else if (t == UsageEvents.Event.MOVE_TO_BACKGROUND) {
                Long d = abiertos.remove(p);
                if (d != null) lista.add(new long[]{d, e.getTimeStamp()});
            }
        }
        for (Long d : abiertos.values()) lista.add(new long[]{d, ahora});
        java.util.Collections.sort(lista, (a, b) -> Long.compare(a[0], b[0]));
        long[] actual = null;
        for (long[] x : lista) {
            if (x[1] <= x[0]) continue;
            if (actual == null) { actual = x.clone(); continue; }
            if (x[0] <= actual[1]) actual[1] = Math.max(actual[1], x[1]);
            else { r.put(new JSONArray().put(actual[0]).put(actual[1])); actual = x.clone(); }
        }
        if (actual != null) r.put(new JSONArray().put(actual[0]).put(actual[1]));
        return r;
    }

    static void arrancarOParar(Context c) {
        Intent s = new Intent(c, VigiaServicio.class);
        if (activo(c)) {
            try {
                if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(s);
                else c.startService(s);
            } catch (Exception ignorado) {
                // Android no deja arrancarlo ahora (app en segundo plano): se intenta al abrir SEK.
            }
        } else {
            c.stopService(s);
        }
    }

    static boolean tienePermisoUso(Context c) {
        AppOpsManager ops = (AppOpsManager) c.getSystemService(Context.APP_OPS_SERVICE);
        if (ops == null) return false;
        int modo = Build.VERSION.SDK_INT >= 29
                ? ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.getPackageName())
                : ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.getPackageName());
        return modo == AppOpsManager.MODE_ALLOWED;
    }

    static boolean puedeEncima(Context c) {
        return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(c);
    }

    static long inicioDelDia() {
        Calendar k = Calendar.getInstance();
        k.set(Calendar.HOUR_OF_DAY, 0);
        k.set(Calendar.MINUTE, 0);
        k.set(Calendar.SECOND, 0);
        k.set(Calendar.MILLISECOND, 0);
        return k.getTimeInMillis();
    }

    /** Resultado de mirar el uso de hoy: milisegundos por app y cuál está adelante ahora. */
    static final class Uso {
        final Map<String, Long> ms = new HashMap<>();
        String adelante;
    }

    /** Suma el tiempo en primer plano de hoy, app por app, con los eventos de Android. */
    static Uso usoDeHoy(Context c) {
        Uso r = new Uso();
        UsageStatsManager u = (UsageStatsManager) c.getSystemService(Context.USAGE_STATS_SERVICE);
        if (u == null) return r;
        long ahora = System.currentTimeMillis();
        UsageEvents ev = u.queryEvents(inicioDelDia(), ahora);
        Map<String, Long> desde = new HashMap<>();
        UsageEvents.Event e = new UsageEvents.Event();
        while (ev.hasNextEvent()) {
            ev.getNextEvent(e);
            String p = e.getPackageName();
            int t = e.getEventType();
            if (t == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                // Si ya estaba adelante (otra actividad de la misma app), sigue contando desde antes.
                if (!desde.containsKey(p)) desde.put(p, e.getTimeStamp());
                r.adelante = p;
            } else if (t == UsageEvents.Event.MOVE_TO_BACKGROUND) {
                Long d = desde.remove(p);
                if (d != null) sumar(r.ms, p, e.getTimeStamp() - d);
                if (p.equals(r.adelante)) r.adelante = null;
            } else if (t == UsageEvents.Event.SCREEN_NON_INTERACTIVE) {
                // Pantalla apagada: se corta lo que estaba abierto.
                for (Map.Entry<String, Long> x : desde.entrySet()) sumar(r.ms, x.getKey(), e.getTimeStamp() - x.getValue());
                desde.clear();
                r.adelante = null;
            }
        }
        for (Map.Entry<String, Long> x : desde.entrySet()) sumar(r.ms, x.getKey(), ahora - x.getValue());
        return r;
    }

    private static void sumar(Map<String, Long> m, String p, long v) {
        if (v <= 0) return;
        Long a = m.get(p);
        m.put(p, (a == null ? 0 : a) + v);
    }

    /** Apps que se pueden abrir (las del cajón de apps), sin SEK. Con ícono chico en PNG base64. */
    static JSONArray appsInstaladas(Context c) {
        PackageManager pm = c.getPackageManager();
        Intent i = new Intent(Intent.ACTION_MAIN);
        i.addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> lista = pm.queryIntentActivities(i, 0);
        JSONArray r = new JSONArray();
        java.util.HashSet<String> vistos = new java.util.HashSet<>();
        for (ResolveInfo ri : lista) {
            String p = ri.activityInfo.packageName;
            if (p.equals(c.getPackageName()) || !vistos.add(p)) continue;
            try {
                JSONObject o = new JSONObject();
                o.put("paquete", p);
                o.put("nombre", String.valueOf(ri.loadLabel(pm)));
                o.put("icono", icono(ri.loadIcon(pm)));
                r.put(o);
            } catch (Exception ignorado) {
                // App rara: se saltea.
            }
        }
        return r;
    }

    private static String icono(Drawable d) {
        try {
            int lado = 72;
            Bitmap b = Bitmap.createBitmap(lado, lado, Bitmap.Config.ARGB_8888);
            Canvas k = new Canvas(b);
            d.setBounds(0, 0, lado, lado);
            d.draw(k);
            ByteArrayOutputStream s = new ByteArrayOutputStream();
            b.compress(Bitmap.CompressFormat.PNG, 100, s);
            return "data:image/png;base64," + Base64.encodeToString(s.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            return "";
        }
    }

    static String nombreDe(Context c, String paquete) {
        try {
            PackageManager pm = c.getPackageManager();
            ApplicationInfo ai = pm.getApplicationInfo(paquete, 0);
            return String.valueOf(pm.getApplicationLabel(ai));
        } catch (Exception e) {
            return paquete;
        }
    }
}
