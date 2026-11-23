-- Módulo desafios: Tensión, «No cumplí», el Tajo, el 3·2·1 y la frase «Dudar es fracasar».
-- Guardados y apagados adentro: ninjas, rival y batalla (las peleas quedan anotadas en `ninjas`).

-- Configuración de cada persona (JSON) y las marcas del día (Tajo, frase, última vez a la vista).
CREATE TABLE config_desafios (
  usuario_id    integer PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  datos         jsonb NOT NULL DEFAULT '{}',
  ultima_vista  bigint,
  tajo_dia      date,
  frase_dia     date,
  actualizado   bigint
);

-- 3·2·1: cada vez que empezaste algo sin esperar las ganas.
CREATE TABLE inicios (
  id             bigserial PRIMARY KEY,
  usuario_id     integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha          date NOT NULL,
  creado         bigint NOT NULL,
  iniciado       bigint,
  terminado      bigint,
  resultado      text,
  accion         text NOT NULL,
  tarea_ambigua  text NOT NULL DEFAULT '',
  compromiso_id  text,
  segundos_hasta_empezar integer,
  id_viejo       integer
);
CREATE INDEX inicios_usuario ON inicios(usuario_id, fecha);

-- Peleas con los ninjas de la distracción (archivado: rival, batalla). resultado: vencido | escapo.
CREATE TABLE ninjas (
  id           bigserial PRIMARY KEY,
  usuario_id   integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha        date NOT NULL,
  instante     bigint NOT NULL,
  distraccion  text NOT NULL,
  momento      text NOT NULL,
  resultado    text NOT NULL,
  pilar        text,
  reps         integer,
  robo         integer
);
CREATE INDEX ninjas_usuario ON ninjas(usuario_id, fecha);
