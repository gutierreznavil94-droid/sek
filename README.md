# Sistema de progreso (90 días)

App web instalable en el móvil (PWA) para convertir una visión personal en acciones diarias, medir el cumplimiento con honestidad y mostrar el progreso en ciclos de 90 días. Proyecto independiente: no usa nada de Tumi Mapa.

- **Datos:** viven solo en el teléfono (IndexedDB). Sin cuentas ni servidor.
- **Día:** de 00:00 a 00:00 en `America/Argentina/Cordoba` (configurable). El panel muestra siempre «Día X de 90».
- **Tres números que no se mezclan:** XP/nivel (esfuerzo acumulado, nunca baja), atributos (% de cumplimiento en 14 días, sube o baja) y objetivos de fase.

## Requisitos

Node 20 o más nuevo y npm.

## Ejecutar

```bash
npm install
npm run dev        # abre http://localhost:5173
```

Para verla en el teléfono dentro de la misma red Wi-Fi: `npm run dev -- --host` y abrí la dirección que imprime.

## Probar

```bash
npm test           # todas las pruebas (dominio y servicios)
npm run test:watch
```

Las pruebas cubren: fechas y cambio de día a medianoche, el compromiso de acostarse que cruza las 00:00, XP sin duplicar (completar dos veces no suma dos veces), deshacer y corregir con historial, reglas que solo afectan al futuro, niveles, atributos, rachas, temporizador de juego que sobrevive al cierre y reparte sesiones entre días, exportar e importar.

## Compilar y publicar

```bash
npm run build      # genera la carpeta dist/
npm run preview    # sirve dist/ para probarla
```

`dist/` es un sitio estático. Para instalarla en el móvil hace falta servirla por **https**. Opciones gratuitas: Netlify (arrastrar la carpeta `dist/`), Cloudflare Pages o GitHub Pages. Después, en Chrome del teléfono: menú → «Instalar aplicación» (o «Añadir a pantalla de inicio»). Los datos no viajan al hosting: solo descarga la app.

## Estructura

```
src/
  domain/      reglas puras: fechas, niveles, xp, cumplimiento, juego (con pruebas)
  data/        tipos, base de datos Dexie y datos iniciales
  services/    casos de uso: día, ciclo, xp, juego, inicios, revisiones, acciones, exportar
  reminders/   interfaz Recordatorios (implementación web; Android después)
  ui/          React: Layout, páginas y componentes
```

Cada capa habla solo con la de abajo. Para añadir un servidor o sincronización, se añade otra implementación en `data/` sin tocar `domain/` ni `ui/`.

## Avisos: qué funciona

- Con la app abierta o recién minimizada: avisos en pantalla, vibración y notificación del navegador (si das permiso).
- Con la app cerrada: la web **no** puede sonar a una hora fija. Usá el reloj del teléfono con las horas que lista «Más → Alarmas del teléfono». La versión Android (Capacitor + Local Notifications) está prevista como etapa posterior; `reminders/recordatorios.ts` es la interfaz que se reemplaza.

## Copia de seguridad

Si borrás los datos del navegador, desinstalás la app o perdés el teléfono, los datos se pierden. «Más → Copia de seguridad» exporta todo en JSON (y los registros en CSV) y la app avisa cada 7 días sin exportar.

## Decisiones de XP (valores iniciales, editables)

| Acción | XP | Máximo |
| --- | --- | --- |
| Entrenamiento (42 min completos, un toque, pilar) | 30 | 1 por día programado |
| Meta propia cumplida en su fecha | 30 (editable por meta) | 1 por meta |
| Contadores: meta diaria de flexiones (70) y dominadas (35) | 10 | 1 por día y contador |
| Dibujar manga (≥ 15 min, hasta 20:50, pilar) | 15 | 1 por día |
| Avanzar en la empresa (hasta 20:50, pilar) | 15 | 1 por día |
| Dormir a horario («Dejo celu» hasta 21:15, pilar) | 20 | 1 por noche |
| Respetar el límite de juego (60 min lun–vie, 120 sáb/dom/feriados) | 15 | 1 por día, al cerrar el día |
| Compromiso diario | 10 | hasta 5 con XP por día |
| Inicio con 3-2-1 / Siguiente acción | 5 | 3 por día, una vez por tarea |
| Revisión diaria | 10 | 1 por día |
| Revisión semanal | 25 | 1 por semana |
| Racha de 7 días (≥ 80 %) | 20 | 1 por bloque de 7 |

Nivel: pasar del nivel n al n+1 cuesta 100 × n XP (base configurable). Nivel 5 a 1.000 XP, nivel 10 a 4.500. Sin tope. No es una fórmula científica: revisalos tras la primera semana; los cambios solo afectan al futuro.
