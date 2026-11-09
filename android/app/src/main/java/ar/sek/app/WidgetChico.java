package ar.sek.app;

import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** Widget chico (2×1) sobre la tormenta: Día N de 90, racha, los pilares como tildes y «Tareas». Un toque abre Hoy. */
public class WidgetChico extends WidgetBase {
    @Override
    protected RemoteViews dibujar(Context c, JSONObject d) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_chico);
        v.setImageViewBitmap(R.id.wc_dia, Dibujo.titulo(c, tituloDia(d), 20, acentoTitulo(d)));
        v.setContentDescription(R.id.wc_dia, tituloDia(d));
        v.setTextViewText(R.id.wc_racha, racha(d));
        v.setTextColor(R.id.wc_racha, aclarar(Datos.color(d, "color-principal", ROJO)));
        v.setTextViewText(R.id.wc_puntos, puntos(d));
        v.setOnClickPendingIntent(R.id.wc_raiz, abrir(c, null, 100));
        v.setOnClickPendingIntent(R.id.wc_tareas, abrir(c, "tareas", 101));
        fondosDelTema(c, v);
        if (TemaVisual.tieneFondos(c)) v.setInt(R.id.wc_tareas, "setBackgroundResource", R.drawable.widget_boton_tareas_tema);
        return v;
    }
}
