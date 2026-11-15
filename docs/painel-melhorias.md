# Melhorias do painel (2026-11-15)

Branch `gestao-branding-2.3.7`. Só front; nada muda no servidor nem no compose da Evolution.

## O que mudou
- Menu sem a seção "Ajuda"; sem seletor de idioma (só pt-BR); rodapé do menu: `Evolution <versão do servidor> · Painel <hash>`.
  O hash vem do Vite (`define __PAINEL_COMMIT__`): `git rev-parse` no `npm run dev`, build-arg `PAINEL_COMMIT` (= `github.sha`) na imagem.
- Dashboard: **Reiniciar todas** (Todas / Só conectadas / Só com problema). Um número por vez, 3 s entre eles, falha não interrompe,
  60 s para voltar a `open` (senão "Não reconectou"), resumo OK / falhou / não reconectou e "Tentar de novo". Lógica em `src/lib/reiniciarTodas.ts` (testada).
  Cada reinício e cada reconexão vão ao histórico com `detalhe.origem = "em massa"` (a edge `evolution-painel-acesso` grava `origem = "manager"` sempre).
- Dashboard: coluna **Último recebimento** (amarelo > 2 h, vermelho > 6 h, só seg–sáb 8h–18h de Brasília).
  O `/chat/findMessages` da 2.3.7 ignora `fromMe: false`; o painel lê até 150 mensagens recentes e pega a primeira recebida.
- Instância: aba **Perfil** (nome, foto, recado) e card **Testar envio e recebimento** (número de teste guardado no navegador).
- Comportamento: nomes e explicações em português simples.
- Webhook: botão renomeado para "Enviar evento de teste".
- Interceptor do axios: respeita a chave passada pela chamada (antes a chave da instância guardada no navegador a sobrescrevia).

## Não existe na Evolution 2.3.7
- Status HTTP da última entrega do webhook e evento de teste feito pelo servidor (o router de webhook só tem `set` e `find`).
- Filtro `fromMe: false` e `limit` real em `findMessages` (usa `offset` como tamanho de página).
- Resposta automática de uma instância: o "Testar" faz a segunda instância responder pelo painel, com ele aberto.
