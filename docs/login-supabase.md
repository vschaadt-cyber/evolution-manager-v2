# Login do painel com o Supabase Auth do Gestão

Data: 2026-11-15 · Branch `gestao-branding-2.3.7`

## Como funciona
1. **Tela de login** (`src/pages/Login`): só e-mail e senha. O login é feito no Supabase Auth do Gestão (`src/lib/supabase.ts`, `@supabase/supabase-js`).
2. **Chave da Evolution**: depois do login, o painel chama a edge `evolution-manager-key` do Supabase do Gestão com o JWT do usuário. A edge (`verify_jwt = true`) só responde para master_admin (RPC `is_master_admin`) e devolve a API key global, lida do secret `EVOLUTION_GLOBAL_API_KEY`. Outro usuário recebe 403 e a tela mostra "Sem permissão" (o login é desfeito).
3. **Onde a chave fica**: só em memória (`src/lib/queries/token.ts`, `definirChaveGlobal`). Nunca em `localStorage`/`sessionStorage`, nem no código, nem no `.env`.
4. **Manter conectado**: a sessão do Supabase fica salva no navegador (`persistSession` e `autoRefreshToken`, chave `gestao-painel-sessao`). Ao abrir ou recarregar `/manager`, se a sessão ainda vale, o painel busca a chave de novo e entra direto. Se o token venceu e não deu para renovar, vai para o login.
5. **Sair**: botão "Sair" no cabeçalho faz `signOut`, apaga a chave da memória e o cache de dados.
6. **Rotas**: todas (`/manager/*`, incluindo `/manager/diagnostico`) passam pelo `ProtectedRoute`; sem sessão, vão para `/manager/login`.
7. **URL do servidor**: fixa em `URL_EVOLUTION` (`https://evo.luminaresc.com.br`), fora da tela.

Estados do login (`src/contexts/AuthContext.tsx`): `carregando`, `sem-sessao`, `pronto`, `erro` (sessão válida, mas a edge não respondeu: tela com "Tentar de novo" e "Sair").

## Build
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` vêm do `.env.production` versionado (a anon key é pública; é a mesma do front do Gestão). O `Dockerfile.evolution` copia o repositório inteiro, então o build da imagem já usa esse arquivo. Para rodar local (`npm run dev`), copiar para `.env.local` (não versionado).

## CORS da edge
A edge aceita chamadas do navegador vindas de `https://evo.luminaresc.com.br` e, para desenvolvimento, de `http://localhost:5173`. Se o painel mudar de endereço, ajustar `ORIGENS` em `supabase/functions/evolution-manager-key/index.ts` (repositório do Gestão).

## Mensagens da tela
- Senha ou e-mail errado: "E-mail ou senha incorretos."
- Usuário sem perfil master_admin: "Sem permissão"
- Muitas tentativas: "Muitas tentativas. Aguarde um minuto e tente de novo."
- Sem rede: "Sem conexão com o servidor. Confira a internet e tente de novo."
