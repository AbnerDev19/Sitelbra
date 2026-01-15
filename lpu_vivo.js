// lpu_vivo.js - BASEADA NO CSV "vivo.xlsx"

const VIVO_DATA = {
    prices: {
        // Vivo IP e L2 usam a mesma base da Claro/Oi G2
        ip: { 4: 388.24, 10: 388.24, 20: 469.41, 50: 1031.38, 100: 1340.79, 200: 1609.03, 500: 2780.79, 1000: 4198.83 },
        l2: { 4: 420.63, 10: 420.63, 20: 546.82, 50: 1261.90, 100: 1682.54, 200: 1892.85, 500: 3238.88, 1000: 4626.98 },
        // Vivo BDL tem valores próprios no CSV
        bdl: { 4: 284.11, 10: 284.11, 20: 284.11, 50: 284.11, 100: 284.11, 200: 284.11, 300: 301.10, 500: 415.48, 1000: 540.12 }
    },
    inst: { ip: 1749, l2: 1800, bdl: 641 }
};

const VIVO_RULES = {
    taxFactor: 1.0379,
    groups: CLARO_RULES.groups, // Usa mesmo agrupamento geográfico
    groupMultipliers: CLARO_RULES.groupMultipliers, // Usa mesmos multiplicadores
    decay: {
        padrao: { 12: 1.00, 24: 0.90, 36: 0.85, 48: 0.83, 60: 0.81 },
        bdl: { 12: 1.00, 24: 0.917, 36: 0.876 } // Decaimento específico Vivo BDL
    }
};

(function gerarVivo() {
    for (const [uf, gId] of Object.entries(VIVO_RULES.groups)) {
        VELOCIDADES_DISPONIVEIS.forEach(v => {
            const processProduct = (prodName, tableKey, decayKey) => {
                let basePrice = VIVO_DATA.prices[tableKey][v] || VIVO_DATA.prices[tableKey][10];
                let multi = VIVO_RULES.groupMultipliers[tableKey][gId];
                if (tableKey === 'bdl' && uf === 'RR') multi = 1.73;

                if (basePrice && multi) {
                    const clean = basePrice * multi;
                    const inst = VIVO_DATA.inst[tableKey];
                    const prazos = (decayKey === 'bdl') ? [12, 24, 36] : [12, 24, 36, 48, 60];

                    prazos.forEach(d => {
                        const fator = VIVO_RULES.decay[decayKey][d] || 1.0;
                        addEntry('Vivo', prodName, uf, d, v, clean * fator, (clean * fator) * VIVO_RULES.taxFactor, inst, inst * VIVO_RULES.taxFactor);
                    });
                }
            };
            processProduct('IP DEDICADO', 'ip', 'padrao');
            processProduct('L2-MPLS', 'l2', 'padrao');
            processProduct('BANDA LARGA', 'bdl', 'bdl');
        });
    }
})();