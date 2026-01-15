// lpu_cirion.js
// BASEADO NOS ARQUIVOS CSV "cirion.xlsx"
// Destaques: Impostos diferentes para Mensal/Instal e Grupos com multiplicadores agressivos.

const CIRION_DATA = {
    // 1. PREÇOS BASE (Referência: GRUPO 1 - SP/DF/MG/etc - 12 Meses/Clean)
    prices: {
        ip: {
            4: 298.50,
            5: 298.50,
            10: 298.50,
            20: 381.30,
            30: 495.65,
            40: 672.70,
            50: 915.50,
            100: 1231.10,
            200: 1506.20,
            300: 1834.60,
            400: 2208.35,
            500: 2674.40,
            1000: 4072.80
        },
        l2: {
            4: 294.04,
            5: 294.04,
            10: 294.04,
            20: 398.00,
            30: 590.17,
            40: 758.19,
            50: 966.11,
            100: 1312.65,
            200: 1480.67,
            300: 1584.63,
            400: 1919.36,
            500: 2573.84,
            1000: 3689.42
        },
        bdl: {
            4: 171.53,
            5: 171.53,
            10: 171.53,
            20: 171.53,
            30: 171.53,
            40: 171.53,
            50: 171.53,
            100: 171.53,
            200: 171.53,
            300: 234.21,
            400: 255.11,
            500: 276.00,
            1000: 517.70
        }
    },

    // 2. INSTALAÇÃO BASE POR GRUPO (Valores Clean extraídos do CSV)
    // A Cirion varia muito a instalação dependendo da região.
    inst_by_group: {
        ip: { 1: 3450, 2: 3960, 3: 4200, 4: 4830 },
        l2: { 1: 3450, 2: 3960, 3: 4200, 4: 4830 }, // G4 no L2 salta para 4830
        bdl: { 1: 1924, 2: 2244, 3: 2244, 4: 2500 }
    }
};

const CIRION_RULES = {
    // Fatores de Imposto (Calculados das razões C/Imp vs S/Imp do CSV)
    taxMonthly: 1.336, // ~33.6% (Ex: 398.80 / 298.50)
    taxInst: 1.166, // ~16.6% (Ex: 4023.32 / 3450.00) - Diferente da mensalidade!

    // Mapeamento de Estados por Grupo
    groups: {
        // G1: Base (SP, DF, MG, NE, Sul...)
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
        // G3: Norte (AC, AP, AM, RO)
        "AC": 3,
        "AP": 3,
        "AM": 3,
        "RO": 3,
        // G4: Zonas Críticas (RJ, RR)
        "RJ": 4,
        "RR": 4
    },

    // Multiplicadores de Mensalidade por Grupo (Baseado em 4Mbps G1)
    multipliers: {
        ip: { 1: 1.00, 2: 1.075, 3: 1.766, 4: 23.3 }, // G4 IP é muito caro (Baseado em histórico/lógica de zona crítica)
        l2: { 1: 1.00, 2: 1.075, 3: 1.690, 4: 7.19 }, // G4 L2 (2115.33 / 294.04 = ~7.2x)
        bdl: { 1: 1.00, 2: 1.047, 3: 1.550, 4: 1.96 }
    },

    decay: {
        ip: {
            12: 1.00,
            24: 0.833, // Cai muito em 24m (248.75/298.50)
            36: 0.791,
            60: 0.772
        },
        l2: {
            12: 1.00,
            24: 0.952, // Cai pouco (280.04/294.04)
            36: 0.904,
            60: 0.860
        },
        bdl: {
            12: 1.00,
            24: 0.952, // Igual L2
            36: 0.904
        }
    }
};

(function gerarCirion() {
    const allUfs = Object.keys(UF_GROUPS);

    allUfs.forEach(uf => {
        let gId = CIRION_RULES.groups[uf] || 1;

        VELOCIDADES_DISPONIVEIS.forEach(v => {
            const processProduct = (prodName, tableKey, decayKey) => {
                let basePrice = CIRION_DATA.prices[tableKey][v] || CIRION_DATA.prices[tableKey][10];
                let multi = CIRION_RULES.multipliers[tableKey][gId];

                // Instalação Base do Grupo
                let instClean = CIRION_DATA.inst_by_group[tableKey][gId] || CIRION_DATA.inst_by_group[tableKey][1];

                // Ajuste de Instalação para altas velocidades (Acima de 200Mb costuma ser mais caro)
                // O CSV mostrou base 4Mb, mas mantemos lógica conservadora para altas capacidades se necessário.
                // Aqui usaremos o valor do grupo extraído.

                if (basePrice) {
                    const cleanM = basePrice * multi;

                    // Prazos disponíveis (Cirion geralmente pula 48 meses nas planilhas)
                    const prazos = (decayKey === 'bdl') ? [12, 24, 36] : [12, 24, 36, 60];

                    prazos.forEach(d => {
                        const fator = CIRION_RULES.decay[decayKey][d] || 1.0;

                        // Cálculo Mensalidade (Taxa ~33.6%)
                        const mClean = cleanM * fator;
                        const mFull = mClean * CIRION_RULES.taxMonthly;

                        // Cálculo Instalação (Taxa ~16.6% - Diferente da mensalidade!)
                        const iClean = instClean;
                        const iFull = iClean * CIRION_RULES.taxInst;

                        addEntry('Cirion', prodName, uf, d, v, mClean, mFull, iClean, iFull);
                    });
                }
            };

            processProduct('IP DEDICADO', 'ip', 'ip');
            processProduct('L2-MPLS', 'l2', 'l2');
            processProduct('BANDA LARGA', 'bdl', 'bdl');
        });
    });
    console.log("Ofertas Cirion Carregadas (Impostos e Grupos Ajustados).");
})();