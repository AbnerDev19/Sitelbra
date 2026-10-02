// specials.js
// Opções de cotação exibidas em "Análise avançada".
// As REGRAS DE CÁLCULO continuam em pricing.js (espelho das abas "Projeto Especial" das planilhas LPU).
// Aqui ficam apenas rótulo, descrição (tooltip) e o grupo em que cada opção aparece na tela.

// Adicionais de local (ids dos checkboxes: check<Id>)
window.LOCAL_DB = [
    { id: 'checkShopping',   key: 'shopping',   nome: 'Shopping Center',     tag: 'x2',            desc: 'Multiplica mensalidade e instalação por 2.' },
    { id: 'checkAeroporto',  key: 'aeroporto',  nome: 'Aeroporto',           tag: '+2x mensal',    desc: 'Soma 2 vezes a mensalidade da LPU, na mensalidade e na instalação.' },
    { id: 'checkIndustria',  key: 'industria',  nome: 'Indústria / Galpão',  tag: 'x1,2 + inst. 3.500', desc: 'Mensalidade x1,2 e instalação +R$ 3.500.' },
    { id: 'checkDatacenter', key: 'datacenter', nome: 'Datacenter',          tag: '+R$ 1.200',     desc: 'Soma R$ 1.200 na mensalidade.' }
];

// Projetos especiais e condições do circuito (ids dos checkboxes: sp_<id>)
window.SPECIALS_DB = [
    // --- SITUAÇÕES DE LOCALIZAÇÃO ---
    { id: 'fora_urbana', grupo: 'local',    nome: 'Fora da Zona Urbana', tag: 'x1,2', tipo: 'simple', desc: 'Mensal e instalação x1,2' },
    { id: 'cid_peq',     grupo: 'local',    nome: 'Cidade Pequena',      tag: 'x1,4', tipo: 'simple', desc: 'Menos de 30 mil habitantes. Mensal e instalação x1,4' },
    { id: 'favela',      grupo: 'local',    nome: 'Favela / Fibra Pública Subterrânea', tag: '+1.000 / +2.000', tipo: 'simple', desc: 'Mensal +1.000 | Inst. +2.000' },
    { id: 'fibra_curta', grupo: 'local',    nome: 'Fibra a menos de 500 m', tag: '', tipo: 'simple', desc: 'Reduz o multiplicador de distância e divide por 2 a instalação rural' },

    // --- PARCEIROS / PROVEDORES ---
    { id: 'prov_rtm',    grupo: 'circuito', nome: 'Provedores (RTM/Avato/Tecpac)', tag: 'x1,2', tipo: 'simple', desc: 'Mensal e instalação x1,2' },

    // --- CONDIÇÕES DO CIRCUITO ---
    { id: 'sla',         grupo: 'circuito', nome: 'SLA maior',           tag: 'x1,4', tipo: 'simple', desc: '> 99,4% (IP/L2) ou > 99,0% (BDL). Mensal x1,4' },
    { id: 'dupla',       grupo: 'circuito', nome: 'Dupla Abordagem / Ponta B não concentradora', tag: 'x1,6', tipo: 'simple', desc: 'Mensal x1,6' },
    { id: 'radio',       grupo: 'circuito', nome: 'Rádio Homologado',    tag: 'x1,2 + inst. 7.500', tipo: 'simple', desc: 'Mensal x1,2 e instalação +R$ 7.500. Não se aplica à Cirion (sempre homologado)' },
    { id: 'comodato',    grupo: 'circuito', nome: 'Equipamento em Comodato', tag: '+75 / +750', tipo: 'simple', desc: 'Mensal +75 | Inst. +750' },
    { id: 'mtu',         grupo: 'circuito', nome: 'BDL - MTU 1500',      tag: '', tipo: 'simple', desc: 'Regra de MTU do BDL. Não se aplica à Cirion' },

    // --- PRODUTOS ADICIONAIS ---
    { id: 'ips',         grupo: 'ips',      nome: 'IPs Fixos',           tag: '', tipo: 'input_qtd', input: true, desc: 'Quantidade de IPs: /32 ou /31 = 1 | /30 = 4 | /29 = 8' }
];
