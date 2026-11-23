-- Módulo temas: los temas que sube cada persona (archivo .sektema revisado) y los avisos visuales pendientes
-- (por ejemplo «subiste de nivel», que llega del servidor y la pantalla muestra la próxima vez que se abre).
CREATE TABLE temas_propios (
  id          bigserial PRIMARY KEY,
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  clave       text NOT NULL,
  archivo     jsonb NOT NULL,
  subido      bigint NOT NULL,
  UNIQUE (usuario_id, clave)
);

CREATE TABLE temas_avisos (
  id          bigserial PRIMARY KEY,
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  datos       jsonb NOT NULL DEFAULT '{}',
  creado      bigint NOT NULL,
  visto       boolean NOT NULL DEFAULT false
);
CREATE INDEX temas_avisos_pendientes ON temas_avisos(usuario_id) WHERE NOT visto;
