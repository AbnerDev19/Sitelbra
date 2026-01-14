/**
 * SITELBRA WHOLESALE CALCULATOR
 * Base de Dados Simplificada das LPUs (Oi, Claro, Cirion, Geral)
 * Lógica baseada no Playbook.
 */

// Grupos de Estados
const groups = {
    oi: {
        g1: ['AL','BA','CE','DF','ES','GO','MA','MT','MS','MG','PB','PR','PE','PI','RN','RS','SC','SP','SE'],
        g2: ['PA','TO'],
        g3: ['AC','AP','AM','RO'],
        g4: ['RJ','RR']
    },
    claro: {
        g1: ['AL','BA','CE','DF','ES','GO','MA','MT','MS','MG','PB','PR','PE','PI','RN','RS','SC','SP','SE'],
        g2: ['PA','TO'],
        g3: ['AC','AP','AM','RO'],
        g4: ['RJ','RR']
    },
    cirion: {
        g1: ['AL','BA','CE','DF','ES','GO','MA','MT','MS','MG','PB','PR','PE','PI','RN','RS','SC','SP','SE'],
        g2: ['PA','TO'],
        g3: ['AC','AP','AM','RO'],
        g4: ['RJ','RR']
    },
    geral: {
        g1: ['AL','BA','CE','DF','ES','GO','MA','MT','MS','MG','PB','PR','PE','PI','RN','RS','SC','SP','SE'],
        g2: ['PA','TO'],
        g3: ['AC','AP','AM','RO'],
        g4: ['RJ','RR']
    }
};

// PREÇOS BASE (S/ IMPOSTOS) EXTRAÍDOS DOS CSVS
// Formato: Operadora > Produto > Grupo > Velocidade
const lpuPrices = {
    oi: {
        L2: {
            g1: {4: 407.69, 5: 407.69, 10: 407.69, 20: 529.99, 50: 700.00, 100: 950.00},
            g2: {4: 441.66, 5: 441.66, 10: 441.66, 20: 574.16, 50: 750.00, 100: 1000.00},
            g3: {4: 672.69, 5: 672.69, 10: 672.69, 20: 874.49, 50: 1100.00, 100: 1400.00},
            g4: {4: 775.75, 5: 775.75, 10: 775.75, 20: 971.66, 50: 1200.00, 100: 1600.00}
        },
        IP: {
            g1: {4: 355.88, 5: 355.88, 10: 355.88, 20: 430.29, 50: 650.00, 100: 900.00},
            g2: {4: 388.23, 5: 388.23, 10: 388.23, 20: 469.41, 50: 700.00, 100: 950.00},
            g3: {4: 420.58, 5: 420.58, 10: 420.58, 20: 508.53, 50: 800.00, 100: 1100.00},
            g4: {4: 640.58, 5: 640.58, 10: 640.58, 20: 774.53, 50: 1000.00, 100: 1300.00}
        },
        BDL: {
            g1: {4: 272.62, 5: 272.62, 10: 272.62, 20: 272.62, 50: 272.62, 100: 300.00},
            g2: {4: 286.26, 5: 286.26, 10: 286.26, 20: 286.26, 50: 286.26, 100: 320.00}
        }
    },
    claro: {
        L2: { // Base S/ Impostos
            g1: {4: 388.28, 5: 388.28, 10: 388.28, 20: 504.76, 50: 680.00, 100: 920.00},
            g2: {4: 420.63, 5: 420.63, 10: 420.63, 20: 546.82, 50: 720.00, 100: 980.00},
            g3: {4: 640.65, 5: 640.65, 10: 640.65, 20: 832.85, 50: 1050.00, 100: 1350.00},
            g4: {4: 711.84, 5: 711.84, 10: 711.84, 20: 925.39, 50: 1150.00, 100: 1550.00}
        },
        IP: {
            g1: {4: 355.88, 5: 355.88, 10: 355.88, 20: 430.29},
            g2: {4: 388.23, 5: 388.23, 10: 388.23, 20: 469.41}
        },
        BDL: {
            g1: {4: 272.62, 5: 272.62, 10: 272.62, 20: 272.62}
        }
    },
    cirion: {
        // Cirion tem preços diferentes
        L2: { 
            g1: {4: 294.03, 5: 294.03, 10: 294.03, 20: 397.99},
            g2: {4: 312.41, 5: 312.41, 10: 312.41, 20: 425.04}
        },
        IP: {
            g1: {4: 298.50, 5: 298.50, 10: 298.50, 20: 381.30}
        }
    },
    geral: {
        L2: {
            g1: {4: 346.50, 5: 346.50, 10: 346.50, 20: 450.45},
            g2: {4: 375.37, 5: 375.37, 10: 375.37, 20: 487.98}
        },
        IP: {
            g1: {4: 346.50, 5: 346.50, 10: 346.50, 20: 418.95}
        }
    }
};

