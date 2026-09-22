# Handoff: sidebar do Trecos v3 (redesign)

Referências visuais neste pacote:
- `Sidebar v3 - final.dc.html` — estados aprovados: 2a (padrão) e 2d (menu de contexto + pasta vazia)
- `Trecos v3 - completo.dc.html` — tela inteira: sidebar + quadro com todos os tipos de item
- `Trecos.dc.html` — protótipo navegável com a sidebar integrada ao quadro (clicar num arquivo da lista seleciona e enquadra no quadro)

Recriar pixel-perfect no `pb_public/` (vanilla, tokens no `:root`, ícones SVG inline). Idiomas pt-BR/EN via `i18n.js`.

## Estrutura nova
Sidebar = **trilho 52px + painel** (largura total igual à atual).

**Trilho** (borda direita 1px `--line`): logo rabisco 22px; Meu Drive (pasta), Recentes (relógio), Buscar (lupa, abre a busca global Ctrl+K); embaixo Lixeira (quando existir) e avatar 30px (círculo, borda 1.5px `--line`, inicial 13px 700) que abre menu com e-mail, tema e Sair. Item 36×36 raio 4; ativo = fundo `--bg2` + filete interno 2px `--acc` à esquerda (`box-shadow: inset 2px 0 0 var(--acc)`); hover = `--bg2`.

**Painel — cabeçalho** (borda baixo 1px `--line`, padding 14px):
- breadcrumb 13px `--fg2`: "← Meu Drive /" (link sublinhado; ← sobe um nível)
- nome da pasta 24px 700
- meta mono 12 `--fg2`: "4 itens · 88 KB"
- ações: botão `+ Novo` (primário: borda 1.5px `--acc`, texto `--acc`, raio 4, padding 5px 14px) + link "Enviar arquivos" sublinhado
- `+ Novo` abre menu: Pasta / Documento / Texto no quadro / Moldura

**Filtro**: input "Filtrar nesta pasta", borda só embaixo 1px `--line`, 15px.

**Lista** (padding 8px; linhas padding 9px 8px raio 4, min-height 40px):
- UMA lista, sem cabeçalhos PASTAS/DOCUMENTOS/ARQUIVOS: ordem pastas → docs → arquivos; o ícone 20px `--fg2` diz o tipo (pasta; folha-dobrada com detalhe por família)
- pasta: nome + contagem mono 12 + "›"
- doc: nome + tempo mono 12 ("há 2 h")
- arquivo: nome + tamanho mono 12
- **A linha "Quadro desta pasta" morre** — o quadro é a tela da direita, sempre

## Modelo de seleção (a correção principal)
- **1 clique abre** (pasta navega; doc abre no editor; arquivo abre por tipo). Sem duplo clique. No celular já era assim.
- Selecionar: **quadradinho 16px** (borda 1.5px `--fg2`, raio 2) que aparece no hover no lugar do ícone; marcado = fundo `--acc` + check `--bg`. Ctrl/Cmd+clique e Shift+clique (faixa) também selecionam.
- Linha selecionada: **só fundo `--bg2`** — sem filete/borda à esquerda (o filete `inset 2px 0 0 var(--acc)` é exclusivo do item ativo do trilho, indicador de navegação, nunca de seleção).
- Com seleção, o cabeçalho vira **barra de ações**: "2 selecionados · limpar" + Compartilhar · Mover · Baixar · Apagar (`--c1`). Esc limpa.
- Arrastar seleção pro quadro cria os cartões (referência, nunca duplica).
- **Seleção sidebar ↔ quadro**: clicar num arquivo/doc na lista seleciona o cartão dele no quadro e enquadra (animação nenhuma; salto direto). A linha da lista fica `--bg2` enquanto o item correspondente estiver selecionado no quadro. Ver funcionando no `Trecos.dc.html`.

## Recentes (view do trilho)
Título "Recentes" + sub mono "o que você tocou por último, em qualquer pasta". Grupos por dia (label 12px uppercase `--fg2`: hoje/ontem/data). Linha: ícone + nome 15px em cima + **pasta de origem em mono 12 `--fg2` embaixo** + hora mono 12 à direita. Inclui quadros. Clique navega pra pasta com o item selecionado e enquadrado. Guardar localmente (sem coleção nova): últimos ~50 toques.

## Rodapé do painel
- linha 13px `--fg2` "No quadro: 3 textos · 1 moldura" + link "enquadrar" (só quando o quadro tem item solto; é a ponte drive↔quadro)
- barra de cota: trilho 2px `--line` + preenchimento `--acc` proporcional; embaixo mono 12 "207 KB de 2 GB" (cheia: `--c1`)
- e-mail e Sair saem do rodapé → menu do avatar
- a dica "Duplo clique abre · botão direito mostra opções" morre

