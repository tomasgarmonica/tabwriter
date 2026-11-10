-- Una tab puede usar varias armónicas (el armonicista cambia durante la canción).
-- Pegar entero en Supabase > SQL Editor y ejecutar (una sola vez). Las tabs existentes se convierten solas.

drop view public.tabs_resumen;

alter table public.tabs add column tonalidades text[];
update public.tabs set tonalidades = array[tonalidad];
alter table public.tabs alter column tonalidades set not null;
alter table public.tabs add constraint tabs_tonalidades_check check (
    cardinality(tonalidades) between 1 and 4
    and tonalidades <@ array['G','Ab','A','Bb','B','C','Db','D','Eb','E','F','F#']
);
alter table public.tabs drop column tonalidad;

create view public.tabs_resumen with (security_invoker = true) as
select t.id, t.titulo, t.artista, t.tonalidades, t.dificultad, t.contenido,
       t.autor, p.nombre as autor_nombre, t.creada, t.actualizada,
       coalesce(round(avg(v.puntaje), 1), 0) as promedio,
       count(v.puntaje)::int as cantidad_votos
from public.tabs t
join public.perfiles p on p.id = t.autor
left join public.votos v on v.tab_id = t.id
group by t.id, p.nombre;
