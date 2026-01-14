document.addEventListener('DOMContentLoaded', () => {
    // Data
    const dateEl = document.getElementById('currentDate');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('pt-BR');

    // Inicialização
    populateDropdowns();
    renderSpecials();

    // Listeners Globais
    document.body.addEventListener('change', calculate);
    document.body.addEventListener('input', (e) => {
        if (e.target.type === 'number') calculate();
    });

    // Listener Específico para o Modo de Imposto
    const selImposto = document.getElementById('selImpostoMode');
    if (selImposto) selImposto.addEventListener('change', calculate);

    document.getElementById('btnCopy').addEventListener('click', copyEmail);

    // Toggle Rural
    const checkRural = document.getElementById('checkRural');
    if (checkRural) {
        checkRural.addEventListener('change', (e) => {
            const div = document.getElementById('ruralOptions');
            if (e.target.checked) div.classList.remove('hidden');
            else div.classList.add('hidden');
            calculate();
        });
    }
});

// --- RENDERIZAÇÃO DE ESPECIAIS (Mantida) ---
function renderSpecials() {
    const container = document.getElementById('specialsContainer');
    if (!container || typeof window.SPECIALS_DB === 'undefined') return;
    container.innerHTML = '';

    window.SPECIALS_DB.forEach(item => {
        const div = document.createElement('div');
        div.className = 'toggle-item';
        div.style.marginBottom = "8px";

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `sp_${item.id}`;
        checkbox.dataset.price = item.valor;
        checkbox.dataset.type = item.tipo;
        checkbox.dataset.name = item.nome;
        checkbox.dataset.hasInput = item.input || false;

        const label = document.createElement('span');
        label.className = 'toggle-label';
        if (item.input) {
            label.innerHTML = `${item.nome} <br><input type="number" id="val_${item.id}" class="input-text" style="width:100px; margin-top:5px; font-size:0.8rem;" placeholder="R$ valor">`;
        } else {
            label.innerText = `${item.nome} (+R$ ${item.valor})`;
        }

        const labelContainer = document.createElement('label');
        labelContainer.style.display = 'flex';
        labelContainer.style.alignItems = 'flex-start';
        labelContainer.style.gap = '10px';
        labelContainer.style.cursor = 'pointer';

        labelContainer.appendChild(checkbox);
        labelContainer.appendChild(label);
        div.appendChild(labelContainer);
        container.appendChild(div);
    });
}

// --- LÓGICA DE SELEÇÃO ---
function populateDropdowns() {
    if (typeof window.LPU_DB === 'undefined') return;
    const db = window.LPU_DB;
    fillSelect('selOperadora', [...new Set(db.map(i => i.o))].sort());
    fillSelect('selProduto', [...new Set(db.map(i => i.p))].sort());
    fillSelect('selUF', [...new Set(db.map(i => i.u))].sort());

    ['selOperadora', 'selProduto', 'selUF', 'selPrazo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateSpeeds);
    });
}

function fillSelect(id, values) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Selecione...</option>';
    sel.disabled = false;
    values.forEach(v => sel.add(new Option(v, v)));
    if (values.includes(current)) sel.value = current;
}

function updateSpeeds() {
    const op = document.getElementById('selOperadora').value;
    const prod = document.getElementById('selProduto').value;
    const uf = document.getElementById('selUF').value;
    const dur = parseInt(document.getElementById('selPrazo').value);
    const selSpeed = document.getElementById('selVelocidade');

    if (!selSpeed) return;
    selSpeed.innerHTML = '<option value="">Selecione...</option>';
    selSpeed.disabled = true;

    if (!op || !prod || !uf) return;

    const itens = window.LPU_DB.filter(i => i.o == op && i.p == prod && i.u == uf && i.d == dur);
    const speeds = [...new Set(itens.map(i => i.s))].sort((a, b) => a - b);

    if (speeds.length > 0) {
        selSpeed.disabled = false;
        speeds.forEach(s => {
            const label = s >= 1000 ? (s / 1000) + ' Gbps' : s + ' Mbps';
            selSpeed.add(new Option(label, s));
        });
    } else {
        selSpeed.add(new Option("Sem viabilidade", ""));
    }
    calculate();
}

// --- CÁLCULO CORE (ATUALIZADO) ---

