# Rabisco: briefing de design

Rabisco (nome provisório) é um app de notas extremamente leve. Uma página em branco onde a pessoa escreve, cola prints com Ctrl+V, ajusta o tamanho da imagem, formata o básico e compartilha por link. Só isso. Este documento diz o que precisa ser desenhado e as regras que o design tem que respeitar. As regras existem por um motivo só: o app inteiro tem que caber em 12 KB comprimidos, e cada tela, estado, token e ícone sai desse orçamento.

## Princípios

1. **Abriu, escreveu.** Cursor piscando na hora. Zero configuração, zero onboarding.
2. **Ctrl+V resolve tudo.** Texto, print, imagem copiada, arquivo arrastado.
3. **Salva sozinho.** Não existe botão de salvar.
4. **Compartilhar é um clique.** Gera link, copia, pronto.
5. **Menos é o produto.** Toda tela, botão ou opção a mais precisa se justificar. Na dúvida, não coloque.

Referência de sensação, não de layout: a simplicidade do Bloco de Notas, a fluidez do Google Keep, a limpeza do Apple Notes. O oposto do Notion. Atenção: a lista de notas é uma coluna de texto, não uma grade de cartões coloridos.

## Regras que valem para tudo

**Orçamento.** HTML + CSS + JS somam no máximo 12 KB comprimidos. Só o CSS tem 6 KB sem minificar, o que dá uns 150 seletores para o app inteiro. Meta: pronto para digitar em menos de 300 ms numa conexão 4G. Cada componente, cada estado visual, cada token de cor e cada ícone custa bytes.

**Fonte.** A do sistema (`system-ui`): Segoe UI no Windows, SF no Mac e iPhone, Roboto no Android. Desenhem com uma delas e aceitem que muda. Regular, bold e o itálico do sistema. Base de 16 px. Nenhum campo de texto abaixo de 16 px no celular, senão o iPhone dá zoom ao focar.

**Ícones.** Sem biblioteca. No máximo 8 SVGs, todos 24×24, um path só, traço de 1,75 px em `currentColor`, sem preenchimento, cantos redondos, entregues como código SVG otimizado, não exportação do Figma com ids e clip-path. Candidatos: recolher lista, alfinete, lista com bolinha, lista numerada, checklist, limpar formatação, voltar, compartilhar. Todo o resto é texto ou caractere neutro: `+ × ← ⋯ ☐ ☑`. B, I, U, S, H1 e H2 são letras estilizadas. Marca-texto e cores de texto são bolinhas de cor. Itens de menu são texto sem ícone. Nada de emoji.

**Imagens na interface.** Nenhuma. Sem ilustração, sem logotipo em imagem, sem wordmark. O nome aparece só em texto. A única imagem do app é o ícone da PWA.

**Estados.** No máximo dois estados visuais por controle: normal e ativo/pressionado. Foco de teclado é um contorno na cor de destaque, igual em todo lugar. Hover não existe no celular, então toda ação tem que estar visível sem hover. Hover no desktop é bônus e não muda layout.

**O que não existe em lugar nenhum.** Modal com fundo escurecido, tooltip, skeleton, spinner de qualquer tipo, animação de entrada, scrollbar customizada, dica de atalho na interface. Transições só de opacidade e deslocamento, 150 ms.

**Modo escuro.** Automático, seguindo o sistema. Não tem botão. No escuro só a cor muda: mesmo layout, mesma borda, mesma sombra.

**Acessibilidade mínima.** Contraste 4,5:1 nos dois temas, inclusive texto colorido sobre o fundo e texto padrão sobre cada marca-texto. Foco visível. Área de toque de 40 px no mínimo, 44 px onde couber. Respeitar `prefers-reduced-motion`.

**Layouts.** Só dois. Até 720 px é celular: lista e nota são telas separadas, com botão voltar. Acima disso a lista vira lateral fixa de 280 px, recolhível, e a nota ocupa o resto. Recolhida, a lista some por inteiro e sobra um botão para reabrir. Não existe layout de tablet nem trilho de ícones. A nota é uma coluna centralizada com largura máxima de 680 px, a mesma no editor e na nota compartilhada. Esses três números são sugestão do dev; podem propor outros, mas tem que existir um número para cada.

## O que precisa ser desenhado

### 1. Entrar

