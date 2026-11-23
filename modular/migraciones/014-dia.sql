-- Módulo dia (parte 2): feriados, fechas clave del calendario y Mi horario.

-- Feriados: sábados, domingos y feriados usan el límite de juego de finde y apagan los bloques obligatorios de Mi horario.
CREATE TABLE feriados (
  usuario_id    integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha         date NOT NULL,
  nombre        text NOT NULL DEFAULT 'Feriado',
  propio        boolean NOT NULL DEFAULT false,   -- false = vino precargado
  creado        bigint NOT NULL,
  PRIMARY KEY (usuario_id, fecha)
);

-- Fechas clave (印): notas del calendario («Ingreso a la facultad», un cumpleaños). No dan XP ni tocan la racha.
-- Con hora, ese día son un bloque obligatorio de Mi horario.
CREATE TABLE fechas_clave (
  usuario_id    integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id            text NOT NULL,
  fecha         date NOT NULL,
  titulo        text NOT NULL,
  nota          text,
  anual         boolean NOT NULL DEFAULT false,
  hora          text,
  hora_fin      text,
  creada        bigint NOT NULL,
  PRIMARY KEY (usuario_id, id)
);
CREATE INDEX fechas_clave_fecha ON fechas_clave (usuario_id, fecha);

-- Mi horario: los horarios guardados con sus bloques, cuál está activo y los bloques apagados por fecha (un JSON por persona).
CREATE TABLE horarios (
  usuario_id    integer PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  config        jsonb NOT NULL,   -- { activo, horarios: [{ id, nombre, bloques: [{ id, nombre, tipo, dias, desde, hasta }] }], excepciones: { fecha: [bloqueId] } }
  actualizado   bigint NOT NULL
);