function calculate() {
    // Inputs
    const op = document.getElementById('selOperadora').value;
    const prod = document.getElementById('selProduto').value;
    const uf = document.getElementById('selUF').value;
    const dur = parseInt(document.getElementById('selPrazo').value) || 36;
    const speed = parseFloat(document.getElementById('selVelocidade').value) || 0;
    const impostoMode = document.getElementById('selImpostoMode') ? document.getElementById('selImpostoMode').value : 'com';

    // Valores Base (Objetos {c, f})
    let mensalObj = { c: 0, f: 0 };
    let instalObj = { c: 0, f: 0 };

    if (speed) {
        const item = window.LPU_DB.find(i =>
            i.o == op && i.p == prod && i.u == uf && i.d == dur && i.s == speed
        );
        if (item && item.m) {
            // Verifica se o dado veio no formato novo {c,f} ou antigo (numero direto)
            if (typeof item.m === 'object') {
                mensalObj = item.m;
                instalObj = item.i;
            } else {
                // Fallback para versões antigas do DB
                mensalObj = { c: item.m, f: item.m };
                instalObj = { c: item.i, f: item.i };
            }
        }
    }

    // Fatores Multiplicadores (Local)
    let fator = 1.0;
    const detalhes = [];

    if (document.getElementById('checkShopping').checked) {
        fator *= 2.0;
        detalhes.push("Shopping (x2)");
    }
    if (document.getElementById('checkAeroporto').checked) {
        fator *= 3.0;
        detalhes.push("Aeroporto (x3)");
    }
    if (document.getElementById('checkIndustria').checked) {
        fator *= 1.4;
        detalhes.push("Indústria (x1.4)");
    }

    // Datacenter
    let extraData = 0;
    if (document.getElementById('checkDatacenter').checked) {
        extraData = 1200;
        detalhes.push("Datacenter (+1.2k)");
    }

    // Rural
    let custoRural = 0;
    if (document.getElementById('checkRural').checked) {
        const dist = parseFloat(document.getElementById('inputDistancia').value) || 0;
        custoRural = ((dist * 4.50) + 800) * 1.16;
        detalhes.push(`Rural (${dist}m)`);
    }

    // Projetos Especiais
    let specialM = 0;
    let specialI = 0;
    const specialList = [];
    const checkboxes = document.querySelectorAll('input[id^="sp_"]');
    checkboxes.forEach(chk => {
        if (chk.checked) {
            let val = parseFloat(chk.dataset.price);
            const name = chk.dataset.name;
            const type = chk.dataset.type;
            const hasInput = chk.dataset.hasInput === 'true';

            if (hasInput) {
                const inputVal = document.getElementById(`val_${chk.id.replace('sp_','')}`);
                if (inputVal) val = parseFloat(inputVal.value) || 0;
            }

            if (type === 'mensal') {
                specialM += val;
                specialList.push(`${name} (+${formatMoney(val)})`);
            } else {
                specialI += val;
                specialList.push(`${name} (+${formatMoney(val)})`);
            }
        }
    });

    // --- CÁLCULO FINAL ---
    const finalM_Clean = (mensalObj.c * fator) + extraData + specialM;
    const finalM_Full = (mensalObj.f * fator) + extraData + specialM;

    const finalI_Clean = instalObj.c + custoRural + specialI;
    const finalI_Full = instalObj.f + custoRural + specialI;

    // --- EXIBIÇÃO ---
    const lblMensal = document.getElementById('resMensal');
    const lblInstal = document.getElementById('resInstalacao');
    const obsMensal = document.getElementById('resMensalObs');
    const obsInstal = document.getElementById('resInstalacaoObs');

    if (obsMensal) obsMensal.innerText = "";
    if (obsInstal) obsInstal.innerText = "";

    if (impostoMode === 'sem') {
        lblMensal.innerText = formatMoney(finalM_Clean);
        lblInstal.innerText = formatMoney(finalI_Clean);
        if (obsMensal) obsMensal.innerText = "Valor SEM impostos";
        if (obsInstal) obsInstal.innerText = "Valor SEM impostos";
    } else if (impostoMode === 'ambos') {
        lblMensal.innerText = formatMoney(finalM_Full);
        lblInstal.innerText = formatMoney(finalI_Full);
        if (obsMensal) obsMensal.innerText = `S/ Impostos: ${formatMoney(finalM_Clean)}`;
        if (obsInstal) obsInstal.innerText = `S/ Impostos: ${formatMoney(finalI_Clean)}`;
    } else {
        // Padrão (Com Impostos)
        lblMensal.innerText = formatMoney(finalM_Full);
        lblInstal.innerText = formatMoney(finalI_Full);
    }

    generateEmail(op, prod, speed, uf, dur, finalM_Full, finalI_Full, finalM_Clean, finalI_Clean, detalhes, specialList, impostoMode);
}

function formatMoney(v) {
    if (v === undefined || v === null || isNaN(v)) return "R$ 0,00";
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function generateEmail(op, prod, speed, uf, dur, mM, mI, cM, cI, fatores, specials, mode) {
    if (!op || !speed) {
        document.getElementById('emailTemplate').value = "";
        return;
    }

    const sLabel = speed >= 1000 ? (speed / 1000) + ' Gbps' : speed + ' Mbps';
    const combinedNotes = [...fatores, ...specials].join(', ') || "Padrão";

    let linhasFinanceiras = "";

    if (mode === 'sem') {
        linhasFinanceiras = `
💰 MENSALIDADE: ${formatMoney(cM)} (S/ Impostos)
🛠️ INSTALAÇÃO: ${formatMoney(cI)} (S/ Impostos)`;
    } else if (mode === 'ambos') {
        linhasFinanceiras = `
💰 MENSALIDADE: ${formatMoney(mM)} (C/ Impostos) | ${formatMoney(cM)} (S/ Impostos)
🛠️ INSTALAÇÃO: ${formatMoney(mI)} (C/ Impostos) | ${formatMoney(cI)} (S/ Impostos)`;
    } else {
        linhasFinanceiras = `
💰 MENSALIDADE: ${formatMoney(mM)} (C/ Impostos)
🛠️ INSTALAÇÃO: ${formatMoney(mI)} (C/ Impostos)`;
    }

    const txt = `COTAÇÃO COMERCIAL | SITELBRA WHOLESALE
----------------------------------------------
PRODUTO: ${op} ${prod}
LOCALIDADE: ${uf}
VELOCIDADE: ${sLabel}
PRAZO: ${dur} Meses

ADICIONAIS / ESPECIFICAÇÕES:
${combinedNotes}

----------------------------------------------${linhasFinanceiras}
----------------------------------------------
* Validade: 15 dias.`;

    document.getElementById('emailTemplate').value = txt;
}

function copyEmail() {
    const el = document.getElementById('emailTemplate');
    el.select();
    document.execCommand('copy');
    alert("Cotação copiada!");
}