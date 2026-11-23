-- Módulo sueno: una fila por noche («Dejo celu», estimación, correcciones) y el modo sueño activo.
-- Los instantes van en milisegundos (bigint), como en el resto de SEK.
CREATE TABLE suenio (
  id                 bigserial PRIMARY KEY,
  usuario_id         integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  noche              date NOT NULL,
  hora_prevista      text NOT NULL,             -- «Dejo celu» previsto esa noche (HH:MM)
  hora_real          bigint NOT NULL,           -- cuándo se tocó «Dejo celu» (o la hora a mano)
  retraso_minutos    integer NOT NULL DEFAULT 0,
  cumplido           boolean NOT NULL DEFAULT false,
  sin_dejo_celu      boolean NOT NULL DEFAULT false, -- noche cargada a mano: no da XP
  nota               text,
  creado             bigint NOT NULL,
  acostado_manual    bigint,
  dormido            bigint,
  latencia_minutos   integer,
  despertar_previsto bigint,
  levantado          bigint,
  despertares        integer,
  minutos_dormido    integer,
  fuente_acostado    text,                      -- estimado | corregido | reloj
  fuente_dormido     text,
  fuente_levantado   text,
  etapas             jsonb,
  aperturas          integer NOT NULL DEFAULT 0,
  UNIQUE (usuario_id, noche)
);

-- Una sola fila por persona mientras el modo sueño está prendido.
CREATE TABLE modo_suenio (
  usuario_id  integer PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  noche       date NOT NULL,
  inicio      bigint NOT NULL,
  hasta       bigint NOT NULL,
  tarde       boolean NOT NULL DEFAULT false,
  resumen     text NOT NULL DEFAULT '',
  aperturas   jsonb NOT NULL DEFAULT '[]'
);
