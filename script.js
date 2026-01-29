// script.js
// ATUALIZADO: Produtos Sempre Visíveis + Cálculo Real de Especiais

document.addEventListener('DOMContentLoaded', () => {
    // Data
    const dateEl = document.getElementById('currentDate');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('pt-BR');

    // Inicialização
    renderOperators();
    renderVisualUF();
    renderPrazoButtons();
    renderSpecials();

    // Inicializa Grids (Mostra tudo desabilitado)
    updateProducts();
    updateSpeeds();

    // Listeners
    document.body.addEventListener('input', (e) => {
        if (e.target.type === 'number') calculate();
    });

    const selImposto = document.getElementById('selImpostoMode');
    if (selImposto) selImposto.addEventListener('change', calculate);

    const btnCopy = document.getElementById('btnCopy');
    if (btnCopy) btnCopy.addEventListener('click', copyEmail);

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
    if (!container || !window.SPECIALS_DB) return;
    container.innerHTML = '';

    window.SPECIALS_DB.forEach(item => {
        const div = document.createElement('div');
        div.className = 'toggle-item';
        div.style.marginBottom = "8px";

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `sp_${item.id}`;

        // Armazena dados no dataset para uso rápido, embora usaremos a DB no calculate
        checkbox.dataset.id = item.id;
        checkbox.addEventListener('change', calculate);

        const label = document.createElement('span');
        label.className = 'toggle-label';

        // Define texto do label baseado no tipo
        let extraText = "";
        if (item.tipo === 'mul' && item.mul !== 1) extraText = ` (x${item.mul})`;
        if (item.tipo === 'add_m' && item.add_m > 0) extraText = ` (+R$ ${item.add_m})`;

        if (item.input) {
            // Input numérico (ex: Quantidade de IPs)
            label.innerHTML = `${item.nome} <br>
                <input type="number" id="val_${item.id}" class="input-text" 
                style="width:100px; margin-top:5px; font-size:0.8rem;" placeholder="Qtd">`;

            setTimeout(() => {
                const inp = document.getElementById(`val_${item.id}`);
                if (inp) inp.addEventListener('input', calculate);
            }, 100);
        } else {
            label.innerText = `${item.nome}${extraText}`;
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

// ... (renderPrazoButtons, renderOperators, renderVisualUF, selectOperator, selectVisualUF MANTIDOS IGUAIS) ...
// Vou incluir apenas o updateProducts e calculate que mudaram bastante.

function renderPrazoButtons() {
    const container = document.getElementById('visualPrazoGrid');
    const hiddenInput = document.getElementById('selPrazo');
    if (!container || !hiddenInput) return;
    const prazos = [12, 24, 36, 48, 60];
    prazos.forEach(p => {
        const btn = document.createElement('div');
        btn.className = 'pill-btn-sm';
        btn.textContent = `${p}m`;
        if (p == 36) btn.classList.add('active');
        btn.onclick = () => {
            container.querySelectorAll('.pill-btn-sm').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            hiddenInput.value = p;
            updateSpeeds();
            calculate();
        };
        container.appendChild(btn);
    });
}

function renderOperators() {
    const container = document.getElementById('visualOpGrid');
    if (!container || !window.LPU_DB) return;
    const ops = [...new Set(window.LPU_DB.map(i => i.o))].sort();
    ops.forEach(op => {
        const btn = document.createElement('div');
        btn.className = 'pill-btn';
        btn.textContent = op;
        btn.onclick = () => selectOperator(op, btn);
        container.appendChild(btn);
    });
}

function selectOperator(op, btnElement) {
    document.querySelectorAll('#visualOpGrid .pill-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
    document.getElementById('selOperadora').value = op;
    document.getElementById('selProduto').value = "";
    document.getElementById('selVelocidade').value = "";
    updateProducts();
    updateSpeeds();
    calculate();
}

function renderVisualUF() {
    const container = document.getElementById('visualUFGrid');
    if (!container || !window.UF_GROUPS) return;
    container.innerHTML = '';
    const ufs = Object.keys(window.UF_GROUPS).sort();
    ufs.forEach(uf => {
        const group = window.UF_GROUPS[uf];
        const btn = document.createElement('div');
        btn.className = `uf-square grp${group}`;
        btn.textContent = uf;
        btn.dataset.uf = uf;
        btn.onclick = () => selectVisualUF(uf);
        container.appendChild(btn);
    });
}

function selectVisualUF(uf) {
    document.getElementById('selUF').value = uf;
    document.querySelectorAll('.uf-square').forEach(sq => {
        if (sq.dataset.uf === uf) sq.classList.add('active');
        else sq.classList.remove('active');
    });
    updateSpeeds();
    calculate();
}

// --- PRODUTOS (SEMPRE VISÍVEIS) ---
function updateProducts() {
    const op = document.getElementById('selOperadora').value;
    const container = document.getElementById('visualProdGrid');
    if (!container) return;
    container.innerHTML = '';

    // Lista global de produtos (Extraída de todo o DB)
    const allProducts = [...new Set(window.LPU_DB.map(i => i.p))].sort();

    // Produtos disponíveis para a operadora selecionada
    let availableProducts = [];
    if (op) {
        availableProducts = [...new Set(window.LPU_DB.filter(i => i.o === op).map(i => i.p))];
    }

    allProducts.forEach(prod => {
        const btn = document.createElement('div');
        btn.textContent = prod;

        if (!op) {
            // Sem operadora: Mostra disabled
            btn.className = 'pill-btn disabled';
        } else {
            if (availableProducts.includes(prod)) {
                btn.className = 'pill-btn';
                if (document.getElementById('selProduto').value === prod) {
                    btn.classList.add('active');
                }
                btn.onclick = () => selectProduct(prod, btn);
            } else {
                // Produto existe, mas não nessa operadora
                btn.className = 'pill-btn disabled';
            }
        }
        container.appendChild(btn);
    });
}

function selectProduct(prod, btnElement) {
    document.querySelectorAll('#visualProdGrid .pill-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
    document.getElementById('selProduto').value = prod;
    document.getElementById('selVelocidade').value = "";
    updateSpeeds();
    calculate();
}

// --- VELOCIDADES (SEMPRE VISÍVEIS) ---
function updateSpeeds() {
    const op = document.getElementById('selOperadora').value;
    const prod = document.getElementById('selProduto').value;
    const uf = document.getElementById('selUF').value;
    const dur = parseInt(document.getElementById('selPrazo').value) || 36;
    const container = document.getElementById('visualSpeedGrid');
    const hiddenInput = document.getElementById('selVelocidade');

    if (!container) return;
    container.innerHTML = '';

    const allSpeeds = window.VELOCIDADES_DISPONIVEIS || [4, 5, 10, 20, 30, 40, 50, 100, 200, 300, 400, 500, 1000];

    let availableSpeeds = [];
    let hasFilters = (op && prod && uf);

    if (hasFilters) {
        const itens = window.LPU_DB.filter(i => i.o == op && i.p == prod && i.u == uf && i.d == dur);
        availableSpeeds = itens.map(i => i.s);
    }

    allSpeeds.forEach(s => {
        const btn = document.createElement('div');
        const labelMain = s >= 1000 ? (s / 1000) + ' Gbps' : s + ' Mbps';
        btn.innerHTML = `${labelMain}`;

        if (!hasFilters) {
            btn.className = 'speed-square disabled';
        } else {
            if (availableSpeeds.includes(s)) {
                btn.className = 'speed-square';
                if (parseInt(hiddenInput.value) === s) btn.classList.add('active');
                btn.onclick = () => {
                    document.querySelectorAll('.speed-square').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    hiddenInput.value = s;
                    calculate();
                };
            } else {
                btn.className = 'speed-square disabled';
            }
        }
        container.appendChild(btn);
    });

    // Limpa se a seleção atual ficou inválida
    if (hiddenInput.value && hasFilters && !availableSpeeds.includes(parseInt(hiddenInput.value))) {
        hiddenInput.value = "";
        calculate();
    }
}

// --- CÁLCULO FINAL (CORRIGIDO) ---
function calculate() {
    const op = document.getElementById('selOperadora').value;
    const prod = document.getElementById('selProduto').value;
    const uf = document.getElementById('selUF').value;
    const dur = parseInt(document.getElementById('selPrazo').value) || 36;
    const speed = parseFloat(document.getElementById('selVelocidade').value) || 0;
    const impostoMode = document.getElementById('selImpostoMode').value;

    const lblMensal = document.getElementById('resMensal');
    const lblInstal = document.getElementById('resInstalacao');
    const obsMensal = document.getElementById('resMensalObs');
    const obsInstal = document.getElementById('resInstalacaoObs');

    lblMensal.innerText = "R$ 0,00";
    lblInstal.innerText = "R$ 0,00";
    if (obsMensal) obsMensal.innerText = "Sem Impostos";
    if (obsInstal) obsInstal.innerText = "Sem Impostos";

    if (!op || !prod || !uf || !speed) return;

    // 1. Busca Preço Base
    const item = window.LPU_DB.find(i => i.o == op && i.p == prod && i.u == uf && i.d == dur && i.s == speed);

    let mensalObj = { c: 0, f: 0 };
    let instalObj = { c: 0, f: 0 };

    if (item && item.m) {
        mensalObj = (typeof item.m === 'object') ? item.m : { c: item.m, f: item.m };
        instalObj = (typeof item.i === 'object') ? item.i : { c: item.i, f: item.i };
    } else {
        return;
    }

    // 2. Fatores do Sidebar (Hardcoded no HTML)
    let fatorGlobal = 1.0;
    if (document.getElementById('checkShopping').checked) fatorGlobal *= 2.0;
    if (document.getElementById('checkAeroporto').checked) fatorGlobal *= 3.0;
    if (document.getElementById('checkIndustria').checked) fatorGlobal *= 1.4;

    let extraData = document.getElementById('checkDatacenter').checked ? 1200 : 0;

    // Rural
    const isRural = document.getElementById('checkRural').checked;
    const distRural = parseFloat(document.getElementById('inputDistancia').value) || 0;
    let custoRural = isRural ? ((distRural * 4.50) + 800) * 1.16 : 0;

    // 3. Projetos Especiais (Do CSV/specials.js)
    let specialMensalAdd = 0;
    let specialInstalAdd = 0;

    if (window.SPECIALS_DB) {
        window.SPECIALS_DB.forEach(sp => {
            const chk = document.getElementById(`sp_${sp.id}`);
            if (chk && chk.checked) {
                // Multiplicador
                if (sp.tipo === 'mul') {
                    fatorGlobal *= sp.mul;
                }
                // Valor Fixo
                else if (sp.tipo === 'add_m') {
                    specialMensalAdd += (sp.add_m || 0);
                    specialInstalAdd += (sp.add_i || 0);
                }
                // Input Quantidade (ex: IPs)
                else if (sp.tipo === 'input_qtd') {
                    const inp = document.getElementById(`val_${sp.id}`);
                    const qtd = parseFloat(inp ? inp.value : 0) || 0;
                    specialMensalAdd += (qtd * sp.unit_price);
                }
            }
        });
    }

    // 4. Cálculo Final
    // Base * Multiplicadores Globais + Adicionais Fixos
    const finalM_Clean = (mensalObj.c * fatorGlobal) + extraData + specialMensalAdd;
    const finalM_Full = (mensalObj.f * fatorGlobal) + extraData + specialMensalAdd;

    const finalI_Clean = instalObj.c + custoRural + specialInstalAdd;
    const finalI_Full = instalObj.f + custoRural + specialInstalAdd;

    // 5. Exibição
    if (impostoMode === 'sem') {
        lblMensal.innerText = formatMoney(finalM_Clean);
        lblInstal.innerText = formatMoney(finalI_Clean);
        if (obsMensal) obsMensal.innerText = "Sem Impostos (Clean)";
        if (obsInstal) obsInstal.innerText = "Sem Impostos (Clean)";
    } else if (impostoMode === 'ambos') {
        lblMensal.innerText = formatMoney(finalM_Full);
        lblInstal.innerText = formatMoney(finalI_Full);
        if (obsMensal) obsMensal.innerText = `Clean: ${formatMoney(finalM_Clean)}`;
        if (obsInstal) obsInstal.innerText = `Clean: ${formatMoney(finalI_Clean)}`;
    } else {
        lblMensal.innerText = formatMoney(finalM_Full);
        lblInstal.innerText = formatMoney(finalI_Full);
        if (obsMensal) obsMensal.innerText = "Com Impostos";
        if (obsInstal) obsInstal.innerText = "Com Impostos";
    }

    generateEmail(op, prod, speed, uf, dur, finalM_Clean, finalI_Clean);
}

function formatMoney(v) {
    if (v === undefined || v === null || isNaN(v)) return "R$ 0,00";
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function generateEmail(op, prod, speed, uf, dur, cM, cI) {
    const sLabel = speed >= 1000 ? (speed / 1000) + ' Gbps' : speed + ' Mbps';
    const txt = `Olá, tudo bem?

Segue abaixo a cotação conforme solicitado. Validade de 30 dias.

Produto: ${op} ${prod} ${sLabel} (${uf})
Valor mensal s/impostos: ${formatMoney(cM)}
Valor de instalação s/impostos: ${formatMoney(cI)}
Prazo de instalação: 60 Dias
Prazo de Contrato: ${dur} Meses

Ficamos à disposição.

Atenciosamente,`;
    document.getElementById('emailTemplate').value = txt;
}

function copyEmail() {
    const el = document.getElementById('emailTemplate');
    if (!el.value) return;
    el.select();
    document.execCommand('copy');
    alert("Cotação copiada!");
}