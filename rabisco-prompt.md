# Rabisco: especificação

Quero construir um app de notas EXTREMAMENTE leve chamado "Rabisco" (nome provisório).

**Leveza é o requisito número 1. Acima de qualquer outra coisa.**

## Ideia

Uma página em branco onde eu escrevo, colo prints/imagens com Ctrl+V, redimensiono, formato o básico e compartilho por link. Só isso.

## Regras de leveza (obrigatórias)

Objetivo: o app mais leve possível que AINDA faça tudo que está neste documento. Leve não é cortar função; é não desperdiçar nada.

**Zero dependências.**
- HTML, CSS e JavaScript puro. SEM React, Vue, Svelte, TypeScript, Tailwind, bundler, npm ou etapa de build.
- NÃO use o SDK do PocketBase: fale com a API REST dele direto com `fetch` (é só meia dúzia de chamadas: login, listar, criar, atualizar, apagar, upload).
- Editor = um `<div contenteditable>`. Sem biblioteca de editor.
- Sem fontes externas: use a fonte do sistema (`system-ui`).
- Sem biblioteca de ícones: ícones em SVG inline pequeno ou caractere unicode.
- Sem imagens na interface, só o ícone do app.

**Orçamento de peso (limite duro, não meta).**
- Total do front (HTML+CSS+JS): até 80 KB sem minificar, até 24 KB com gzip (limite dobrado em 19/09/2026 para caber tabela de planilha, tema e largura configuráveis, arrastar imagem e histórico próprio de desfazer).
- JavaScript somado até 60 KB. `style.css` até 12 KB.
- Primeira abertura: no máximo 4 requisições (html, css, js, lista de notas).
- Aberturas seguintes: app sai do cache do service worker; só a lista de notas vem da rede, e aparece antes pelo cache local.
- Pronto pra digitar em menos de 300 ms numa conexão 4G.
- Se alguma funcionalidade estourar o orçamento, PARE e me avise antes de continuar, com a sugestão do que simplificar.

**Leve em execução também.**
- Nada rodando em loop ou `setInterval` à toa. Tudo por evento.
- Salvar só a nota que mudou, só quando mudou.
- Imagens: `loading="lazy"` e miniaturas do próprio PocketBase (`?thumb=`) na lista de notas.
- Servidor: PocketBase servindo tudo com gzip e cache longo nos arquivos estáticos.

**Arquivos.**
- `index.html`, `style.css`, `app.js`, `manifest.json`, `sw.js`, ícone. Mais nada no front.

**Na dúvida, NÃO coloque.** Mas tudo que está neste documento tem que funcionar de verdade: colar print, redimensionar, formatar, notas, compartilhar e extras.

## Básico

- Abriu → cursor já piscando na última nota que eu estava usando.
- Salva sozinho enquanto digito (debounce ~1s). Sem botão de salvar. Indicador discreto "salvo".
- Login sem senha: código de uso único por e-mail (OTP do PocketBase). Sem senha.

---

## PRIORIDADE MÁXIMA: colar prints e imagens

Essa é a funcionalidade mais importante do app. Tem que funcionar perfeito antes de qualquer outra coisa.

Tem que funcionar com Ctrl+V (e Cmd+V no Mac) vindo de:

- Win+Shift+S / Ferramenta de Captura do Windows
- Tecla PrintScreen
- Cmd+Ctrl+Shift+4 no Mac
- Lightshot, Greenshot, ShareX e parecidos
- Botão direito → "Copiar imagem" no navegador
- Imagem copiada de WhatsApp Web, Discord, Slack
- Arquivo de imagem copiado no Explorer/Finder
- Arrastar arquivo de imagem pra dentro da nota

Comportamento:

- Intercepte o evento `paste`, percorra `clipboardData.items` e pegue qualquer item `image/*`.
- Se vier imagem E html junto, priorize a imagem e ignore o html.
- Se vierem várias imagens, cole todas, na ordem.
- A imagem aparece NA HORA onde está o cursor (versão local com `URL.createObjectURL`); o upload acontece em segundo plano e depois troca pela URL do PocketBase sem piscar.
- Antes de subir, reduza a imagem no navegador com `<canvas>` (máx. 1600px, webp).
- Depois da imagem, o cursor fica logo abaixo dela.
- Texto colado de fora entra como texto puro (sem fonte, cor e formatação de outros sites).
- Imagem selecionada + Backspace/Delete → apaga.
- Botão direito numa imagem da nota → "Copiar imagem" do navegador tem que funcionar.
- Nunca salve imagem como base64 no banco; sempre upload pro Storage.

