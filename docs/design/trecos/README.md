# Handoff: Trecos v2 — quadro infinito (design evoluído)

## Overview
Redesign do Rabisco para a v2 (**Trecos**): quadro infinito com quatro tipos de item (texto, imagem, arquivo, link), seleção/laço, zoom, compartilhar por quadro/seleção/arquivo, busca global e lista lateral unificada (só quadros — arquivos vivem dentro dos quadros e são achados pela busca). A identidade evolui os 12 tokens do Rabisco para "mesa de pedra, tinta de grafite": mesma disciplina (12 cores, 5 tamanhos, 5 espaçamentos, 2 raios, 1 sombra), valores novos.

## About the Design Files
`Trecos.dc.html` é uma **referência de design em HTML** (protótipo navegável), não código de produção. A tarefa é **recriar este design no codebase existente** (`pb_public/` — HTML, CSS e JS vanilla servidos pelo PocketBase, sem frameworks), seguindo os padrões do repo: tokens no `:root` do `style.css`, módulos ES em `js/`, ícones SVG inline. O orçamento do produto continua lei: **48 KB gzip total, CSS até 24 KB sem minificar** (ver `trecos-prompt.md` no repo). A spec funcional completa da v2 é o `trecos-prompt.md`; este handoff cobre o desenho.

Atualizar também `docs/design/design-system/tokens.json` com os valores novos abaixo (mesma estrutura, só valores).

## Fidelity
**High-fidelity.** Cores, tipografia, espaçamentos e microcopy são finais — recriar pixel-perfect. Exceções (ainda não desenhadas): telas de celular a 375 px, o conjunto completo dos 9 ícones de arquivo (aqui há 6 rascunhos na linguagem certa) e o ícone do app.

## Design Tokens (12 cores, claro / escuro)
| token | claro | escuro | uso |
|---|---|---|---|
| bg | `#edebe7` | `#191816` | fundo do quadro e de toda superfície; sem grade, sem pontinhos |
| bg2 | `#e3e0da` | `#242320` | item ativo da lista, cartão de arquivo/link, popover, toast(¹), bloco de código |
| fg | `#1b1a17` | `#eceae5` | texto padrão e ícones |
| fg2 | `#605e57` | `#a3a19a` | texto secundário, placeholder, metadado, indicador "salvo" |
| line | `#d3d0c9` | `#35342f` | única cor de borda/separador |
| acc | `#33524d` | `#93aea6` | única cor interativa: sublinhado, contorno de seleção 2px, laço, alça, caret, borda 1,5px do botão primário. **Nunca preenchimento** (exceto laço a 10% e a barra de progresso de 2px) |
| hl1 | `#d9c583` | `#79663a` | marca-texto amarelo |
| hl2 | `#a8bd9c` | `#3d4a3b` | marca-texto verde |
| hl3 | `#d2a7a7` | `#4a3537` | marca-texto rosa |
| c1 | `#8e4a40` | `#c98e83` | caneta vermelha; também "Apagar" no menu e a linha de cota cheia |
| c2 | `#4a637c` | `#9cb2c2` | caneta azul |
| c3 | = fg2 | = fg2 | caneta cinza |

Sombra (`shadow-1`, só popover/menu/toast/barra flutuante):
claro `0 2px 6px rgba(30,28,24,.14), 0 8px 20px -8px rgba(30,28,24,.22)` · escuro `0 2px 6px rgba(0,0,0,.3), 0 8px 20px -8px rgba(0,0,0,.45)`

Espaçamentos: 4 / 8 / 12 / 16 / 24 px. Raios: **4 px** (itens, campos, botão com borda, toast) e **8 px** (só popover, menu e barra flutuante). Grade invisível de alinhamento: 8 px.