const ufs = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", 
    "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const icmsMap = {
    'SP': 0.18, 'RJ': 0.20, 'MG': 0.18, 'RS': 0.17, 'PR': 0.18, 
    'SC': 0.17, 'DF': 0.18, 'GO': 0.17, 'BA': 0.18
};

// Inicialização
window.onload = function() {
    const ufSelect = document.getElementById('uf');
    ufs.forEach(uf => {
        const opt = document.createElement('option');
        opt.value = uf;
        opt.text = uf;
        ufSelect.add(opt);
    });
    updateForm();
};

function toggleRural() {
    const isRural = document.getElementById('checkRural').checked;
    const div = document.getElementById('ruralInput');
    if(isRural) div.classList.remove('hidden');
    else div.classList.add('hidden');
    calculate();
}

function updateForm() {
    const vel = document.getElementById('velocidade').value;
    const manualGroup = document.getElementById('manualPriceGroup');
    if(vel === 'special') manualGroup.classList.remove('hidden');
    else manualGroup.classList.add('hidden');
    calculate();
}

function getBaseInstalacao(operadora, grupo) {
    if(operadora === 'oi') return 2700.00;
    if(operadora === 'claro') {
        if(grupo === 'g1') return 1500.00;
        if(grupo === 'g2') return 1800.00;
        return 2100.00;
    }
    if(operadora === 'cirion') return 3450.00;
    if(operadora === 'geral') return 1500.00;
    return 1500.00;
}

function getIcmsRate(uf) {
    return icmsMap[uf] || 0.17;
}

