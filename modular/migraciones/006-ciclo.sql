-- Módulo ciclo: ciclos de 90 días (o más), fases, objetivos, atributos, identidad, metas con fecha y revisiones.
-- Los id son texto (como en la app vieja) para que la copia los traiga igual y los demás módulos
-- (dia: acciones vinculadas a atributos) los sigan nombrando. Clave primaria: (usuario_id, id).

CREATE TABLE ciclos (
  usuario_id     integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id             text NOT NULL,
  numero         integer NOT NULL,
  inicio         date NOT NULL,
  dia_cero       date,
  duracion_dias  integer NOT NULL CHECK (duracion_dias BETWEEN 7 AND 3650),
  dias_por_fase  integer NOT NULL CHECK (dias_por_fase BETWEEN 1 AND 3650),
  estado         text NOT NULL CHECK (estado IN ('activo', 'cerrado')),
  creado         bigint NOT NULL,
  cerrado        bigint,
  PRIMARY KEY (usuario_id, id)
);
-- Un solo ciclo activo por persona.
CREATE UNIQUE INDEX ciclos_un_activo ON ciclos(usuario_id) WHERE estado = 'activo';

CREATE TABLE fases (
  usuario_id    integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id            text NOT NULL,
  ciclo_id      text NOT NULL,
  numero        integer NOT NULL,
  dia_inicio    integer NOT NULL,
  dia_fin       integer NOT NULL,
  foco          text NOT NULL DEFAULT '',
  que_se_mide   text NOT NULL DEFAULT '',
  notas_cierre  text,
  cerrada_en    bigint,
  PRIMARY KEY (usuario_id, id),
  UNIQUE (usuario_id, ciclo_id, numero),
  FOREIGN KEY (usuario_id, ciclo_id) REFERENCES ciclos(usuario_id, id) ON DELETE CASCADE
);

CREATE TABLE atributos (
  usuario_id    integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id            text NOT NULL,
  nombre        text NOT NULL,
  descripcion   text NOT NULL DEFAULT '',
  orden         integer NOT NULL DEFAULT 0,
  ventana_dias  integer NOT NULL DEFAULT 14 CHECK (ventana_dias BETWEEN 3 AND 60),
  creado        bigint NOT NULL,
  archivado     boolean NOT NULL DEFAULT false,
  PRIMARY KEY (usuario_id, id)
);

CREATE TABLE objetivos (
  usuario_id    integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id            text NOT NULL,
  ciclo_id      text NOT NULL,
  fase_numero   integer NOT NULL,
  atributo_id   text NOT NULL,
  titulo        text NOT NULL,
  indicador     text NOT NULL DEFAULT '',
  linea_base    text,
  meta          text,
  resultado     text,
  creado        bigint NOT NULL,
  archivado     boolean NOT NULL DEFAULT false,
  PRIMARY KEY (usuario_id, id),
  FOREIGN KEY (usuario_id, ciclo_id) REFERENCES ciclos(usuario_id, id) ON DELETE CASCADE
);
CREATE INDEX objetivos_ciclo ON objetivos(usuario_id, ciclo_id, fase_numero);

CREATE TABLE identidad (
  usuario_id   integer PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  vision       text NOT NULL DEFAULT '',
  obstaculos   text NOT NULL DEFAULT '',
  actualizado  bigint NOT NULL
);

-- Metas con fecha: las automáticas (inicio, fin de fase, fin de ciclo, revisión semanal) y las propias.
CREATE TABLE metas (
  usuario_id   integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id           text NOT NULL,
  fecha        date NOT NULL,
  titulo       text NOT NULL,
  tipo         text NOT NULL CHECK (tipo IN ('propia', 'inicio_ciclo', 'fin_fase', 'fin_ciclo', 'revision_semanal')),
  estado       text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'cumplida', 'no_cumplida')),
  xp           integer,
  resuelta_en  bigint,
  cumplida_el  date,
  nota         text,
  creado       bigint NOT NULL,
  PRIMARY KEY (usuario_id, id)
);
CREATE INDEX metas_fecha ON metas(usuario_id, fecha);

-- Revisiones: diaria (periodo = fecha), semanal (periodo = lunes), de fase o de ciclo (periodo = id).
CREATE TABLE revisiones (
  usuario_id   integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id           text NOT NULL,
  tipo         text NOT NULL CHECK (tipo IN ('diaria', 'semanal', 'fase', 'ciclo')),
  periodo      text NOT NULL,
  respuestas   jsonb NOT NULL DEFAULT '{}',
  foto         jsonb NOT NULL DEFAULT '{}',
  creado       bigint NOT NULL,
  actualizado  bigint NOT NULL,
  PRIMARY KEY (usuario_id, id),
  UNIQUE (usuario_id, tipo, periodo)
);
