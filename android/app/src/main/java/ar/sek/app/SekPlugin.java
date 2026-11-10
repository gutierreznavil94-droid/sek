package ar.sek.app;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.Ringtone;
import android.media.RingtoneManager;

import androidx.activity.result.ActivityResult;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Puente de la web con Android: widgets, accesos directos, «Buscar actualización» y las alarmas reales (Más → Alarmas). */
@CapacitorPlugin(name = "Sek")
public class SekPlugin extends Plugin {

    @PluginMethod
    public void guardarWidget(PluginCall call) {
        String datos = call.getString("datos", "{}");
        Datos.guardar(getContext(), datos);
        Datos.actualizarWidgets(getContext());
        call.resolve();
    }

    /** Imágenes del tema para widgets y alarma: { tema: JSON con id, fondos, alarma }. */
    @PluginMethod
    public void guardarTema(PluginCall call) {
        try {
            TemaVisual.guardar(getContext(), new org.json.JSONObject(call.getString("tema", "{}")));
        } catch (Exception ignorado) {
            // Tema mal armado: quedan las imágenes de Shinobi.
        }
        Datos.actualizarWidgets(getContext());
        call.resolve();
    }

    // ---------- Apps que te atrapan ----------

    @PluginMethod
    public void vigiaGuardar(PluginCall call) {
        Vigia.guardar(getContext(), call.getString("config", "{}"));
        call.resolve();
    }

    @PluginMethod
    public void vigiaEstado(PluginCall call) {
        JSObject r = new JSObject();
        r.put("uso", Vigia.tienePermisoUso(getContext()));
        r.put("encima", Vigia.puedeEncima(getContext()));
        r.put("activo", Vigia.activo(getContext()));
        if (Vigia.activo(getContext())) Vigia.arrancarOParar(getContext());
        call.resolve(r);
    }

    @PluginMethod
    public void vigiaApps(PluginCall call) {
        new Thread(() -> {
            JSObject r = new JSObject();
            r.put("apps", Vigia.appsInstaladas(getContext()).toString());
            JSObject min = new JSObject();
            if (Vigia.tienePermisoUso(getContext())) {
                for (java.util.Map.Entry<String, Long> x : Vigia.usoDeHoy(getContext()).ms.entrySet()) min.put(x.getKey(), x.getValue() / 60_000L);
            }
            r.put("minutos", min);
            call.resolve(r);
        }).start();
    }

