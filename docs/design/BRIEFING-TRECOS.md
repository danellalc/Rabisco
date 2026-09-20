# Trecos: briefing de design (v2)

O Rabisco virou **Trecos**. A ideia cresceu: em vez de uma página de texto corrido, o app agora é um **quadro infinito** onde a pessoa joga texto, prints, imagens, links e qualquer arquivo (pdf, docx, zip...), organiza tudo como quiser e compartilha o quadro inteiro, um pedaço dele ou um arquivo só. Um Drive misturado com bloco de notas, num quadro. Quem recebe o link vê e baixa.

Este documento é um **incremento** do briefing anterior: os princípios, os tokens de cor, a tipografia, os espaçamentos, a tela de entrar, a lista, o toast, o menu e o popover de compartilhar continuam valendo como base. Aqui está só o que muda e o que é novo.

## O que continua igual

- Abriu, usou. Zero onboarding. Salva sozinho. Compartilhar é um clique.
- Fonte do sistema, sem imagem na interface, no máximo dois estados por controle, sem modal com fundo escuro, sem tooltip, sem spinner, sem skeleton.
- Tema claro, escuro ou do sistema (a pessoa escolhe no menu; já existe).
- Os 12 tokens de cor, os 5 tamanhos, os 5 espaçamentos, os 2 raios e a 1 sombra. Não peçam token novo: item de arquivo, cartão de link e seleção usam `bg2`, `line` e `acc`.
- Todo o editor de texto (barra de formatação, listas, checklist, marca-texto, cores, imagem dentro do texto com alça) continua exatamente como foi desenhado, só que agora dentro de um bloco no quadro.

**Orçamento novo.** O app inteiro cabe em 48 KB comprimidos (era 32). O CSS pode chegar a 24 KB sem minificar. Continua sendo pouco: cada tela, estado e ícone custa.

## O que é novo

### 1. O quadro

- Fundo do quadro é `bg`, sem grade visível, sem pontinhos. O quadro não tem borda nem fim.
- Controles de zoom no canto inferior direito, discretos: `−`, a porcentagem em texto (`100%`), `+` e um botão "enquadrar" (o único ícone novo de interface). No celular esses controles somem; é pinça e dois dedos.
- O cabeçalho continua o mesmo: voltar ou recolher lista, indicador "salvo", Compartilhar, `⋯`.
- Quadro novo: um bloco de texto grande no centro com o placeholder "Escreva" e o cursor dentro. Nada mais na tela. Não desenhem estado vazio com ilustração ou dica.
- Mock necessário: quadro com uns 8 itens de tipos misturados a 100%, o mesmo quadro a 40% (enquadrado), e o celular com o mesmo quadro.

### 2. Os quatro itens

Só existem estes quatro. Todos são retângulos com cantos no raio pequeno, sem sombra, sem borda no estado normal.

- **Bloco de texto.** Texto sobre o fundo, sem caixa visível quando não está selecionado. Largura ajustável, altura cresce com o conteúdo. Editando: contorno fino em `line` e a barra de formatação flutuante de sempre.
- **Imagem.** Print solto no quadro. Mesmo desenho da imagem dentro do texto: cantos no raio pequeno, opacidade reduzida enquanto sobe, alça no canto quando selecionada.
- **Arquivo.** Um cartão pequeno e fixo (sugestão 200 × 64 px): ícone da família à esquerda (32 px), nome em uma linha com reticências, abaixo o tamanho em `fg2` ("2,4 MB"). Fundo `bg2`. Enquanto sobe, uma barra de progresso de 2 px em `acc` na base do cartão, sem porcentagem em texto. Falhou: o cartão some e o toast avisa.
- **Link.** Cartão com o mesmo formato do arquivo, ícone de link à esquerda, a URL sem `https://` em uma linha, sem título, sem favicon, sem preview. É clicável sempre: cursor de mão.

