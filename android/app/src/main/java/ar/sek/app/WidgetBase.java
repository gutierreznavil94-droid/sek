package ar.sek.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

/**
 * Base de los dos widgets: dibuja, atiende los toques (marcar un pilar, +1 vaso) y se redibuja a medianoche.
 * Android además los actualiza cada 30 min (updatePeriodMillis) y la app, cada vez que se marca algo.
 */
public abstract class WidgetBase extends AppWidgetProvider {
    static final String MARCAR = "ar.sek.app.MARCAR";
    static final String VASO = "ar.sek.app.VASO";
    static final String EXTRA_PILAR = "pilar";

    static final int PAPEL = Color.parseColor("#F1EBDF");
    static final int TINTA = Color.parseColor("#121110");
    static final int TINTA_SUAVE = Color.parseColor("#6B655C");
    static final int ROJO = Color.parseColor("#C8102E");

    protected abstract RemoteViews dibujar(Context c, JSONObject d);

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        JSONObject d = Datos.leer(c);
        for (int id : ids) m.updateAppWidget(id, dibujar(c, d));
        programarMedianoche(c);
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        String accion = intent.getAction();
        if (MARCAR.equals(accion)) {
            marcarPilar(c, intent.getStringExtra(EXTRA_PILAR));
            Datos.actualizarWidgets(c);
            return;
        }
        if (VASO.equals(accion)) {
            sumarVaso(c);
            Datos.actualizarWidgets(c);
            return;
        }
        super.onReceive(c, intent);
    }

    private static void marcarPilar(Context c, String id) {
        if (id == null) return;
        JSONObject d = Datos.leer(c);
        JSONArray pilares = d.optJSONArray("pilares");
        if (pilares == null) return;
        try {
            for (int i = 0; i < pilares.length(); i++) {
                JSONObject p = pilares.getJSONObject(i);
                if (!id.equals(p.optString("id")) || !p.optBoolean("marcable")) continue;
                p.put("estado", "hecho");
                p.put("marcable", false);
                Datos.encolar(c, new JSONObject().put("tipo", "pilar").put("id", id).put("instante", System.currentTimeMillis()));
            }
            Datos.guardar(c, d);
        } catch (JSONException ignorado) {
            // Sin cambios.
        }
    }

    private static void sumarVaso(Context c) {
        JSONObject d = Datos.leer(c);
        try {
            JSONObject agua = d.optJSONObject("agua");
            if (agua == null) agua = new JSONObject().put("ml", 0).put("objetivo", 2000).put("vasoMl", 250);
            agua.put("ml", agua.optInt("ml") + agua.optInt("vasoMl", 250));
            d.put("agua", agua);
            Datos.guardar(c, d);
            Datos.encolar(c, new JSONObject().put("tipo", "vaso").put("instante", System.currentTimeMillis()));
        } catch (JSONException ignorado) {
            // Sin cambios.
        }
    }

    /** A las 00:01 se redibuja para cambiar de día aunque la app no se abra. */
    private void programarMedianoche(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Calendar k = Calendar.getInstance();
        k.add(Calendar.DAY_OF_MONTH, 1);
        k.set(Calendar.HOUR_OF_DAY, 0);
        k.set(Calendar.MINUTE, 1);
        k.set(Calendar.SECOND, 0);
        Intent i = new Intent(c, getClass());
        i.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, getClass())));
        PendingIntent pi = PendingIntent.getBroadcast(c, getClass().getName().hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.set(AlarmManager.RTC, k.getTimeInMillis(), pi);
    }

    // ---------- Ayudas para dibujar ----------

    /** Abre la app (Hoy), o una ruta de acceso directo. */
    static PendingIntent abrir(Context c, String ruta, int codigo) {
        Intent i = new Intent(c, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (ruta != null) i.putExtra("ruta", ruta);
        return PendingIntent.getActivity(c, codigo, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static PendingIntent difusion(Context c, Class<?> k, String accion, String pilar, int codigo) {
        Intent i = new Intent(c, k);
        i.setAction(accion);
        if (pilar != null) i.putExtra(EXTRA_PILAR, pilar);
        return PendingIntent.getBroadcast(c, codigo, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static String tituloDia(JSONObject d) {
        String inicio = d.optString("inicio", "");
        int total = d.optInt("dias", 90);
        if (inicio.isEmpty() || "null".equals(inicio)) return "SEK";
        int n = Datos.diasEntre(inicio, Datos.hoy()) + 1;
        if (n < 1) return "Empieza pronto";
        if (n > total) return "Ciclo terminado";
        return "Día " + n + " de " + total;
    }

    static String racha(JSONObject d) {
        return Datos.icono(d, "icono-racha", "🔥") + " " + d.optInt("racha", 0);
    }

    /** «● ● ○»: lleno y rojo = hecho; vacío = falta; guion = descanso. */
    static CharSequence puntos(JSONObject d) {
        JSONArray p = d.optJSONArray("pilares");
        SpannableStringBuilder s = new SpannableStringBuilder();
        if (p == null || p.length() == 0) return "Sin pilares hoy";
        int rojo = Datos.color(d, "color-principal", ROJO);
        int suave = Datos.color(d, "color-tinta-suave", TINTA_SUAVE);
        for (int i = 0; i < p.length(); i++) {
            JSONObject x = p.optJSONObject(i);
            String estado = x == null ? "" : x.optString("estado");
            String signo = "hecho".equals(estado) ? "●" : "descanso".equals(estado) ? "–" : "○";
            int desde = s.length();
            s.append(signo);
            s.setSpan(new ForegroundColorSpan("hecho".equals(estado) ? rojo : suave), desde, s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            if (i < p.length() - 1) s.append("  ");
        }
        return s;
    }

    /** Agua: «1,25 / 2 L». */
    static String agua(JSONObject d) {
        JSONObject a = d.optJSONObject("agua");
        if (a == null) return "0 / 2 L";
        return litros(a.optInt("ml")) + " / " + litros(a.optInt("objetivo", 2000)) + " L";
    }

    private static String litros(int ml) {
        double l = ml / 1000.0;
        String t = String.format(Locale.US, "%.2f", l).replaceAll("0+$", "").replaceAll("\\.$", "");
        return t.replace('.', ',');
    }

    /** La franja de Mi horario de ahora («Ahora: Dibujar, hasta 20:50») o la próxima de hoy. */
    static String franja(JSONObject d) {
        JSONObject h = d.optJSONObject("horario");
        JSONArray hoy = h == null ? null : h.optJSONArray(String.valueOf(Datos.diaSemana()));
        if (hoy == null || hoy.length() == 0) return "";
        int ahora = Datos.minutoAhora();
        for (int i = 0; i < hoy.length(); i++) {
            JSONObject b = hoy.optJSONObject(i);
            if (b == null) continue;
            int desde = Datos.minutos(b.optString("d")), hasta = Datos.minutos(b.optString("h"));
            if (ahora >= desde && ahora < hasta) return "Ahora: " + b.optString("n") + ", hasta " + b.optString("h");
            if (desde > ahora) return "Después: " + b.optString("n") + " a las " + b.optString("d");
        }
        return "";
    }
}