- Tela única: nome em texto, campo de e-mail, botão "Receber código". Sem ilustração. Primeira vez e retorno são a mesma tela; não existe cadastro.
- E-mail inválido: erro em uma linha abaixo do campo, sem toast.
- A segunda etapa substitui o formulário no lugar: um único campo para o código de 6 dígitos, não seis caixinhas. Botão "Entrar". Dois links de texto: "Reenviar código" e "Trocar e-mail". Mostrar para qual e-mail foi e que o código vale por 10 minutos.
- O e-mail também traz um link que loga direto. Quem clica cai numa transição mínima com "Entrando…" e vai para a nota. O e-mail em si não precisa ser desenhado.
- "Enviando" é o botão desabilitado com texto "Enviando…". Erro é um slot só com dois textos possíveis: "Código inválido ou expirado" e "Muitas tentativas. Espere um minuto". O servidor não distingue errado de expirado.

### 2. Tela principal

**Abertura.** O app cai direto na última nota usada, com o cursor no fim do texto. No celular isso significa abrir na nota, não na lista; o voltar leva à lista. Na primeira vez, sem notas, abre numa nota nova em branco. A posição do cursor dentro da nota não é guardada.

**Lista de notas.**
- Ordem: fixadas primeiro, depois da mais recente para a mais antiga.
- Busca: campo nativo `type=search` com placeholder "Buscar", sem lupa. Filtra enquanto digita, sem destacar trecho, sem contador. Sem resultado: "Nenhuma nota encontrada" em uma linha.
- Botão "+" para nota nova.
- Cada item tem duas informações: título e quando foi editada. Título é a primeira linha de texto da nota, cortado com reticências em uma linha. Nota nova vazia aparece como "Nova nota". Sem linha de prévia do conteúdo.
- Textos de tempo, só estes: "agora", "há 5 min", "há 2 h", "ontem", "12 set", "12 set 25".
- Nota que só tem imagem: título "Imagem" e uma miniatura quadrada de 40 px à direita, gerada pelo servidor num tamanho fixo, cortada no centro, com fundo neutro enquanto carrega. Nota com texto e imagem não tem miniatura.
- Nota fixada tem um alfinete pequeno. É só indicador; fixar e desafixar ficam no menu da nota.
- Nota ativa com fundo destacado.
- Lista vazia: uma linha de texto. Só aparece se a pessoa apagar tudo.
- Rodapé da lista: o e-mail logado em cor secundária e um link de texto "Sair". É o único lugar de sair e a única "configuração" do app.

**Cabeçalho da nota.** Celular: `← voltar` · indicador de salvamento · `Compartilhar` · `⋯`. Desktop: `recolher lista` · indicador de salvamento · `Compartilhar` · `⋯`. Só isso. Sem título editável, sem contador de palavras, sem data.

**Editor.**
- Página em branco, sem borda. A primeira linha vira o título sozinha. Placeholder único "Escreva…" quando a nota está vazia.
- Só existem estes blocos: parágrafo, H1, H2, lista com bolinha, lista numerada, checklist e imagem. H1 e H2 usam os dois maiores tamanhos da escala. Sem menu "/", sem alça de bloco, sem reordenar, sem tabela, sem lista aninhada desenhada.
- Indicador de salvamento: um texto discreto em cor secundária, num lugar só, com três valores: "salvando…", "salvo", "sem conexão · não salvo".
- Botão `⋯` sempre visível abrindo um popover com lista de texto sem ícones: Fixar/Desafixar, Baixar .txt, Baixar .md, Apagar. Baixar é download direto, sem tela; o nome do arquivo é o título da nota.
- Apagar não pede confirmação. A nota some e o toast "Nota apagada · Desfazer" fica 5 segundos. Depois, abre a próxima nota da lista, ou uma nova se não houver.
- Atalhos que o app faz e que não aparecem na interface: no início da linha, `# ` título, `## ` subtítulo, `- ` lista, `1. ` numerada, `[] ` checklist. No teclado, Ctrl+B/I/U, Ctrl+Shift+X riscado, Ctrl+Alt+N nota nova. Não existe `**negrito**` inline.

### 3. Imagens dentro da nota

