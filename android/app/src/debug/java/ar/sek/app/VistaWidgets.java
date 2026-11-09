package ar.sek.app;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.widget.LinearLayout;
import android.widget.RemoteViews;
import android.view.View;

import org.json.JSONObject;

/** Solo en la versión de prueba: muestra los dos widgets uno abajo del otro, para sacarles captura sin el inicio de Android. */
public class VistaWidgets extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        l.setBackgroundColor(Color.parseColor("#33363b"));
        l.setPadding(40, 120, 40, 40);
        JSONObject d = Datos.leer(this);
        float dp = getResources().getDisplayMetrics().density;
        RemoteViews m = new WidgetMediano().dibujar(this, d);
        View vm = m.apply(this, l);
        l.addView(vm, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, (int) (180 * dp)));
        View sep = new View(this);
        l.addView(sep, new LinearLayout.LayoutParams(1, (int) (40 * dp)));
        RemoteViews c = new WidgetChico().dibujar(this, d);
        View vc = c.apply(this, l);
        l.addView(vc, new LinearLayout.LayoutParams((int) (180 * dp), (int) (90 * dp)));
        setContentView(l);
    }
}
