-- Módulo copia: cada copia que se importó o exportó (para no importar dos veces la misma y mostrar «Última copia»).
CREATE TABLE copia_registros (
  id          bigserial PRIMARY KEY,
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo        text NOT NULL CHECK (tipo IN ('importar', 'exportar')),
  origen      text NOT NULL CHECK (origen IN ('vieja', 'nueva')),
  exportado   bigint NOT NULL,           -- el momento en que se armó la copia (viene adentro de la copia)
  resultado   jsonb NOT NULL DEFAULT '{}', -- cuántos entraron de cada módulo
  creado      bigint NOT NULL
);
-- La misma copia (mismo origen y mismo momento) se importa una sola vez por persona.
CREATE UNIQUE INDEX copia_registros_una_vez ON copia_registros(usuario_id, origen, exportado) WHERE tipo = 'importar';
CREATE INDEX copia_registros_usuario ON copia_registros(usuario_id, tipo, creado);
