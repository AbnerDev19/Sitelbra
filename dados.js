// dados.js
// Banco de Dados Oficial - Sitelbra Wholesale
// Operadoras: VIVO | CLARO | CIRION | GERAL | OI
// Estrutura: Multi-Price (Clean / Full)

const LPU_DB = [];

// ==========================================
// 1. CONFIGURAÇÃO DE ESTADOS (MAPA GLOBAL)
// ==========================================
const UF_GROUPS = {
    // GRUPO 1: DF (Distrito Federal)
    "DF": 1,

    // GRUPO 2: Geral (Sul, Sudeste, NE, CO - exceto RJ)
    "SP": 2,
    "MG": 2,
    "ES": 2,
    "PR": 2,
    "SC": 2,
    "RS": 2,
    "GO": 2,
    "MS": 2,
    "MT": 2,
    "BA": 2,
    "SE": 2,
    "AL": 2,
    "PE": 2,
    "PB": 2,
    "RN": 2,
    "CE": 2,
    "PI": 2,
    "MA": 2,

    // GRUPO 3: Pará e Tocantins
    "PA": 3,
    "TO": 3,

    // GRUPO 4: Norte (AC, AP, AM, RO)
    "AC": 4,
    "AP": 4,
    "AM": 4,
    "RO": 4,

    // GRUPO 5: Rio de Janeiro (Crítico)
    "RJ": 5,

    // GRUPO 6: Roraima (Extremo)
    "RR": 6
};

// ==========================================
// 2. DADOS BRUTOS (CARGA)
// ==========================================

// --- VIVO (Dados Detalhados Com/Sem Impostos) ---
const VIVO_IP = {
    4: { g1: { c: 355.88, f: 369.36 }, g2: { c: 388.24, f: 402.94 }, g3: { c: 420.59, f: 436.52 }, g4: { c: 640.59, f: 664.86 }, g5: { c: 711.77, f: 738.73 }, g6: { c: 711.77, f: 738.73 } },
    5: { g1: { c: 355.88, f: 369.36 }, g2: { c: 388.24, f: 402.94 }, g3: { c: 420.59, f: 436.52 }, g4: { c: 640.59, f: 664.86 }, g5: { c: 711.77, f: 738.73 }, g6: { c: 711.77, f: 738.73 } },
    10: { g1: { c: 355.88, f: 369.36 }, g2: { c: 388.24, f: 402.94 }, g3: { c: 420.59, f: 436.52 }, g4: { c: 640.59, f: 664.86 }, g5: { c: 711.77, f: 738.73 }, g6: { c: 711.77, f: 738.73 } },
    20: { g1: { c: 430.29, f: 446.60 }, g2: { c: 469.41, f: 487.20 }, g3: { c: 508.53, f: 527.79 }, g4: { c: 774.53, f: 803.87 }, g5: { c: 860.59, f: 893.19 }, g6: { c: 860.59, f: 893.19 } },
    30: { g1: { c: 559.34, f: 580.53 }, g2: { c: 610.20, f: 633.32 }, g3: { c: 661.05, f: 686.09 }, g4: { c: 1006.83, f: 1044.97 }, g5: { c: 1118.70, f: 1161.08 }, g6: { c: 1118.70, f: 1161.08 } },
    40: { g1: { c: 727.22, f: 754.77 }, g2: { c: 793.33, f: 823.38 }, g3: { c: 859.45, f: 892.01 }, g4: { c: 1309.00, f: 1358.59 }, g5: { c: 1454.45, f: 1509.55 }, g6: { c: 1454.45, f: 1509.55 } },
    50: { g1: { c: 945.42, f: 981.24 }, g2: { c: 1031.38, f: 1070.45 }, g3: { c: 1117.32, f: 1159.65 }, g4: { c: 1531.59, f: 1589.61 }, g5: { c: 1890.85, f: 1962.48 }, g6: { c: 1890.85, f: 1962.48 } },
    100: { g1: { c: 1229.05, f: 1275.61 }, g2: { c: 1340.79, f: 1391.58 }, g3: { c: 1452.52, f: 1507.55 }, g4: { c: 1991.07, f: 2066.49 }, g5: { c: 2458.11, f: 2551.23 }, g6: { c: 2458.11, f: 2551.23 } },
    200: { g1: { c: 1474.93, f: 1530.81 }, g2: { c: 1609.03, f: 1669.98 }, g3: { c: 1743.11, f: 1809.14 }, g4: { c: 2389.40, f: 2479.91 }, g5: { c: 2949.88, f: 3061.62 }, g6: { c: 2949.88, f: 3061.62 } },
    300: { g1: { c: 1770.07, f: 1837.13 }, g2: { c: 1930.98, f: 2004.13 }, g3: { c: 2091.90, f: 2171.14 }, g4: { c: 2867.51, f: 2976.14 }, g5: { c: 3540.13, f: 3674.24 }, g6: { c: 3540.13, f: 3674.24 } },
    400: { g1: { c: 2124.16, f: 2204.62 }, g2: { c: 2317.26, f: 2405.05 }, g3: { c: 2510.37, f: 2605.47 }, g4: { c: 3441.13, f: 3571.49 }, g5: { c: 4248.31, f: 4409.25 }, g6: { c: 4248.31, f: 4409.25 } },
    500: { g1: { c: 2549.05, f: 2645.62 }, g2: { c: 2780.79, f: 2886.14 }, g3: { c: 3012.52, f: 3126.64 }, g4: { c: 4129.47, f: 4285.91 }, g5: { c: 5098.11, f: 5291.24 }, g6: { c: 5098.11, f: 5291.24 } },
    1000: { g1: { c: 3848.92, f: 3994.73 }, g2: { c: 4198.83, f: 4357.89 }, g3: { c: 4548.74, f: 4721.05 }, g4: { c: 6235.26, f: 6471.47 }, g5: { c: 7697.86, f: 7989.47 }, g6: { c: 7697.86, f: 7989.47 } }
};

