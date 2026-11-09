-- Música da partida em andamento, para continuar sem internet.
--
-- Logo depois de iniciar uma partida online, o aplicativo guarda a música
-- dessa partida no aparelho. Se a conexão cair no meio do jogo, a partida
-- continua localmente com o mesmo progresso e o mesmo tempo.

create or replace function public.get_session_song(p_session_token uuid)
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
begin
  return query
  select s.id,
         s.title,
         s.album,
         s.display_tokens,
         s.normalized_tokens,
         s.word_count,
         s.time_limit_seconds,
         case when s.chorus_needs_review then '[]'::jsonb else s.chorus_ranges end
    from public.game_sessions as gs
    join public.songs as s on s.id = gs.song_id
   where gs.session_token = p_session_token;
end;
$function$;

revoke all on function public.get_session_song(uuid) from public;
grant execute on function public.get_session_song(uuid) to anon, authenticated;
