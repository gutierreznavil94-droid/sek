package ar.sek.app;

import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** Widget chico (2×1): Día N de 90, racha y los pilares de hoy como puntos. Un toque abre Hoy. */
public class WidgetChico extends WidgetBase {
    @Override
    protected RemoteViews dibujar(Context c, JSONObject d) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_chico);
        int tinta = Datos.color(d, "color-tinta", TINTA);
        v.setTextViewText(R.id.wc_dia, tituloDia(d));
        v.setTextColor(R.id.wc_dia, tinta);
        v.setTextViewText(R.id.wc_racha, racha(d));
        v.setTextColor(R.id.wc_racha, Datos.color(d, "color-principal", ROJO));
        v.setTextViewText(R.id.wc_puntos, puntos(d));
        v.setOnClickPendingIntent(R.id.wc_raiz, abrir(c, null, 100));
        return v;
    }
}
