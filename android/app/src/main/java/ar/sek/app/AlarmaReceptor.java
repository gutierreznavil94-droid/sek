package ar.sek.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONObject;

/** Recibe la hora de una alarma (arranca el sonido) y el reinicio del celu (vuelve a programarlas). */
public class AlarmaReceptor extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        String accion = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(accion) || "android.intent.action.LOCKED_BOOT_COMPLETED".equals(accion)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(accion)) {
            Alarmas.reprogramarTodas(c);
            return;
        }
        if (!Alarmas.ACCION_SONAR.equals(accion)) return;
        String id = intent.getStringExtra(Alarmas.EXTRA_ID);
        if (id == null) return;
        JSONObject a = Alarmas.leer(c, id);
        Alarmas.prefs(c).edit().remove(id).apply();
        if (a == null) return;
        Intent s = new Intent(c, AlarmaServicio.class);
        s.setAction(AlarmaServicio.SONAR);
        s.putExtra(AlarmaServicio.EXTRA_ALARMA, a.toString());
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(s);
        else c.startService(s);
    }
}