    @PluginMethod
    public void vigiaPermiso(PluginCall call) {
        String cual = call.getString("cual", "uso");
        Intent i;
        if ("encima".equals(cual) && Build.VERSION.SDK_INT >= 23) {
            i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getContext().getPackageName()));
        } else {
            i = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            if (Build.VERSION.SDK_INT >= 29) i.setData(Uri.parse("package:" + getContext().getPackageName()));
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(i);
        } catch (Exception e) {
            getContext().startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }
        call.resolve();
    }

    @PluginMethod
    public void leerPendientes(PluginCall call) {
        JSObject r = new JSObject();
        r.put("acciones", Datos.sacarPendientes(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void rutaPendiente(PluginCall call) {
        String ruta = Datos.prefs(getContext()).getString(Datos.CLAVE_RUTA, null);
        Datos.prefs(getContext()).edit().remove(Datos.CLAVE_RUTA).apply();
        JSObject r = new JSObject();
        r.put("ruta", ruta);
        call.resolve(r);
    }

    @PluginMethod
    public void version(PluginCall call) {
        JSObject r = new JSObject();
        try {
            PackageInfo p = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            r.put("nombre", p.versionName);
            r.put("codigo", Build.VERSION.SDK_INT >= 28 ? (int) p.getLongVersionCode() : p.versionCode);
        } catch (Exception e) {
            r.put("nombre", "");
            r.put("codigo", 0);
        }
        call.resolve(r);
    }

    @PluginMethod
    public void puedeInstalar(PluginCall call) {
        JSObject r = new JSObject();
        r.put("puede", Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(r);
    }

    /** Abre el ajuste «Instalar apps desconocidas» para SEK (solo la primera vez hace falta). */
    @PluginMethod
    public void pedirPermisoInstalar(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 26) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    /** Baja el APK a la caché y abre el instalador de Android (instala encima: misma firma, los datos quedan). */
    @PluginMethod
    public void descargarEInstalar(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Falta el link del APK");
            return;
        }
        new Thread(() -> {
            try {
                File carpeta = new File(getContext().getCacheDir(), "actualizacion");
                if (!carpeta.exists() && !carpeta.mkdirs()) throw new Exception("No se pudo crear la carpeta");
                File apk = new File(carpeta, "sek.apk");
                bajar(url, apk);
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(uri, "application/vnd.android.package-archive");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? "No se pudo bajar" : e.getMessage());
            }
        }).start();
    }

    /** GitHub redirige el link del Release a otro servidor: se siguen las redirecciones a mano. */
    private static void bajar(String direccion, File destino) throws Exception {
        String actual = direccion;
        for (int saltos = 0; saltos < 6; saltos++) {
            HttpURLConnection c = (HttpURLConnection) new URL(actual).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(20_000);
            c.setReadTimeout(60_000);
            int codigo = c.getResponseCode();
            if (codigo >= 300 && codigo < 400) {
                actual = new URL(new URL(actual), c.getHeaderField("Location")).toString();
                c.disconnect();
                continue;
            }
            if (codigo != 200) throw new Exception("El servidor respondió " + codigo);
            try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(destino)) {
                byte[] b = new byte[64 * 1024];
                int n;
                while ((n = in.read(b)) > 0) out.write(b, 0, n);
            } finally {
                c.disconnect();
            }
            return;
        }
        throw new Exception("Demasiadas redirecciones");
    }

    // ---------- Alarmas reales (modo «Alarma» de Más → Alarmas) ----------

    @PluginMethod
    public void programarAlarma(PluginCall call) {
        JSONObject a = new JSONObject();
        try {
            a.put("id", call.getString("id", ""));
            a.put("instante", call.getData().optLong("instante"));
            a.put("titulo", call.getString("titulo", "SEK"));
            a.put("cuerpo", call.getString("cuerpo", ""));
            a.put("vibrar", call.getBoolean("vibrar", true));
            a.put("sonido", call.getString("sonido", "sek"));
        } catch (Exception e) {
            call.reject("Datos de alarma inválidos");
            return;
        }
        Alarmas.programar(getContext(), a);
        call.resolve();
    }

    @PluginMethod
    public void cancelarAlarma(PluginCall call) {
        String id = call.getString("id", "");
        Alarmas.cancelar(getContext(), id);
        Alarmas.cancelar(getContext(), id + ":pospuesta");
        call.resolve();
    }

    @PluginMethod
    public void cancelarAlarmas(PluginCall call) {
        Alarmas.cancelarPorPrefijo(getContext(), call.getString("prefijo", ""));
        call.resolve();
    }

    @PluginMethod
    public void listarAlarmas(PluginCall call) {
        JSObject r = new JSObject();
        r.put("alarmas", Alarmas.listar(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void probarAlarma(PluginCall call) {
        int segundos = call.getInt("segundos", 5);
        JSONObject a = new JSONObject();
        try {
            a.put("id", "prueba:" + System.currentTimeMillis());
            a.put("instante", System.currentTimeMillis() + segundos * 1000L);
            a.put("titulo", "Alarma de prueba");
            a.put("cuerpo", "Así suena una Alarma de SEK. Tocá Apagar o Posponer 5 min.");
            a.put("vibrar", call.getBoolean("vibrar", true));
            a.put("sonido", call.getString("sonido", "sek"));
        } catch (Exception e) {
            call.reject("No se pudo armar la prueba");
            return;
        }
        Alarmas.programar(getContext(), a);
        call.resolve();
    }

    @PluginMethod
    public void estadoAlarmas(PluginCall call) {
        JSObject r = new JSObject();
        r.put("exactas", Alarmas.puedeExactas(getContext()));
        boolean completa = true;
        if (Build.VERSION.SDK_INT >= 34) {
            NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            completa = nm == null || nm.canUseFullScreenIntent();
        }
        r.put("pantallaCompleta", completa);
        call.resolve(r);
    }

    @PluginMethod
    public void abrirAjusteAlarmas(PluginCall call) {
        String cual = call.getString("cual", "exactas");
        Uri paquete = Uri.parse("package:" + getContext().getPackageName());
        Intent i;
        if ("notificaciones".equals(cual) && Build.VERSION.SDK_INT >= 26) i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        else if ("pantalla".equals(cual) && Build.VERSION.SDK_INT >= 34) i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, paquete);
        else if (Build.VERSION.SDK_INT >= 31) i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, paquete);
        else i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, paquete);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(i);
        } catch (Exception e) {
            getContext().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, paquete).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }
        call.resolve();
    }

    /** Selector de tonos de Android (alarmas y tonos del celu). */
    @PluginMethod
    public void elegirTono(PluginCall call) {
        Intent i = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER);
        i.putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALARM | RingtoneManager.TYPE_RINGTONE | RingtoneManager.TYPE_NOTIFICATION);
        i.putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Sonido de la alarma");
        i.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false);
        i.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true);
        startActivityForResult(call, i, "tonoElegido");
    }

    @ActivityCallback
    private void tonoElegido(PluginCall call, ActivityResult resultado) {
        JSObject r = new JSObject();
        Intent datos = resultado.getData();
        Uri u = datos == null ? null : datos.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
        if (u == null) {
            r.put("uri", null);
            r.put("nombre", "");
        } else {
            r.put("uri", u.toString());
            String nombre = "Tono del celu";
            try {
                Ringtone t = RingtoneManager.getRingtone(getContext(), u);
                if (t != null) nombre = t.getTitle(getContext());
            } catch (Exception ignorado) {
                // Queda el nombre genérico.
            }
            r.put("nombre", nombre);
        }
        call.resolve(r);
    }
}