## Tipografia
- `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` — pesos 400 e 700 apenas, line-height 1.5 em tudo.
- Escala: meta 13 px (uppercase + letter-spacing 0.04em) · ui 15 px · body 16 px · h2 21 px · h1 32 px.
- **Novo, custo zero:** `ui-monospace, Menlo, Consolas, monospace` para METADADO: tamanho de arquivo (12 px), etiqueta de extensão (9 px, letter-spacing 0.05em), zoom % (13 px), cota (12 px), URL do link no popover (12 px), tag `#site` na lista (12 px), rótulo do placeholder de imagem (13 px), bloco de código (13 px), "← sair da prévia" (13 px).

## Identidade (4 assinaturas — preservar)
1. **Sublinhado como assinatura**: toda ação em texto é sublinhada em `acc` com `text-underline-offset: 3px` (Compartilhar usa `text-decoration-thickness: 1.5px`). Não existe botão preenchido em lugar nenhum; o primário é texto `acc` + borda 1,5px `acc` + fundo `bg`.
2. **Metadado em monoespaçada** (lista acima).
3. **A dobra de papel** dos ícones de arquivo é o único motivo gráfico recorrente.
4. **Cor só nas marcas da pessoa**: interface acromática; `acc` marca seleção/laço/ações; hl/c são da escrita do usuário.

## Screens / Views

### 1. Lateral (296 px, borda direita 1px `line`)
- Topo: busca (`type=search`, sem lupa, borda só embaixo 1px `line`, padding 8px 4px, 16 px) + botão `+` 32×32 (fonte 22 px).
- Linhas de quadro: padding 10px 8px, raio 4, min-height 40 px; título 16 px 1 linha com reticências; tag opcional em mono 12 px `fg2` (ex.: `#site`); tempo à direita em meta 13 uppercase `fg2` ("agora", "há 2 h", "ontem", "12 set"). Ativa: fundo `bg2`. Fixada: pin 14×14 (ícone `pin.svg` do repo) em `fg2`, fixadas primeiro.
- **Sem aba "Arquivos"** — decisão do produto: arquivos vivem dentro dos quadros; a busca global acha e abre o quadro no item.
- Rodapé (borda topo 1px `line`, padding 12px 16px): e-mail em meta uppercase `fg2` + "Sair" sublinhado `acc` 15 px; abaixo a cota em mono 12 px `fg2` "1,4 GB de 2 GB" (cheia: mesmo texto em `c1`, "2 GB de 2 GB").

### 2. Cabeçalho do quadro (padding 10px 24px, borda baixo 1px `line`)
`recolher lista` (ícone sidebar.svg 20×20) · indicador "salvo" (meta uppercase `fg2`, flex:1) · **Compartilhar** (15 px, `acc`, sublinhado 1.5px) · `⋯` (32×32).