---

## Redimensionar imagens

Sem biblioteca. Implementação própria.

- Clicou na imagem → borda discreta + alça no canto inferior direito.
- Arrastar a alça redimensiona, SEMPRE mantendo a proporção.
- Use Pointer Events, pra funcionar com mouse, touch e caneta.
- Mínimo 60px, máximo a largura da nota.
- Salve a largura em PORCENTAGEM da largura do editor (ex: `style="width: 45%"`), pra ficar certo em qualquer tela.
- Duplo clique → volta ao tamanho original (limitado à largura da nota).
- Clicar fora ou Esc → tira a seleção.
- Alça e borda são só visuais: NÃO vão pro HTML salvo nem pra nota compartilhada.
- Ao colar: print grande entra com no máximo 100% da largura; print pequeno entra no tamanho real, sem esticar.

---

## Formatar texto

Poucas opções, bem feitas.

Barra flutuante:

- Selecionou texto → barrinha pequena acima da seleção. Some quando a seleção some.
- No celular, aparece acima do teclado.

Opções (só essas):

- Negrito (Ctrl+B), itálico (Ctrl+I), sublinhado (Ctrl+U), riscado (Ctrl+Shift+X)
- Título grande e pequeno (H1, H2)
- Lista com bolinha, lista numerada, checklist (☐ → ☑ clicável)
- Marca-texto: amarelo, verde, rosa + remover
- Cor do texto: vermelho, azul, cinza + padrão
- Limpar formatação

Atalhos de digitação:

- `# ` → título; `## ` → subtítulo
- `- ` → lista; `1. ` → numerada; `[] ` → checklist
- `**texto**` → negrito; `*texto*` → itálico

Regras:

- HTML semântico simples (`<b>`, `<i>`, `<u>`, `<s>`, `<h1>`, `<h2>`, `<ul>`, `<ol>`, `<mark>`) com classes pras cores. Nada de style inline gigante nem `<span>` aninhado.
- Cores legíveis no modo claro e escuro.
- Se usar `document.execCommand`, teste no Chrome, Firefox e Safari.

---

## Notas (lista e organização)

Uma lista só, sem pastas nem tags.

Lista lateral:

- Mais recente no topo. Cada item: título (primeira linha, automático) + quando foi editada ("agora", "há 2h", "ontem", "12 set").
- Nota só com imagem → título "Imagem" + miniatura.
- Nota ativa destacada. Clicar abre na hora.

Criar:

- Botão "+" e atalho Ctrl+Alt+N → nota nova com cursor dentro.
- Nota vazia abandonada é descartada sozinha.

Buscar:

- Campo no topo da lista, filtra enquanto digito.
- Busca local no navegador, sem ir no servidor. Ignora maiúsculas e acentos.

Fixar:

- Alfinete pra fixar nota no topo.

Apagar:

- Some da lista + "Nota apagada · Desfazer" por 5 segundos.

Celular:

- Tela pequena: lista e nota em telas separadas, com botão voltar.
- Tela grande: lista lateral recolhível.

Performance:

- Cache da lista em localStorage pra abrir instantâneo; sincroniza com o PocketBase em segundo plano.

---

## Compartilhar

- Botão "Compartilhar" → gera link e copia pra área de transferência.
- Opções: "só ver" ou "pode editar".
- Quem abre não precisa de conta pra ver.
- Dá pra desativar o link.
- A nota compartilhada mostra imagens e formatação iguais.

---

## Extras

### Modo escuro automático

- Segue o tema do sistema (`prefers-color-scheme`), sem botão nem configuração.
- Cores definidas como variáveis CSS no `:root`, redefinidas no modo escuro.
- Marca-texto, cores de texto e a nota compartilhada também respeitam o tema.

### Colar link vira link clicável

