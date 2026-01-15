// lpu_oi.js - BASEADA NOS CSVS "oi.xlsx"
// CORREÇÃO: Instalação dinâmica por velocidade e ajustes finos nos multiplicadores de RJ/RR.

const OI_DATA = {
    // 1. TABELA DE PREÇOS MENSAIS BASE (Referência: Grupo 2 - SP/Geral)
    prices: {
        ip: {
            4: 388.24,
            5: 388.24,
            10: 388.24,
            20: 469.41,
            30: 610.20,
            40: 793.33,
            50: 1031.38,
            100: 1340.79,
            200: 1609.03,
            300: 1930.98,
            400: 2317.26,
            500: 2780.79,
            1000: 4198.83
        },
        l2: {
            4: 407.69,
            5: 407.69,
            10: 407.69,
            20: 530.00,
            30: 774.61,
            40: 978.46,
            50: 1223.08,
            100: 1630.77,
            200: 1834.61,
            300: 1956.92,
            400: 2364.61,
            500: 3139.23,
            1000: 4484.61
        },
        bdl: {
            4: 286.26,
            5: 286.26,
            10: 286.26,
            20: 286.26,
            30: 286.26,
            40: 286.26,
            50: 286.26,
            100: 286.26,
            200: 286.26,
            300: 360.54,
            400: 396.59,
            500: 436.25,
            1000: 567.13
        }
    },

    // 2. TABELA DE INSTALAÇÃO BASE (Por Velocidade)
    // A instalação muda conforme a velocidade aumenta.
    inst_base: {
        ip: {
            4: 1500,
            5: 1500,
            10: 1500,
            20: 1500,
            30: 1950,
            40: 2100,
            50: 2100,
            100: 2100,
            200: 3000,
            300: 3000,
            400: 3450,
            500: 3600,
            1000: 6000
        },
        l2: {
            4: 2700,
            5: 2700,
            10: 2700,
            20: 2700,
            30: 3510,
            40: 3780,
            50: 3780,
            100: 3780,
            200: 5100,
            300: 5100,
            400: 5865,
            500: 6120,
            1000: 8400
        },
        bdl: {
            // BDL é mais estável, mas definimos base 550
            all: 550
        }
    }
};

const OI_RULES = {
    taxFactor: 1.0379, // ~3.79%

    // Mapeamento de UF para Grupo
    groups: {
        ip: {
            "DF": 1,
            "SP": 2,
            "MG": 2,
            "PR": 2,
            "RS": 2,
            "SC": 2,
            "ES": 2,
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
            "PA": 3,
            "TO": 3,
            "AC": 4,
            "AP": 4,
            "AM": 4,
            "RO": 4,
            "RJ": 5,
            "RR": 5 // RJ e RR no Grupo 5 (Mais caro)
        },
        l2: {
            // No L2, DF entra no Grupo 1 (Geral)
            "DF": 1,
            "SP": 1,
            "MG": 1,
            "PR": 1,
            "RS": 1,
            "SC": 1,
            "ES": 1,
            "GO": 1,
            "MS": 1,
            "MT": 1,
            "BA": 1,
            "SE": 1,
            "AL": 1,
            "PE": 1,
            "PB": 1,
            "RN": 1,
            "CE": 1,
            "PI": 1,
            "MA": 1,
            "PA": 2,
            "TO": 2,
            "AC": 3,
            "AP": 3,
            "AM": 3,
            "RO": 3,
            "RJ": 4,
            "RR": 4 // RJ e RR no Grupo 4 do L2
        },
        bdl: {
            "DF": 1,
            "SP": 2,
            "MG": 2,
            "PR": 2,
            "RS": 2,
            "SC": 2,
            "ES": 2,
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
            "PA": 3,
            "TO": 3,
            "AC": 4,
            "AP": 4,
            "AM": 4,
            "RJ": 5,
            "RO": 5, // RO é caro no BDL
            "RR": 6
        }
    },

    // Multiplicadores (Aplicados sobre a Base para Mensalidade E Instalação)
    multipliers: {
        ip: { 1: 0.916, 2: 1.00, 3: 1.083, 4: 1.65, 5: 1.833 },
        l2: { 1: 1.000, 2: 1.083, 3: 1.65, 4: 1.833 },
        // BDL tem instalação fixa por grupo no CSV, então trataremos diferente na lógica
        bdl: { 1: 0.952, 2: 1.00, 3: 1.05, 4: 1.312, 5: 1.509, 6: 1.735 }
    },

    // Instalação Fixa BDL por Grupo (Exceção à regra de multiplicador)
    bdlInstFixed: { 1: 550, 2: 550, 3: 750, 4: 750, 5: 850, 6: 850 },

    decay: {
        ip: { 12: 1.00, 24: 0.90, 36: 0.85, 48: 0.803, 60: 0.758 },
        l2: { 12: 1.00, 24: 0.90, 36: 0.85, 60: 0.81 },
        bdl: { 12: 1.00, 24: 0.952, 36: 0.907 }
    }
};