## Menu de contexto (arquivo)
Abrir · Pôr no quadro · Compartilhar · Renomear F2 · Mover · Duplicar · Baixar · Detalhes · Apagar (`--c1`). Popover raio 8, `--bg2`, sombra, 200px, item 15px padding 7px 8px, atalho em mono 11.

## Pasta vazia
"Nada aqui ainda. Solte arquivos nesta lista ou direto no quadro ao lado." + zona tracejada 1px `--line` raio 4 "soltar aqui envia pra esta pasta". Sem ilustração.

## Cabeçalho do painel — detalhes medidos
- painel 268px + trilho 52px = 320 total; painel com borda direita 1px `--line`
- meta do cabeçalho conta por tipo e NÃO muda com o filtro: "4 arquivos · 1 link · 186 MB" (singular "1 arquivo")
- título da pasta: 24px 700 (21px se o painel for o de 268px dentro do protótipo); 1 linha com reticências
- botão "+ Novo": `white-space:nowrap; flex-shrink:0` (senão quebra em Segoe UI)

## Quadro — estilo v3 (ver `Trecos v3 - completo.dc.html`)
- **Moldura**: retângulo 1px `--line` raio 4, sem fundo; nome em mono 12 `--fg2` FORA do retângulo, acima à esquerda; fica atrás dos itens; arrastar leva o conteúdo.
- **Notas adesivas**: fundo nas 3 cores de marca-texto (`--hl1/2/3`), texto `--fg`, raio 4, padding 12, largura ~140–200; sem sombra, sem rotação.
- **Cartões de referência** (arquivo, pasta, documento, link): anatomia única 230×64, fundo `--bg2`, raio 4, padding 12, gap 10; ícone 32 em `--fg` (não `--fg2`); nome 15px 1 linha; 2ª linha em mono 12 `--fg2` diz o tipo/meta ("pasta · 4 itens", "documento · há 2 h", "28 KB"); pasta ganha "›" à direita; etiqueta de extensão mono 9 sobre a base do ícone.
- **Áudio/vídeo tocam no cartão**: ▸/❚❚ 28×28, tempo "0:42 · 3:41" em mono no lugar do tamanho, progresso 2px `--acc` na base; vídeo expande o cartão pra 320px com área de reprodução.
- **Seleção no quadro**: contorno 2px `--acc` (box-shadow) + **8 alças** 13×13 (fundo `--bg`, borda 1.5px `--acc`, raio 2): cantos proporcionais (Shift libera), lados só largura/altura; ⋯ 28×28 a 32px acima do canto sup. direito; legenda opcional mono "também na pasta" sob cartão de imagem que existe no Drive.
- **Cabeçalho do quadro**: salvo (meta uppercase, flex:1) · "+ Adicionar" (link `--acc`) · Compartilhar (sublinhado 1.5px) · ⋯ · zoom no canto inferior direito (− · % mono · + · enquadrar).
- Bloco de código no quadro: fundo `--bg2` raio 4 padding 12 mono 13; citação: itálico 16 + fonte em meta uppercase.

## Microcopy nova (pt-BR · EN)
- Recentes · Recent
- o que você tocou por último, em qualquer pasta · what you touched last, in any folder
- hoje · today | ontem · yesterday
- N selecionados · N selected | limpar · clear
- 4 arquivos · 1 link · 186 MB · 4 files · 1 link · 186 MB
- Pôr no quadro · Put on the board
- No quadro: 3 textos · 1 moldura · On the board: 3 texts · 1 frame
- enquadrar · fit view
- Nada aqui ainda. Solte arquivos nesta lista ou direto no quadro ao lado. · Nothing here yet. Drop files on this list or straight onto the board.
- soltar aqui envia pra esta pasta · dropping here uploads to this folder
- vazia · empty

## Aceite
- Lado a lado com os protótipos: mesmos hex/medidas (rail 52, item 36, título 24, linha 40, quadradinho 16, cartão 230×64, contorno 2px, alça 13, progresso 2px).
- 1 clique abre em desktop e celular; zero duplo clique; F2/Enter/Delete/Esc continuam; seleção de linha sem filete.
- Clicar arquivo na lista → cartão selecionado e enquadrado no quadro.
- Orçamento 72 KB gzip / CSS 32 KB respeitado; sem tooltip real (title nativo ok), sem spinner.