### 3. O quadro
- Fundo `bg` puro. Pan: arrastar vazio (modo ver) / roda do mouse; zoom: Ctrl+roda em volta do cursor, 10–400%.
- Controles de zoom (canto inferior direito, `fg2`): `−` 28×28 · % em mono 13 · `+` · ícone **enquadrar** 24×24 (novo, path: `M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3`, traço 1,75 `currentColor`). Somem no celular.
- **Bloco de texto**: sem caixa no estado normal; padding 8px 12px; largura ajustável (mín. 160), altura cresce. Editando: contorno 1px `line` (box-shadow) + barra de formatação flutuante 48 px acima do topo do item. Duplo clique edita; duplo clique no vazio cria bloco com placeholder "Escreva" em `fg2`.
- **Imagem**: raio 4; enquanto sobe, opacidade reduzida. (No protótipo é um placeholder listrado 45° `bg2`; no produto é a imagem real.)
- **Arquivo**: cartão 230×64 (spec sugere ~200×64; 230 acomodou nomes reais), fundo `bg2`, raio 4, padding 12, gap 10; ícone 32×32; nome 15 px 1 linha reticências; tamanho em mono 12 `fg2` ("2,4 MB"; subindo: "enviando"). Etiqueta de extensão (`PDF`, `ZIP`) em mono 9 px `fg2` sobre fundo `bg2`, centrada na base do ícone — **escrita pelo app, não no SVG**. Upload: barra de 2 px `acc` na base do cartão, sem %. Renomear: input inline no lugar do nome (borda baixo 1px `line`), Enter/blur confirma.
- **Link**: mesmo cartão 230×64; ícone de corrente 24×24 (viewBox 32: `M13.2 18.8l5.6-5.6M11.6 15.2l-2.4 2.4a3.7 3.7 0 1 0 5.2 5.2l2.4-2.4M20.4 16.8l2.4-2.4a3.7 3.7 0 1 0-5.2-5.2l-2.4 2.4`); URL sem `https://` sublinhada com `text-decoration-color: acc`; cursor pointer sempre.
- **Vídeo e áudio tocam dentro do quadro** (dono e visitante, inclusive em "só ver"): o cartão ganha um botão ▸/❚❚ 28×28 em `fg` no fim da linha; enquanto toca (ou pausado no meio), o tempo em mono 12 ("0:12 · 1:24") substitui o tamanho. **Áudio** toca no próprio cartão 230×64, com progresso de 2 px `acc` na base. **Vídeo** expande o cartão para 320 px e abre a área de reprodução (~320×166, raio 4) abaixo da linha, com progresso de 2 px `acc` na base da área; clicar na área toca/pausa. Um item toca por vez. Sem chrome de player, sem controle de volume ou fullscreen custom — no produto, usar `<video>`/`<audio>` nativos apontando pro download protegido (com `Range`), `preload="none"`; a área listrada do protótipo é o placeholder do frame.

### 4. Seleção e manipulação
- Selecionado: contorno 2 px `acc` (box-shadow, não border), alça 13×13 no canto inferior direito (fundo `bg`, borda 1,5px `acc`, raio 2, cursor nwse-resize) só em item redimensionável (texto/imagem), e `⋯` 28×28 `fg2` a 32 px acima do canto superior direito do item. Vários: cada um com contorno, sem caixa de grupo.
- Laço: borda 1px `acc`, preenchimento `acc` a 10% (`acc` + alpha 1A), sem raio.
- Arrastando: opacidade 80% dos itens movidos; snap invisível de 8 px; sem guias, sem sombra.
- Menu do item (popover raio 8, `bg2`, sombra, largura 190, itens padding 8px 15 px, sem ícone): Renomear (só arquivo) · Baixar (arquivo, imagem) · Compartilhar arquivo (só arquivo) · Duplicar · Trazer pra frente · Apagar (em `c1`).

### 5. Barra de formatação flutuante (ao editar texto)
Pílula não: retângulo raio 4, `bg2`, sombra, padding 4, controles 28×28 raio 4, divisores 1px `line`. Ordem: B I U S | H1 H2 | lista, numerada, checklist (ícones do repo 16×16) | bolinhas hl1 hl2 hl3 (14 px ∅) e × | bolinhas c1 c2 c3 | limpar (ícone do repo).

### 6. Popover de compartilhar (320 px, raio 8, `bg2`, sombra, padding 12, canto sup. direito)
- Título 15 px 700: "Este quadro" / "Seleção (3 itens)" / nome do arquivo.
- Seleção: linha 13 px `fg2` "Quem abrir vê só o que está selecionado"; só modo "Só ver".
- Quadro: Desativado / Só ver / Pode editar (texto 15 px, ativo = `acc` 700).
- Linha "EXPIRA" (meta uppercase `fg2`) + opções em texto 13: 1 h · 1 dia · 7 dias · nunca (ativa sublinhada `acc`).
- Linha do link: URL em mono 12 `fg2` reticências + botão "Copiar" (borda 1,5px `acc`, texto `acc`, raio 4, padding 4px 8px).
- "LINKS ATIVOS" (meta uppercase) após divisor: cada linha = alvo sublinhado `acc` ("Quadro", "Seleção · 3 itens", "relatorio-orcamento.pdf") + modo em mono 12 `fg2` ("só ver"/"pode editar") + links de texto "Copiar" (`acc`) e "Desativar" (`fg2`), ambos 13 px sublinhados. Sem tabela, sem datas.