### 3. Ícones de arquivo (a entrega mais importante)

Nove ícones, um por família: **pdf, documento, planilha, apresentação, compactado, vídeo, áudio, código, genérico**. Regras:

- 32 × 32, mesma linguagem dos 8 ícones existentes: um `<path>`, traço de 1,75 px em `currentColor`, cantos redondos, sem preenchimento sólido grande. A silhueta é a mesma folha de papel com o canto dobrado em todos; o que muda é um detalhe pequeno dentro (linhas para documento, grade para planilha, zíper para compactado, play para vídeo, onda para áudio, `</>` para código, nada para genérico).
- **A extensão vai escrita em texto pelo app** (`PDF`, `DOCX`, `ZIP`), numa etiqueta de 3 ou 4 letras em `fg2` sobreposta na base do ícone. Não desenhem a etiqueta dentro do SVG; desenhem o espaço para ela.
- Nada de cor por tipo (pdf vermelho, planilha verde). Tudo em `fg`, senão o quadro vira um arco-íris e o CSS estoura. Se quiserem UMA exceção, proponham e justifiquem.
- Nada parecido com os ícones do Windows, do Mac ou do Google Drive: é referência de sensação, não pode ser cópia.
- Entregar como código SVG otimizado, um arquivo por ícone, mais a prévia dos 9 em claro e escuro, no tamanho real (32 px) e a 200%.

### 4. Seleção e manipulação

- Item selecionado: contorno de 2 px em `acc`, igual ao da imagem hoje. Uma alça no canto inferior direito. Vários selecionados: cada um com o contorno, sem caixa envolvendo o grupo.
- Laço: retângulo com borda de 1 px em `acc` e preenchimento de `acc` a 10%, desenhado enquanto arrasta no vazio.
- Arrastando itens: opacidade a 80% do que está sendo movido. Sem sombra, sem guias de alinhamento, sem réguas. O alinhamento por grade de 8 px é invisível.
- Menu do item (botão direito ou `⋯` que aparece só com o item selecionado, no canto superior direito dele): Renomear (arquivo), Baixar (arquivo e imagem), Compartilhar arquivo, Duplicar, Trazer pra frente, Apagar. Lista de texto sem ícone, como o menu do quadro.
- Celular: tocar seleciona, arrastar pelo item move, pinça é zoom, dois toques no vazio cria texto. Editar texto no bloco abre o teclado com a barra de formatação acima dele, como hoje. Mock necessário: item selecionado no celular e bloco de texto em edição com teclado aberto.

### 5. Compartilhar (v2)

O popover cresce uma linha: **o que** está sendo compartilhado.

- Sem nada selecionado: "Este quadro", com Desativado, Só ver, Pode editar, a expiração e o link, como hoje.
- Com itens selecionados: o popover abre em "Seleção (3 itens)", só com Só ver, expiração e o link. Um texto de uma linha explica: "Quem abrir vê só o que está selecionado".
- Abaixo, "Links ativos": uma lista curta (raramente mais de 3) com o alvo ("Quadro", "Seleção · 3 itens", "relatorio.pdf"), o modo e dois links de texto: Copiar e Desativar. Sem tabela, sem data de criação, sem contador de acessos.
- Mocks: popover do quadro (já existe), popover de seleção, popover com dois links ativos.

### 6. Quem recebe o link

Três variações, todas sem lista, sem menu e com o rodapé "Feito com Trecos · Crie o seu quadro":

- **Quadro inteiro**: o mesmo quadro, com pan e zoom, sem os controles de edição no modo ver. No modo editar, tudo se move e se edita, mas arrastar arquivo ou colar imagem dá o toast "Só o dono do quadro pode adicionar arquivos".
- **Seleção**: os itens selecionados nas mesmas posições, enquadrados ao abrir, e nada mais. Visualmente igual ao quadro inteiro.
- **Um arquivo**: uma página pequena e centralizada, como a tela de entrar: ícone grande da família (64 px), nome, tamanho, o aviso em `fg2` "Arquivo enviado por outra pessoa. Baixe só se confiar em quem mandou." e o botão primário "Baixar". Nada mais. Mock em celular e desktop.
- Botão Duplicar no rodapé copia o quadro ou a seleção pra conta de quem abriu, com os arquivos.

