-- Moderación, profes, sello de revisada, videos de YouTube, búsqueda sin tildes y arreglos de seguridad.
-- Pegar entero en Supabase > SQL Editor y ejecutar (una sola vez).

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

-- Perfiles: administradores y profes (solo los cambia un administrador)
alter table public.perfiles add column admin boolean not null default false;
alter table public.perfiles add column profe boolean not null default false;
alter table public.perfiles add constraint perfiles_nombre_sin_espacios_extremos check (nombre = btrim(nombre));

create function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
    select coalesce((select admin from public.perfiles where id = auth.uid()), false)
$$;

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

create policy "Admins editan perfiles" on public.perfiles for update to authenticated
    using (public.es_admin()) with check (true);

-- Al registrarse con un nombre reservado (por ejemplo desde Google) se usa otro
create or replace function public.crear_perfil() returns trigger
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

-- Tabs: video de YouTube (el id de 11 caracteres), sello de revisada y texto para buscar
alter table public.tabs add column video text check (video ~ '^[A-Za-z0-9_-]{11}$');
alter table public.tabs add column revisada boolean not null default false;
alter table public.tabs add column busqueda text not null default '';

update public.tabs set busqueda = public.normalizar(titulo || ' ' || coalesce(artista, ''));

-- Las fechas las pone la base (antes las mandaba el navegador), el sello solo lo pone un administrador
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

create policy "Admins editan tabs" on public.tabs for update to authenticated
    using (public.es_admin()) with check (true);
create policy "Admins borran tabs" on public.tabs for delete to authenticated
    using (public.es_admin());

-- Votos: al cambiar un voto no se lo puede pasar a una tab propia (antes se podía)
drop policy "Cambiar el voto propio" on public.votos;
create policy "Cambiar el voto propio" on public.votos for update to authenticated
    using (usuario = auth.uid())
    with check (
        usuario = auth.uid()
        and not exists (select 1 from public.tabs where id = tab_id and autor = auth.uid())
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
alter table public.reportes enable row level security;
create policy "Reportar tabs" on public.reportes for insert to authenticated
    with check (usuario = auth.uid());
create policy "Admins ven reportes" on public.reportes for select to authenticated
    using (public.es_admin());
create policy "Admins resuelven reportes" on public.reportes for delete to authenticated
    using (public.es_admin());

-- Vista con los datos nuevos
drop view public.tabs_resumen;
create view public.tabs_resumen with (security_invoker = true) as
select t.id, t.titulo, t.artista, t.tonalidades, t.dificultad, t.contenido, t.video, t.revisada, t.busqueda,
       t.autor, p.nombre as autor_nombre, p.profe as autor_profe, t.creada, t.actualizada,
       coalesce(round(avg(v.puntaje), 1), 0) as promedio,
       count(v.puntaje)::int as cantidad_votos
from public.tabs t
join public.perfiles p on p.id = t.autor
left join public.votos v on v.tab_id = t.id
group by t.id, p.nombre, p.profe;

-- Administradores iniciales
update public.perfiles set admin = true where nombre in ('Escueladearmonicaba', 'tomasg.armonica');