### 7. Menu do quadro (⋯) — 190 px, raio 8
Fixar · Baixar .md · Baixar tudo (.zip) · Imprimir · Tema escuro/claro · Apagar (`c1`).

### 8. Busca global (Ctrl+K ou Cmd+K)
Popover central (520 px, raio 8, `bg2`, sombra, topo a 72 px), campo com borda só embaixo, placeholder "Buscar em tudo — quadros, arquivos, #tags". Resultados: coluna tipo em meta uppercase `fg2` 64 px ("quadro"/"arquivo") · nome 15 px · meta em mono 12 `fg2` (tag/tempo ou quadro de origem). Escolher um arquivo abre o quadro dele, seleciona e enquadra o item.

### 9. Quem recebe o link (sem lista, sem menu)
- **Quadro/Seleção**: topo com "← sair da prévia" (mono 13 `fg2` — no produto real não existe; é navegação do protótipo) e "SÓ VER" (meta uppercase). Seleção abre enquadrada só com os itens dela, mesmas posições. Pan/zoom livres; nada se move em "só ver". Rodapé com borda topo: "FEITO COM TRECOS · Crie o seu quadro" (link `acc`) + botão "Duplicar" (primário: borda 1,5px `acc`).
- **Página de download de arquivo**: centrada, máx. 360 px: ícone 64×64 (traço 1,4) com etiqueta mono 12; nome 21 px 700; tamanho mono 13 `fg2`; aviso 15 px `fg2` "Arquivo enviado por outra pessoa. Baixe só se confiar em quem mandou."; botão primário "Baixar" (16 px, padding 8px 24px). Rodapé igual.
- **Arquivo de mídia compartilhado toca na própria página**, acima do nome: vídeo em área 328×184 (raio 4, progresso 2 px `acc` na base, clique toca/pausa); áudio em linha: botão ▸/❚❚ 32×32 `fg` + trilho de 2 px `line` com progresso `acc` + tempo mono 12 `fg2`. O Baixar continua embaixo — tocar não substitui baixar.

### 10. Toast
Um só, centro inferior: fundo `fg`, texto `bg`, 15 px, raio 4, padding 10px 16px, sombra. 3 s (5 s com ação).

## Interactions & Behavior
- Clique seleciona; Shift+clique adiciona; arrasto no vazio = laço (seleção ao vivo); arrasto no item move a seleção inteira com snap 8 px; alça redimensiona (imagem mantém proporção, texto só largura, mín. 160/60).
- Duplo clique: vazio cria texto; texto entra em edição (Esc sai). Delete/Backspace apaga seleção. Ctrl/Cmd+K abre busca. Esc fecha overlays e limpa seleção.
- Zoom: botões ×1.25; Ctrl+roda ×1.1 em volta do cursor; clamp 10–400%; enquadrar = bounding box + 96 px de folga, centrado.
- Compartilhar abre com alvo pela seleção atual (algo selecionado → "Seleção (n itens)"). Copiar gera/mostra toast "Link copiado" e adiciona em Links ativos (1 por alvo). Desativado → toast "Link desativado".
- Upload: barra 2 px anima; falha: item some + toast "Não deu pra enviar o arquivo".
- Mídia: ▸ toca, ❚❚ pausa (retoma de onde parou); tocar outro item pausa o anterior; ao terminar, volta a 0 e mostra o tamanho de novo. O clique no ▸ não seleciona nem arrasta o item (stopPropagation).
- Transições só de opacidade/deslocamento, 150 ms; respeitar `prefers-reduced-motion`. Sem tooltip, spinner, skeleton, modal escurecido. Máx. 2 estados por controle. Foco visível: outline 2 px `acc` offset 2.

## State Management (o protótipo demonstra; o produto segue trecos-prompt.md)
Itens `{id, type, x, y, w, z}` (+ `h` p/ imagem, `html`, `file`, `url`); seleção como set; câmera `{zoom, pan}` por quadro no navegador; modo de compartilhamento por alvo; links ativos `[{alvo, modo}]`; tema claro/escuro/sistema.

