# Sitelbra Wholesale | Cotação

Plataforma interna de cotação. Sem build: HTML + JS puro. As regras de preço continuam em `pricing.js` (inalteradas) e as tabelas em `lpu_*.js`.

## Rodar
```bash
cp .env.example .env      # preencha GEMINI_API_KEY
npm start                 # http://localhost:3000
npm test                  # pricing + composição/status
```
Sem `GEMINI_API_KEY` tudo funciona, exceto "Melhorar com IA" e "Análise comercial com IA".

## Arquitetura
| Arquivo | Papel |
|---|---|
| `pricing.js` | Regras de preço (fonte única). Não mexa sem conferir `tests/pricing.test.js`. |
| `lpu_*.js`, `lpu_config.js` | Tabelas LPU e carregamento. |
| `specials.js` | Rótulos/tooltips das opções da "Análise avançada". |
| `quote.js` | Status, composição do preço, fatores aplicados, resumo, texto comercial, comparação. Não calcula preço: chama `pricing.js` e confere que a composição fecha com o total. |
| `history.js` | Histórico em `localStorage` (chave `sitelbra.historico.v1`). |
| `ai.js` + `api/ai.js` | Cliente da IA e proxy no servidor. A chave só existe no servidor. |
| `dev-server.js` | Servidor SÓ para uso local (a Vercel não usa; por isso não se chama server.js) sem dependências (serve o site e `/api/ai`). |
| `rede-core.js` | Aba Rede própria: geohash, distância, leitura de coordenadas/velocidade e colunas da planilha (puro, testável). |
| `rede.js` | Aba Rede própria: login, Firestore, importação da planilha, busca e comparação com a LPU. |
| `firebase-config.js`, `firestore.rules` | Config do Firebase e regras de segurança. |
| `script.js`, `style.css`, `index.html` | Interface. |

## IA e segurança
- Nenhuma chave no front-end. O navegador chama `/api/ai`, que lê `GEMINI_API_KEY` do ambiente.
- O navegador envia só `{task, dados}`; o prompt é montado no servidor (não é um proxy aberto). Limite de 20 chamadas/min por IP.
- Em Vercel/Netlify: `api/ai.js` funciona como função serverless; defina `GEMINI_API_KEY` nas variáveis de ambiente do projeto. Em hospedagem estática pura (GitHub Pages) a IA não funciona, pois não há onde guardar a chave.
- **A chave antiga estava no histórico do repositório. Revogue-a no Google AI Studio.**

## Status de viabilidade
O projeto não tem uma regra comercial de viabilidade; o status usa só fatos já existentes:
- **Inviável**: a LPU não tem preço para a combinação (operadora, produto, UF, prazo).
- **Atenção**: há preço, mas algo exige conferência (opção marcada que a operadora ignora, ex. Rádio/MTU na Cirion; zona rural sem distância; prazo adicional sem preço; operadora sem planilha de referência, hoje a Oi, lista em `OPERADORAS_SEM_PLANILHA` em `quote.js`).
- **Viável**: nenhuma das anteriores.
Se a Sitelbra definir critérios comerciais (ex.: instalação máxima vs. mensalidade), o ponto de entrada é `evaluateStatus` em `quote.js`.

## Exportar proposta
Gera o documento e abre a impressão do navegador: escolha "Salvar como PDF". Não cita a operadora.

## Estados coloridos
Cada UF é colorida pela mensalidade da LPU (operadora + produto + prazo + velocidade escolhidos) em relação à UF mais barata: verde até +10%, amarelo até +30%, laranja até +70%, vermelho acima disso (local ruim) e tracejado cinza quando não há preço. Muda sozinha ao trocar a seleção. Faixas em `UF_TIERS` (`script.js`).

## Rede própria (Firebase)
1. Console Firebase: crie o projeto, adicione um app Web, ative **Authentication > E-mail/senha**, desligue o cadastro público e crie seus usuários.
2. Crie o **Firestore** e cole `firestore.rules` (ajuste a lista de e-mails que podem importar).
3. Cole a config em `firebase-config.js`.
4. Aba **Rede própria > Base de ativos**: envie a planilha do Metabase (.xlsx/.csv). O sistema detecta as colunas; confira o mapeamento e envie. Cada importação pode remover o que saiu da planilha.
5. Busca: endereço (geocodificação OpenStreetMap, posição aproximada) e/ou coordenadas. Mostra os links mais próximos, distância, velocidade vs. pedido, custo estimado de extensão (R$/m informado por você) e a LPU de terceiros para comparar.
Obs.: a velocidade do ativo é a do circuito cadastrado, não a banda livre.

## Publicar com IA (Vercel)
Importe o repositório na Vercel (sem build). Em Settings > Environment Variables: `GEMINI_API_KEY` (chave NOVA), e para proteger a IA `REQUIRE_AUTH=1` + `FIREBASE_API_KEY` (apiKey do firebase-config.js). Em Firebase > Authentication > Configurações > Domínios autorizados, adicione o domínio da Vercel.
