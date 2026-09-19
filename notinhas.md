# Rabisco (nome provisório)

> Uma página em branco que aceita qualquer coisa que você colar, e gera um link pra compartilhar.

## O problema

Já existem vários apps de notas, mas quase todos pesam demais:

- **Notion / OneNote**: poderosos, mas lentos e cheios de opção.
- **Google Keep**: leve, mas ruim pra imagem no meio do texto.
- **Bloco de Notas / Notepad++**: leve de verdade, mas não aceita imagem nem compartilha.

Falta o meio-termo: abrir e escrever, colar print, mandar link. Só isso.

## Princípios

1. **Abriu, escreveu.** Cursor piscando na hora. Zero configuração.
2. **Ctrl+V resolve tudo.** Texto, print, imagem copiada, arquivo arrastado.
3. **Salva sozinho.** Não existe botão de salvar.
4. **Compartilhar é um clique.** Gera link, copia, pronto.
5. **Menos é o produto.** Toda feature nova precisa justificar por que não deixa o app mais pesado.

## Funcionalidades (MVP)

### Escrever
- Editor de texto simples, com no máximo: negrito, itálico, lista e título.
- Atalhos comuns funcionando (Ctrl+B, Ctrl+I, Ctrl+Z).

### Imagens
- Colar print direto (Win+Shift+S, PrintScreen, Cmd+Shift+4).
- Colar imagem copiada do navegador.
- Arrastar arquivo de imagem pra dentro da nota.
- Imagem aparece no meio do texto, onde o cursor estava.

### Notas
- Barra lateral com a lista de notas, ordenadas pela mais recente.
- Título da nota = primeira linha (automático).
- Busca simples por texto.
- Apagar nota (com opção de desfazer por alguns segundos).

### Login
- Entrar com Google **ou** link mágico por e-mail.
- Sem senha.

### Compartilhar
- Botão "Compartilhar" gera um link.
- Duas opções: **só ver** ou **pode editar**.
- Quem recebe o link não precisa ter conta pra ver.
- Dá pra desativar o link a qualquer momento.

## O que o app NÃO tem (de propósito)

- Pastas, subpastas, tags
- Templates
- Bancos de dados, tabelas complexas
- Integrações com mil serviços
- Temas e personalização infinita

## Fluxos principais

**Primeira vez**
Entra no site → login com Google → já cai numa nota em branco.

**Anotar com print**
Tira print → Ctrl+V na nota → escreve embaixo → fecha. Tá salvo.

**Compartilhar**
Clica em Compartilhar → copia o link → cola no WhatsApp.

## Stack sugerida (simples e barata)

| Parte | Opção |
|---|---|
| Front | React ou Svelte + editor tipo TipTap |
| Login + banco | Supabase (auth, Postgres e storage de imagem juntos) |
| Hospedagem | Vercel ou Netlify |
| Imagens | Comprimir no navegador antes de subir (economiza espaço) |

## Depois do MVP (talvez)

- Modo offline (anota sem internet, sincroniza depois)
- App de celular / PWA pra instalar na tela inicial
- Modo escuro
- Exportar nota como .txt ou .md

## Próximos passos

1. Fazer um protótipo só do editor (colar texto + imagem).
2. Testar a sensação: tá leve mesmo?
3. Adicionar login e salvar na nuvem.
4. Adicionar compartilhamento por link.
5. Mostrar pra uns amigos e ver o que eles tentam fazer.