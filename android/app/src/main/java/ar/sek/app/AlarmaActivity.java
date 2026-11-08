package ar.sek.app;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Pantalla completa de la alarma sonando (se ve aunque el celu esté bloqueado). «Apagar» o «Posponer 5 min». */
public class AlarmaActivity extends Activity {
    private final BroadcastReceiver alTerminar = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent i) {
            finish();
        }
    };

    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setContentView(R.layout.activity_alarma);
        mostrar(getIntent());
        findViewById(R.id.alarma_apagar).setOnClickListener(v -> enviar(AlarmaServicio.APAGAR));
        findViewById(R.id.alarma_posponer).setOnClickListener(v -> enviar(AlarmaServicio.POSPONER));
        ContextCompat.registerReceiver(this, alTerminar, new IntentFilter(AlarmaServicio.FIN), ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        mostrar(intent);
    }

    private void mostrar(Intent intent) {
        JSONObject a;
        try {
            a = new JSONObject(intent.getStringExtra(AlarmaServicio.EXTRA_ALARMA));
        } catch (Exception e) {
            a = new JSONObject();
        }
        ((TextView) findViewById(R.id.alarma_hora)).setText(new SimpleDateFormat("HH:mm", Locale.US).format(new Date()));
        String titulo = a.optString("titulo", "SEK");
        ImageView t = findViewById(R.id.alarma_titulo);
        t.setImageBitmap(Dibujo.titulo(this, titulo, 30));
        t.setContentDescription(titulo);
        ((TextView) findViewById(R.id.alarma_cuerpo)).setText(a.optString("cuerpo"));
    }

    private void enviar(String accion) {
        startService(new Intent(this, AlarmaServicio.class).setAction(accion));
        finish();
    }

    @Override
    public void onBackPressed() {
        // Atrás no apaga la alarma: hay que elegir Apagar o Posponer.
    }

    @Override
    protected void onDestroy() {
        try { unregisterReceiver(alTerminar); } catch (Exception ignorado) { /* ya quitado */ }
        super.onDestroy();
    }
}