- Colou ou digitou uma URL (`http...`, `www...`) → vira link automaticamente ao dar espaço ou Enter.
- Ctrl+clique (ou clique simples no celular) abre em nova aba; clique normal só posiciona o cursor, pra dar pra editar.
- Selecionar texto + colar URL → o texto vira link com aquela URL.
- Sem preview de site, sem buscar título na internet. Só o link.
- Links na nota compartilhada abrem em nova aba com `rel="noopener noreferrer"`.

### Exportar nota

- Menu da nota → "Baixar .txt" e "Baixar .md".
- `.txt`: só o texto, sem formatação.
- `.md`: formatação convertida (títulos, negrito, listas, checklist, links); imagens viram `![imagem](url)`.
- Conversão feita à mão no `app.js`, sem biblioteca. Nome do arquivo = título da nota.

### Instalar como app (PWA)

- `manifest.json` com nome, ícone, cor de tema e `display: standalone`.
- Service worker (`sw.js`) simples: guarda os arquivos do app em cache pra abrir instantâneo, até com internet ruim. NÃO precisa editar offline.
- Funciona "Adicionar à tela inicial" no Android e no iPhone.
- Bônus leve: no Android, o Rabisco aparece no menu "Compartilhar" do celular (`share_target`), então dá pra mandar um print da galeria direto pra uma nota nova.

---

## Backend

Tudo roda na minha VPS, com **PocketBase** (um executável único, banco SQLite embutido).

- O próprio PocketBase serve o front: os arquivos do app ficam em `pb_public/`. Um processo só, sem Nginx obrigatório.
- HTTPS automático com o domínio (`./pocketbase serve meudominio.com`, Let's Encrypt embutido).
- Coleção `notes`: user (relação com users), content (html), pinned (bool), share_token (texto), share_mode ("off" | "view" | "edit"), updated (autodate).
- Coleção `images`: note (relação), file (arquivo, máx. 5 MB, só imagens), user. Arquivos com nome aleatório.
- API rules: cada usuário só lê/edita as próprias notas e imagens. Nota compartilhada acessível só com o `share_token` correto (via `@request.query` na rule ou uma rota custom em `pb_hooks/`), respeitando o `share_mode`.
- Apagar nota apaga as imagens dela (cascade).
- E-mail do código de login via SMTP configurado no painel do PocketBase.
- Rodar como serviço systemd (reinicia sozinho se cair ou se a VPS reiniciar).
- Backup: script simples que copia a pasta `pb_data/` uma vez por dia (ou o backup embutido do PocketBase).
- Sanitize o HTML ao exibir notas compartilhadas (evitar XSS), com uma lista de tags permitidas, sem biblioteca pesada.

## Fora do escopo (não faça)

Pastas, tags, templates, temas customizáveis, fontes diferentes, tabelas, modo offline completo, app mobile nativo, integrações.

---

## Como trabalhar

Primeiro me mostre um plano curto (arquivos + coleções e API rules do PocketBase). Espere eu aprovar. Prefira definir as coleções por migration em `pb_migrations/`, pra ficar versionado.

Depois construa em etapas, parando no fim de cada uma pra eu testar:

1. **Editor local** (sem backend): escrever + colar prints + redimensionar.
   *Teste:* abro a página, tiro print com Win+Shift+S, Ctrl+V, escrevo embaixo, colo outro print, diminuo o primeiro pela metade.
2. **Formatação:** barra flutuante + atalhos de digitação.
3. **PocketBase:** login + salvar/carregar notas + upload de imagens.
   *Teste:* recarrego a página e tudo continua igual, inclusive o tamanho das imagens.
4. **Lista de notas:** criar, buscar, fixar, apagar com desfazer.
5. **Compartilhar** por link.
   *Teste:* abro o link no celular, sem login, e a nota aparece proporcional e formatada.
6. **Extras:** modo escuro, links clicáveis, exportar, PWA.
   *Teste:* instalo no celular pela tela inicial, troco o celular pro modo escuro, compartilho um print da galeria pro Rabisco.

No fim, um README curto: como subir na VPS do zero (baixar o PocketBase, apontar o domínio, systemd, SMTP, backup) e como atualizar o app depois.

Ao terminar cada etapa, me mostre: tamanho de cada arquivo (normal e gzip) e se continua dentro do orçamento de peso.