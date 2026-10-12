# Decisões de Front-End

## Direção visual

### Intro
A primeira tela é intencionalmente mais atmosférica e cinematográfica:
- fundo escuro;
- brilhos suaves;
- partículas leves;
- tipografia serifada;
- título `Swifter Lyrics / for Malu`;
- botão PLAY com microinteração.

### Partida
A partida é propositalmente mais simples:
- fundo branco;
- poucos elementos simultâneos;
- foco no input e na letra;
- sem capas, era, álbum ou título durante a partida;
- contador e cronômetro no topo;
- blocos ocultos com largura uniforme;
- refrões destacados apenas por tratamento visual sutil.

### Barra durante a rolagem
O placar e a barra de digitação ficam juntos em uma camada fixa no topo.
`FloatingGameControls` reserva a altura real dos controles com `ResizeObserver`,
para que o início da letra não fique coberto, inclusive quando há mensagens de erro.
No celular, acompanha o deslocamento do `visualViewport` provocado pelo teclado;
durante o zoom, mantém o comportamento nativo do navegador. A letra continua
rolando na página, sem bloquear o `body`, forçar `scrollTo` ou recriar o input.

## Performance

Não foi usada biblioteca de animação. As transições são feitas com CSS usando principalmente:
- `transform`;
- `opacity`;
- `transition`;
- `@keyframes`.

Também há suporte a `prefers-reduced-motion`.

## Supabase

O navegador não lê diretamente a tabela de letras.

A interface usa somente as RPCs:
- `start_random_game`;
- `submit_guess`;
- `get_game_state`.

A letra completa não é enviada para o cliente durante a partida. Somente palavras já encontradas e suas posições são retornadas.

Refrões ainda marcados como pendentes de revisão no banco não recebem destaque no front-end.
