# Sitelbra – correções aplicadas

## Bugs que faziam o site errar
1. **Valores especiais nunca eram aplicados** (script.js): `isChecked('sp_fora_urbana')` procurava o elemento `sp_sp_fora_urbana`. Fora da zona urbana, cidade pequena, favela, provedores, rádio e IPs fixos eram ignorados.
2. **Operadora "Geral" não carregava** (lpu_geral.js): o código usava `GERAL_IP_MATRIX`, mas as matrizes se chamavam `LPU_GERAL_*`. Dava ReferenceError.
3. **Tabelas aproximadas por "decaimento"**: os preços de 24/36/48/60 meses eram calculados por fator. Agora são os valores exatos das planilhas (`ms, is, mc, ic`).
4. **Grupos de UF errados no IP Claro/Vivo**: a planilha tem 5 grupos (DF é grupo próprio) e o site usava 4.
5. **BDL Claro/Vivo**: a planilha tem 6 grupos (RO junto com RJ, RR sozinho).
6. **Impostos**: o site multiplicava tudo por 1.336. Agora a razão vem da própria linha da LPU (Claro/Vivo mensal ÷0,9635; Cirion ÷0,7635; Geral ÷0,7485; instalação ÷0,8575).
7. **Geral L2, grupo 1, 500M/1000M**: a planilha tem fórmula errada na instalação s/ impostos (4.580 / 7.633). Corrigido para 3.600 / 6.000, como nos outros grupos.

## Regras dos valores especiais (pricing.js, espelho das abas "Projeto Especial - Abner")
- Fora da zona urbana x1,2 (mensal e inst.); Indústria x1,2 mensal + inst. 3.500 (antes eram tratados como iguais).
- Cidade pequena x1,4; Provedores x1,2; Shopping x2; SLA maior x1,4; Dupla abordagem x1,6 (mensal).
- Aeroporto = +2x a mensalidade da LPU (mensal e inst.); antes era 4.200 fixo.
- Favela: +1.000 mensal / +2.000 inst., **sem** multiplicador (antes tinha x1,2).
- Datacenter +1.200 mensal. Comodato +75 mensal / +750 inst.
- Rádio homologado: x1,2 mensal + 7.500 inst. (antes 6.000). Cirion não usa.
- Distância: multiplicador na mensal (dist/500*0,1+1; fibra < 500 m usa /1000; Geral usa /1500). Instalação rural **substitui** a urbana.
- Faixas da mensalidade: ≥ 15.000 x0,65; ≥ 10.000 x0,85 (não existia).
- IPs fixos: 125 + 25/IP (Cirion: 45/IP) e inst. +10/IP. MTU 1500 (BDL): +200 mensal / +100 inst.

## Não alterado
- **Oi**: não veio planilha; `lpu_oi.js` segue como estava.
- Aba ALLOHA (Cirion) não foi carregada como operadora.
- ~~A chave da API Gemini estava exposta no script.js~~ → removida do front-end (ver README). **A chave antiga continua pública no histórico do repositório: revogue-a e gere uma nova.**

Testes: `node tests/pricing.test.js`

## Revisão de 02/10/2026 (valores + espaçamento)
- **Dado corrigido (lpu_cirion.js)**: Cirion L2-MPLS, UFs AC/AP/AM/RO (grupo 3), 36 meses, 500M. A instalação estava com o valor do grupo 2 (R$ 6.840 s/ imp.; R$ 7.976,68 c/ imp.), enquanto 12, 24 e 60 meses trazem R$ 9.576 (c/ imp. R$ 11.167,35). Ajustado para 9.576 / 11.167,3469.
- **Conferido sem erro**: todas as regras de pricing.js (shopping, aeroporto, indústria, datacenter, fora da urbana, cidade pequena, favela, provedor, SLA, dupla, rádio, comodato, IPs, rural/distância, faixas) batem com o descrito neste relatório; sem duplicatas na LPU; razão de impostos constante por operadora; preços sobem com a velocidade e caem com o prazo.
- **Visual**: a coluna "Instalação" da tabela de prazos e da aba Comparar ficava cortada (parecia faltar valor) e a aba "Análise IA" saía da tela. Corrigido em style.css, no bloco "RESPIRO" no final do arquivo, que também deixa o espaçamento mais solto. Para ajustar, mexa só nas variáveis no topo desse bloco (--gap-col, --gap-stack, --pad-card, --pad-main, --side-w).
- **Pendente de confirmação**: MTU 1500 (BDL) soma +200 na mensalidade e **+500** na instalação no código (Q*5), mas este relatório e a versão anterior diziam +100 na instalação. Confira na aba "Projeto Especial" da planilha antes de mudar.
- **Pendente**: a Oi continua sem planilha de referência (status "Atenção").
