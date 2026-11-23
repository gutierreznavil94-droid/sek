-- Módulo comida: comidas con alimentos, alimentos propios, comidas guardadas, peso, agua con envases y fruta del día.
-- Configuración de cada persona (objetivo de calorías y proteína, envases de agua, fruta): un JSON por parte.
CREATE TABLE comida_config (
  usuario_id  integer PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  objetivo    jsonb,
  agua        jsonb,
  fruta       jsonb
);

-- Alimentos propios o traídos por código de barras. Valores por 100 g.
CREATE TABLE alimentos_propios (
  id          bigserial PRIMARY KEY,
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  kcal        double precision NOT NULL,
  p           double precision NOT NULL DEFAULT 0,
  c           double precision NOT NULL DEFAULT 0,
  g           double precision NOT NULL DEFAULT 0,
  porcion     text NOT NULL DEFAULT '100 g',
  gramos      integer NOT NULL DEFAULT 100,
  fuente      text NOT NULL DEFAULT 'propio',
  codigo      text,
  up          boolean NOT NULL DEFAULT false,
  creado      bigint NOT NULL
);
CREATE INDEX alimentos_propios_usuario ON alimentos_propios(usuario_id);
CREATE UNIQUE INDEX alimentos_propios_codigo ON alimentos_propios(usuario_id, codigo) WHERE codigo IS NOT NULL;

-- Una cosa comida, con los totales ya calculados para esa cantidad (congelados).
-- alimento: 't001' (tabla común) o 'p12' (alimento propio 12).
CREATE TABLE comidas (
  id          bigserial PRIMARY KEY,
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha       date NOT NULL,
  franja      text NOT NULL CHECK (franja IN ('desayuno', 'almuerzo', 'merienda', 'cena', 'otro')),
  alimento    text NOT NULL,
  nombre      text NOT NULL,
  gramos      integer NOT NULL CHECK (gramos > 0),
  kcal        double precision NOT NULL,
  p           double precision NOT NULL,
  c           double precision NOT NULL,
  g           double precision NOT NULL,
  up          boolean NOT NULL DEFAULT false,
  instante    bigint NOT NULL
);
CREATE INDEX comidas_usuario_fecha ON comidas(usuario_id, fecha);

CREATE TABLE comidas_guardadas (
  id          bigserial PRIMARY KEY,
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  items       jsonb NOT NULL,
  creado      bigint NOT NULL
);
CREATE INDEX comidas_guardadas_usuario ON comidas_guardadas(usuario_id);

-- Un peso por día: el último manda.
CREATE TABLE pesos (
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha       date NOT NULL,
  kg          double precision NOT NULL,
  instante    bigint NOT NULL,
  PRIMARY KEY (usuario_id, fecha)
);

-- Un toque de agua.
CREATE TABLE agua_tomas (
  id          bigserial PRIMARY KEY,
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha       date NOT NULL,
  ml          integer NOT NULL CHECK (ml > 0),
  envase      text,
  instante    bigint NOT NULL
);
CREATE INDEX agua_tomas_usuario_fecha ON agua_tomas(usuario_id, fecha);

-- Una fruta comida (un toque en la manzana).
CREATE TABLE frutas (
  id          bigserial PRIMARY KEY,
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha       date NOT NULL,
  instante    bigint NOT NULL
);
CREATE INDEX frutas_usuario_fecha ON frutas(usuario_id, fecha);
