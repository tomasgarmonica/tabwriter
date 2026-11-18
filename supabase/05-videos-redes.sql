-- Videos de Instagram y TikTok además de YouTube.
-- video: id de YouTube (11 caracteres), 'instagram:CÓDIGO' o 'tiktok:NÚMERO'. Las tabs que ya tienen video no cambian.
-- Pegar entero en Supabase > SQL Editor y ejecutar (una sola vez).

alter table public.tabs drop constraint tabs_video_check;
alter table public.tabs add constraint tabs_video_check check (
    video ~ '^([A-Za-z0-9_-]{11}|instagram:[A-Za-z0-9_-]{5,60}|tiktok:[0-9]{10,25})$'
);
