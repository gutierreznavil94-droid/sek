-- Módulo entreno: rutinas con bloques, entrenos (sesiones), series rápidas (contadores) y sus toques.
-- Las rutinas guardan sus bloques como JSON: un ejercicio enlazado es el MISMO id de bloque en varias rutinas.
CREATE TABLE rutinas (
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id          text NOT NULL,
  nombre      text NOT NULL,
  dias        jsonb NOT NULL DEFAULT '[]',
  bloques     jsonb NOT NULL DEFAULT '[]',
  minutos     integer NOT NULL DEFAULT 30,
  orden       integer NOT NULL DEFAULT 0,
  activa      boolean NOT NULL DEFAULT true,
  borrada     boolean NOT NULL DEFAULT false,
  creado      bigint NOT NULL,
  PRIMARY KEY (usuario_id, id)
);

-- Un entreno. Lo que cambia mientras se entrena (paso, orden, series, descanso, reloj…) va en `datos`.
CREATE TABLE sesiones_entreno (
  id          bigserial PRIMARY KEY,
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rutina_id   text NOT NULL,
  fecha       date NOT NULL,
  estado      text NOT NULL CHECK (estado IN ('en_curso', 'terminada')),
  inicio      bigint NOT NULL,
  fin         bigint,
  datos       jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX sesiones_entreno_usuario ON sesiones_entreno(usuario_id, rutina_id, estado);
CREATE INDEX sesiones_entreno_fecha ON sesiones_entreno(usuario_id, fecha);

-- Series rápidas (flexiones, dominadas): la configuración va en `datos` (cuota, extra, historial de cuota…).
CREATE TABLE contadores (
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id          text NOT NULL,
  datos       jsonb NOT NULL,
  orden       integer NOT NULL DEFAULT 0,
  activo      boolean NOT NULL DEFAULT true,
  creado      bigint NOT NULL,
  PRIMARY KEY (usuario_id, id)
);

CREATE TABLE registros_contador (
  id           bigserial PRIMARY KEY,
  usuario_id   integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  contador_id  text NOT NULL,
  fecha        date NOT NULL,
  instante     bigint NOT NULL,
  cantidad     integer NOT NULL,
  nota         text
);
CREATE INDEX registros_contador_dia ON registros_contador(usuario_id, contador_id, fecha);
