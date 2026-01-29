// specials.js
// CONFIGURAÇÃO DOS PROJETOS ESPECIAIS
// mul: Multiplicador (ex: 1.2 = +20%)
// add_m: Valor fixo mensal a somar
// add_i: Valor fixo instalação a somar
// input: Se true, pede um valor/quantidade ao usuário

window.SPECIALS_DB = [
    // --- MULTIPLICADORES DE RISCO / LOCAL ---
    {
        id: 'favela',
        nome: 'Área de Risco / Favela (x2)',
        tipo: 'mul',
        mul: 2.0,
        desc: 'Rede em área de risco'
    },
    {
        id: 'cid_peq',
        nome: 'Cidade Pequena (<30k hab)',
        tipo: 'mul',
        mul: 1.1,
        desc: 'Logística complexa'
    },

    // --- TÉCNICO / SLA ---
    {
        id: 'sla',
        nome: 'SLA Estendido (>99.4%)',
        tipo: 'mul',
        mul: 1.2,
        desc: 'Alta disponibilidade'
    },
    {
        id: 'dupla',
        nome: 'Dupla Abordagem (x2)',
        tipo: 'mul',
        mul: 2.0,
        desc: 'Redundância total'
    },

    // --- ADICIONAIS FIXOS ---
    {
        id: 'radio',
        nome: 'Backup Rádio',
        tipo: 'add_m',
        add_m: 400.0,
        add_i: 1000.0,
        desc: 'Link Rádio Homologado'
    },
    {
        id: 'comodato',
        nome: 'Equipamento (Comodato)',
        tipo: 'add_m',
        add_m: 150.0,
        desc: 'Aluguel Router'
    },
    {
        id: 'mtu',
        nome: 'BDL - MTU 1500',
        tipo: 'add_m',
        add_m: 0,
        desc: 'Configuração Jumbo'
    },

    // --- COM INPUT (QUANTIDADE) ---
    {
        id: 'ips',
        nome: 'IPs Fixos (R$ 50/un)',
        tipo: 'input_qtd',
        unit_price: 50.0,
        input: true,
        desc: 'Quantidade de IPs'
    },

    // --- OUTROS ---
    {
        id: 'fibra500',
        nome: 'Fibra < 500m',
        tipo: 'mul',
        mul: 1.0,
        desc: 'Facilidade técnica'
    },
    {
        id: 'prov',
        nome: 'RTM/Avato/Provedores',
        tipo: 'mul',
        mul: 1.0,
        desc: 'Parceiros específicos'
    }
];