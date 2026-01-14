document.addEventListener('DOMContentLoaded', () => {
    // Data
    const dateEl = document.getElementById('currentDate');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('pt-BR');

    // Validação de Arquivos
    if (typeof window.LPU_DB === 'undefined' || typeof window.SPECIALS_DB === 'undefined') {
        alert("Erro: Arquivos 'dados.js' ou 'specials.js' não carregados.");
        return;
    }

    console.log(`Sistema iniciado. LPU: ${window.LPU_DB.length} | Specials: ${window.SPECIALS_DB.length}`);

    // Inicialização
    populateDropdowns();
    renderSpecials(); // Gera os checkboxes dos projetos especiais

    // Listeners Globais (qualquer mudança recalcula)
    document.body.addEventListener('change', calculate);
    document.body.addEventListener('input', (e) => {
        if (e.target.type === 'number') calculate();
    });

    // Botões
    document.getElementById('btnCopy').addEventListener('click', copyEmail);

    // Toggle Rural Específico
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

// --- RENDERIZAÇÃO DE ESPECIAIS ---
function renderSpecials() {
    const container = document.getElementById('specialsContainer');
    if (!container) return;

    container.innerHTML = ''; // Limpa

    window.SPECIALS_DB.forEach(item => {
        // Cria o elemento visual para cada item do CSV
        const div = document.createElement('div');
        div.className = 'toggle-item';
        div.style.marginBottom = "8px";

        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `sp_${item.id}`;
        checkbox.dataset.price = item.valor;
        checkbox.dataset.type = item.tipo;
        checkbox.dataset.name = item.nome;
        checkbox.dataset.hasInput = item.input || false;

        // Label
        const label = document.createElement('span');
        label.className = 'toggle-label';

        // Se for item com valor fixo, mostra o preço. Se for input livre, mostra campo.
        if (item.input) {
            label.innerHTML = `${item.nome} <br><input type="number" id="val_${item.id}" class="input-text" style="width:100px; margin-top:5px; font-size:0.8rem;" placeholder="R$ valor">`;
        } else {
            label.innerText = `${item.nome} (+R$ ${item.valor})`;
        }

        // Monta o HTML
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

// --- LÓGICA DE SELEÇÃO (MANTIDA) ---
function populateDropdowns() {
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

// --- CÁLCULO CORE ---

function calculate() {
    // 1. Dados Básicos
    const op = document.getElementById('selOperadora').value;
    const prod = document.getElementById('selProduto').value;
    const uf = document.getElementById('selUF').value;
    const dur = parseInt(document.getElementById('selPrazo').value) || 36;
    const speed = parseFloat(document.getElementById('selVelocidade').value) || 0;

    let mensal = 0;
    let instalacao = 0;

    // Busca LPU Base
    if (speed) {
        const item = window.LPU_DB.find(i =>
            i.o == op && i.p == prod && i.u == uf && i.d == dur && i.s == speed
        );
        if (item) {
            mensal = item.m;
            instalacao = item.i;
        }
    }

    // 2. Fatores Multiplicadores (Local)
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

    let extraDatacenter = 0;
    if (document.getElementById('checkDatacenter').checked) {
        extraDatacenter = 1200;
        detalhes.push("Datacenter (+1.2k)");
    }

    // Rural
    let custoRural = 0;
    if (document.getElementById('checkRural').checked) {
        const dist = parseFloat(document.getElementById('inputDistancia').value) || 0;
        // Fórmula Rural: ((Metros * 4.50) + 800 Ativação) * 1.16 Imposto
        custoRural = ((dist * 4.50) + 800) * 1.16;
        detalhes.push(`Rural (${dist}m)`);
    }

    // 3. PROJETOS ESPECIAIS (Cálculo Dinâmico)
    let specialMensal = 0;
    let specialInstal = 0;
    const specialList = [];

    // Itera sobre todos os checkboxes gerados pelo specials.js
    const checkboxes = document.querySelectorAll('input[id^="sp_"]');
    checkboxes.forEach(chk => {
        if (chk.checked) {
            let val = parseFloat(chk.dataset.price);
            const name = chk.dataset.name;
            const type = chk.dataset.type; // 'mensal' ou 'instalacao'
            const hasInput = chk.dataset.hasInput === 'true';

            // Se for um item variavel (ex: obra civil digitada), pega o valor do input atrelado
            if (hasInput) {
                const inputVal = document.getElementById(`val_${chk.id.replace('sp_','')}`);
                if (inputVal) val = parseFloat(inputVal.value) || 0;
            }

            // Soma nos totais corretos
            if (type === 'mensal') {
                specialMensal += val;
                specialList.push(`${name} (+${formatMoney(val)}/mês)`);
            } else {
                specialInstal += val;
                specialList.push(`${name} (+${formatMoney(val)} One-off)`);
            }
        }
    });

    // 4. Consolidação Final
    const totalMensal = (mensal * fator) + extraDatacenter + specialMensal;
    const totalInstalacao = instalacao + custoRural + specialInstal;

    // Atualiza UI
    document.getElementById('resMensal').innerText = formatMoney(totalMensal);
    document.getElementById('resInstalacao').innerText = formatMoney(totalInstalacao);

    generateEmail(op, prod, speed, uf, dur, totalMensal, totalInstalacao, detalhes, specialList);
}

function formatMoney(v) {
    if (!v) return "R$ 0,00";
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function generateEmail(op, prod, speed, uf, dur, valM, valI, fatores, specials) {
    if (!op || !speed) {
        document.getElementById('emailTemplate').value = "";
        return;
    }

    const sLabel = speed >= 1000 ? (speed / 1000) + ' Gbps' : speed + ' Mbps';
    const combinedNotes = [...fatores, ...specials].join(', ') || "Padrão";

    const txt = `COTAÇÃO COMERCIAL | SITELBRA WHOLESALE
----------------------------------------------
PRODUTO: ${op} ${prod}
LOCALIDADE: ${uf}
VELOCIDADE: ${sLabel}
PRAZO: ${dur} Meses

ADICIONAIS / ESPECIFICAÇÕES:
${combinedNotes}

----------------------------------------------
💰 MENSALIDADE TOTAL: ${formatMoney(valM)}
🛠️ INSTALAÇÃO TOTAL: ${formatMoney(valI)}
----------------------------------------------
* Valores com impostos inclusos.
* Validade: 15 dias.`;

    document.getElementById('emailTemplate').value = txt;
}

function copyEmail() {
    const el = document.getElementById('emailTemplate');
    el.select();
    document.execCommand('copy');
    alert("Cotação copiada!");
}