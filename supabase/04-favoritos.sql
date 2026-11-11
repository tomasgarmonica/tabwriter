-- Tabs guardadas (favoritos): cada usuario guarda las tabs que quiera; solo las ve él.
-- Pegar entero en Supabase > SQL Editor y ejecutar (una sola vez).

create table public.favoritos (
    usuario uuid not null default auth.uid() references public.perfiles on delete cascade,
    tab_id bigint not null references public.tabs on delete cascade,
    creado timestamptz not null default now(),
    primary key (usuario, tab_id)
);
create index favoritos_tab on public.favoritos (tab_id);

alter table public.favoritos enable row level security;
create policy "Cada uno ve sus guardadas" on public.favoritos for select to authenticated
    using (usuario = auth.uid());
create policy "Guardar tabs" on public.favoritos for insert to authenticated
    with check (usuario = auth.uid());
create policy "Quitar de guardadas" on public.favoritos for delete to authenticated
    using (usuario = auth.uid());
