## Conceito

Papel de rascunho. A interface se comporta como uma folha de papel e um lápis — nada além disso em cima da mesa. Como a fonte é obrigatoriamente `system-ui`, a hierarquia inteira nasce de escala, peso e espaço — nunca de cor ou de caixa. A própria cor de interface é quase ausente de propósito: `acc` é um cinza com uma sombra de verde-azulado, não uma cor de marca, porque a única cor que este produto quer que alguém note é a que a pessoa escolheu para o próprio texto — o que ela grifou, o que ela sublinhou. Onde a maioria dos apps de nota tenta parecer "vivo" colorindo a própria interface, o Rabisco vai no sentido oposto até o fim: quase sem matiz nenhum.

## Voz e conteúdo

Sentence case em tudo — nunca Title Case em botão, rótulo ou item de menu ("Receber código", não "Receber Código"). Sem ponto de exclamação, sem emoji, sem "Oops", sem tom de torcida. A cópia diz exatamente o que aconteceu e sai do caminho: `Código inválido ou expirado`, `Muitas tentativas. Espere um minuto`, `Nenhuma nota encontrada`, `Só imagens`, `Imagens só o dono da nota`, `Esse link não está mais ativo`. A única exceção emocional é o toast de desfazer, e mesmo aí sem adjetivo: `Nota apagada · Desfazer`.

Botões e ações no imperativo/infinitivo curto: `Copiar`, `Entrar`, `Reenviar código`, `Trocar e-mail`, `Baixar .txt`. Zero onboarding, zero tour, zero tooltip explicando o óbvio — se um controle precisa de legenda, ele está desenhado errado, não documentado errado.

## Cor

`bg` é o fundo de toda superfície de leitura/escrita — a página, o editor, o painel da lista e a nota compartilhada. É uma folha só: a lista não tem uma cor de painel diferente do editor. `bg2` é reservado para exatamente duas coisas — o item ativo da lista e as duas superfícies elevadas (popover, toast); não use `bg2` para "dar profundidade" em mais nada, e nunca como fundo de uma tela inteira.

`fg` é o texto padrão em qualquer superfície, nos dois temas. `fg2` é texto secundário, placeholder, o indicador de salvamento e o tempo relativo na lista — sempre sobre `bg` ou `bg2`, nunca decorativo.

`acc` é a única cor interativa do produto — e é quase incolor de propósito: um cinza com uma sombra de verde-azulado, nunca uma cor "de marca" saturada. Ela só existe como marca, nunca como preenchimento: contorno de foco, sublinhado de link, contorno de 2px da imagem selecionada, cor do caret, e o texto e a borda de 1,5px — nunca o fundo — do botão de ação primária de cada tela (`Entrar`, `Receber código`, `Compartilhar` quando ativo). O sublinhado ou o contorno é o que avisa "isto é clicável"; a cor é só o detalhe de quem repara duas vezes. Uma borda ainda é um traço, não um preenchimento; a distinção que importa é que `acc` nunca vira a cor de fundo de uma área. Não crie um "botão primário com fundo `acc`", e não tente "esquentar" `acc` para parecer mais uma cor de marca — a discrição é a decisão, não uma etapa incompleta.

`hl1` `hl2` `hl3` são as três opções de marca-texto (amarelo, verde, rosa) — deliberadamente empoeiradas, nunca um amarelo-post-it ou um verde-menta saturado, mas ainda claramente amarelo/verde/rosa; são a única concentração de cor "de verdade" que o sistema permite, e por isso pertencem à pessoa que escreve, não à interface. Sempre com `fg` do mesmo tema por cima, nunca um texto branco ou preto fixo. `c1` `c2` `c3` são as três opções de cor de texto (vermelho, azul, cinza), também empoeiradas — um vermelho e um azul de caneta velha, nunca um vermelho de alerta ou um azul de link de sistema — que a pessoa aplica à própria escrita pela barra de formatação; trate como escolha de caneta, nunca como categoria, tag ou status. `c3` é intencionalmente o mesmo valor de `fg2`: a "caneta cinza" é o mesmo grafite do texto secundário do sistema.

`line` é a única cor de borda/separador do produto — um traço, não uma cor de UI. No máximo uma vez por relação entre dois elementos (por exemplo, entre a lista e o editor no desktop); nunca emoldure um elemento nos quatro lados com `line` só para separá-lo do fundo.

## Tipografia

