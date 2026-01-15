// lpu_claro.js
// BASEADO NOS ARQUIVOS CSV "claro.xlsx"
// Destaques: DF separado no IP, RO caro no BDL e Instalação dinâmica por velocidade.

const CLARO_DATA = {
    // 1. PREÇOS BASE (Referência 12 Meses / Clean)
    prices: {
        // Referência IP: Grupo 2 (SP/Geral)
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
        // Referência L2: Grupo 1 (SP/DF/Geral)
        l2: {
            4: 388.28,
            5: 388.28,
            10: 388.28,
            20: 504.76,
            30: 737.73,
            40: 931.87,
            50: 1164.83,
            100: 1553.11,
            200: 1747.25,
            300: 1863.73,
            400: 2252.01,
            500: 2989.74,
            1000: 4271.06
        },
        // Referência BDL: Grupo 2 (SP/Geral)
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

    // 2. INSTALAÇÃO BASE (Por Velocidade - Referência SP/Geral)
    // Extraído das colunas de Instalação do Grupo Base
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
        bdl: {
            // BDL tem instalação fixa por GRUPO, não por velocidade (tratado nas REGRAS)
            all: 550
        }
    }
};

const CLARO_RULES = {
    taxFactor: 1.0379, // ~3.79%

    // Mapeamento de Estados por Grupo
    groups: {
        ip: {
            // G1: DF (Mais barato que a base)
            "DF": 1,
            // G2: Geral (Base)
            "AL": 2,
            "BA": 2,
            "CE": 2,
            "ES": 2,
            "GO": 2,
            "MA": 2,
            "MT": 2,
            "MS": 2,
            "MG": 2,
            "PB": 2,
            "PR": 2,
            "PE": 2,
            "PI": 2,
            "RN": 2,
            "RS": 2,
            "SC": 2,
            "SP": 2,
            "SE": 2,
            // G3: PA, TO
            "PA": 3,
            "TO": 3,
            // G4: Norte
            "AC": 4,
            "AP": 4,
            "AM": 4,
            "RO": 4,
            // G5: RJ, RR
            "RJ": 5,
            "RR": 5
        },
        l2: {
            // G1: Geral + DF (DF paga igual SP no L2)
            "AL": 1,
            "BA": 1,
            "CE": 1,
            "DF": 1,
            "ES": 1,
            "GO": 1,
            "MA": 1,
            "MT": 1,
            "MS": 1,
            "MG": 1,
            "PB": 1,
            "PR": 1,
            "PE": 1,
            "PI": 1,
            "RN": 1,
            "RS": 1,
            "SC": 1,
            "SP": 1,
            "SE": 1,
            // G2: PA, TO
            "PA": 2,
            "TO": 2,
            // G3: Norte
            "AC": 3,
            "AP": 3,
            "AM": 3,
            "RO": 3,
            // G4: RJ, RR
            "RJ": 4,
            "RR": 4
        },
        bdl: {
            // G1: DF
            "DF": 1,
            // G2: Geral
            "AL": 2,
            "BA": 2,
            "CE": 2,
            "ES": 2,
            "GO": 2,
            "MA": 2,
            "MT": 2,
            "MS": 2,
            "MG": 2,
            "PB": 2,
            "PR": 2,
            "PE": 2,
            "PI": 2,
            "RN": 2,
            "RS": 2,
            "SC": 2,
            "SP": 2,
            "SE": 2,
            // G3: PA, TO
            "PA": 3,
            "TO": 3,
            // G4: Norte (Sem RO)
            "AC": 4,
            "AP": 4,
            "AM": 4,
            // G5: RJ e RO (RO é mais caro no BDL Claro)
            "RJ": 5,
            "RO": 5,
            // G6: RR
            "RR": 6
        }
    },

    // Multiplicadores de Preço (Sobre a Base)
    multipliers: {
        ip: { 1: 0.916, 2: 1.00, 3: 1.083, 4: 1.65, 5: 1.833 },
        l2: { 1: 1.000, 2: 1.083, 3: 1.65, 4: 1.833 },
        bdl: { 1: 0.952, 2: 1.00, 3: 1.05, 4: 1.312, 5: 1.509, 6: 1.735 }
    },

    // Instalação Fixa BDL por Grupo
    bdlInstFixed: { 1: 550, 2: 550, 3: 750, 4: 750, 5: 850, 6: 850 },

    decay: {
        ip: {
            12: 1.00,
            24: 0.90, // 349.41/388.24
            36: 0.85,
            48: 0.803,
            60: 0.758
        },
        l2: {
            12: 1.00,
            24: 0.90,
            36: 0.85,
            60: 0.81 // 314.51/388.28 (Aprox 19% desconto)
        },
        bdl: {
            12: 1.00,
            24: 0.952,
            36: 0.907
        }
    }
};

