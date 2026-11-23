-- Módulo dia (parte 1): pilares y compromisos de cada día, reglas de XP de cada pilar,
-- días cerrados, foto diaria de atributos, excepciones y la marca del Tajo.
-- Los id son texto, como en la app vieja (entrenamiento, manga, acostarse:2026-11-23...).

CREATE TABLE acciones (
  usuario_id    integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id            text NOT NULL,
  nombre        text NOT NULL,
  tipo          text NOT NULL CHECK (tipo IN ('compromiso', 'entrenamiento', 'acostarse', 'limite_juego', 'revision_diaria', 'revision_semanal', 'comida_plan')),
  dias          jsonb NOT NULL DEFAULT '[]',   -- días de la semana (0 dom .. 6 sáb)
  hora          text,                          -- HH:MM prevista
  hora_limite   text,                          -- HH:MM: después queda «tarde», sin XP
  pilar         boolean NOT NULL DEFAULT false,
  atributo_ids  jsonb NOT NULL DEFAULT '[]',
  peso          integer NOT NULL DEFAULT 1 CHECK (peso BETWEEN 1 AND 5),
  activa        boolean NOT NULL DEFAULT true,
  orden         integer NOT NULL DEFAULT 0,
  opciones      jsonb NOT NULL DEFAULT '{}',   -- condicion, pregunta, horasPorDia, minutosMinimos, minutosExtra, xpExtra, duracionMinutos, horaLimiteInicio, avisoInicio, objetivoIds
  creado        bigint NOT NULL,
  PRIMARY KEY (usuario_id, id)
);

-- Cuánta XP da cada pilar desde tal fecha. Cambiar la XP crea una regla nueva: lo ganado no cambia.
CREATE TABLE reglas_xp (
  usuario_id    integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id            text NOT NULL,
  accion_id     text NOT NULL,
  xp            integer NOT NULL CHECK (xp >= 0),
  maximo        integer NOT NULL DEFAULT 1,
  periodo       text NOT NULL DEFAULT 'dia' CHECK (periodo IN ('dia', 'semana')),
  valida_desde  date NOT NULL,
  creado        bigint NOT NULL,
  PRIMARY KEY (usuario_id, id),
  UNIQUE (usuario_id, accion_id, valida_desde)
);

-- Un compromiso = una acción en una fecha. id = '<accion>:<fecha>'.
CREATE TABLE compromisos (
  usuario_id          integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id                  text NOT NULL,
  accion_id           text NOT NULL,
  fecha               date NOT NULL,
  hora_prevista       text,
  estado              text NOT NULL CHECK (estado IN ('pendiente', 'iniciado', 'completado', 'tarde', 'omitido', 'reprogramado', 'no_registrado')),
  inicio_real         bigint,
  fin_real            bigint,
  reprogramado_a      date,
  reprogramado_desde  date,
  minutos             integer,
  nota                text,
  respuesta           text,
  retraso_minutos     integer,
  extra               boolean NOT NULL DEFAULT false,
  actualizado         bigint NOT NULL,
  PRIMARY KEY (usuario_id, id)
);
CREATE INDEX compromisos_fecha ON compromisos(usuario_id, fecha);

CREATE TABLE dias_cerrados (
  usuario_id     integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha          date NOT NULL,
  cumplidos      integer NOT NULL,
  programados    integer NOT NULL,
  porcentaje     integer,             -- null: excepción o nada programado
  minutos_juego  integer NOT NULL DEFAULT 0,
  excepcion      boolean NOT NULL DEFAULT false,
  cerrado_en     bigint NOT NULL,
  PRIMARY KEY (usuario_id, fecha)
);

-- Foto del valor de cada atributo al cerrar un día (para la tendencia «+5 en 7 días»).
CREATE TABLE atributos_diarios (
  usuario_id    integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha         date NOT NULL,
  atributo_id   text NOT NULL,
  valor         integer,
  cumplidos     integer NOT NULL,
  programados   integer NOT NULL,
  PRIMARY KEY (usuario_id, atributo_id, fecha)
);

-- Días que no cuentan (enfermedad, viaje): no cortan la racha ni restan.
CREATE TABLE excepciones (
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha       date NOT NULL,
  motivo      text NOT NULL,
  creado      bigint NOT NULL,
  PRIMARY KEY (usuario_id, fecha)
);

-- El Tajo: la última vez que la app estuvo a la vista y el día en que ya salió.
CREATE TABLE dia_vistas (
  usuario_id    integer PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  ultima_vista  bigint,
  tajo_fecha    date
);
