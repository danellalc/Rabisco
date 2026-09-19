Os oito ícones do Rabisco — o teto inteiro do orçamento de iconografia do produto. Todos 24×24, um único elemento `<path>` (com sub-traçados quando o desenho precisa, nunca mais de um `<path>`), traço de 1,75px, `stroke-linecap` e `stroke-linejoin` redondos, sem preenchimento.

A tinta de cada um é `currentColor` — de propósito, para herdar `fg` (ou `fg2`, conforme o contexto) quando o `<svg>` é colado diretamente no HTML do produto. Pré-visualizado aqui como `<img>`, fora desse contexto, `currentColor` não resolve e o ícone aparece na cor padrão do navegador (preto) — isso é uma limitação de como este catálogo exibe SVGs por `<img>`, não um erro do arquivo; ao consumir, inclua o código do `<path>` diretamente no documento, nunca via `<img src="...">`.

- `back.svg` — voltar (cabeçalho da nota no celular, abaixo do breakpoint)
- `share.svg` — compartilhar (cabeçalho da nota)
- `pin.svg` — nota fixada (indicador na lista; fixar/desafixar em si ficam no menu da nota, como texto)
- `list-bullet.svg` — inserir lista com marcador (barra de formatação)
- `list-number.svg` — inserir lista numerada (barra de formatação)
- `checklist.svg` — inserir checklist (barra de formatação) — diferente dos caracteres `☐`/`☑` usados nos itens já inseridos dentro da nota
- `clear-format.svg` — limpar formatação (barra de formatação)
- `sidebar.svg` — recolher/reabrir a lista (cabeçalho, acima do breakpoint)

Nenhum destes entra num container colorido, círculo ou quadrado de fundo — sempre soltos, no tamanho que são.
