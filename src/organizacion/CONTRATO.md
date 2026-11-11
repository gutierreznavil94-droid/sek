# Organización · contrato (v0.1.0)

Apartado de notas y tareas por «frentes». Nació del prototipo «Frentes» v14 del proyecto «Organización fácil y enfoque», que se fusionó con SEK el 5 nov 2026.

## Reglas de la carpeta

- **Sin React.** TypeScript simple que se puede pasar a JavaScript tal cual, porque más adelante vive también en Tumi (HTML + JS simple).
- **No depende de nada de SEK** (ni de `src/temas/`). Nada de afuera se importa acá. SEK la monta dentro de una pantalla.
- **Una sola parte guarda y lee**: el `Almacen` que le pasa la app madre. En SEK es la base local del teléfono; en Tumi será su servidor.
- **Lo visual se pide por nombre genérico** al tema (colores, íconos, eventos). Si el tema no responde, usa un respaldo simple.
- Lo propio de SEK (XP, pilares, rival) no entra acá. Hoy las tareas **no dan XP**.
- En Tumi esta carpeta nunca se edita: se trae desde SEK con confirmación de Navil.

## Cómo se monta

```ts
import { montarOrganizacion, montarTiraHoy } from './organizacion'

const pantalla = montarOrganizacion(lugar, {
  almacen,            // { leer(): Promise<unknown>, guardar(datos): Promise<void> }
  tema,               // { color(nombre), icono(nombre), evento(nombre, detalle), fuente?(nombre) }
  nombre: 'Navil',    // se ve en «Navil → Facu»
  hoy: () => '2026-11-05',
  alAvisar: (aviso, { frente, tarea }) => {},
  abajo: '80px',      // dónde va el botón «+», para no tapar la barra de la app
  abrir: 'anotar',    // opcional: 'anotar' o el id de un frente (para widgets y accesos directos)
})
pantalla.desmontar()

const tira = montarTiraHoy(lugar, { almacen, tema, nombre, hoy, alAbrir: () => irAOrganizacion() })
```

En Vite el CSS entra solo (`vista.ts` importa `estilos.css`). En una página HTML simple, se agrega `<link rel="stylesheet" href="organizacion/estilos.css">`.

## Avisos a la app madre (`alAvisar`)

| Aviso | Cuándo |
|---|---|
| `tarea.hecha` | Se marcó hecha (en la pantalla, en la tira o con «Ya lo hice») |
| `tarea.creada` | Salió de Clasificar a un frente |
| `tarea.cambiada` | Cambió algo de una tarea (o volvió a por hacer) |
| `frente.cambiado` | Se finalizó, reabrió o eliminó un frente |

## Lo que se le pide al tema

**Eventos visuales** (los mismos de Temas): `completar` (al marcar hecha), `aparecer` (al abrir una hoja), `logro` (cuando no queda nada de hoy), `alerta` (falta clasificar algo).

**Colores** (quedan como variables `--fr-*`): `color-fondo`, `color-tarjeta`, `color-tarjeta-2`, `color-borde`, `color-texto`, `color-texto-2`, `color-texto-3`, `color-principal`, `color-hecho`, `color-aviso`, `color-con-alguien`, `color-peligro`, `color-papel`, `color-papel-2` (sombra del papel), `color-tinta`, `color-importancia-alta`, `color-importancia-media`, `color-importancia-baja`.

**Letras** (opcional, `fuente(nombre)`, como CSS font-family): `fuente-decorativa` (kanjis y sello de hecho; queda en `--fr-pincel`).

Si el tema no da un color o una letra, se usa un respaldo **neutro** (grises y azul), nunca el look de un tema. En esta carpeta no va nada propio de Shinobi ni de otro tema.

**Íconos** (un `<svg>` o un texto corto): `icono-importancia-alta|media|baja`, `icono-rapida`, `icono-lenta`, `icono-celu`, `icono-compu`, `icono-calle`, `icono-sin-donde`, `icono-yo`, `icono-delegar`, `icono-con-alguien`, `icono-flecha`, `icono-hecho`, `icono-por-hacer`, `icono-libre`, `icono-punto`, `icono-sueltas`.

**Kanjis decorativos** (texto; vacío = no se muestran): `icono-organizacion`, `icono-hoy`, `icono-bandeja`, `icono-sueltas-fondo`, `icono-sello-hecho`, `kanji-quien`, `kanji-importancia`, `kanji-rapidez`, `kanji-donde`, `kanji-fecha`, `kanji-frente`.

## Datos (formato 1)

Se guardan como un solo objeto JSON. Solo se suman campos; las migraciones van en `normalizar()` y nunca borran lo cargado.

```ts
{
  formato: 1,
  frentes: Frente[],      // el primero suele ser «Sueltas» (tipo: 'sueltas')
  archivados: Frente[],   // finalizados (se pueden reabrir)
  bandeja: ItemBandeja[], // anotado sin clasificar
  ajustes: { limiteHoy: 3, sugerir: true, vista: 'todo' | 'solo' }
}
Frente = { id, nombre, tipo?: 'sueltas', icono, color, sub?, nota?, movido: 'AAAA-MM-DD', palabras?, no?, tareas: Tarea[], finalizado? }
Tarea  = { id, texto, estado: 'por_hacer' | 'hecho', quien: 'yo' | 'delegar' | 'alguien', quienNombre?,
           imp?: 'alta' | 'media' | 'baja', rapidez?: 'rapida' | 'lenta', donde?: 'celu' | 'compu' | 'calle',
           fecha?: 'AAAA-MM-DD', creada: ms, hecha?: ms }
ItemBandeja = { id, texto, frente?, previo?, creada: ms }
```

Sin `donde` = «Sin dónde». Sin `fecha` = «Libre». En SEK el objeto vive en la tabla `organizacion` (fila `id: 'datos'`) y viaja en la copia de seguridad.

## Decisiones que vienen del prototipo

- Bandeja sí; atajos de texto (#, @, ?) no.
- Estados: solo Por hacer y Hecho. Las hechas van al Historial plegado.
- Quién: Yo / Delegar («Navil → Facu», gris) / Necesito a alguien («Navil ∞ Facu», violeta).
- «Hoy me toca a mí» = lo mío con fecha de hoy o vencida y no hecho. Se ven de 1 a 9 a la vez.
- Clasificar es obligatorio (quién, importancia, rapidez, dónde, fecha). Si falta algo no deja elegir frente.
- Sugerir frente: solo resalta, muestra por qué palabras, aprende si elegís otro, se puede apagar, nunca elige sola.
- Sueltas: papel washi, máximo 5 a la vista, no se finaliza ni se elimina.
- Frentes: se crean, se finalizan (con Reabrir) y se eliminan con confirmación y Deshacer; al eliminar se borran sus tareas.
- Sin «Simple / Ver todo»: los detalles aparecen al tocar la tarea.

## Pendiente

- Widget de Organización en el APK (después del APK actual): las 3 de «Hoy me toca a mí», botones «+ Anotar» y «Abrir», atado a un frente.
- Exportar e importar solo Organización; vista semana; arrastrar para ordenar (hoy usa ↑↓).
