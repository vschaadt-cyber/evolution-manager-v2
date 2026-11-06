# Fase 3 — redirect da raiz para o painel

Data: 2026-11-06 · VPS `srv2092753` · projeto Docker `evolution`

## O que mudou
- Acesso a `https://evo.luminaresc.com.br/` (sem caminho) agora responde **302** para `https://evo.luminaresc.com.br/manager/`.
- Só a raiz sem caminho é redirecionada. `/manager/`, a API e os webhooks não mudam.
- Limitação: `/?algo=1` (com query string) continua respondendo a raiz da Evolution.

## Como foi feito
Labels do Traefik no serviço `evolution` do `docker-compose.yml` do projeto (fica só na VPS, não está neste repositório):

```
traefik.http.routers.evolution.middlewares=evo-root-manager
traefik.http.middlewares.evo-root-manager.redirectregex.regex=^https://[^/]+/?$$
traefik.http.middlewares.evo-root-manager.redirectregex.replacement=https://${EVO_DOMAIN}/manager/
traefik.http.middlewares.evo-root-manager.redirectregex.permanent=false
```

Aplicado com `vps_docker_create` (recria o projeto; volumes `evo_pg`, `evo_redis`, `evo_instances` preservados). Os containers do Evolution foram recriados, por isso as conexões do WhatsApp podem ter caído e reconectado.

## Verificação
- `GET /` → 302 `Location: https://evo.luminaresc.com.br/manager/`
- `GET /manager/` → 200
- `GET /instance/fetchInstances` sem chave → 401 (rota da API continua viva)

## Reverter
Remover as 4 labels acima do serviço `evolution` e recriar o projeto pelo mesmo caminho.
