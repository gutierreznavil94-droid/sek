-- Módulo xp: cada movimiento de XP con su clave única (el mismo evento nunca suma dos veces).
-- La cantidad se congela: cambiar una regla después no recalcula lo ganado. Nada se borra: se anula con motivo.
CREATE TABLE xp_registros (
  id                bigserial PRIMARY KEY,
  usuario_id        integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  clave             text NOT NULL,
  cantidad          integer NOT NULL,
  origen            text NOT NULL,
  fecha             date NOT NULL,
  creado            bigint NOT NULL,
  descripcion       text NOT NULL DEFAULT '',
  anulado           boolean NOT NULL DEFAULT false,
  anulado_en        bigint,
  motivo_anulacion  text,
  UNIQUE (usuario_id, clave)
);
CREATE INDEX xp_registros_fecha ON xp_registros(usuario_id, fecha);