(function gerarOi() {
    // Itera por todas as UFs conhecidas
    const allUfs = Object.keys(UF_GROUPS);

    allUfs.forEach(uf => {
        VELOCIDADES_DISPONIVEIS.forEach(v => {

            // --- 1. IP DEDICADO ---
            let gIp = OI_RULES.groups.ip[uf] || 2;
            let mIp = OI_RULES.multipliers.ip[gIp];
            let baseIp = OI_DATA.prices.ip[v] || OI_DATA.prices.ip[10];
            let baseInstIp = OI_DATA.inst_base.ip[v] || OI_DATA.inst_base.ip[10];

            if (baseIp) {
                let cleanM = baseIp * mIp;
                let cleanI = baseInstIp * mIp; // Multiplicador afeta a instalação também no IP

                [12, 24, 36, 48, 60].forEach(d => {
                    let fator = OI_RULES.decay.ip[d] || 1.0;
                    addEntry('Oi', 'IP DEDICADO', uf, d, v,
                        cleanM * fator, (cleanM * fator) * OI_RULES.taxFactor,
                        cleanI, cleanI * OI_RULES.taxFactor
                    );
                });
            }

            // --- 2. L2 MPLS ---
            let gL2 = OI_RULES.groups.l2[uf] || 1;
            let mL2 = OI_RULES.multipliers.l2[gL2];
            let baseL2 = OI_DATA.prices.l2[v] || OI_DATA.prices.l2[10];
            let baseInstL2 = OI_DATA.inst_base.l2[v] || OI_DATA.inst_base.l2[10];

            if (baseL2) {
                let cleanM = baseL2 * mL2;
                let cleanI = baseInstL2 * mL2; // Multiplicador afeta a instalação no L2

                [12, 24, 36, 60].forEach(d => {
                    let fator = OI_RULES.decay.l2[d] || 1.0;
                    addEntry('Oi', 'L2-MPLS', uf, d, v,
                        cleanM * fator, (cleanM * fator) * OI_RULES.taxFactor,
                        cleanI, cleanI * OI_RULES.taxFactor
                    );
                });
            }

            // --- 3. BANDA LARGA ---
            let gBdl = OI_RULES.groups.bdl[uf] || 2;
            let mBdl = OI_RULES.multipliers.bdl[gBdl];
            let baseBdl = OI_DATA.prices.bdl[v] || OI_DATA.prices.bdl[10];

            if (baseBdl) {
                let cleanM = baseBdl * mBdl;
                let cleanI = OI_RULES.bdlInstFixed[gBdl]; // BDL usa tabela fixa de instalação

                [12, 24, 36].forEach(d => {
                    let fator = OI_RULES.decay.bdl[d] || 1.0;
                    addEntry('Oi', 'BANDA LARGA', uf, d, v,
                        cleanM * fator, (cleanM * fator) * OI_RULES.taxFactor,
                        cleanI, cleanI * OI_RULES.taxFactor
                    );
                });
            }
        });
    });
    console.log("Ofertas Oi (Corrigidas RJ/RR) Carregadas.");
})();