function calculate() {
    const operadora = document.getElementById('operadora').value;
    const produto = document.getElementById('produto').value;
    const uf = document.getElementById('uf').value;
    const velocidade = document.getElementById('velocidade').value;
    
    // Identificar Grupo do Estado
    let grupo = 'g1';
    const opGroups = groups[operadora];
    if (opGroups.g2.includes(uf)) grupo = 'g2';
    if (opGroups.g3.includes(uf)) grupo = 'g3';
    if (opGroups.g4.includes(uf)) grupo = 'g4';

    // 1. Obter Preço Base (Mensal e Instalação)
    let baseMensal = 0;
    let baseInst = getBaseInstalacao(operadora, grupo);

    if (velocidade === 'special') {
        baseMensal = parseFloat(document.getElementById('manualBasePrice').value) || 0;
    } else {
        try {
            baseMensal = lpuPrices[operadora][produto][grupo][velocidade] || 0;
        } catch(e) {
            baseMensal = 0; 
        }
        // Fallback simples se não achar na lista simplificada
        if (baseMensal === 0 && velocidade !== 'special') {
             if(operadora === 'oi') baseMensal = 400; 
             else baseMensal = 350;
        }
    }

    // 2. Aplicar Modificadores do Playbook
    let multMensal = 1.0;
    let multInst = 1.0;
    let addMensal = 0;

    const isShopping = document.getElementById('checkShopping').checked;
    const isIndustria = document.getElementById('checkIndustria').checked;
    const isAeroporto = document.getElementById('checkAeroporto').checked;
    const isDatacenter = document.getElementById('checkDatacenter').checked;
    const isCidadePequena = document.getElementById('checkCidadePequena').checked;
    const isRural = document.getElementById('checkRural').checked;

    if (isShopping) { multMensal *= 2; multInst *= 2; }
    if (isAeroporto) { multMensal *= 3; multInst *= 3; }
    if (isDatacenter) { addMensal += 1200; }
    if (isIndustria) { multMensal *= 1.4; multInst *= 1.4; }
    if (isCidadePequena) { multMensal *= 1.4; multInst *= 1.4; }

    let valorInstalacaoFinalS = baseInst * multInst;
    
    // Cálculo Rural
    if (isRural) {
        const distancia = parseFloat(document.getElementById('distanciaRural').value) || 0;
        const ruralInstCalc = (distancia * 3.65) + 500;
        valorInstalacaoFinalS = ruralInstCalc; 
    }

    let valorMensalFinalS = (baseMensal * multMensal) + addMensal;

    // 3. Motor de Impostos (Gross Up)
    let valorInstalacaoC = 0;
    let valorMensalC = 0;
    const pisCofins = 0.0365;
    let divisor = 1;

    // Regra Oi e Cirion = DF (20%)
    if (operadora === 'oi' || operadora === 'cirion') {
        const icmsDF = 0.20;
        divisor = 1 - (icmsDF + pisCofins);
    } 
    // Regra Claro L2 = Estado
    else if (operadora === 'claro' && produto === 'L2') {
        const icmsEst = getIcmsRate(uf);
        divisor = 1 - (icmsEst + pisCofins);
    }
    else {
        // Geral / BDL Claro / IP Claro
        const icmsEst = getIcmsRate(uf);
        divisor = 1 - (icmsEst + pisCofins);
    }

    valorMensalC = valorMensalFinalS / divisor;
    
    if (isRural) {
         valorInstalacaoC = valorInstalacaoFinalS * 1.16618;
    } else {
         valorInstalacaoC = valorInstalacaoFinalS / divisor;
    }

    // 4. Renderização
    document.getElementById('dispMensS').innerText = formatMoeda(valorMensalFinalS);
    document.getElementById('dispMensC').innerText = formatMoeda(valorMensalC);
    document.getElementById('dispInstS').innerText = formatMoeda(valorInstalacaoFinalS);
    document.getElementById('dispInstC').innerText = formatMoeda(valorInstalacaoC);

    generateEmail(operadora, produto, velocidade, uf, valorInstalacaoC, valorMensalC, isRural);
}

function formatMoeda(val) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function generateEmail(operadora, produto, velocidade, uf, instC, mensC, isRural) {
    const prazo = isRural ? "90 dias" : "60 Dias";
    const nomeProduto = produto === 'BDL' ? "Banda Larga" : produto;
    const velTexto = velocidade === 'special' ? 'Sob consulta' : velocidade + ' Mbps';
    
    // Modelo solicitado pelo usuário
    const texto = `Olá, tudo bem?

Segue abaixo a cotação conforme solicitado. Nossa proposta possui validade de 30 dias.

Produto: ${operadora.toUpperCase()} - ${nomeProduto} - ${velTexto}
Valor mensal c/impostos: ${formatMoeda(mensC)}
Valor de instalação c/impostos: ${formatMoeda(instC)}
Prazo de instalação: ${prazo}
Prazo de Contrato: 24 Meses

Ficamos à disposição para quaisquer dúvidas ou ajustes necessários.

Atenciosamente,`;

    document.getElementById('emailOutput').value = texto;
}

function copyToClipboard() {
    const copyText = document.getElementById("emailOutput");
    copyText.select();
    copyText.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(copyText.value);
    alert("Cotação copiada com sucesso!");
}