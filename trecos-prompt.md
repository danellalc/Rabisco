# Trecos: especificação (v2)

Trecos é o Rabisco crescido. Continua sendo o app mais leve possível, mas em vez de uma página de texto corrido vira um **quadro infinito** onde eu jogo texto, prints, imagens, links e qualquer arquivo, organizo tudo do jeito que eu quiser e compartilho o quadro inteiro, um pedaço dele ou um arquivo só. Um Drive misturado com um bloco de notas, num quadro.

Versão 2 de 20/09/2026. Substitui a spec do Rabisco. Tudo que já funciona continua funcionando: colar print, redimensionar, formatar, tabela de planilha, link clicável, lista, buscar, fixar, apagar com desfazer, compartilhar com expiração, exportar, imprimir, app instalável, compartilhar da galeria.

**Leveza continua sendo o requisito número 1.**

## Ideia

Abro um quadro. Colo um print, escrevo do lado, arrasto um PDF, um zip, um docx pra cima do quadro, colo um link. Cada coisa fica onde eu soltei e eu movo à vontade. Dou zoom pra ver tudo ou pra chegar perto. Seleciono uma parte do quadro e compartilho só aquilo. Quem abre o link vê, e baixa os arquivos.

## Regras de leveza (obrigatórias)

**Zero dependências em tempo de execução.**
- HTML, CSS e JavaScript puro com módulos ES. Sem framework, sem biblioteca de editor, de canvas, de zoom, de upload. Sem SDK do PocketBase: `fetch` direto na API REST.
- A única dependência de desenvolvimento é o `esbuild`, só pra empacotar e minificar no `build/` que vai pro servidor. O código-fonte roda sem build no dev.
- Fonte do sistema. Ícones em SVG inline. Nenhuma imagem na interface além do ícone do app.

**Orçamento de peso (limite duro, não meta), medido no `build/`.**
- Até 160 KB sem gzip, até 48 KB com gzip (era 32 KB no Rabisco; os 16 KB a mais são o quadro, seleção, arquivos, upload e compartilhar por seleção).
- JavaScript somado até 128 KB. `style.css` até 24 KB.
- Primeira abertura: no máximo 4 requisições (html, css, js, lista de quadros).
- Aberturas seguintes saem do cache do service worker.
- Pronto pra usar em menos de 300 ms numa conexão 4G.
- Se alguma funcionalidade estourar o orçamento, PARE e me avise antes de continuar, com a sugestão do que simplificar.

**Leve em execução.**
- Nada em loop. Tudo por evento.
- Salva só o quadro que mudou, só quando mudou, com debounce de 1 s.
- Itens fora da tela não custam nada (`content-visibility`). Imagens com `loading="lazy"` e miniaturas do PocketBase.
- Quadro com centenas de itens tem que continuar fluido no celular.

**Na dúvida, NÃO coloque.** Mas tudo que está aqui tem que funcionar de verdade.

## Básico

- Abriu, cai no último quadro usado, na mesma posição e zoom em que eu estava (guardado no navegador).
- Salva sozinho. Sem botão. Indicador discreto "salvo".
- Login sem senha por código no e-mail, como hoje.
- Interface em português do Brasil e inglês, pelo idioma do navegador.

---

## O quadro

É o coração do app. Uma tela sem fim onde cada coisa é um **item** com posição e largura.

**Navegar.**
- Pan: arrastar o fundo, ou roda do mouse (vertical rola, Shift rola de lado), ou um dedo no celular.
- Zoom: Ctrl + roda, pinça no celular, botões − e + no canto, atalho Ctrl + 0 pra 100%. De 10% a 400%. O zoom acontece em volta do cursor ou do centro da pinça.
- "Enquadrar tudo" mostra o quadro inteiro de uma vez.
- Zoom e posição não são salvos no servidor, só no navegador, por quadro.

