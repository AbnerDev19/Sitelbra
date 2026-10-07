// lpu_config.js - ATUALIZADO
window.LPU_DB = [];

// 2000 a 20000 (2 a 20 Gbps): LPU acima de 2 Gbps, ver lpu_acima2g.js
window.VELOCIDADES_DISPONIVEIS = [4, 5, 10, 20, 30, 40, 50, 100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 6000, 10000, 20000];

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

// LPU acima de 2 Gbps (lpu_acima2g.js chama esta função depois de carregar as outras tabelas).
// A planilha é única: vale igual para TODAS as operadoras, só IP Dedicado e L2-MPLS, só 24 meses.
// Ela não traz instalação (semInst) e já é preço de tabela final: a faixa de volume do pricing.js não se aplica (semFaixa).
window.loadLpuAcima2G = function() {
    const t = window.LPU_ACIMA_2G;
    if (!t) return;
    const ops = [...new Set(window.LPU_DB.map(i => i.o))];
    let n = 0;
    ops.forEach(op => Object.keys(t).forEach(prod => Object.keys(t[prod]).forEach(uf => Object.keys(t[prod][uf]).forEach(vel => {
        const [mS, mC] = t[prod][uf][vel];
        window.LPU_DB.push({ o: op, p: prod, u: uf, d: 24, s: parseInt(vel), m: { c: mS, f: mC }, i: { c: 0, f: 0 }, semInst: true, semFaixa: true });
        n++;
    }))));
    console.log('LPU acima de 2 Gbps carregada: ' + n + ' ofertas (' + ops.length + ' operadoras).');
};
