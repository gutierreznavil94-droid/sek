package ar.sek.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

/**
 * «Apps que te atrapan» con el tema Shinobi: ventana transparente ENCIMA de la otra app con el clip del Tajo.
 * La pantalla de la otra app se corta, sale la mano y al tocarla se abre SEK con Tensión.
 */
public class TajoActivity extends Activity {
    static final String EXTRA_APP = "app";
    static final String EXTRA_MIN = "min";
    private boolean tocado = false;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
        String app = getIntent().getStringExtra(EXTRA_APP);
        long min = getIntent().getLongExtra(EXTRA_MIN, 0);
        WebView w = new WebView(this);
        w.setBackgroundColor(Color.TRANSPARENT);
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        w.addJavascriptInterface(new Puente(app == null ? "esa app" : app, min), "SekTajo");
        setContentView(w);
        w.loadUrl("file:///android_asset/public/tajo-encima.html?app=" + Uri.encode(app == null ? "" : app) + "&min=" + min);
        // Si nadie toca, a los 20 s se cierra y deja la otra app como estaba.
        w.postDelayed(this::finish, 20_000);
    }

    private final class Puente {
        private final String app;
        private final long min;
        Puente(String app, long min) { this.app = app; this.min = min; }

        @JavascriptInterface
        public void tocar() {
            runOnUiThread(() -> {
                if (tocado) return;
                tocado = true;
                String ruta = "tension|" + app.replace('|', ' ') + "|" + min;
                Datos.prefs(TajoActivity.this).edit().putString(Datos.CLAVE_RUTA, ruta).apply();
                startActivity(new Intent(TajoActivity.this, MainActivity.class).putExtra("ruta", ruta)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT));
                finish();
                overridePendingTransition(0, 0);
            });
        }
    }
}
