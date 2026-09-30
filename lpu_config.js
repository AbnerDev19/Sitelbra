// lpu_config.js - ATUALIZADO
window.LPU_DB = [];

window.VELOCIDADES_DISPONIVEIS = [4, 5, 10, 20, 30, 40, 50, 100, 200, 300, 400, 500, 1000];

window.addEntry = function(operadora, produto, uf, prazo, velocidade, mClean, mFull, iClean, iFull) {
    window.LPU_DB.push({
        o: operadora,
        p: produto,
        u: uf,
        d: parseInt(prazo),
        s: parseInt(velocidade),
        // 4 casas para não perder precisão nos multiplicadores dos valores especiais
        m: {
            c: parseFloat(mClean.toFixed(4)),
            f: parseFloat(mFull.toFixed(4))
        },
        i: {
            c: parseFloat(iClean.toFixed(4)),
            f: parseFloat(iFull.toFixed(4))
        }
    });
};

// Carrega tabelas geradas direto das planilhas LPU (valores exatos, sem decaimento aproximado).
// tables[produto] = { ufg: {UF: grupo}, d: { prazo: { grupo: { velocidade: [mS, iS, mC, iC] } } } }
window.loadLpuTables = function(operadora, tables) {
    Object.keys(tables).forEach(produto => {
        const t = tables[produto];
        Object.keys(UF_GROUPS).forEach(uf => {
            const g = t.ufg[uf];
            if (!g) return;
            Object.keys(t.d).forEach(prazo => {
                const porVel = t.d[prazo][g];
                if (!porVel) return;
                Object.keys(porVel).forEach(vel => {
                    const [mS, iS, mC, iC] = porVel[vel];
                    window.addEntry(operadora, produto, uf, prazo, vel, mS, mC, iS, iC);
                });
            });
        });
    });
    console.log('Ofertas ' + operadora + ' carregadas (valores da planilha).');
};

// PADRONIZAÇÃO: 1: DF | 2: Geral | 3: Norte/PA/TO | 4: RJ/RR (Críticos)
window.UF_GROUPS = {
    "DF": 1,
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
    "PA": 3,
    "TO": 3,
    "AC": 3,
    "AP": 3,
    "AM": 3,
    "RO": 3,
    "RJ": 4,
    "RR": 4
};