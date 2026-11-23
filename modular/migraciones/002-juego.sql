-- Módulo juego: sesiones con marcas de tiempo (inicio, pausas, fin), nunca un contador.
CREATE TABLE sesiones_juego (
  id          bigserial PRIMARY KEY,
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  inicio      bigint NOT NULL,
  fin         bigint,
  pausas      jsonb NOT NULL DEFAULT '[]',
  nota        text
);
CREATE INDEX sesiones_juego_usuario ON sesiones_juego(usuario_id, inicio);
