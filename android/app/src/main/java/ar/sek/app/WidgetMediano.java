package ar.sek.app;

import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget mediano (4×2) sobre la tormenta: a la izquierda los pilares de hoy (se marcan desde acá); a la derecha
 * «Tareas», la botella de agua y la manzana (se tocan para +1 vaso / +1 fruta). Abajo, la franja de Mi horario. Un toque en el título abre Hoy. Lo marcado con la app cerrada se anota al abrirla.
 */
public class WidgetMediano extends WidgetBase {
    private static final int[] FILAS = { R.id.wm_fila0, R.id.wm_fila1, R.id.wm_fila2, R.id.wm_fila3, R.id.wm_fila4 };
    private static final int[] TILDES = { R.id.wm_tilde0, R.id.wm_tilde1, R.id.wm_tilde2, R.id.wm_tilde3, R.id.wm_tilde4 };
    private static final int[] NOMBRES = { R.id.wm_nombre0, R.id.wm_nombre1, R.id.wm_nombre2, R.id.wm_nombre3, R.id.wm_nombre4 };

    @Override
    protected RemoteViews dibujar(Context c, JSONObject d) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_mediano);
        int rojo = Datos.color(d, "color-principal", ROJO);
        v.setImageViewBitmap(R.id.wm_titulo, Dibujo.titulo(c, tituloDia(d), 24));
        v.setContentDescription(R.id.wm_titulo, tituloDia(d));
        v.setTextViewText(R.id.wm_racha, racha(d));
        v.setTextColor(R.id.wm_racha, aclarar(rojo));
        v.setOnClickPendingIntent(R.id.wm_cabeza, abrir(c, null, 200));

        JSONArray p = d.optJSONArray("pilares");
        int n = p == null ? 0 : p.length();
        for (int i = 0; i < FILAS.length; i++) {
            if (i >= n) { v.setViewVisibility(FILAS[i], View.GONE); continue; }
            JSONObject x = p.optJSONObject(i);
            String estado = x.optString("estado");
            boolean hecho = "hecho".equals(estado);
            boolean descanso = "descanso".equals(estado);
            v.setViewVisibility(FILAS[i], View.VISIBLE);
            v.setTextViewText(TILDES[i], hecho ? "✓" : descanso ? "–" : "");
            v.setInt(TILDES[i], "setBackgroundResource",
                    hecho ? R.drawable.widget_circulo_hecho : descanso ? R.drawable.widget_circulo_descanso : R.drawable.widget_circulo);
            v.setTextViewText(NOMBRES[i], x.optString("nombre"));
            v.setTextColor(NOMBRES[i], hecho || descanso ? PAPEL_SUAVE : PAPEL);
            if (x.optBoolean("marcable")) {
                v.setOnClickPendingIntent(FILAS[i], difusion(c, WidgetMediano.class, MARCAR, x.optString("id"), 210 + i));
            } else {
                // «Dormir a horario» pendiente abre «Dejo celu»; lo demás abre Hoy.
                String ruta = !hecho && "acostarse".equals(x.optString("id")) ? "dejo-celu" : null;
                v.setOnClickPendingIntent(FILAS[i], abrir(c, ruta, 220 + i));
            }
        }
        v.setViewVisibility(R.id.wm_vacio, n == 0 ? View.VISIBLE : View.GONE);

        // Botella y manzana dibujadas: se llenan con lo del día y se tocan para sumar.
        v.setImageViewBitmap(R.id.wm_botella, Dibujo.botella(fraccionAgua(d)));
        v.setTextViewText(R.id.wm_agua, agua(d).replace(" / ", "/"));
        v.setImageViewBitmap(R.id.wm_manzana, Dibujo.manzana(fraccionFruta(d)));
        v.setTextViewText(R.id.wm_fruta_txt, fruta(d).replace("/", " / "));
        v.setOnClickPendingIntent(R.id.wm_tareas, abrir(c, "tareas", 240));
        v.setOnClickPendingIntent(R.id.wm_vaso, difusion(c, WidgetMediano.class, VASO, null, 230));
        v.setOnClickPendingIntent(R.id.wm_fruta, difusion(c, WidgetMediano.class, FRUTA, null, 231));

        String franja = franja(d);
        v.setViewVisibility(R.id.wm_franja, franja.isEmpty() ? View.GONE : View.VISIBLE);
        v.setTextViewText(R.id.wm_franja, franja);
        return v;
    }
}
