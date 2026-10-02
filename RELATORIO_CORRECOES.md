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
