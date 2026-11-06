# Auditoria — painel Gestão (Evolution Manager v2)

Data: 2026-11-06 · Branch `gestao-branding-2.3.7` (commit `6625492`) · Evolution API **2.3.7** (confirmado em `https://evo.luminaresc.com.br/` → `"version":"2.3.7"`).

Método: leitura das rotas, telas e queries do painel; teste de existência das rotas no servidor ao vivo (sem credenciais); leitura do código-fonte da Evolution 2.3.7 (tag `2.3.7`) para DTOs, eventos e status de conexão. Não foi usada nenhuma chave de API.

## 1. Rotas e telas

| Rota | Tela | Situação | Ação |
|---|---|---|---|
| `/manager/` | Lista de instâncias (Visão geral) | usada | manter |
| `/manager/instance/:id/dashboard` | Conexão da instância, QR | usada | manter |
| `/manager/instance/:id/settings` | Comportamento | usada | manter |
| `/manager/instance/:id/proxy` | Proxy | usada | manter |
| `/manager/instance/:id/webhook` | Webhook | usada | manter e melhorar |
| `/manager/instance/:id/n8n` (+ `/:n8nId`) | n8n | usada | manter |
| `/manager/instance/:id/chat` (+ `/:remoteJid`) | Conversas | fora do menu, fora do escopo | **remover** |
| `/manager/embed-chat` (+ `/:remoteJid`) | Chat embutido, público | fora do escopo | **remover** |
| chatwoot, typebot, dify, openai, flowise, evoai, evolutionBot, websocket, rabbitmq, sqs | integrações | fora do escopo | **remover** |
| `/` (Home) | página de boas-vindas do SPA | inacessível: o servidor responde a raiz com o JSON da Evolution | **remover** (ver Fase 3) |

## 2. Botões e controles

- **Webhook**: "Marcar todos / Desmarcar todos" funciona, mas não há teste, nem aviso quando "Ativo" está ligado sem eventos. A lista tem `TYPEBOT_START` e `TYPEBOT_CHANGE_STATUS`, sem efeito após remover Typebot.
- **Webhook e Proxy**: toast de erro mostra `Error: undefined` quando a API não devolve `response.message` (erro de rede, por exemplo).
- **Webhook e Proxy**: importam `Separator` de `@radix-ui/react-dropdown-menu` em vez de `components/ui/separator`.
- **Proxy**: campo "Protocolo" é texto livre; deveria ser lista (http, https, socks4, socks5).
- **Comportamento**: os 7 interruptores existem no DTO da 2.3.7 (`rejectCall`, `msgCall`, `groupsIgnore`, `alwaysOnline`, `readMessages`, `readStatus`, `syncFullHistory`). Funcionam.
- **Instância**: "Atualizar", "Reiniciar", "Desconectar" e "Código de pareamento" usam rotas existentes (`/instance/restart`, `/instance/logout`, `/instance/connect`).

## 3. Configurações: o que faz e se funciona na 2.3.7

| Tela / opção | O que faz | Funciona na 2.3.7 |
|---|---|---|
| Comportamento → Rejeitar chamadas (+ mensagem) | recusa chamadas de voz e responde com a mensagem | sim |
| Comportamento → Ignorar grupos | não processa mensagens de grupos | sim |
| Comportamento → Sempre online | mantém o número aparecendo online | sim |
| Comportamento → Marcar como lidas | marca as mensagens recebidas como lidas | sim |
| Comportamento → Ver status como lido | marca stories como vistos | sim |
| Comportamento → Sincronizar histórico completo | baixa histórico ao parear; pesado, só vale em pareamento novo | sim |
| Proxy (protocolo, host, porta, usuário, senha) | faz a conexão sair por proxy | sim (`ProxyDto`) |
| Webhook (URL, ativo, eventos, por evento, base64) | envia eventos para a URL | sim (`{webhook:{...}}`) |

Rótulos a revisar na Fase 2: "Comportamento" passa a ser "Comportamento da conta", com descrição curta em cada opção.

## 4. Código: melhorias

- **Código morto**: ~40 arquivos das integrações e do chat (`pages/instance/*`, `lib/queries/*`, `services/websocket`, contextos de embed).
- **Dependências sem uso** (após a remoção, confirmar): `recharts`, `react-tag-input`, `react-resizable-panels`, `socket.io-client`, `cmdk`, `@radix-ui/react-collapsible`.
- **Bundle**: 1,23 MB (327 kB gzip), com aviso de chunk acima de 500 kB. A remoção deve reduzir bastante.
- **Segurança**:
  - a chave global e o token da instância ficam em `localStorage` (acessíveis a qualquer script da página);
  - `console.error("Error:", error)` em vários pontos registra o objeto do Axios, que inclui os cabeçalhos com `apikey` no console;
  - `restart`, `logout` e `connect` não recebem o token explícito: usam o `INSTANCE_TOKEN` salvo no `localStorage`. Se esse valor estiver defasado, a ação pode cair na instância errada. Correção: passar o token em cada chamada.