// Instalação Vivo IP
const INST_VIVO_IP = { g1: { c: 1500, f: 1749 }, g3: { c: 1800, f: 2099 }, g4: { c: 2100, f: 2448 }, g5: { c: 2750, f: 3207 } };

// --- CLARO BANDA LARGA ---
const CLARO_BDL = {
    4: { g1: { m: 272.63, f: 282.96 }, g2: { m: 286.26, f: 297.10 }, g3: { m: 300.57, f: 311.96 }, g4: { m: 375.72, f: 389.95 }, g5: { m: 286.26, f: 297.10 }, g6: { m: 496.88, f: 515.71 } },
    // Replicando até 200M
    10: { g1: { m: 272.63, f: 282.96 }, g2: { m: 286.26, f: 297.10 }, g3: { m: 300.57, f: 311.96 }, g4: { m: 375.72, f: 389.95 }, g5: { m: 286.26, f: 297.10 }, g6: { m: 496.88, f: 515.71 } },
    50: { g1: { m: 272.63, f: 282.96 }, g2: { m: 286.26, f: 297.10 }, g3: { m: 300.57, f: 311.96 }, g4: { m: 375.72, f: 389.95 }, g5: { m: 286.26, f: 297.10 }, g6: { m: 496.88, f: 515.71 } },
    100: { g1: { m: 272.63, f: 282.96 }, g2: { m: 286.26, f: 297.10 }, g3: { m: 300.57, f: 311.96 }, g4: { m: 375.72, f: 389.95 }, g5: { m: 286.26, f: 297.10 }, g6: { m: 496.88, f: 515.71 } },
    200: { g1: { m: 272.63, f: 282.96 }, g2: { m: 286.26, f: 297.10 }, g3: { m: 300.57, f: 311.96 }, g4: { m: 375.72, f: 389.95 }, g5: { m: 286.26, f: 297.10 }, g6: { m: 496.88, f: 515.71 } },
    300: { g1: { m: 343.37, f: 356.38 }, g2: { m: 360.54, f: 374.20 }, g3: { m: 378.57, f: 392.91 }, g4: { m: 473.21, f: 491.13 }, g5: { m: 360.54, f: 374.20 }, g6: { m: 625.82, f: 649.52 } },
    500: { g1: { m: 415.48, f: 431.22 }, g2: { m: 436.25, f: 452.78 }, g3: { m: 458.06, f: 475.42 }, g4: { m: 572.58, f: 594.27 }, g5: { m: 436.25, f: 452.78 }, g6: { m: 757.24, f: 785.92 } },
    1000: { g1: { m: 540.12, f: 560.58 }, g2: { m: 567.13, f: 588.61 }, g3: { m: 595.48, f: 618.04 }, g4: { m: 744.35, f: 772.55 }, g5: { m: 567.13, f: 588.61 }, g6: { m: 984.41, f: 1021.70 } }
};
const INST_CLARO_BDL = { g1: { c: 550, f: 641 }, g3: { c: 750, f: 874 }, g6: { c: 850, f: 991 } };

