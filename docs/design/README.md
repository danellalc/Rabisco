# Design do Rabisco

Cópia local do que o time de design entregou em 19/09/2026 (design system, tokens, ícones e telas). A fonte da verdade continua sendo o material do time; se ele mudar, atualizar esta pasta.

## Pastas

- `BRIEFING-DESIGN.md`: o briefing da versão 1 (Rabisco), enviado ao time em 19/09/2026.
- `BRIEFING-TRECOS.md`: o briefing da versão 2 (Trecos, quadro infinito com arquivos), incremento sobre o primeiro.
- `design-system/README.md`: o brand book. Conceito, voz, cor, tipografia, espaçamento, layout, iconografia.
- `design-system/tokens.json`: os 12 tokens de cor em claro e escuro, 5 tamanhos de fonte, 5 espaçamentos, 2 raios, 1 sombra e os 3 números de layout. É daqui que sai o `:root` do `style.css`.
- `design-system/components/<Nome>/README.md` e `preview.html`: guia de uso e exemplo de cada componente. Os previews usam `var(--token)` e as classes `.meta .ui .body .h1 .h2`.
- `design-system/icons/*.svg`: os 8 ícones, 24×24, um path, traço 1,75 em `currentColor`. Colar o `<path>` direto no HTML, nunca via `<img>`.
- `telas/*.dc.html`: as 5 telas do canvas. São HTML autocontido com os tokens embutidos; abrem no navegador sem o runtime só parcialmente, porque dependem de `support.js` do canvas para os estados interativos. O markup e o CSS servem de referência direta.
- `telas/canvas.json`: posição e tamanho de cada tela no canvas.

## Mapa token → CSS

| token | uso |
|---|---|
| `bg` `bg2` | fundo da página; item ativo, popover, toast |
| `fg` `fg2` | texto; texto secundário, placeholder, indicador, tempo |
| `line` | única cor de borda |
| `acc` | foco, link, contorno da imagem selecionada, borda do botão primário. Nunca preenchimento |
| `hl1` `hl2` `hl3` | marca-texto amarelo, verde, rosa |
| `c1` `c2` `c3` | cor de texto vermelho, azul, cinza. `c3` = `fg2` |

Tipografia: `meta` 13, `ui` 15, `body` 16, `h2` 21, `h1` 32. Line-height 1,5 em tudo. Pesos 400 e 700.

Layout: breakpoint 720 px, lateral 296 px, coluna 640 px.

## O que o canvas ainda não cobre

Imagem na nota com alça e estado subindo, toast em tela, nota compartilhada em modo editar com a barra, tela de link desativado, celular com teclado aberto, ícone do app. Os componentes correspondentes existem no design system.