Pilha do sistema (`system-ui`) exclusivamente — sem web font em nenhuma tela, nem para títulos. A hierarquia nasce de escala e peso, nunca de cor: `h1` (32px/700) é o título automático da nota — a primeira linha, sempre — e o bloco H1 do corpo; `h2` (21px/700) é o bloco H2; `body` (16px/400) é o corpo do texto e o mínimo em qualquer campo tocável no celular; `ui` (15px/400) é rótulo, botão de texto, item de menu, controle da barra de formatação; `meta` (13px/400, com `letter-spacing` próprio e `text-transform: uppercase` aplicado no consumo) é a única textura tipográfica extra do produto — timestamp da lista, indicador de salvamento, rodapé da nota compartilhada — e não deve aparecer em mais nada, ou perde a força de sinalizar "isto é metadado, não conteúdo".

Só dois pesos existem no produto — 400 e 700 — mais o itálico do sistema. Não introduza 500/600: é exatamente o peso intermediário de painel de SaaS que este sistema existe para não ter. `line-height` é 1.5 fixo em todo estilo, sem exceção, inclusive em `h1` mesmo parecendo generoso para um título — é uma regra de orçamento de bytes do produto, não descuido, e criar uma exceção custaria uma regra CSS a mais por tamanho.

## Espaçamento, raio e sombra

Cinco passos de espaçamento (`space-4` a `space-24`) cobrem o produto inteiro. Se uma medida não bate em nenhum dos cinco, ajuste a composição — não crie um sexto valor.

Dois raios: `radius-4` para qualquer campo de entrada, botão com fundo ou canto de imagem; `radius-8` só para as duas superfícies elevadas do produto (popover, toast). Nunca use um raio maior que `radius-8` em lugar nenhum — não existe pílula, não existe círculo perfeito em nenhum controle, não existe cartão arredondado.

`shadow-1` existe em exatamente dois lugares: o popover (compartilhar, menu da nota) e o toast. É deliberadamente mais seca e mais próxima do objeto do que uma sombra flutuante de SaaS — lê como um cartão de papel levantado da mesa, não como um painel de vidro. Nenhum outro elemento tem sombra, inclusive o item ativo da lista e a barra de formatação — eles se separam do fundo por cor (`bg2`) ou por `line`, nunca por elevação.

## Layout

Um único breakpoint (`breakpoint`, 720px) separa o layout de celular — lista e nota como telas cheias, com voltar — do layout de mesa: lateral fixa recolhível de `sidebar-width` (296px) mais a nota. A coluna de texto — editor e nota compartilhada — nunca passa de `column-width` (640px); ela é uma coluna fixa centralizada, não um container fluido que cresce com a tela. Não existe layout de tablet nem trilho de ícones entre a lista recolhida e o editor: recolhida, a lista some por inteiro e sobra só um botão de reabrir.

## Iconografia

Oito ícones no total — o teto do orçamento do produto — todos 24×24, um único elemento `<path>` (com sub-traçados quando preciso, nunca múltiplos elementos), traço de 1,75px em `currentColor`, sem preenchimento, `stroke-linecap` e `stroke-linejoin` redondos: voltar, compartilhar, alfinete (fixar), lista com marcador, lista numerada, checklist, limpar formatação, recolher lista. Nenhum ícone entra num container colorido, num círculo de fundo ou num quadrado — ele senta sozinho, no tamanho que é, na cor do texto ao redor.

Tudo que não é um desses oito ícones é texto ou caractere: `+` (nota nova), `×` (fechar, remover marca-texto), `←` (voltar em contexto de texto), `⋯` (menu da nota), `☐` / `☑` (item de checklist dentro da nota — diferente do ícone de "inserir checklist" da barra). B, I, U, S, H1, H2 na barra de formatação são letras no próprio estilo que representam — o B é negrito de verdade, o I é itálico de verdade — nunca um glifo de biblioteca de ícones. Nenhum emoji em nenhuma circunstância, inclusive em estado vazio ou toast.

## O que este sistema não tem

Não existem componentes de card genérico, botão secundário/terciário ou badge/pill neste sistema porque o produto não tem esses conceitos — antes de adicionar um, confirme se aquele elemento existe no escopo do Rabisco; a resposta, na dúvida, é que não deveria. Não existe paleta "de marca" separada da paleta funcional: as únicas cores fora de `fg`/`fg2`/`bg`/`bg2`/`line` são as que a própria pessoa aplica ao seu texto (`c1`–`c3`, `hl1`–`hl3`) e o único acento do sistema (`acc`), usado como marca, nunca como preenchimento.