// --- CIRION L2 (Dados Detalhados) ---
const CIRION_L2 = {
    10: { g1: { c: 294, f: 392 }, g3: { c: 312, f: 417 }, g4: { c: 498, f: 665 }, g5: { c: 539, f: 720 } },
    20: { g1: { c: 398, f: 531 }, g3: { c: 425, f: 567 }, g4: { c: 669, f: 894 }, g5: { c: 729, f: 974 } },
    50: { g1: { c: 966, f: 1290 }, g3: { c: 1038, f: 1386 }, g4: { c: 1612, f: 2154 }, g5: { c: 1771, f: 2366 } },
    100: { g1: { c: 1312, f: 1753 }, g3: { c: 1413, f: 1888 }, g4: { c: 2184, f: 2918 }, g5: { c: 2406, f: 3215 } },
    200: { g1: { c: 1480, f: 1978 }, g3: { c: 1594, f: 2130 }, g4: { c: 2462, f: 3290 }, g5: { c: 2714, f: 3626 } },
    500: { g1: { c: 2573, f: 3438 }, g3: { c: 2777, f: 3710 }, g4: { c: 4270, f: 5705 }, g5: { c: 4718, f: 6304 } },
    1000: { g1: { c: 3689, f: 4929 }, g3: { c: 3982, f: 5320 }, g4: { c: 6118, f: 8173 }, g5: { c: 6763, f: 9036 } }
};
const INST_CIRION = { g1: { c: 3450, f: 4023 }, g3: { c: 3960, f: 4618 }, g4: { c: 4620, f: 5387 }, g5: { c: 6957, f: 8113 } };

// --- OI E GERAL (Dados Base do Upload - Adaptados) ---
// Regra: Clean = Valor Base | Full = Valor Base * 1.15 (Aprox)
const OI_BASE = {
    ip: { 10: 280, 50: 743, 100: 967, 200: 1160, 500: 2005, 1000: 3028 },
    l2: { 10: 342, 50: 1028, 100: 1370, 200: 1542, 500: 2639, 1000: 3770 },
    bdl: { 10: 256, 50: 256, 100: 256, 200: 256, 300: 323, 500: 391, 1000: 508 }
};
const OI_INST = { ip: 1749, l2: 3148, bdl: 641 };

const GERAL_BASE = {
    ip: { 10: 397, 50: 1057, 100: 1374, 200: 1649, 500: 2849, 1000: 4303 },
    l2: { 10: 397, 50: 1193, 100: 1591, 200: 1790, 500: 3063, 1000: 4376 },
    bdl: { 10: 253, 50: 253, 100: 253, 200: 253, 300: 329, 500: 379, 1000: 672 }
};
const GERAL_INST = { ip: 1749, l2: 1749, bdl: 641 };


// ==========================================
// 3. REGRAS DE PRAZO
// ==========================================
const RULES = {
    prazos: { 12: 1.00, 24: 0.90, 36: 0.80, 48: 0.75, 60: 0.70 },
    instalacao: { 12: 1.0, 24: 1.0, 36: 1.0, 48: 1.0, 60: 1.0 }
};

