package ar.sek.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * La app: la misma web de SEK adentro (Capacitor), más el plugin «Sek» (widgets, accesos directos y actualización).
 * Un acceso directo o un toque en el widget llega con el extra «ruta» («vaso», «dejo-celu», «batalla», «revision»).
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SekPlugin.class);
        super.onCreate(savedInstanceState);
        guardarRuta(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        guardarRuta(intent);
        // La app ya estaba abierta: se le avisa a la web para que lo atienda ya.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('sek-atajo'))", null));
        }
    }

    private void guardarRuta(Intent intent) {
        if (intent == null) return;
        String ruta = intent.getStringExtra("ruta");
        if (ruta != null && !ruta.isEmpty()) {
            Datos.prefs(this).edit().putString(Datos.CLAVE_RUTA, ruta).apply();
            intent.removeExtra("ruta");
        }
    }
}