**Itens (só estes quatro tipos).**
- **Texto**: um bloco de texto rico. É o editor do Rabisco inteiro dentro de um retângulo: formatação, atalhos de digitação, colar print dentro do texto, tabela de planilha, checklist, link. Largura ajustável, altura cresce com o conteúdo.
- **Imagem**: print ou imagem solta no quadro, redimensionável como hoje, abre em tela cheia com um clique no modo ver.
- **Arquivo**: qualquer arquivo. Ícone da família, nome, tamanho. Clique baixa (dono) ou abre a página de download (visitante).
- **Link**: URL colada no vazio vira um cartão pequeno com a URL, clicável, abre em nova aba. Sem preview de site.

**Quadro novo** nasce com um bloco de texto grande no meio e o cursor dentro. Pra quem só quer escrever, é igual ao Rabisco.

**Criar item.**
- Duplo clique ou duplo toque no vazio: bloco de texto ali.
- Ctrl + V no vazio: print vira imagem, URL vira link, texto vira bloco de texto, arquivo vira arquivo.
- Arrastar do computador pra cima do quadro: cai onde soltou. Vários de uma vez entram em fileira.
- Colar dentro de um bloco de texto: igual ao Rabisco, entra no texto.

**Manipular (tem que ser MUITO fácil).**
- Clique seleciona. Shift + clique adiciona. Arrastar no vazio faz um laço que seleciona tudo que tocar. Ctrl + A seleciona tudo.
- Arrastar move o item ou a seleção inteira. Grade invisível de 8 px alinha sozinho. Setas movem 8 px, Shift + setas 40 px.
- Alça no canto redimensiona (imagem mantém proporção, texto só largura).
- Delete apaga a seleção. Ctrl + Z e Ctrl + Y desfazem e refazem tudo: mover, apagar, redimensionar, editar texto.
- Ctrl + D duplica a seleção. Ctrl + C e Ctrl + V copiam e colam itens dentro do mesmo quadro ou entre quadros.
- Item por cima do outro: o último tocado vem pra frente.
- No celular: tocar seleciona, arrastar pelo item move, pinça dá zoom, dois toques no vazio cria texto. Mover vários de uma vez fica pro desktop.

**Editar texto no quadro.**
- Duplo clique num bloco de texto (ou toque, no celular) entra no texto. Esc ou clique fora sai.
- A barra de formatação flutuante e todos os atalhos funcionam iguais.
- Editando, o zoom não muda sozinho.

---

## PRIORIDADE MÁXIMA: colar prints e imagens

Continua sendo a função mais importante. Tudo do Rabisco vale: Win + Shift + S, PrintScreen, Mac, Lightshot, WhatsApp Web, arquivo copiado no Explorer, arrastar.

O que muda: se o cursor está dentro de um bloco de texto, o print entra no texto, como hoje. Se nada está sendo editado, o print vira um item de imagem no meio da tela visível. Redução no navegador antes de subir (máx. 1600 px, webp), aparece na hora e o upload acontece em segundo plano.

---

## Redimensionar imagens

Igual ao Rabisco: alça no canto, proporção sempre mantida, Pointer Events, mínimo 60 px, duplo clique volta ao original. Dentro do texto a largura é porcentagem do bloco; imagem solta no quadro tem largura em pixels do quadro.

---

## Formatar texto

Igual ao Rabisco, dentro de cada bloco de texto: negrito, itálico, sublinhado, riscado, H1, H2, listas, checklist, marca-texto, cor, limpar, atalhos de digitação, `---` vira linha, Ctrl + ; data.

---

## Arquivos

- Qualquer formato: pdf, docx, xlsx, pptx, zip, csv, mp4, mp3, o que for. Sobe pra onde o PocketBase apontar (bucket R2 da Cloudflare em produção, disco no dev).
- Cada arquivo tem um ícone pela família (pdf, documento, planilha, apresentação, compactado, vídeo, áudio, código, genérico) com a extensão escrita, nome cortado com reticências e tamanho legível.
- Upload com barra de progresso fininha no próprio item. Falhou: item some e toast "Não deu pra enviar o arquivo". Vários arquivos de uma vez sobem em paralelo, no máximo 3 por vez.
- Tamanho por arquivo na v1: 500 MB. Acima disso, etapa futura com upload direto pro bucket.
- Bloqueados por segurança: exe, msi, bat, cmd, com, scr, pif, vbs, js, jse, wsf, ps1, jar, hta, dll, lnk. Toast "Esse tipo de arquivo não é aceito".
- Baixar: o dono baixa direto. O visitante baixa pela página compartilhada e só enquanto o link estiver ativo. Todo download vai com `Content-Disposition: attachment`, `nosniff` e CSP `sandbox`. Nunca abre inline no nosso domínio, nem PDF; PDF abre na aba nova do navegador a partir do download, se a pessoa quiser.
- Renomear: duplo clique no nome, no dono. Só isso de edição.
- Apagar item apaga o arquivo do bucket. Apagar quadro apaga tudo dele. Um cron limpa arquivos órfãos uma vez por dia.
- Aba **Arquivos** na lista lateral: todos os arquivos de todos os quadros, mais recente primeiro, com busca por nome e o quadro de origem. Clicar abre o quadro naquele item.