### 7. Lista lateral: Quadros e Arquivos

- Duas abas em texto no topo da lateral, "Quadros" e "Arquivos", com a ativa sublinhada em `acc`. Sem ícone.
- Quadros: a lista de hoje, com "quadro" no lugar de "nota". Título automático; quadro só com arquivos mostra o nome do primeiro arquivo.
- Arquivos: todos os arquivos de todos os quadros, mais recente primeiro. Cada linha: ícone pequeno (20 px), nome com reticências, à direita o tamanho, embaixo em `fg2` o título do quadro de origem. A busca filtra por nome. Clicar abre o quadro naquele item.
- Rodapé da lateral ganha uma linha: "1,4 GB de 2 GB" em `fg2`. Cheio: a mesma linha em `c1`. Sem barra de progresso, sem botão de upgrade na v1.

### 8. Estados e textos novos

- Toasts novos: "Não deu pra enviar o arquivo", "Esse tipo de arquivo não é aceito", "Espaço cheio: 2 GB de 2 GB", "Só o dono do quadro pode adicionar arquivos", "Colocar o conteúdo compartilhado numa nota nova?" vira "...no quadro?".
- Indicador de salvamento não muda.
- Nada de barra de progresso global, painel de uploads, fila. Cada item mostra o seu progresso.

### 9. Ícone e nome

- O nome é **Trecos**. Aparece só em texto, como antes. Domínio provável: trecos.digital.
- Ícone do app novo, mesmas regras de antes: maskable, fundo sólido, símbolo dentro do círculo central de 80%, sem gradiente. SVG mestre de até 1 KB mais PNG 180, 192 e 512. O mesmo SVG é o favicon.
- Sugestão de conceito, não obrigação: vários trecos pequenos (um quadrado, um traço, uma bolinha) soltos num quadro, na cor do texto sobre o fundo escuro.

## O que NÃO existe, de propósito

Grade visível, réguas, guias de alinhamento, minimapa, conectores ou setas entre itens, formas geométricas, cor de fundo em item, agrupar, camadas, comentários, cursor de outra pessoa, presença, preview de site no link, preview de PDF, pastas no Drive, seleção múltipla no celular, painel de uploads, barra de progresso global, tela de plano ou upgrade, onboarding do quadro.

## Entregáveis

- **Figma**, celular a 375 px: quadro com itens mistos; item selecionado; bloco de texto em edição com teclado; popover de seleção; popover com links ativos; página de download de um arquivo; lateral na aba Arquivos. Desktop a 1280 px: quadro a 100% e enquadrado a 40%, laço no meio do arraste, menu do item, popover de seleção, lateral em Arquivos.
- **Protótipo navegável** no celular: abrir quadro, tocar num arquivo, baixar; selecionar e compartilhar; abrir o link de uma seleção.
- **Ícones de arquivo**: os 9 SVGs no padrão acima, mais a prévia.
- **Ícone de interface novo**: "enquadrar", 24 × 24, no padrão dos 8 existentes. Mais nenhum: zoom é `−` e `+` em texto, abas são texto, menu do item é texto.
- **Ícone do app** Trecos: SVG mestre e PNG 180, 192 e 512.
- **Microcopy**: os textos novos em pt-BR e em inglês, curtos, numa lista. O dev cola direto.

Não entregar: telas de tablet, variações de hover, ilustração de estado vazio, tela de plano, e-mail.

Dúvida sobre o que cabe no orçamento: perguntem antes de desenhar. Ajustar no Figma é mais barato do que cortar depois.
