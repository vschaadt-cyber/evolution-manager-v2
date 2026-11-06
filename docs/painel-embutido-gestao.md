# Painel embutido no Gestão

Data: 2026-11-06 · Branch `gestao-branding-2.3.7`

## O que o painel faz agora
- **Entrada com `?acesso=<token>`**: troca o token de uso único (60 s) pela chave na edge `evolution-painel-acesso` do Supabase (`verify_jwt=false`; o próprio token é a credencial) e guarda a chave na sessão do painel (`localStorage`, o mesmo do login por chave). Depois limpa o parâmetro com `history.replaceState`.
- **Token inválido ou expirado**: vai para `/manager/login?motivo=link-expirado`, com o aviso "Link expirado, reabra pelo Gestão" e o login normal por chave.
- **Modo embutido** (`?embed=1` ou o painel num iframe): sem cabeçalho e sem menu do painel; só o conteúdo.
- **Tema**: o Gestão envia `{ type: "gestao:tema", tema: "light" | "dark" }` por `postMessage`. O painel aceita só de `ORIGENS_GESTAO` (`src/lib/acessoGestao.ts`) e só do pai da janela. Ao carregar, o painel envia `evolution:pronto` para as mesmas origens.

## Origens do Gestão permitidas
`https://omni-hr-hub-tqwf.vercel.app` e `https://gestao.luminaresc.com.br`. Sem curinga. Se o domínio do Gestão mudar, ajustar `ORIGENS_GESTAO` e o `frame-ancestors` abaixo.

## Cabeçalhos no servidor (pendente, fora do repositório)
O `/manager/` é servido pela própria Evolution (imagem `evoapicloud/evolution-api:v2.3.7` com a pasta `manager/dist` trocada por `Dockerfile.evolution`), atrás do Traefik da VPS. O `Dockerfile.evolution` não consegue definir cabeçalhos HTTP, então a regra vai no Traefik, nas labels do serviço `evolution` do projeto Docker (fica só na VPS):

```
traefik.http.middlewares.evo-embed-gestao.headers.customresponseheaders.Content-Security-Policy=frame-ancestors 'self' https://omni-hr-hub-tqwf.vercel.app https://gestao.luminaresc.com.br
traefik.http.middlewares.evo-embed-gestao.headers.customresponseheaders.X-Frame-Options=
traefik.http.routers.evolution-manager.middlewares=evo-embed-gestao
```

- `X-Frame-Options=` (valor vazio) remove o cabeçalho, se a Evolution ou o Traefik enviarem um que bloqueie o iframe.
- Aplicar exige recriar o serviço (reinício da Evolution, ~30 s sem WhatsApp). Não fazer sem aval.
- Verificação: `curl -I https://evo.luminaresc.com.br/manager/` deve mostrar `Content-Security-Policy: frame-ancestors ...` e nenhum `X-Frame-Options` bloqueante.

## Imagem
O workflow `.github/workflows/docker.yml` (nome "Imagem Evolution + painel Gestão") roda em cada push neste branch e publica `ghcr.io/vschaadt-cyber/evolution-gestao:2.3.7` e `:<sha>`. Publicar a imagem não reinicia nada; o VPS só usa a nova versão depois de recriar o serviço.

## Como testar sem o Gestão
1. Gerar um token de teste pela edge `evolution-painel-acesso` (ação `gerar`, com JWT de master_admin) e abrir `/manager/?acesso=<token>`.
2. Abrir `/manager/?embed=1` diretamente: sem cabeçalho nem menu.
3. Token reutilizado: deve cair em `/manager/login?motivo=link-expirado`.
