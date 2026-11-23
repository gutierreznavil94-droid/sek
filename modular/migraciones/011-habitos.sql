-- Módulo habitos: la Forja (hábitos que se vuelven costumbre), Mi código (reglas propias),
-- caídas («No cumplí mi palabra» / nuevo round), fotos de progreso y días marcados.
-- Los id son texto: así los que vienen de la app vieja conservan su id (y su clave de XP).

CREATE TABLE forja_habitos (
  usuario_id     integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id             text NOT NULL,
  nombre         text NOT NULL,
  kanji          text NOT NULL,
  inicio         date NOT NULL,
  cumplidos      jsonb NOT NULL DEFAULT '[]',   -- días cumplidos ["AAAA-MM-DD", ...]
  fallas         integer NOT NULL DEFAULT 0,    -- fallas no perdonadas al último cálculo (solo para el historial)
  estado         text NOT NULL DEFAULT 'forja' CHECK (estado IN ('forja', 'forjado', 'abandonado')),
  forjado_en     date,
  abandonado_en  date,
  creado         bigint NOT NULL,
  PRIMARY KEY (usuario_id, id)
);
CREATE INDEX forja_habitos_estado ON forja_habitos(usuario_id, estado);

CREATE TABLE codigo_reglas (
  usuario_id     integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id             text NOT NULL,
  texto          text NOT NULL,
  grupo          text NOT NULL CHECK (grupo IN ('cuerpo', 'mente', 'comida', 'cuidado')),
  momento        text NOT NULL DEFAULT 'siempre' CHECK (momento IN ('manana', 'tarde', 'noche', 'siempre')),
  orden          integer NOT NULL,
  orden_momento  integer NOT NULL,
  creado         bigint NOT NULL,
  PRIMARY KEY (usuario_id, id)
);

CREATE TABLE caidas (
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id          text NOT NULL,
  fecha       date NOT NULL,
  instante    bigint NOT NULL,
  origen      text NOT NULL,          -- 'boton' o 'tension'
  xp          integer NOT NULL DEFAULT 0,
  PRIMARY KEY (usuario_id, id)
);
CREATE INDEX caidas_fecha ON caidas(usuario_id, fecha);

CREATE TABLE fotos_progreso (
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id          text NOT NULL,
  fecha       date NOT NULL,          -- el día en que se cargó (no se cambia)
  dia         integer,                -- día del ciclo, si se sabe
  imagen      text NOT NULL,          -- data URL achicada (máx. ~1080 px)
  creada      bigint NOT NULL,
  PRIMARY KEY (usuario_id, id)
);

CREATE TABLE marcas_dia (
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha       date NOT NULL,
  texto       text NOT NULL,
  creada      bigint NOT NULL,
  editada     bigint,
  PRIMARY KEY (usuario_id, fecha)
);
