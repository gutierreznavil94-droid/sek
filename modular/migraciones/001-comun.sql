-- Lo común: personas, sesiones, ajustes e historial.
CREATE TABLE usuarios (
  id          serial PRIMARY KEY,
  nombre      text NOT NULL,
  email       text NOT NULL UNIQUE,
  clave_hash  text NOT NULL,
  creado      bigint NOT NULL
);

CREATE TABLE sesiones (
  token       text PRIMARY KEY,
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  vence       bigint NOT NULL
);
CREATE INDEX sesiones_usuario ON sesiones(usuario_id);

-- Ajustes de cada persona (zona horaria, límites, nombres...). Un objeto JSON: solo se suman campos.
CREATE TABLE ajustes (
  usuario_id  integer PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  datos       jsonb NOT NULL DEFAULT '{}',
  actualizado bigint NOT NULL
);

-- Historial de cambios (quién cambió qué y cuándo). Cada módulo anota lo suyo.
CREATE TABLE historial (
  id          bigserial PRIMARY KEY,
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  modulo      text NOT NULL,
  tipo        text NOT NULL,
  detalle     jsonb,
  instante    bigint NOT NULL
);
CREATE INDEX historial_usuario ON historial(usuario_id, instante);
