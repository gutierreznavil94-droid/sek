package ar.sek.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;

/**
 * Dibujos de los widgets que se llenan: la botella de agua y la manzana. Se dibujan en una caja de 100×150
 * (las mismas formas que las imágenes de ejemplo de la vista previa, armadas con herramientas/widgets-vista.py).
 */
final class Dibujo {
    private Dibujo() {}

    private static final int ANCHO = 200, ALTO = 300; // píxeles del bitmap (caja 100×150 al doble)
    private static final int PAPEL = Color.parseColor("#F1EBDF");
    private static final int AGUA = Color.parseColor("#4FA8E8");
    private static final int ROJO = Color.parseColor("#D2283C");
    private static final int VERDE = Color.parseColor("#4CAF50");
    private static final int TALLO = Color.parseColor("#8A5A2B");

    private static Paint pintura(int color, Paint.Style estilo, float grosor) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(color);
        p.setStyle(estilo);
        p.setStrokeWidth(grosor);
        p.setStrokeJoin(Paint.Join.ROUND);
        p.setStrokeCap(Paint.Cap.ROUND);
        return p;
    }

    private static float acotar(float f) {
        return f < 0 ? 0 : f > 1 ? 1 : f;
    }

    /** Cuerpo de la botella (sin tapa). */
    private static Path cuerpoBotella() {
        Path p = new Path();
        p.moveTo(40, 30);
        p.cubicTo(40, 40, 18, 40, 18, 50);
        p.lineTo(18, 138);
        p.quadTo(18, 148, 28, 148);
        p.lineTo(72, 148);
        p.quadTo(82, 148, 82, 138);
        p.lineTo(82, 50);
        p.cubicTo(82, 40, 60, 40, 60, 30);
        p.lineTo(60, 16);
        p.lineTo(40, 16);
        p.close();
        return p;
    }

    /** Botella llena según {@code fraccion} (0 a 1; más de 1 = rebalsa, se ve llena). */
    static Bitmap botella(float fraccion) {
        float f = acotar(fraccion);
        Bitmap b = Bitmap.createBitmap(ANCHO, ALTO, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        c.scale(ANCHO / 100f, ALTO / 150f);
        Path cuerpo = cuerpoBotella();
        // Vidrio.
        c.drawPath(cuerpo, pintura(Color.argb(60, 241, 235, 223), Paint.Style.FILL, 0));
        // Agua: desde abajo (148) hasta el hombro (44) cuando está llena.
        if (f > 0) {
            float tope = 148 - f * (148 - 44);
            c.save();
            c.clipPath(cuerpo);
            c.drawRect(0, tope, 100, 150, pintura(AGUA, Paint.Style.FILL, 0));
            c.drawRect(0, tope, 100, tope + 3, pintura(Color.argb(150, 255, 255, 255), Paint.Style.FILL, 0));
            c.restore();
        }
        // Brillo y borde.
        c.drawLine(26, 60, 26, 132, pintura(Color.argb(110, 255, 255, 255), Paint.Style.STROKE, 4));
        c.drawPath(cuerpo, pintura(PAPEL, Paint.Style.STROKE, 4));
        c.drawRoundRect(new RectF(37, 3, 63, 16), 3, 3, pintura(PAPEL, Paint.Style.FILL, 0));
        return b;
    }

    /** Silueta de la manzana. */
    private static Path cuerpoManzana() {
        Path p = new Path();
        p.moveTo(50, 62);
        p.cubicTo(62, 50, 92, 52, 94, 84);
        p.cubicTo(96, 114, 76, 138, 62, 138);
        p.cubicTo(56, 138, 54, 135, 50, 135);
        p.cubicTo(46, 135, 44, 138, 38, 138);
        p.cubicTo(24, 138, 4, 114, 6, 84);
        p.cubicTo(8, 52, 38, 50, 50, 62);
        p.close();
        return p;
    }

    /** Manzana llena (roja) desde abajo según {@code fraccion} de la fruta del día. */
    static Bitmap manzana(float fraccion) {
        float f = acotar(fraccion);
        // Caja recortada a la manzana (y de 36 a 141) para que se vea del mismo tamaño que la botella.
        Bitmap b = Bitmap.createBitmap(ANCHO, ANCHO * 105 / 100, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        c.scale(ANCHO / 100f, ANCHO / 100f);
        c.translate(0, -36);
        Path cuerpo = cuerpoManzana();
        c.drawPath(cuerpo, pintura(Color.argb(60, 241, 235, 223), Paint.Style.FILL, 0));
        if (f > 0) {
            float tope = 138 - f * (138 - 54);
            c.save();
            c.clipPath(cuerpo);
            c.drawRect(0, tope, 100, 150, pintura(ROJO, Paint.Style.FILL, 0));
            c.restore();
        }
        // Tallo y hoja.
        c.drawLine(50, 62, 55, 44, pintura(TALLO, Paint.Style.STROKE, 5));
        Path hoja = new Path();
        hoja.moveTo(55, 52);
        hoja.cubicTo(62, 40, 78, 40, 82, 44);
        hoja.cubicTo(76, 56, 62, 58, 55, 52);
        hoja.close();
        c.drawPath(hoja, pintura(VERDE, Paint.Style.FILL, 0));
        c.drawLine(30, 80, 26, 100, pintura(Color.argb(110, 255, 255, 255), Paint.Style.STROKE, 4));
        c.drawPath(cuerpo, pintura(PAPEL, Paint.Style.STROKE, 4));
        return b;
    }

    /**
     * Título con la letra de pincel de Progreso (Brocha): blanco papel, con la sombra roja corrida y un brillo rojo
     * suave, como «.camino-frase». Los widgets no aceptan fuentes propias en un TextView, así que va como imagen.
     */
    static Bitmap titulo(Context c, String texto, float sp) {
        float px = sp * c.getResources().getDisplayMetrics().scaledDensity;
        Typeface t = null;
        try {
            t = androidx.core.content.res.ResourcesCompat.getFont(c, R.font.brocha);
        } catch (Exception ignorado) {
            // Queda la del sistema.
        }
        if (t == null) t = Typeface.DEFAULT_BOLD;
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setTypeface(t);
        p.setTextSize(px);
        Paint.FontMetrics m = p.getFontMetrics();
        float corrida = px / 9f;
        float margen = px / 5f;
        int ancho = (int) Math.ceil(p.measureText(texto) + margen * 2 + corrida);
        int alto = (int) Math.ceil(m.descent - m.ascent + margen * 2 + corrida);
        Bitmap b = Bitmap.createBitmap(Math.max(ancho, 1), Math.max(alto, 1), Bitmap.Config.ARGB_8888);
        Canvas k = new Canvas(b);
        float x = margen, y = margen - m.ascent;
        // Brillo rojo suave.
        Paint brillo = new Paint(p);
        brillo.setColor(Color.argb(120, 200, 16, 46));
        brillo.setMaskFilter(new android.graphics.BlurMaskFilter(px / 2.5f, android.graphics.BlurMaskFilter.Blur.NORMAL));
        k.drawText(texto, x, y, brillo);
        // Sombra roja corrida (3px 3px en la web).
        Paint sombra = new Paint(p);
        sombra.setColor(Color.argb(217, 200, 16, 46));
        k.drawText(texto, x + corrida, y + corrida, sombra);
        // Texto blanco papel, apenas engrosado.
        Paint blanco = new Paint(p);
        blanco.setColor(Color.parseColor("#F3EFE6"));
        blanco.setStyle(Paint.Style.FILL_AND_STROKE);
        blanco.setStrokeWidth(px / 40f);
        k.drawText(texto, x, y, blanco);
        return b;
    }
}
