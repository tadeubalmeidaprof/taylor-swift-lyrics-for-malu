-- Pacote de músicas para jogar sem internet.
--
-- O aplicativo chama esta função quando está online e guarda as músicas no
-- aparelho. Durante o jogo offline, as palavras são conferidas localmente com
-- a mesma normalização de private.normalize_word (minúsculas, apenas a-z e 0-9).
--
-- A letra completa já fica visível ao fim de qualquer partida (desistência ou
-- tempo esgotado), então este pacote não cria um novo tipo de exposição.

create or replace function public.get_offline_pack(
  p_client_id uuid default null,
  p_count integer default 4
)
returns table (
  song_id bigint,
  title text,
  album text,
  display_tokens text[],
  normalized_tokens text[],
  word_count integer,
  time_limit_seconds integer,
  chorus_ranges jsonb
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_count integer := least(greatest(coalesce(p_count, 4), 1), 8);
begin
  return query
  with recent as (
    select gs.song_id
      from public.game_sessions as gs
     where p_client_id is not null
       and gs.client_id = p_client_id
     order by gs.started_at desc
     limit 20
  ),
  candidates as (
    select s.*,
           (s.id in (select r.song_id from recent as r)) as played_recently
      from public.songs as s
     where s.enabled = true
       and s.is_exact_duplicate = false
  )
  select c.id,
         c.title,
         c.album,
         c.display_tokens,
         c.normalized_tokens,
         c.word_count,
         c.time_limit_seconds,
         case when c.chorus_needs_review then '[]'::jsonb else c.chorus_ranges end
    from candidates as c
   order by c.played_recently, random()
   limit v_count;
end;
$function$;

revoke all on function public.get_offline_pack(uuid, integer) from public;
grant execute on function public.get_offline_pack(uuid, integer) to anon, authenticated;
