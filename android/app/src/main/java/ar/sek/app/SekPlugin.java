package ar.sek.app;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Puente de la web con Android: widgets, accesos directos y «Buscar actualización» (bajar e instalar el APK). */
@CapacitorPlugin(name = "Sek")
public class SekPlugin extends Plugin {

    @PluginMethod
    public void guardarWidget(PluginCall call) {
        String datos = call.getString("datos", "{}");
        Datos.guardar(getContext(), datos);
        Datos.actualizarWidgets(getContext());
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
}
