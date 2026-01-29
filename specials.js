// specials.js
// ATUALIZADO: Novas Regras de Negócio
// As regras de cálculo complexas estão centralizadas no script.js.
// Este arquivo serve para gerar os checkboxes na interface.

window.SPECIALS_DB = [
    // --- SITUAÇÕES DE LOCALIZAÇÃO ---
    {
        id: 'fora_urbana',
        nome: 'Fora da Zona Urbana (x1.2)',
        tipo: 'simple', // Lógica tratada no script.js
        desc: 'Afastado do centro'
    },
    {
        id: 'cid_peq',
        nome: 'Cidade Pequena (x1.4)',
        tipo: 'simple',
        desc: 'Menos de 30k hab'
    },
    {
        id: 'favela',
        nome: 'Área de Risco / Favela / Subt.',
        tipo: 'simple',
        desc: 'Risco + Adicionais Fixos'
    },

    // --- PARCEIROS / PROVEDORES ---
    {
        id: 'prov_rtm',
        nome: 'Provedores (RTM/Avato/Tecpac)',
        tipo: 'simple', // x1.2
        desc: 'Parceiros Específicos'
    },

    // --- PRODUTOS ADICIONAIS ---
    {
        id: 'radio',
        nome: 'Backup Rádio (+Inst)',
        tipo: 'simple',
        desc: 'Instalação + 6k'
    },
    {
        id: 'ips',
        nome: 'IPs Fixos',
        tipo: 'input_qtd', // Input numérico
        input: true,
        desc: 'Calculadora de IPs'
    }
];