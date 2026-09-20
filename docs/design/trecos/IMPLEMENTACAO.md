# Implementação — guia pro dev

## Ordem (do SPEC, "Como trabalhar")

1. **Quadro**: pan, zoom, blocos de texto como itens, criar/mover/redimensionar, laço, desfazer, autosave, migração das notas, lista com "quadro", renomear pra Trecos.
2. **Arquivos e cota**: upload, ícones, progresso, bloqueio de tipos, cota, baixar, renomear, apagar. **Plus deste design: vídeo/áudio tocam no cartão** (`<video>`/`<audio>` nativos, `preload="none"`, um por vez — ver README §3).
3. **Compartilhar v2**: quadro/seleção/arquivo, links ativos, página de download (com player pra mídia), duplicar.
4. **Acabamento**: enquadrar, atalhos, busca global (Ctrl+K), copiar/colar itens, exportar, imprimir.

## O que atualizar no repo

- `pb_public/style.css` — trocar os valores do `:root` pelos tokens v2 (abaixo), mantendo o mecanismo atual de tema (claro/escuro/sistema). Adicionar `--mono`.
- `docs/design/design-system/tokens.json` — mesmos valores novos, mesma estrutura.
- `pb_public/js/i18n.js` — strings novas de `MICROCOPY.md` (pt-BR e EN).
- Ícones: colar o `<path>` inline no HTML (nunca `<img>`). Os novos estão em `icons/`: `enquadrar.svg` (24×24, interface), `link.svg` e os 9 `arquivo-*.svg` (32×32). A etiqueta da extensão (PDF, ZIP…) é texto do app sobreposto na base do ícone, não faz parte do SVG.

## Tokens v2 (colar no :root)

```css
:root{
  --bg:#edebe7; --bg2:#e3e0da; --fg:#1b1a17; --fg2:#605e57; --line:#d3d0c9; --acc:#33524d;
  --hl1:#d9c583; --hl2:#a8bd9c; --hl3:#d2a7a7; --c1:#8e4a40; --c2:#4a637c; --c3:var(--fg2);
  --shadow:0 2px 6px rgba(30,28,24,.14), 0 8px 20px -8px rgba(30,28,24,.22);
  --mono:ui-monospace, Menlo, Consolas, monospace;
}
/* tema escuro (no mecanismo atual do style.css): */
--bg:#191816; --bg2:#242320; --fg:#eceae5; --fg2:#a3a19a; --line:#35342f; --acc:#93aea6;
--hl1:#79663a; --hl2:#3d4a3b; --hl3:#4a3537; --c1:#c98e83; --c2:#9cb2c2; --c3:var(--fg2);
--shadow:0 2px 6px rgba(0,0,0,.3), 0 8px 20px -8px rgba(0,0,0,.45);
```

## Critérios de aceite

- Lado a lado com `Trecos.dc.html` aberto no navegador: mesmos hex, mesmas medidas do README (cartão 230×64, contorno 2px, alça 13px, barra 2px, popover 320px, raios 4/8), claro e escuro.
- Orçamento: `npm run size` dentro de 48 KB gzip / CSS ≤ 24 KB. Estourou: parar e avisar, como manda o SPEC.
- Sem tooltip, spinner, skeleton, modal escurecido; máx. 2 estados por controle; foco visível 2px `--acc`.
- `npm test` verde; testar em Chromium e WebKit.