- A imagem é sempre um bloco sozinho na linha. Sem texto ao lado, sem alinhar à esquerda ou direita, sem legenda, sem tela cheia. O cursor fica logo abaixo dela.
- Ao colar, aparece na hora onde estava o cursor, com opacidade reduzida enquanto sobe. Sem barra de progresso, sem spinner. Se o upload falhar, a imagem some e o toast avisa "Não deu pra enviar a imagem". Sem botão de tentar de novo; a pessoa cola de novo.
- Várias imagens coladas de uma vez entram em sequência.
- Print grande entra na largura da coluna. Print pequeno entra no tamanho real.
- A largura é guardada em porcentagem da coluna, então a mesma imagem escala junto em qualquer tela. Não desenhem tamanhos em pixel.
- Selecionada, após clique ou toque, nunca no hover: contorno de 2 px na cor de destaque e uma alça só, no canto inferior direito, quadrado de uns 12 px visíveis com área de toque de 32 px. Arrastar a alça redimensiona mantendo a proporção. Mínimo 60 px, máximo a largura da coluna. Duplo clique volta ao original. Esc ou clique fora tira a seleção. Backspace ou Delete apaga.
- Arrastar um arquivo por cima da nota: no máximo um contorno no editor. Arquivo que não é imagem: toast "Só imagens".
- Mocks necessários: normal, selecionada com alça, subindo. Só esses três.

### 4. Barra de formatação

- Desktop: barra pequena logo acima do texto selecionado, some quando a seleção some. Controles de 28 a 32 px.
- Celular: barra fixa no rodapé da tela, colada acima do teclado, respeitando a área do indicador home. O balão nativo de Copiar/Colar continua aparecendo sobre a seleção, por isso a barra vai embaixo. O mock precisa mostrar a tela com teclado aberto e a barra.
- Não existe barra fixa no desktop: sem seleção, títulos e listas entram pelos atalhos de digitação.
- São 18 controles, e só estes: negrito, itálico, sublinhado, riscado; H1, H2; lista com bolinha, numerada, checklist; marca-texto amarelo, verde, rosa e remover; cor de texto vermelho, azul, cinza e padrão; limpar formatação. Em 375 px isso não cabe numa linha com toque de 40 px: desenhem duas linhas ou uma linha com rolagem horizontal. Sem submenu que abre.
- Estado ativo do botão é só um fundo diferente, quando a seleção já tem aquele formato.
- Checklist: `☐` e `☑` em caractere. Item marcado fica esmaecido, não riscado, porque riscado é uma opção de formatação separada.
- Marca-texto e cores de texto: entreguem os 6 tons em claro e escuro, legíveis com o texto padrão por cima.
- Links: só cor de destaque e sublinhado. Sem cartão de preview, sem popover ao passar o mouse, sem favicon. Clique normal posiciona o cursor. Ctrl+clique abre em nova aba. No celular e no modo "só ver", toque simples abre.

### 5. Compartilhar

- O botão Compartilhar abre um popover pequeno, não um modal, com uma escolha de três posições: Desativado, Só ver, Pode editar. É um link só que muda de modo; não são dois links.
- Ao escolher Só ver ou Pode editar aparece a linha do link, cortada com reticências, e o botão "Copiar". A cópia automática ao gerar é bônus e não é garantida no iPhone, então o botão é obrigatório. Toast "Link copiado".
- Ao reabrir, a posição escolhida já mostra o estado atual. Voltar para Desativado mata o link e dispara o toast "Link desativado". Ativar de novo gera um link novo.
- Sem tela de gerenciar links, sem lista de quem acessou. O preview do link no WhatsApp mostra só "Rabisco", nunca o conteúdo da nota; não desenhem preview.

### 6. Nota compartilhada, para quem recebe o link sem conta

- É a mesma tela do editor sem lista, sem menu e sem botão de compartilhar, com a mesma largura de coluna, a mesma formatação e as mesmas imagens. Vai abrir principalmente no celular, vindo do WhatsApp.
- Rodapé de uma linha em texto: "Feito com Rabisco · Crie a sua nota". Sem logo, sem banner.
- Modo "só ver": sem barra, sem cursor. Links abrem no toque simples. Checklist não é clicável.
- Modo "pode editar": mesmo editor do dono, com barra de formatação e indicador de salvamento. Pode redimensionar e apagar imagens que já estão na nota, mas não cola novas; ao tentar, toast "Imagens só o dono da nota".
- Se duas pessoas editam ao mesmo tempo, o último salvamento vence, em silêncio. Não desenhem presença, avatar, cursor de outra pessoa nem aviso de conflito.
- Link desativado ou inexistente: uma frase centralizada, "Esse link não está mais ativo", e o mesmo rodapé.

