// specials.js
// Banco de dados de Projetos Especiais (Baseado no seu CSV)
// Formato: { id: "codigo", nome: "Nome do Item", tipo: "mensal" ou "instalacao", valor: 100.00 }

const SPECIALS_DB = [
    // --- EXEMPLOS (Substitua pelos dados da sua planilha 'Projeto Especial - Abner') ---

    // ITENS MENSAIS (Recorrentes)
    { id: "ip_fixo", nome: "IP Fixo Adicional (/32)", tipo: "mensal", valor: 50.00 },
    { id: "bloco_29", nome: "Bloco de IPs /29", tipo: "mensal", valor: 250.00 },
    { id: "router_basic", nome: "Router Gerenciado (Básico)", tipo: "mensal", valor: 150.00 },
    { id: "router_adv", nome: "Router Gerenciado (Avançado)", tipo: "mensal", valor: 400.00 },
    { id: "sla_4h", nome: "SLA Premium (4h)", tipo: "mensal", valor: 300.00 },

    // ITENS DE INSTALAÇÃO (Pontuais / Obras)
    { id: "obra_civil", nome: "Infra/Obra Civil (Verificar Metragem)", tipo: "instalacao", valor: 0.00, input: true }, // input: true permite digitar valor
    { id: "taxa_ativacao", nome: "Taxa de Ativação Expressa", tipo: "instalacao", valor: 1500.00 },
    { id: "assistida", nome: "Instalação Assistida (TI Local)", tipo: "instalacao", valor: 500.00 }
];

window.SPECIALS_DB = SPECIALS_DB;