// lpu_geral.js - BASEADA NO CSV "geral.xlsx"

const GERAL_DATA = {
    prices: {
        // IP e L2 são idênticos no CSV Geral
        ip: {
            4: 346.50,
            10: 346.50,
            20: 450.45,
            30: 658.35,
            40: 831.60,
            50: 1039.50,
            100: 1386.00,
            200: 2999.99,
            500: 3599.99,
            1000: 5999.99
        },
        l2: {
            4: 346.50,
            10: 346.50,
            20: 450.45,
            30: 658.35,
            40: 831.60,
            50: 1039.50,
            100: 1386.00,
            200: 2999.99,
            500: 3599.99,
            1000: 5999.99
        },
        bdl: {
            4: 208.95,
            10: 208.95,
            20: 208.95,
            50: 208.95,
            100: 208.95,
            200: 208.95,
            300: 246.36,
            500: 359.72,
            1000: 514.40
        }
    },
    inst: { ip: 1500, l2: 1500, bdl: 550 }
};

const GERAL_RULES = {
    taxFactor: 1.336, // ~33.6%
    groups: CIRION_RULES.groups, // Mesma divisão geográfica da Cirion (G1..G4)
    groupMultipliers: {
        ip: { 1: 1.0, 2: 1.08, 3: 1.65, 4: 1.83 }, // Multiplicadores mais comportados que Cirion
        l2: { 1: 1.0, 2: 1.08, 3: 1.65, 4: 1.83 },
        bdl: { 1: 1.0, 2: 1.08, 3: 1.40, 4: 1.71 }
    },
    decay: {
        // Geral segue decaimento conservador
        padrao: { 12: 1.00, 24: 0.952, 36: 0.904, 60: 0.860 },
        bdl: { 12: 1.00, 24: 0.952, 36: 0.904 }
    }
};

(function gerarGeral() {
    for (const [uf, gId] of Object.entries(GERAL_RULES.groups)) {
        VELOCIDADES_DISPONIVEIS.forEach(v => {
            const processProduct = (prodName, tableKey, decayKey) => {
                let basePrice = GERAL_DATA.prices[tableKey][v] || GERAL_DATA.prices[tableKey][10];
                let multi = GERAL_RULES.groupMultipliers[tableKey][gId];

                if (basePrice) {
                    const clean = basePrice * multi;
                    const inst = GERAL_DATA.inst[tableKey];
                    const prazos = (decayKey === 'bdl') ? [12, 24, 36] : [12, 24, 36, 60];

                    prazos.forEach(d => {
                        const fator = GERAL_RULES.decay[decayKey][d] || 1.0;
                        addEntry('Geral', prodName, uf, d, v, clean * fator, (clean * fator) * GERAL_RULES.taxFactor, inst, inst * GERAL_RULES.taxFactor);
                    });
                }
            };
            processProduct('IP DEDICADO', 'ip', 'padrao');
            processProduct('L2-MPLS', 'l2', 'padrao');
            processProduct('BANDA LARGA', 'bdl', 'bdl');
        });
    }
})();