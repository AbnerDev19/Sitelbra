// lpu_config.js
// Configurações Globais, Regras de Negócio e Inicialização do Banco

// Inicializa o Banco Global
window.LPU_DB = [];

// Lista Mestra de Velocidades (Garante que todas apareçam)
const VELOCIDADES_DISPONIVEIS = [4, 5, 10, 20, 30, 40, 50, 100, 200, 300, 400, 500, 1000];

// Grupos de Estados
const UF_GROUPS = {
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
    "AC": 4,
    "AP": 4,
    "AM": 4,
    "RO": 4,
    "RJ": 5,
    "RR": 6
};

// ==========================================================
// REGRAS DE DECAIMENTO (Prazos) - AJUSTE AQUI SE NECESSÁRIO
// ==========================================================
// O valor base (12 meses) é mantido (1.00). 
// Se o desconto estiver errado, altere os decimais abaixo.
const RULES = {
    prazos: {
        12: 1.00,
        24: 1.00, // Ex: 10% de desconto
        36: 1.00, // Ex: 20% de desconto
        48: 1.00,
        60: 1.00
    },
    instalacao: {
        12: 1.0,
        24: 1.0,
        36: 1.0,
        48: 1.0,
        60: 1.0
    }
};

// Função Auxiliar para Adicionar Ofertas ao Banco
function addEntry(op, prod, uf, duracao, vel, mc, mf, ic, _if) {
    if (!mf) mf = mc * 1.15; // Fallback Full
    if (!_if) _if = ic * 1.15; // Fallback Inst Full

    const fM = RULES.prazos[duracao];
    const fI = RULES.instalacao[duracao];

    window.LPU_DB.push({
        o: op,
        p: prod,
        u: uf,
        d: duracao,
        s: vel,
        m: { c: mc * fM, f: mf * fM },
        i: { c: ic * fI, f: _if * fI }
    });
}

// Função Auxiliar para Processar todos os prazos de uma vez
function processarPrazos(op, prod, uf, vel, mc, mf, ic, _if) {
    [12, 24, 36, 48, 60].forEach(d => {
        addEntry(op, prod, uf, d, vel, mc, mf, ic, _if);
    });
}