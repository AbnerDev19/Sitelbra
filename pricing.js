// pricing.js
// Motor de cálculo dos VALORES ESPECIAIS.
// Segue as fórmulas das abas "Projeto Especial - Abner" das planilhas LPU
// (Claro/Vivo, Cirion e Geral). Função pura: não mexe no DOM, então dá para testar no Node.
//
// Entrada:
//   item : entrada da LPU_DB  { m:{c,f}, i:{c,f}, ... }  (valores da planilha, prazo/UF/velocidade já escolhidos)
//   o    : opções marcadas na tela (ver campos abaixo)
//   op   : nome da operadora (Claro, Vivo, Cirion, Geral, Oi)

(function (root) {

    // Regras que mudam de uma planilha para outra
    const RULES = {
        default: {
            radio: true,                 // "Rádio Homologado" existe
            mtu: true,                   // "BDL - MTU 1500" existe
            ipMensal: q => (q > 0 ? 125 + q * 25 : 0),
            ipInst: q => q * 10,
            fibraCurtaDiv: 1000          // distância/1000*0.1+1 quando fibra < 500 m
        },
        Cirion: {
            radio: false,                // "Cirion sempre homologado"
            mtu: false,
            ipMensal: q => q * 45,       // P4 = P3*45
            ipInst: q => 0,
            fibraCurtaDiv: 1000
        },
        Geral: {
            fibraCurtaDiv: 1500          // J4 da planilha Geral usa /1500
        }
    };

    function rulesFor(op) {
        return Object.assign({}, RULES.default, RULES[op] || {});
    }

    function computePricing(item, o, op) {
        const R = rulesFor(op);
        o = o || {};

        const baseM = item.m.c;   // mensalidade LPU s/ impostos
        const baseI = item.i.c;   // instalação LPU s/ impostos

        // ---- Fatores (linha 4 da planilha) ----
        const B = o.foraUrbana ? 1.2 : 1;                 // Fora da zona urbana
        const C = o.industria ? 1.2 : 1;                  // Indústria
        const D = o.cidPeq ? 1.4 : 1;                     // Cidade pequena (< 30 mil hab.)
        const E = o.provedor ? 1.2 : 1;                   // RTM / Avato / Tecpac / provedores
        const F = o.shopping ? 2 : 1;                     // Shopping
        const G = o.aeroporto ? baseM * 2 : 0;            // Aeroporto = 2 x mensalidade da LPU
        const H = o.datacenter ? 1200 : 0;                // Datacenter
        const I = o.sla ? 1.4 : 1;                        // SLA maior
        const dist = Math.max(0, parseFloat(o.distancia) || 0);
        let J = 1;                                        // Distância
        if (dist > 0) J = o.fibraCurta ? dist / R.fibraCurtaDiv * 0.1 + 1 : dist / 500 * 0.1 + 1;
        const K = o.favela ? 1000 : 0;                    // Favela / fibra pública subterrânea
        const L = o.comodato ? 75 : 0;                    // Equipamento em comodato
        const reduzido = !!o.fibraCurta;                  // Fibra a menos de 500 m
        const N = o.dupla ? 1.6 : 1;                      // Dupla abordagem / ponta B não concentrador
        const O = (R.radio && o.radio) ? 1.2 : 1;         // Rádio homologado
        const qtdIp = Math.max(0, parseFloat(o.qtdIp) || 0);
        const P = R.ipMensal(qtdIp);                      // IPs fixos (mensal)
        const Q = (R.mtu && o.mtu) ? 100 : 0;             // BDL MTU 1500

        // ---- MENSALIDADE (B11) ----
        const S = baseM * B * C * O * D * E * I * J * N * F + G + H + K + L;
        let faixa = 1;
        if (S >= 15000) faixa = 0.65;
        else if (S >= 10000) faixa = 0.85;
        const mensal = S * faixa + P + Q * 2;

        // ---- INSTALAÇÃO ZONA URBANA (D11) ----
        const instUrbana =
            baseI * B * D * E * F + G + 2 * K + 10 * L +
            (C === 1 ? 0 : 3500) +
            (O === 1 ? 0 : 7500) +
            R.ipInst(qtdIp) + Q * 5;

        // ---- INSTALAÇÃO ZONA RURAL (B16) — substitui a urbana ----
        const instRural =
            (dist * 3.65 + 500 + 10 * L +
                (C === 1 ? 0 : 3500) +
                (O === 1 ? 0 : 7500) +
                K * 2) / (reduzido ? 2 : 1);

        const instalacao = o.rural ? instRural : instUrbana;

        // ---- IMPOSTOS: razão exata da própria linha da LPU (c/ imposto ÷ s/ imposto) ----
        const taxM = item.m.f / item.m.c;
        const taxI = item.i.f / item.i.c;

        return {
            mensalClean: mensal,
            instalacaoClean: instalacao,
            mensalFull: mensal * taxM,
            instalacaoFull: instalacao * taxI,
            taxM, taxI,
            faixa,
            mensalAntesFaixa: S,
            instUrbana, instRural,
            fatores: { B, C, D, E, F, G, H, I, J, K, L, N, O, P, Q }
        };
    }

    const api = { computePricing, rulesFor, RULES };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.Pricing = api;

})(typeof window !== 'undefined' ? window : globalThis);
