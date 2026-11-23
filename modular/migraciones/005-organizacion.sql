-- Módulo organizacion: frentes, tareas y bandeja de cada persona, en un solo JSON (formato 1, ver su LEEME).
CREATE TABLE organizacion_datos (
  usuario_id  integer PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  datos       jsonb NOT NULL,
  actualizado bigint NOT NULL
);