- **Erros**: a mensagem de erro vem como array em alguns casos (`["The x instance does not exist"]`); tratar com helper único.
- **Loading e vazio**: lista de instâncias tem estado vazio; QR tem placeholder. Falta skeleton nas telas de configuração.
- **Atualização do QR**: recarrega a instância a cada 4 s enquanto o QR está na tela. Dá para trocar por `refetchInterval` do React Query.
- **Duplicação**: os blocos de integração repetem o mesmo padrão (Form, Sessions, Default settings) nove vezes.

## 5. O que a Evolution 2.3.7 oferece (verificado no código e nas rotas)

- Rotas existentes (testadas no servidor; resposta "instance does not exist" prova que a rota existe): `settings/find|set`, `webhook/find|set`, `proxy/find|set`, `instance/connect|connectionState|restart|logout|delete`, `n8n/*`.
- **Não existe**: endpoint de teste de webhook; endpoint de histórico de conexão ou de log de eventos.
- **Dados de diagnóstico** já na tabela `Instance` (`fetchInstances`): `connectionStatus`, `disconnectionReasonCode`, `disconnectionAt`, `disconnectionObject`, `ownerJid`, contadores de mensagens, contatos e chats.
- **Comportamento de conexão** (`whatsapp.baileys.service.ts`): quando a conexão cai com um código que não está em `[401, 403, 402, 406]`, a Evolution reconecta sozinha. Com um desses códigos, marca `close` e grava `disconnectionReasonCode` e `disconnectionAt`. Uma instância presa em "Conectando" é quase sempre reconexão em loop ou sessão sem pareamento concluído.
- **Webhook**: só envia evento se o webhook está ativo e o evento está marcado. Com URL vazia ou sem eventos, nada chega ao n8n ou ao Gestão.

## 6. Diagnóstico da instância "Compras - Archer"

Dados que você informou: **Conectando**, webhook desligado, URL vazia, todos os eventos desmarcados.

1. **Causa certa**: o Gestão e o n8n não recebem nada porque não há webhook configurado. A Evolution continua conectada, mas não entrega os eventos.
2. **Causa a confirmar**: "Conectando" persistente. Pode ser reconexão em loop ou sessão não pareada. Para confirmar, preciso de `disconnectionReasonCode` e `disconnectionAt` dessa instância. Não consultei a API ao vivo porque não tenho a chave, e não vou pedi-la. A tela de Diagnóstico (Fase 4) mostra esses campos.

## 7. Códigos de desconexão (valores do Baileys usados pela 2.3.7; confirmar na versão 7.0.0-rc.9)

| Código | Significado | Ação sugerida |
|---|---|---|
| 401 | sessão encerrada pelo celular (logout) | reconectar com QR |
| 403 | bloqueado pelo WhatsApp | verificar número; não adianta reconectar |
| 440 | conexão substituída (outro WhatsApp Web aberto) | fechar o outro e reconectar |
| 408 / 428 | queda de rede ou tempo esgotado | aguardar; reiniciar se persistir |
| 515 | reinício necessário | reiniciar a instância |
| 500 | sessão corrompida | apagar a instância e parear de novo |

## 8. Pendências que dependem de você

- **Fase 3 (raiz `/` → `/manager/`)**: não aplico sem sua aprovação, porque mexe no proxy da VPS. Duas opções: (a) regra de redirecionamento no proxy do projeto Docker (mais limpo, se você tiver acesso); (b) pequeno patch na imagem (mais frágil a cada atualização da Evolution). Recomendo (a).
- **Fase 4 (log de eventos)**: a Evolution não guarda histórico de conexão. Opções: (1) webhook `CONNECTION_UPDATE` → n8n → tabela no Supabase (recomendo, reaproveita a stack atual); (2) só o último evento por instância, lido de `disconnectionAt`, sem histórico. Preciso da sua escolha.
- **Teste de webhook**: a Evolution não tem endpoint. O painel envia um POST de teste direto para a URL, sem conseguir ler a resposta por causa do CORS. Ele informa "enviado", não "recebido". Para confirmação real, o teste precisa ser lido no n8n.