## Cota e plano

- Grátis: 2 GB por usuário. Plano pago: 100 GB (número ajustável no painel). Conta em bytes de arquivos e imagens.
- O servidor recusa upload que passaria da cota. O app mostra "Espaço cheio: X de 2 GB" no toast e uma linha "1,4 GB de 2 GB" no rodapé da lista.
- Cobrança fica pra depois (Pix ou cartão, a decidir). No começo o admin marca o plano do usuário no painel do PocketBase.

## Links

- Dentro do texto: igual ao Rabisco. URL digitada ou colada vira link, Ctrl + clique abre, clique simples no celular e no modo ver.
- URL colada no vazio do quadro: cartão de link. Clicável em qualquer modo, abre em nova aba com `rel="noopener noreferrer"`. Sem buscar título nem imagem do site.

---

## Quadros (lista e organização)

Igual à lista do Rabisco, com "nota" virando "quadro": mais recente no topo, título automático (primeira linha do primeiro bloco de texto; sem texto, "Imagem" ou o nome do primeiro arquivo), miniatura quando só tem imagem, buscar, fixar, apagar com desfazer, cache local. Duas abas no topo da lateral: **Quadros** e **Arquivos**.

---

## Compartilhar

Um mecanismo só, três alvos:

- **Quadro inteiro**: só ver ou pode editar, com expiração (1 h, 1 dia, 7 dias, nunca), como hoje.
- **Seleção**: seleciono itens (laço ou Shift + clique), botão Compartilhar mostra "Compartilhar seleção". Só ver. Quem abre vê exatamente aqueles itens, nas mesmas posições, e mais nada. O servidor filtra; o resto do quadro nunca sai do servidor.
- **Um arquivo**: menu do item, "Compartilhar arquivo". Abre uma página de download com ícone, nome, tamanho, aviso de que foi enviado por outra pessoa, e botão Baixar.

Regras que valem pros três: token de 22 caracteres gerado no servidor, no fragmento da URL (`/s/#token`), expiração, desativar mata o link, ativar de novo gera outro. Um quadro pode ter vários links ativos ao mesmo tempo (um do quadro, outros de seleções e arquivos). Painel "Links ativos" no popover de compartilhar lista os links do quadro com "Copiar" e "Desativar".

Quem recebe o link: mesma tela, sem lista e sem menu. Pan e zoom liberados. Modo ver: nada se move. Modo editar (só quadro inteiro): pode mover, editar texto, apagar, redimensionar, mas não sobe imagem nem arquivo ("Só o dono do quadro pode adicionar arquivos"). Botão Duplicar copia o quadro (ou a seleção) pra conta de quem abriu, com cópias dos arquivos.

---

## Extras (todos já existem no Rabisco e continuam)

- Tema claro, escuro ou do sistema; largura não faz mais sentido no quadro e sai do menu.
- Exportar: "Baixar .md" e "Baixar .txt" do quadro, itens na ordem de leitura (de cima pra baixo, da esquerda pra direita); arquivos viram `[nome](url)`; e "Baixar tudo (.zip)" com o md e os arquivos, montado no navegador sem biblioteca.
- Imprimir: itens na ordem de leitura, sem o quadro.
- PWA: instalável, abre do cache, compartilhar da galeria do Android cai como item no quadro atual depois de confirmar.

---

## Backend

