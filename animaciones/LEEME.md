# Carpeta `animaciones/`: las poses del shinobi

El shinobi es un **muñeco articulado** dibujado en código. Cada pose es una lista de ángulos guardada en `poses.json`, en esta carpeta. Tus dibujos a mano **no se ponen tal cual en la app**: sirven de guía para ajustar esas poses y el diseño del personaje.

## Cómo trabajamos con tus dibujos

1. **Dibujá una pose** en hoja blanca, con birome o marcador negro, y sacale una foto de frente, con buena luz.
2. **Opción A (vos):** en la app, Más → Ver animaciones → Editar pose. Elegí la pose, tocá «Cargar foto de tu dibujo» y movés los deslizadores hasta que el muñeco calce con el dibujo. «Guardar pose» la deja en tu teléfono.
3. **Opción B (yo):** me mandás la foto en el chat y yo la traduzco a ángulos en `poses.json`.
4. Se mira en la vista previa (los botones de arriba de esa misma página) y, si está bien, queda.

Para pasarme las poses que guardaste en el teléfono: «Exportar poses» descarga un `poses.json`; mandámelo o copialo a esta carpeta. «Restaurar» vuelve a la pose que trae la app.

## El archivo `poses.json`

```json
{
  "corte": { "cadera": [8, -2], "torso": 32, "cabeza": 4, "sombrero": -4, "bufanda": 85,
             "brazoDer": 68, "antebrazoDer": -4, "brazoIzq": 25, "antebrazoIzq": 35,
             "musloDer": 60, "piernaDer": -45, "musloIzq": -38, "piernaIzq": -8, "katana": -4 }
}
```

- Las poses son: `guardia`, `carrera`, `corte`, `bloqueo`, `caramelo`, `meditar` y `victoria`.
- Los ángulos van en grados. **0** = la parte cuelga derecha hacia abajo (brazos, piernas) o está recta (torso, cabeza). **Positivo = hacia adelante** (el personaje mira a la derecha).
- `cadera` es `[x, y]` en píxeles: `y` negativo sube el cuerpo, positivo lo baja (para agacharse o arrodillarse).
- `katana` es el ángulo respecto del antebrazo; `null` = guardada en la vaina.
- «Der» es el lado de adelante (el que se ve más cerca) e «Izq» el de atrás.
- Si una pose falta o está mal escrita, se usa la que viene con la app. Cambiar un número acá cambia la pose en la vista previa sin tocar el código.

## Las animaciones

| Animación | Poses, en orden | Duración |
|---|---|---|
| Cumplir un pilar (ejecución) | guardia → carrera → corte | 1,5 s |
| Sumar una serie (parry) | guardia → bloqueo | 0,6 s |
| 3-2-1 y Siguiente acción | caramelo → meditar | 1,2 s |
| Nivel, racha de 7 y fase | guardia → carrera → corte, después victoria (sin sombrero: vuela) | 2 s |

Entre una pose y la siguiente la app calcula los pasos intermedios, así que con pocas poses alcanza.

## Estilo

Tinta sobre papel claro: silueta negra sólida, y el rojo solo en el borde del sombrero, la bufanda y la sangre. Sombrero kasa ancho, katana en la mano y la segunda en la vaina, a la cintura.
