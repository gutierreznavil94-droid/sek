package ar.sek.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;

/**
 * Imágenes del tema elegido para lo que corre fuera de la app (widgets y alarma). Un tema subido por la persona
 * las trae; la app las manda una vez al cambiar de tema y quedan como archivos. Sin imágenes, la tormenta de Shinobi.
 */
final class TemaVisual {
    private TemaVisual() {}

    private static File carpeta(Context c) {
        return new File(c.getFilesDir(), "tema");
    }

    /** Guarda las imágenes del tema ({ id, fondos: [data:…], alarma: data:… }). Sin imágenes, borra las anteriores. */
    static void guardar(Context c, JSONObject t) {
        File dir = carpeta(c);
        File[] viejos = dir.listFiles();
        if (viejos != null) for (File f : viejos) f.delete();
        JSONArray fondos = t.optJSONArray("fondos");
        String alarma = t.optString("alarma", "");
        if ((fondos == null || fondos.length() == 0) && alarma.isEmpty()) return;
        dir.mkdirs();
        if (fondos != null) for (int i = 0; i < Math.min(4, fondos.length()); i++) escribir(new File(dir, "widget_" + (i + 1)), fondos.optString(i));
        if (!alarma.isEmpty()) escribir(new File(dir, "alarma"), alarma);
    }

    private static void escribir(File f, String dataUrl) {
        int coma = dataUrl.indexOf(',');
        if (!dataUrl.startsWith("data:image/") || coma < 0) return;
        try (FileOutputStream o = new FileOutputStream(f)) {
            o.write(Base64.decode(dataUrl.substring(coma + 1), Base64.DEFAULT));
        } catch (Exception ignorado) {
            f.delete();
        }
    }

    private static int cuantosFondos(Context c) {
        int n = 0;
        while (n < 4 && new File(carpeta(c), "widget_" + (n + 1)).exists()) n++;
        return n;
    }

    static boolean tieneFondos(Context c) {
        return cuantosFondos(c) > 0;
    }

    /** Fondo `i` (1 a 4) del widget, achicado y con un velo para que se lea el texto blanco. Null: tormenta. */
    static Bitmap fondoWidget(Context c, int i) {
        int n = cuantosFondos(c);
        if (n == 0) return null;
        Bitmap b = leer(new File(carpeta(c), "widget_" + (((i - 1) % n) + 1)), 640);
        if (b == null) return null;
        Bitmap m = b.isMutable() ? b : b.copy(Bitmap.Config.ARGB_8888, true);
        new Canvas(m).drawColor(Color.argb(95, 40, 20, 35));
        return m;
    }

    /** Fondo de la pantalla de alarma del tema, o null (tormenta). */
    static Bitmap alarma(Context c) {
        return leer(new File(carpeta(c), "alarma"), 1080);
    }

    private static Bitmap leer(File f, int anchoMax) {
        if (!f.exists()) return null;
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(f.getPath(), o);
        int paso = 1;
        while (o.outWidth / (paso * 2) >= anchoMax) paso *= 2;
        BitmapFactory.Options o2 = new BitmapFactory.Options();
        o2.inSampleSize = paso;
        o2.inMutable = true;
        Bitmap b = BitmapFactory.decodeFile(f.getPath(), o2);
        if (b == null || b.getWidth() <= anchoMax) return b;
        int alto = Math.round(b.getHeight() * (anchoMax / (float) b.getWidth()));
        return Bitmap.createScaledBitmap(b, anchoMax, alto, true);
    }
}
