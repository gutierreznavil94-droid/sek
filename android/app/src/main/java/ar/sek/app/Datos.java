package ar.sek.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

/**
 * Lo que comparten la app y los widgets: los datos del día que manda la web (JSON), lo marcado en el widget
 * con la app cerrada (cola que la web aplica al abrir) y la ruta de un acceso directo.
 * Si cambió el día y la app no se abrió, el widget arma el día nuevo solo: pilares sin marcar y agua en 0.
 */
final class Datos {
    static final String PREFS = "sek_widget";
    static final String CLAVE_DATOS = "datos";
    static final String CLAVE_PENDIENTES = "pendientes";
    static final String CLAVE_RUTA = "ruta";

    private Datos() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String hoy() {
        Calendar k = Calendar.getInstance();
        return String.format(Locale.US, "%04d-%02d-%02d", k.get(Calendar.YEAR), k.get(Calendar.MONTH) + 1, k.get(Calendar.DAY_OF_MONTH));
    }

    static int diaSemana() {
        return Calendar.getInstance().get(Calendar.DAY_OF_WEEK) - 1; // 0 domingo
    }

    static int minutoAhora() {
        Calendar k = Calendar.getInstance();
        return k.get(Calendar.HOUR_OF_DAY) * 60 + k.get(Calendar.MINUTE);
    }

    static int minutos(String hhmm) {
        try {
            String[] p = hhmm.split(":");
            return Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]);
        } catch (Exception e) {
            return -1;
        }
    }

    /** Días entre dos fechas AAAA-MM-DD. */
    static int diasEntre(String desde, String hasta) {
        try {
            Calendar a = fecha(desde), b = fecha(hasta);
            return (int) Math.round((b.getTimeInMillis() - a.getTimeInMillis()) / 86_400_000.0);
        } catch (Exception e) {
            return 0;
        }
    }

    private static Calendar fecha(String f) {
        String[] p = f.split("-");
        Calendar k = Calendar.getInstance();
        k.clear();
        k.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]), 12, 0, 0);
        return k;
    }

    /** Los datos para hoy: los de la app, o los del día nuevo armados acá si la app todavía no se abrió hoy. */
    static JSONObject leer(Context c) {
        JSONObject d;
        try {
            d = new JSONObject(prefs(c).getString(CLAVE_DATOS, "{}"));
        } catch (JSONException e) {
            d = new JSONObject();
        }
        String hoy = hoy();
        if (!hoy.equals(d.optString("fecha", hoy))) {
            try {
                int ds = diaSemana();
                JSONArray viejos = d.optJSONArray("pilares");
                JSONArray nuevos = new JSONArray();
                if (viejos != null) {
                    for (int i = 0; i < viejos.length(); i++) {
                        JSONObject p = viejos.getJSONObject(i);
                        JSONArray dias = p.optJSONArray("dias");
                        boolean toca = dias == null;
                        if (dias != null) for (int j = 0; j < dias.length(); j++) if (dias.optInt(j) == ds) toca = true;
                        if (!toca) continue;
                        JSONObject n = new JSONObject(p.toString());
                        n.put("estado", "pendiente");
                        // Se puede marcar, salvo «Dormir a horario» (va por «Dejo celu»).
                        n.put("marcable", !"acostarse".equals(p.optString("id")));
                        nuevos.put(n);
                    }
                }
                d.put("pilares", nuevos);
                JSONObject agua = d.optJSONObject("agua");
                if (agua != null) agua.put("ml", 0);
                d.put("fecha", hoy);
            } catch (JSONException ignorado) {
                // Queda lo que había.
            }
        }
        return d;
    }

    static void guardar(Context c, String json) {
        prefs(c).edit().putString(CLAVE_DATOS, json).apply();
    }

    static void guardar(Context c, JSONObject d) {
        guardar(c, d.toString());
    }

    /** Suma algo a la cola de lo marcado en el widget. */
    static void encolar(Context c, JSONObject accion) {
        try {
            JSONArray cola = new JSONArray(prefs(c).getString(CLAVE_PENDIENTES, "[]"));
            cola.put(accion);
            prefs(c).edit().putString(CLAVE_PENDIENTES, cola.toString()).apply();
        } catch (JSONException ignorado) {
            prefs(c).edit().putString(CLAVE_PENDIENTES, "[" + accion + "]").apply();
        }
    }

    /** Devuelve la cola y la vacía. */
    static String sacarPendientes(Context c) {
        SharedPreferences p = prefs(c);
        String cola = p.getString(CLAVE_PENDIENTES, "[]");
        p.edit().remove(CLAVE_PENDIENTES).apply();
        return cola;
    }

    static int color(JSONObject d, String nombre, int defecto) {
        JSONObject colores = d.optJSONObject("colores");
        if (colores == null) return defecto;
        try {
            return android.graphics.Color.parseColor(colores.optString(nombre, ""));
        } catch (Exception e) {
            return defecto;
        }
    }

    static String icono(JSONObject d, String nombre, String defecto) {
        JSONObject iconos = d.optJSONObject("iconos");
        String v = iconos == null ? "" : iconos.optString(nombre, "");
        return v.isEmpty() ? defecto : v;
    }

    /** Vuelve a dibujar los dos widgets. */
    static void actualizarWidgets(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (Class<?> k : new Class<?>[] { WidgetChico.class, WidgetMediano.class }) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, k));
            if (ids.length == 0) continue;
            Intent i = new Intent(c, k);
            i.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            c.sendBroadcast(i);
        }
    }
}
