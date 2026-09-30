// specials.js
// Valores especiais (checkboxes da barra lateral).
// As regras de cálculo ficam em pricing.js (espelho das abas "Projeto Especial" das planilhas LPU).

window.SPECIALS_DB = [
    // --- SITUAÇÕES DE LOCALIZAÇÃO ---
    { id: 'fora_urbana', nome: 'Fora da Zona Urbana (x1.2)', tipo: 'simple', desc: 'Mensal e instalação x1.2' },
    { id: 'cid_peq', nome: 'Cidade Pequena (x1.4)', tipo: 'simple', desc: 'Menos de 30 mil habitantes' },
    { id: 'favela', nome: 'Favela / Fibra Pública Subterrânea', tipo: 'simple', desc: 'Mensal +1.000 | Inst. +2.000' },
    { id: 'fibra_curta', nome: 'Fibra a menos de 500 m', tipo: 'simple', desc: 'Reduz multiplicador de distância e metade da inst. rural' },

    // --- PARCEIROS / PROVEDORES ---
    { id: 'prov_rtm', nome: 'Provedores (RTM/Avato/Tecpac) (x1.2)', tipo: 'simple', desc: 'Mensal e instalação x1.2' },

    // --- CONDIÇÕES DO CIRCUITO ---
    { id: 'sla', nome: 'SLA maior (x1.4)', tipo: 'simple', desc: '> 99,4% (IP/L2) ou > 99,0% (BDL)' },
    { id: 'dupla', nome: 'Dupla Abordagem / Ponta B não concentradora (x1.6)', tipo: 'simple', desc: 'Mensal x1.6' },
    { id: 'radio', nome: 'Rádio Homologado (x1.2 + Inst. 7.500)', tipo: 'simple', desc: 'Não se aplica à Cirion (sempre homologado)' },
    { id: 'comodato', nome: 'Equipamento em Comodato', tipo: 'simple', desc: 'Mensal +75 | Inst. +750' },
    { id: 'mtu', nome: 'BDL - MTU 1500', tipo: 'simple', desc: 'Mensal +200 | Inst. +100 (não se aplica à Cirion)' },

    // --- PRODUTOS ADICIONAIS ---
    { id: 'ips', nome: 'IPs Fixos (quantidade de IPs)', tipo: 'input_qtd', input: true, desc: '/32 ou /31 = 1 | /30 = 4 | /29 = 8' }
];
