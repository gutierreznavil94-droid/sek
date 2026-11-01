-- SEK: tabla para sincronizar los datos entre dispositivos.
-- Se pega una sola vez en Supabase → SQL Editor → Run.
-- Cada usuario tiene una sola fila con la copia completa de sus datos.

create table if not exists public.respaldo (
  usuario uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  datos jsonb not null,
  actualizado bigint not null,
  dispositivo text,
  modificado timestamptz not null default now()
);

alter table public.respaldo enable row level security;

drop policy if exists "cada uno lo suyo" on public.respaldo;
create policy "cada uno lo suyo" on public.respaldo
  for all to authenticated
  using ((select auth.uid()) = usuario)
  with check ((select auth.uid()) = usuario);

-- Aviso al instante cuando otro dispositivo guarda cambios.
do $$ begin
  alter publication supabase_realtime add table public.respaldo;
exception when duplicate_object then null; end $$;
