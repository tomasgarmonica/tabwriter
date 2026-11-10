-- Esquema de Armonitabs. Pegar entero en Supabase > SQL Editor y ejecutar (una sola vez).

-- Perfiles públicos de los usuarios
create table public.perfiles (
    id uuid primary key references auth.users on delete cascade,
    nombre text not null check (char_length(nombre) between 3 and 30),
    creado timestamptz not null default now()
);
create unique index perfiles_nombre_unico on public.perfiles (lower(nombre));

-- Tablaturas
create table public.tabs (
    id bigint generated always as identity primary key,
    autor uuid not null default auth.uid() references public.perfiles on delete cascade,
    titulo text not null check (char_length(titulo) between 1 and 120),
    artista text check (char_length(artista) <= 120),
    tonalidades text[] not null check (
        cardinality(tonalidades) between 1 and 4
        and tonalidades <@ array['G','Ab','A','Bb','B','C','Db','D','Eb','E','F','F#']
    ),
    dificultad smallint not null check (dificultad between 1 and 3),
    contenido text not null check (char_length(contenido) between 1 and 20000),
    creada timestamptz not null default now(),
    actualizada timestamptz not null default now()
);
create index tabs_autor on public.tabs (autor);

-- Puntajes: un voto de 1 a 5 por usuario y tab
create table public.votos (
    tab_id bigint not null references public.tabs on delete cascade,
    usuario uuid not null default auth.uid() references public.perfiles on delete cascade,
    puntaje smallint not null check (puntaje between 1 and 5),
    primary key (tab_id, usuario)
);

-- Tabs con autor y promedio de puntaje, para listar y mostrar
create view public.tabs_resumen with (security_invoker = true) as
select t.id, t.titulo, t.artista, t.tonalidades, t.dificultad, t.contenido,
       t.autor, p.nombre as autor_nombre, t.creada, t.actualizada,
       coalesce(round(avg(v.puntaje), 1), 0) as promedio,
       count(v.puntaje)::int as cantidad_votos
from public.tabs t
join public.perfiles p on p.id = t.autor
left join public.votos v on v.tab_id = t.id
group by t.id, p.nombre;

-- Al registrarse, se crea el perfil. El nombre sale del formulario o de la cuenta de Google;
-- si ya existe, se le agrega un número.
create function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
    base text;
    candidato text;
    n int := 0;
begin
    base := coalesce(
        nullif(trim(new.raw_user_meta_data->>'nombre'), ''),
        nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
        split_part(new.email, '@', 1)
    );
    base := left(base, 24);
    if char_length(base) < 3 then
        base := base || 'armo';
    end if;
    candidato := base;
    while exists (select 1 from public.perfiles where lower(nombre) = lower(candidato)) loop
        n := n + 1;
        candidato := base || n;
    end loop;
    insert into public.perfiles (id, nombre) values (new.id, candidato);
    return new;
end;
$$;

create trigger al_registrarse after insert on auth.users
for each row execute function public.crear_perfil();

-- Seguridad: cualquiera puede leer; cada usuario solo modifica lo suyo
alter table public.perfiles enable row level security;
alter table public.tabs enable row level security;
alter table public.votos enable row level security;

create policy "Perfiles visibles para todos" on public.perfiles for select using (true);
create policy "Cada uno edita su perfil" on public.perfiles for update
    using (id = auth.uid()) with check (id = auth.uid());

create policy "Tabs visibles para todos" on public.tabs for select using (true);
create policy "Publicar tabs propias" on public.tabs for insert to authenticated
    with check (autor = auth.uid());
create policy "Editar tabs propias" on public.tabs for update to authenticated
    using (autor = auth.uid()) with check (autor = auth.uid());
create policy "Borrar tabs propias" on public.tabs for delete to authenticated
    using (autor = auth.uid());

create policy "Votos visibles para todos" on public.votos for select using (true);
create policy "Votar tabs ajenas" on public.votos for insert to authenticated
    with check (
        usuario = auth.uid()
        and not exists (select 1 from public.tabs where id = tab_id and autor = auth.uid())
    );
create policy "Cambiar el voto propio" on public.votos for update to authenticated
    using (usuario = auth.uid()) with check (usuario = auth.uid());
create policy "Borrar el voto propio" on public.votos for delete to authenticated
    using (usuario = auth.uid());
