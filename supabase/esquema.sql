-- Esquema de Armonitabs. Pegar entero en Supabase > SQL Editor y ejecutar (una sola vez).
-- Al final, marcar a mano los administradores: update public.perfiles set admin = true where nombre = '...';

-- Texto sin mayúsculas, tildes ni signos (igual que normalizarTexto() en comun.js)
create function public.normalizar(texto text) returns text
language sql immutable set search_path = '' as $$
    select btrim(regexp_replace(
        translate(lower(coalesce(texto, '')), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
        '[^a-z0-9]+', ' ', 'g'))
$$;

-- Nombres que se confunden con la Escuela o con el sitio
create function public.nombre_reservado(nombre text) returns boolean
language sql immutable set search_path = '' as $$
    select n like '%escuela%' and n like '%armonica%'
        or n like '%armonitabs%'
        or n ~ '^(admin|administrador|moderador|moderacion|soporte|staff)'
    from (select replace(public.normalizar(nombre), ' ', '') as n) as x
$$;

-- Perfiles públicos de los usuarios. admin y profe solo los cambia un administrador.
create table public.perfiles (
    id uuid primary key references auth.users on delete cascade,
    nombre text not null check (char_length(nombre) between 3 and 30),
    creado timestamptz not null default now(),
    admin boolean not null default false,
    profe boolean not null default false,
    constraint perfiles_nombre_sin_espacios_extremos check (nombre = btrim(nombre))
);
create unique index perfiles_nombre_unico on public.perfiles (lower(nombre));

create function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
    select coalesce((select admin from public.perfiles where id = auth.uid()), false)
$$;

-- Tablaturas. video: id de YouTube; revisada: sello de la Escuela; busqueda: título y artista normalizados.
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
    actualizada timestamptz not null default now(),
    video text check (video ~ '^[A-Za-z0-9_-]{11}$'),
    revisada boolean not null default false,
    busqueda text not null default ''
);
create index tabs_autor on public.tabs (autor);

-- Puntajes: un voto de 1 a 5 por usuario y tab
create table public.votos (
    tab_id bigint not null references public.tabs on delete cascade,
    usuario uuid not null default auth.uid() references public.perfiles on delete cascade,
    puntaje smallint not null check (puntaje between 1 and 5),
    primary key (tab_id, usuario)
);

-- Reportes de tabs: los hace cualquier usuario con cuenta, los ven y resuelven los administradores
create table public.reportes (
    id bigint generated always as identity primary key,
    tab_id bigint not null references public.tabs on delete cascade,
    usuario uuid not null default auth.uid() references public.perfiles on delete cascade,
    motivo text not null check (char_length(motivo) between 1 and 500),
    creado timestamptz not null default now(),
    unique (tab_id, usuario)
);

-- Tabs con autor y promedio de puntaje, para listar y mostrar
create view public.tabs_resumen with (security_invoker = true) as
select t.id, t.titulo, t.artista, t.tonalidades, t.dificultad, t.contenido, t.video, t.revisada, t.busqueda,
       t.autor, p.nombre as autor_nombre, p.profe as autor_profe, t.creada, t.actualizada,
       coalesce(round(avg(v.puntaje), 1), 0) as promedio,
       count(v.puntaje)::int as cantidad_votos
from public.tabs t
join public.perfiles p on p.id = t.autor
left join public.votos v on v.tab_id = t.id
group by t.id, p.nombre, p.profe;

-- Al registrarse, se crea el perfil. El nombre sale del formulario o de la cuenta de Google;
-- si está reservado se usa otro, y si ya existe se le agrega un número.
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
    base := trim(left(base, 24));
    if public.nombre_reservado(base) then
        base := 'armonicista';
    end if;
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

-- Perfiles: los permisos solo los cambia un administrador y los nombres reservados quedan para ellos
create function public.cuidar_perfil() returns trigger
language plpgsql set search_path = '' as $$
begin
    -- Lo que se hace desde el SQL Editor de Supabase no se controla
    if current_user not in ('anon', 'authenticated') then return new; end if;
    if (new.admin is distinct from old.admin or new.profe is distinct from old.profe) and not public.es_admin() then
        raise exception 'Solo un administrador puede cambiar los permisos';
    end if;
    if new.nombre is distinct from old.nombre and public.nombre_reservado(new.nombre) and not new.admin then
        raise exception 'nombre_reservado';
    end if;
    return new;
end;
$$;
create trigger cuidar_perfil before update on public.perfiles
for each row execute function public.cuidar_perfil();

-- Tabs: las fechas las pone la base, el sello solo lo pone un administrador
-- y si el autor cambia la tab, el sello se pierde
create function public.cuidar_tab() returns trigger
language plpgsql set search_path = '' as $$
begin
    new.busqueda := public.normalizar(new.titulo || ' ' || coalesce(new.artista, ''));
    if current_user not in ('anon', 'authenticated') then return new; end if;
    if tg_op = 'INSERT' then
        new.creada := now();
        if not public.es_admin() then new.revisada := false; end if;
    else
        new.creada := old.creada;
        if not public.es_admin() then
            new.revisada := old.revisada and new.contenido = old.contenido;
        end if;
    end if;
    new.actualizada := now();
    return new;
end;
$$;
create trigger cuidar_tab before insert or update on public.tabs
for each row execute function public.cuidar_tab();

-- Seguridad: cualquiera puede leer; cada usuario solo modifica lo suyo; los administradores moderan
alter table public.perfiles enable row level security;
alter table public.tabs enable row level security;
alter table public.votos enable row level security;
alter table public.reportes enable row level security;

create policy "Perfiles visibles para todos" on public.perfiles for select using (true);
create policy "Cada uno edita su perfil" on public.perfiles for update
    using (id = auth.uid()) with check (id = auth.uid());
create policy "Admins editan perfiles" on public.perfiles for update to authenticated
    using (public.es_admin()) with check (true);

create policy "Tabs visibles para todos" on public.tabs for select using (true);
create policy "Publicar tabs propias" on public.tabs for insert to authenticated
    with check (autor = auth.uid());
create policy "Editar tabs propias" on public.tabs for update to authenticated
    using (autor = auth.uid()) with check (autor = auth.uid());
create policy "Borrar tabs propias" on public.tabs for delete to authenticated
    using (autor = auth.uid());
create policy "Admins editan tabs" on public.tabs for update to authenticated
    using (public.es_admin()) with check (true);
create policy "Admins borran tabs" on public.tabs for delete to authenticated
    using (public.es_admin());

create policy "Votos visibles para todos" on public.votos for select using (true);
create policy "Votar tabs ajenas" on public.votos for insert to authenticated
    with check (
        usuario = auth.uid()
        and not exists (select 1 from public.tabs where id = tab_id and autor = auth.uid())
    );
-- Al cambiar un voto no se lo puede pasar a una tab propia
create policy "Cambiar el voto propio" on public.votos for update to authenticated
    using (usuario = auth.uid())
    with check (
        usuario = auth.uid()
        and not exists (select 1 from public.tabs where id = tab_id and autor = auth.uid())
    );
create policy "Borrar el voto propio" on public.votos for delete to authenticated
    using (usuario = auth.uid());

create policy "Reportar tabs" on public.reportes for insert to authenticated
    with check (usuario = auth.uid());
create policy "Admins ven reportes" on public.reportes for select to authenticated
    using (public.es_admin());
create policy "Admins resuelven reportes" on public.reportes for delete to authenticated
    using (public.es_admin());

-- Tabs guardadas (favoritos): solo las ve quien las guardó
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