## Assets
- Ícones existentes do repo (usar como estão): `docs/design/design-system/icons/` — sidebar, share, pin, back, list-bullet, list-number, checklist, clear-format.
- **Novo ícone de interface** (o único): "enquadrar" 24×24, path acima, mesma linguagem (1 path, traço 1,75, `currentColor`, cantos redondos).
- **Ícones de arquivo 32×32** (traço 1,75, `currentColor`, mesma folha com canto dobrado em todos): base `M19 4H9.5A2.5 2.5 0 0 0 7 6.5v19A2.5 2.5 0 0 0 9.5 28h13a2.5 2.5 0 0 0 2.5-2.5V10.5L19 4Z M19 4.5v6h6` + detalhe: zip `M15.5 6v1.75 M15.5 9.75v1.75 M15.5 13.5v1.75` · documento `M11.5 15h9 M11.5 18.5h6` · planilha `M11.5 14h9v6.5h-9Z M16 14v6.5 M11.5 17.25h9` · áudio `M11 17.5c1.6-3 3.2-3 4.8 0s3.2 3 4.8 0` · pdf/genérico = só a base. Faltam desenhar: apresentação, vídeo, código (seguir a mesma receita; deixar a base livre embaixo para a etiqueta de texto). Nada de cor por tipo.
- Ícone de link 24×24 (path acima, viewBox 32).
- Imagens: nenhuma na interface; placeholders do protótipo viram imagens reais.

## Microcopy (pt-BR, colar direto)
"Escreva" · "salvo" · "Buscar" · "Buscar em tudo — quadros, arquivos, #tags" · "Compartilhar" · "Este quadro" · "Seleção (3 itens)" · "Quem abrir vê só o que está selecionado" · "Desativado / Só ver / Pode editar" · "Expira · 1 h / 1 dia / 7 dias / nunca" · "Links ativos" · "Copiar / Desativar" · "Renomear / Baixar / Compartilhar arquivo / Duplicar / Trazer pra frente / Apagar" · "Fixar / Baixar .md / Baixar tudo (.zip) / Imprimir / Tema escuro / Apagar" · "1,4 GB de 2 GB" · "Espaço cheio: 2 GB de 2 GB" · "Link copiado" · "Link desativado" · "Não deu pra enviar o arquivo" · "Esse tipo de arquivo não é aceito" · "Só o dono do quadro pode adicionar arquivos" · "Arquivo enviado por outra pessoa. Baixe só se confiar em quem mandou." · "Baixar" · "Feito com Trecos · Crie o seu quadro" · "Quadro duplicado na sua conta" · "Sair".

## Files (tudo neste pacote)
- `Trecos.dc.html` — protótipo navegável de referência. Os valores exatos estão no CSS inline e no objeto `THEMES` do script.
- `IMPLEMENTACAO.md` — guia pro dev: ordem das etapas, bloco `:root` pronto, critérios de aceite.
- `SIDEBAR-V3.md` — redesign da sidebar (trilho + painel), modelo de seleção, Recentes, lixeira e o estilo v3 do quadro; protótipos `Sidebar v3 - final.dc.html`, `Trecos v3 - completo.dc.html` e o `Trecos.dc.html` atualizado (`support.js` é o runtime dos protótipos).
- A spec funcional completa é o `trecos-prompt.md` na raiz do repo; o briefing de design da v2 é `docs/design/BRIEFING-TRECOS.md`.
- `MICROCOPY.md` — todos os textos em pt-BR e EN, pra colar no `i18n.js`.
- `icons/` — os 8 ícones existentes do repo + os novos: `enquadrar.svg` (24×24), `link.svg` e os 9 `arquivo-*.svg` (32×32, folha com canto dobrado + detalhe por família; a etiqueta PDF/ZIP é texto do app, fora do SVG).
