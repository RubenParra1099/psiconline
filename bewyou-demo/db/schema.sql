-- La API crea esta tabla sola en la primera llamada. Este archivo es de referencia.
create table if not exists docs (
  col text not null,          -- expedientes | notas | jueces | config
  id text not null,           -- folio, id de juez, "banco"
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);
-- Consultas útiles:
-- select id, data->>'nombre' as nombre, data->>'comunidad' as comunidad, updated_at from docs where col='expedientes' order by updated_at desc;
-- select count(*) from docs where col='expedientes';