(function gerarClaro() {
    const allUfs = Object.keys(UF_GROUPS);

    allUfs.forEach(uf => {
        VELOCIDADES_DISPONIVEIS.forEach(v => {

            // --- 1. IP DEDICADO ---
            let gIp = CLARO_RULES.groups.ip[uf] || 2;
            let mIp = CLARO_RULES.multipliers.ip[gIp];
            let baseIp = CLARO_DATA.prices.ip[v] || CLARO_DATA.prices.ip[10];
            let baseInstIp = CLARO_DATA.inst_base.ip[v] || CLARO_DATA.inst_base.ip[10];

            if (baseIp) {
                let cleanM = baseIp * mIp;
                let cleanI = baseInstIp * mIp; // Multiplicador afeta instalação IP

                [12, 24, 36, 48, 60].forEach(d => {
                    let fator = CLARO_RULES.decay.ip[d] || 1.0;
                    addEntry('Claro', 'IP DEDICADO', uf, d, v,
                        cleanM * fator, (cleanM * fator) * CLARO_RULES.taxFactor,
                        cleanI, cleanI * CLARO_RULES.taxFactor
                    );
                });
            }

            // --- 2. L2 MPLS ---
            let gL2 = CLARO_RULES.groups.l2[uf] || 1;
            let mL2 = CLARO_RULES.multipliers.l2[gL2];
            let baseL2 = CLARO_DATA.prices.l2[v] || CLARO_DATA.prices.l2[10];
            let baseInstL2 = CLARO_DATA.inst_base.l2[v] || CLARO_DATA.inst_base.l2[10];

            if (baseL2) {
                let cleanM = baseL2 * mL2;
                let cleanI = baseInstL2 * mL2;

                [12, 24, 36, 60].forEach(d => {
                    let fator = CLARO_RULES.decay.l2[d] || 1.0;
                    addEntry('Claro', 'L2-MPLS', uf, d, v,
                        cleanM * fator, (cleanM * fator) * CLARO_RULES.taxFactor,
                        cleanI, cleanI * CLARO_RULES.taxFactor
                    );
                });
            }

            // --- 3. BANDA LARGA ---
            let gBdl = CLARO_RULES.groups.bdl[uf] || 2;
            let mBdl = CLARO_RULES.multipliers.bdl[gBdl];
            let baseBdl = CLARO_DATA.prices.bdl[v] || CLARO_DATA.prices.bdl[10];

            if (baseBdl) {
                let cleanM = baseBdl * mBdl;
                let cleanI = CLARO_RULES.bdlInstFixed[gBdl]; // Instalação fixa por grupo

                [12, 24, 36].forEach(d => {
                    let fator = CLARO_RULES.decay.bdl[d] || 1.0;
                    addEntry('Claro', 'BANDA LARGA', uf, d, v,
                        cleanM * fator, (cleanM * fator) * CLARO_RULES.taxFactor,
                        cleanI, cleanI * CLARO_RULES.taxFactor
                    );
                });
            }
        });
    });
    console.log("Ofertas Claro Carregadas.");
})();