// ==========================================
// 4. ENGINE (GERADOR DE DADOS)
// ==========================================
function gerarDB() {
    const prazos = [12, 24, 36, 48, 60];

    // --- FUNÇÃO AUXILIAR: ADD ---
    function add(op, prod, uf, grupoId, vel, mc, mf, ic, _if) {
        // Se Full não definido, calcula ~15% tax
        if (!mf) mf = mc * 1.15;
        if (!_if) _if = ic * 1.15;

        prazos.forEach(d => {
            const fM = RULES.prazos[d];
            const fI = RULES.instalacao[d];
            LPU_DB.push({
                o: op,
                p: prod,
                u: uf,
                d: d,
                s: vel,
                m: { c: mc * fM, f: mf * fM },
                i: { c: ic * fI, f: _if * fI }
            });
        });
    }

    // --- PROCESSAR ESTADOS ---
    for (const [uf, gId] of Object.entries(UF_GROUPS)) {
        const gKey = `g${gId}`;
        const isCritical = (gId >= 4); // Norte, RJ, RR (Preço alto)
        const isRJRR = (gId >= 5);

        // ================= VIVO =================
        // IP e L2 (Usam tabela VIVO_IP como base de preço para ambos na falta de L2 especifica no objeto)
        // Mapeando dados para L2 similar ao IP na Vivo conforme pedido anterior
        const vIpVel = VIVO_IP;

        for (let v of[10, 20, 30, 40, 50, 100, 200, 300, 400, 500, 1000]) {
            let dados = vIpVel[v] ? vIpVel[v][gKey] : vIpVel[10][gKey]; // Fallback
            if (!dados && gId == 6) dados = vIpVel[v]['g5']; // RR usa RJ

            let inst = INST_VIVO_IP[gKey] || (gId == 2 ? INST_VIVO_IP.g1 : INST_VIVO_IP.g5);
            if (!inst && gId == 6) inst = INST_VIVO_IP.g5;

            if (dados && inst) {
                add('Vivo', 'IP DEDICADO', uf, gId, v, dados.c, dados.f, inst.c, inst.f);
                add('Vivo', 'L2-MPLS', uf, gId, v, dados.c, dados.f, inst.c, inst.f); // L2 = IP na Vivo (regra simplificada)
            }
        }

        // ================= CLARO =================
        // IP/L2 = Vivo (Cópia)
        // BDL = Própria
        const cBdl = CLARO_BDL;
        const cInst = INST_CLARO_BDL[gKey] || (gId == 2 ? INST_CLARO_BDL.g1 : INST_CLARO_BDL.g6);

        for (let v of[10, 50, 100, 200, 300, 500, 1000]) {
            // IP e L2 Clone Vivo
            let dadosV = vIpVel[v] ? vIpVel[v][gKey] : null;
            let instV = INST_VIVO_IP[gKey] || INST_VIVO_IP.g5;
            if (dadosV) {
                add('Claro', 'IP DEDICADO', uf, gId, v, dadosV.c, dadosV.f, instV.c, instV.f);
                add('Claro', 'L2-MPLS', uf, gId, v, dadosV.c, dadosV.f, instV.c, instV.f);
            }

            // BDL Claro
            let dadosC = cBdl[v] ? cBdl[v][gKey] : cBdl[10][gKey]; // Fallback
            // Ajuste RR/RJ fallback
            if (!dadosC && gId == 5) dadosC = cBdl[v]['g2']; // RJ usa Geral na BDL Claro

            if (dadosC && cInst) {
                add('Claro', 'BANDA LARGA', uf, gId, v, dadosC.m, dadosC.f, cInst.c, cInst.f);
            }
        }

        // ================= CIRION =================
        const ciL2 = CIRION_L2;
        const ciInst = INST_CIRION[gKey] || (gId == 2 ? INST_CIRION.g1 : INST_CIRION.g5);

        for (let v of[10, 20, 50, 100, 200, 500, 1000]) {
            // L2
            let dL2 = ciL2[v] ? ciL2[v][gKey] : null;
            if (!dL2 && gId == 2) dL2 = ciL2[v]['g1']; // G2 usa G1
            if (!dL2 && gId == 6) dL2 = ciL2[v]['g5']; // RR usa RJ

            if (dL2 && ciInst) {
                add('Cirion', 'L2-MPLS', uf, gId, v, dL2.c, dL2.f, ciInst.c, ciInst.f);
                // Cirion BDL clone (simplificação baseada em L2 mais barata)
                add('Cirion', 'BANDA LARGA', uf, gId, v, dL2.c * 0.7, dL2.f * 0.7, ciInst.c * 0.6, ciInst.f * 0.6);
            }
        }

        // ================= OI & GERAL =================
        // Usa valores base + multiplicador para zonas críticas
        const multi = isCritical ? 1.8 : 1.0; // Zonas Norte/RJ/RR são ~80% mais caras na Oi/Geral
        const tax = 1.15; // Taxa estimada p/ Full

        for (let v of[10, 50, 100, 200, 300, 500, 1000]) {
            // OI
            let oIp = OI_BASE.ip[v] || OI_BASE.ip[1000];
            let oL2 = OI_BASE.l2[v] || OI_BASE.l2[1000];
            let oBdl = OI_BASE.bdl[v] || OI_BASE.bdl[1000];

            if (oIp) add('Oi', 'IP DEDICADO', uf, gId, v, oIp * multi, oIp * multi * tax, OI_INST.ip * multi, OI_INST.ip * multi * tax);
            if (oL2) add('Oi', 'L2-MPLS', uf, gId, v, oL2 * multi, oL2 * multi * tax, OI_INST.l2 * multi, OI_INST.l2 * multi * tax);
            if (oBdl) add('Oi', 'BANDA LARGA', uf, gId, v, oBdl * multi, oBdl * multi * tax, OI_INST.bdl * multi, OI_INST.bdl * multi * tax);

            // GERAL
            let gIp = GERAL_BASE.ip[v] || GERAL_BASE.ip[1000];
            let gL2 = GERAL_BASE.l2[v] || GERAL_BASE.l2[1000];
            let gBdl = GERAL_BASE.bdl[v] || GERAL_BASE.bdl[1000];

            if (gIp) add('Geral', 'IP DEDICADO', uf, gId, v, gIp * multi, gIp * multi * tax, GERAL_INST.ip * multi, GERAL_INST.ip * multi * tax);
            if (gL2) add('Geral', 'L2-MPLS', uf, gId, v, gL2 * multi, gL2 * multi * tax, GERAL_INST.l2 * multi, GERAL_INST.l2 * multi * tax);
            if (gBdl) add('Geral', 'BANDA LARGA', uf, gId, v, gBdl * multi, gBdl * multi * tax, GERAL_INST.bdl * multi, GERAL_INST.bdl * multi * tax);
        }
    }
}

// Executar
gerarDB();
window.LPU_DB = LPU_DB;
console.log("Banco de Dados Carregado: " + LPU_DB.length + " ofertas.");