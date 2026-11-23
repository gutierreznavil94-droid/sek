-- Módulo progreso: SOLO LEE (REGLAS §8.4). No tiene tablas propias: estas vistas juntan lo que
-- progreso necesita de las tablas de los otros módulos, ya resumido por día. Progreso nunca lee
-- las tablas de otro módulo directo: lee estas vistas (y las ventanillas para lo calculado).
-- Si un módulo cambia una columna que usa una vista, su migración tiene que rehacer la vista
-- (PostgreSQL no deja borrar una columna que una vista usa: avisa enseguida).

-- XP de cada día: lo ganado, lo perdido y lo neto (sin anulados). Para la montaña.
CREATE VIEW progreso_xp_dia AS
SELECT usuario_id, fecha,
       COALESCE(SUM(cantidad) FILTER (WHERE cantidad > 0), 0)::int AS ganado,
       COALESCE(-SUM(cantidad) FILTER (WHERE cantidad < 0), 0)::int AS perdido,
       COALESCE(SUM(cantidad), 0)::int AS neto
FROM xp_registros WHERE NOT anulado
GROUP BY usuario_id, fecha;

-- Días cerrados por el módulo dia: cumplimiento y minutos de juego.
CREATE VIEW progreso_dias AS
SELECT usuario_id, fecha, cumplidos, programados, porcentaje, minutos_juego, excepcion
FROM dias_cerrados;

-- Compromisos de entrenamiento (para «entrenos hechos / previstos» del cierre de fase).
CREATE VIEW progreso_entrenos_previstos AS
SELECT c.usuario_id, c.fecha, c.estado
FROM compromisos c
JOIN acciones a ON a.usuario_id = c.usuario_id AND a.id = c.accion_id
WHERE a.tipo = 'entrenamiento' AND c.estado <> 'reprogramado';

-- Foto diaria de cada atributo (la deja dia al cerrar el día), con el nombre del atributo.
CREATE VIEW progreso_atributos_dia AS
SELECT d.usuario_id, d.fecha, d.atributo_id, at.nombre, d.valor
FROM atributos_diarios d
JOIN atributos at ON at.usuario_id = d.usuario_id AND at.id = d.atributo_id
WHERE NOT at.archivado;

-- Noches de sueño.
CREATE VIEW progreso_noches AS
SELECT usuario_id, noche, cumplido, retraso_minutos, minutos_dormido, sin_dejo_celu
FROM suenio;

-- Entrenos terminados, con el nombre de la rutina y los minutos.
CREATE VIEW progreso_entrenos AS
SELECT s.usuario_id, s.fecha, s.rutina_id, COALESCE(r.nombre, s.rutina_id) AS rutina,
       GREATEST(1, ROUND((COALESCE(s.fin, s.inicio) - s.inicio) / 60000.0))::int AS minutos
FROM sesiones_entreno s
LEFT JOIN rutinas r ON r.usuario_id = s.usuario_id AND r.id = s.rutina_id
WHERE s.estado = 'terminada';

-- Series rápidas: repeticiones por día de cada contador.
CREATE VIEW progreso_series_dia AS
SELECT rc.usuario_id, rc.contador_id, COALESCE(c.datos->>'nombre', rc.contador_id) AS nombre, rc.fecha,
       SUM(rc.cantidad)::int AS reps
FROM registros_contador rc
LEFT JOIN contadores c ON c.usuario_id = rc.usuario_id AND c.id = rc.contador_id
GROUP BY rc.usuario_id, rc.contador_id, c.datos->>'nombre', rc.fecha;

-- Comida: calorías y proteína por día.
CREATE VIEW progreso_comida_dia AS
SELECT usuario_id, fecha, ROUND(SUM(kcal))::int AS kcal, ROUND(SUM(p))::int AS proteina
FROM comidas GROUP BY usuario_id, fecha;

-- Agua: mililitros por día.
CREATE VIEW progreso_agua_dia AS
SELECT usuario_id, fecha, SUM(ml)::int AS ml FROM agua_tomas GROUP BY usuario_id, fecha;

-- Fruta: cuántas por día.
CREATE VIEW progreso_fruta_dia AS
SELECT usuario_id, fecha, COUNT(*)::int AS frutas FROM frutas GROUP BY usuario_id, fecha;

-- Peso (uno por día).
CREATE VIEW progreso_pesos AS
SELECT usuario_id, fecha, kg FROM pesos;

-- Caídas («No cumplí mi palabra»): se ve que hubo una falla, y que seguiste.
CREATE VIEW progreso_caidas AS
SELECT usuario_id, fecha, origen FROM caidas;

-- Días marcados con un texto corto.
CREATE VIEW progreso_marcas AS
SELECT usuario_id, fecha, texto FROM marcas_dia;

-- Forja: cada hábito con su estado y sus días cumplidos.
CREATE VIEW progreso_forja AS
SELECT usuario_id, id, nombre, kanji, estado, cumplidos FROM forja_habitos;