### 7. Toast e estados gerais

- Toast: um único elemento, embaixo no centro, texto e no máximo uma ação em texto. Sem ícone, sem botão fechar, sem empilhar; o novo substitui o anterior. Some sozinho em 3 segundos, 5 quando tem "Desfazer". Fundo na cor do texto, texto na cor do fundo. Usado em: "Link copiado", "Link desativado", "Nota apagada · Desfazer", "Imagens só o dono da nota", "Não deu pra enviar a imagem", "Só imagens".
- Offline não é um modo. O app abre do cache com a lista e a última nota, dá para digitar, e o indicador vira "sem conexão · não salvo". Sem banner, sem tela offline, sem ícone de sincronização, sem fila.
- Erro ao salvar com internet: o indicador vira "não salvo". Sessão expirada: volta para a tela de entrar, sem aviso.
- Primeira abertura sem cache: lista vazia por um instante. Sem skeleton.

### 8. Ícone e PWA

- Um único desenho, feito já para ser maskable: fundo sólido preenchendo o quadrado inteiro, símbolo dentro do círculo central de 80% do lado, sem transparência. Formas simples, sem gradiente, sem filtro.
- Entregar o SVG mestre com no máximo 1 KB, mais PNG em 180, 192 e 512 px exportados dele. O mesmo SVG é o favicon.
- Cor de tema para a barra do navegador: a cor de fundo do app, uma para o claro e uma para o escuro.

## O que NÃO existe, de propósito

Pastas, tags, templates, temas customizáveis, escolha de fonte, tabelas, colaboração em tempo real, presença, avatares, comentários, versões, app nativo, integrações, login com Google ou senha, tela de perfil, tela de configurações, tour de boas-vindas, preview de link, alinhamento, legenda ou tela cheia de imagem, arrastar para reordenar notas, lixeira, arquivar, seleção múltipla, notificações, tooltips, modais de confirmação, scrollbar customizada, skeleton, spinner, dica de atalho na interface, logotipo em imagem. Compartilhar um print da galeria do Android direto para o app é uma etapa opcional futura e, se entrar, cai numa nota nova sem tela própria.

## Entregáveis

- **Figma**, telas de celular a 375 px: entrar em dois passos com erro; lista; nota com teclado aberto e barra; imagem selecionada com alça; popover de compartilhar; menu da nota; nota compartilhada em só ver e pode editar; link desativado; toast com Desfazer. Desktop a 1280 px só para a tela principal com lista aberta e recolhida, popover de compartilhar e menu da nota. Escuro só para o editor e a nota compartilhada, para conferir os tokens.
- **Protótipo navegável** do fluxo principal no celular: entrar, nota, colar imagem, compartilhar, nota compartilhada.
- **Tokens de cor** como variáveis CSS, no máximo 12, com exatamente estes nomes e um valor hex para claro e um para escuro: `--bg` fundo; `--bg2` fundo da lista, item ativo e popover; `--fg` texto; `--fg2` texto secundário, placeholder, indicador e tempo na lista; `--line` bordas e separadores; `--acc` link, foco, contorno da imagem selecionada e botão principal; `--hl1` `--hl2` `--hl3` marca-texto amarelo, verde e rosa; `--c1` `--c2` `--c3` texto vermelho, azul e cinza. Cada token custa uns 80 bytes do CSS; não peçam um 13º.
- **Tipografia e espaçamento**: 5 tamanhos de fonte, sugestão 13/15/16/20/26, line-height 1,5 fixa. 5 valores de espaçamento, sugestão 4/8/12/16/24. 2 raios. 1 sombra, só em popover e toast. E os três números de layout: breakpoint, largura da lateral, largura da coluna.
- **Microcopy**: todos os textos do app numa lista, em pt-BR, curtos: botões, toasts, erros, estados vazios, placeholder. O dev vai colar direto.
- **Ícones**: os SVGs, um arquivo por ícone, como código otimizado, mais a lista do que virou letra ou caractere.
- **Ícone do app**: SVG mestre e PNG 180, 192 e 512.
- **Bônus, não bloqueante**: sugestão de nome, em texto, fora do Figma.

Não entregar: e-mail de login, logotipo em imagem, ilustrações, telas de tablet, variações de hover.

Dúvida sobre o que cabe ou não no orçamento: perguntem antes de desenhar, no [canal/pessoa]. É mais barato ajustar no Figma do que cortar depois.