PocketBase na VPS, atrás do Caddy, em Docker Compose, como hoje. Arquivos no **Cloudflare R2** (S3 compatível, sem custo de saída), configurado no painel do PocketBase em Files storage. No dev, disco local.

Coleções:

- `users`: como hoje, mais `plan` ("free" | "pro"), `quota_bytes`, `used_bytes`.
- `boards` (era `notes`): user, content (JSON com os itens, máx. 2 MB), title, cover, pinned, revision, created, updated. Cada item: `{ id, type, x, y, w, z, html | file | url }`.
- `images`: como hoje (imagens dentro de texto e soltas no quadro), agora com `board` em vez de `note`, `size`.
- `files`: user, board, file (qualquer tipo, máx. 500 MB, protegido), name, size, kind. Nome físico aleatório.
- `shares`: user, board, token, mode ("view" | "edit"), items (JSON com ids ou vazio = quadro inteiro), expires, created. Índice único no token.

Regras: deny por padrão; cada usuário só vê e mexe no que é dele; `user` sempre vem do servidor. Hooks em `pb_hooks/`: sanitizar o HTML de cada bloco de texto e validar cada item (números, ids de arquivos do próprio quadro) em todo create e update; revisão só muda quando o conteúdo muda, com compare-and-set; cota no upload; rotas `/api/shared` (GET, PATCH e download de arquivo) filtrando pelos itens do link; cron de expiração de links e de arquivos órfãos; cabeçalhos de segurança em tudo; `attachment` + `sandbox` em todo download de arquivo.

Migração do Rabisco: cada nota vira um quadro com um bloco de texto em (0, 0) com 640 px de largura; cada link ativo vira uma linha em `shares`. Chaves do navegador `rabisco.*` viram `trecos.*` na primeira abertura.

Backup: o backup embutido do PocketBase só do banco (pb_data sem storage), diário, guardado fora da VPS. Arquivos ficam no R2 com versionamento do bucket ligado.

## Fora do escopo (não faça)

Pastas, tags, templates, colaboração em tempo real com cursor de outra pessoa, preview de site em link, preview de PDF dentro do app, comentários, versões de quadro, app nativo, integrações, login com Google ou senha, conectores de linha entre itens, formas geométricas, cor de fundo de item, agrupar itens, camadas, minimapa, OCR.

---

## Como trabalhar

Igual ao Rabisco: construir em etapas, parar no fim de cada uma pra eu testar, mostrar o peso de cada arquivo (normal e gzip) e se continua no orçamento. Migrations versionadas em `pb_migrations/`. Testes unitários com `node --test`, bateria de navegador em Chromium e WebKit antes de cada commit.

1. **Quadro**: pan, zoom, blocos de texto como itens, criar, mover, redimensionar, laço, desfazer, autosave do quadro, migração das notas, lista com "quadro", celular básico, renomear pra Trecos.
   *Teste:* abro o app, meu texto antigo está lá num bloco; dou duplo clique do lado, escrevo outro; arrasto os dois; dou zoom; recarrego e está tudo igual.
2. **Arquivos e cota**: arrastar, colar e escolher arquivo; ícones; progresso; bloqueio de tipos; cota; baixar; renomear; apagar com limpeza; aba Arquivos; R2 configurado na VPS.
   *Teste:* arrasto um pdf e um zip pro quadro, escrevo do lado, baixo os dois, apago um, vejo a cota mudar.
3. **Compartilhar v2**: quadro, seleção e arquivo; links ativos; página de download; duplicar com arquivos.
   *Teste:* seleciono um pedaço do quadro, compartilho, abro no celular sem login, baixo o arquivo; desativo e o link morre.
4. **Acabamento**: enquadrar, atalhos, copiar e colar itens, exportar quadro e zip, imprimir, compartilhar da galeria caindo no quadro.
5. **Bucket direto e cobrança**: upload acima de 500 MB direto pro R2, plano pago com Pix ou cartão.
6. **Desenho**: o quadro vetorial (caneta, formas, texto) vira mais um tipo de item.

No fim, README curto: subir na VPS do zero (Docker Compose, domínio, SMTP, R2, backup) e atualizar depois.
