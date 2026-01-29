document.addEventListener('DOMContentLoaded', () => {
    // Data Atual
    const dateEl = document.getElementById('currentDate');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('pt-BR');

    // Inicialização da Interface
    renderOperators();
    renderVisualUF();
    renderPrazoButtons();
    renderSpecials();

    // Inicializa Grids (Visibilidade inicial)
    updateProducts();
    updateSpeeds();

    // --- LISTENERS (OUVINTES DE EVENTOS) ---

    // 1. Recalcula ao digitar números (Distância, IPs, Coordenadas)
    document.body.addEventListener('input', (e) => {
        if (e.target.type === 'number') calculate();
    });

    // 2. Listener para Checkboxes FIXOS do HTML (Aeroporto, Shopping, Indústria...)
    // Isso corrige o problema de "não funcionar ao clicar"
    const staticChecks = [
        'checkShopping', 'checkAeroporto', 'checkIndustria',
        'checkDatacenter', 'checkRural'
    ];
    staticChecks.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', calculate);
    });

    // 3. Listener para Modo de Imposto
    const selImposto = document.getElementById('selImpostoMode');
    if (selImposto) selImposto.addEventListener('change', calculate);

    // 4. Botões de Ação
    const btnCopy = document.getElementById('btnCopy');
    if (btnCopy) btnCopy.addEventListener('click', copyEmail);

    const btnSmart = document.getElementById('btnSmartAnalysis');
    if (btnSmart) btnSmart.addEventListener('click', executarAnaliseReal);

    // 5. Tecla Enter para Coordenadas
    const inputCoords = document.getElementById('aiCoords');
    if (inputCoords) {
        inputCoords.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') executarAnaliseReal();
        });
    }

    // 6. Toggle Visual do Rural
    const checkRural = document.getElementById('checkRural');
    if (checkRural) {
        checkRural.addEventListener('change', (e) => {
            const div = document.getElementById('ruralOptions');
            if (div) {
                if (e.target.checked) div.classList.remove('hidden');
                else div.classList.add('hidden');
            }
            calculate();
        });
    }

    // 7. Botão Mágico IA
    const btnMagic = document.getElementById('btnMagicAI');
    if (btnMagic) btnMagic.addEventListener('click', callGeminiAI);
});

// --- CÁLCULO FINANCEIRO (LÓGICA CORRIGIDA) ---

function calculate() {
    const op = document.getElementById('selOperadora').value;
    const prod = document.getElementById('selProduto').value;
    const uf = document.getElementById('selUF').value;
    const dur = parseInt(document.getElementById('selPrazo').value) || 36;
    const speed = parseFloat(document.getElementById('selVelocidade').value) || 0;
    const impostoMode = document.getElementById('selImpostoMode') ? document.getElementById('selImpostoMode').value : 'ambos';

    const lblMensal = document.getElementById('resMensal');
    const lblInstal = document.getElementById('resInstalacao');
    const obsMensal = document.getElementById('resMensalObs');
    const obsInstal = document.getElementById('resInstalacaoObs');

    // Reset visual imediato
    if (lblMensal) lblMensal.innerText = "R$ 0,00";
    if (lblInstal) lblInstal.innerText = "R$ 0,00";
    if (obsMensal) obsMensal.innerText = "Aguardando seleção...";

    if (!op || !prod || !uf || !speed) return;

    // 1. Busca Item Base na LPU
    const item = window.LPU_DB.find(i => i.o == op && i.p == prod && i.u == uf && i.d == dur && i.s == speed);

    if (!item) {
        if (obsMensal) obsMensal.innerText = "Item não encontrado na LPU";
        return;
    }

    // --- BASE DE CÁLCULO (CLEAN) ---
    // Sempre reinicia do valor base para garantir que desmarcar funcione
    let calcMensal = item.m.c;
    let calcInstal = item.i.c;

    // Variáveis de acumulação (Começam zeradas/neutras a cada cálculo)
    let multM = 1.0;
    let multI = 1.0;
    let addM = 0.0;
    let addI = 0.0;

    // --- REGRAS DE NEGÓCIO ---

    // 1. Shopping (x2)
    if (document.getElementById('checkShopping').checked) {
        multM *= 2.0;
        multI *= 2.0;
    }

    // 2. Indústria OU Fora de Zona Urbana (São a mesma coisa: x1.2 + 5k Instalação)
    const isIndustria = document.getElementById('checkIndustria').checked;
    const isForaUrbana = isChecked('sp_fora_urbana'); // Do specials.js

    if (isIndustria || isForaUrbana) {
        multM *= 1.2;
        multI *= 1.2;
        addI += 5000; // Adicional fixo unificado
    }

    // 3. Cidade Pequena (x1.4)
    if (isChecked('sp_cid_peq')) {
        multM *= 1.4;
        multI *= 1.4;
    }

    // 4. Provedores (RTM/Avato/etc) (x1.2)
    if (isChecked('sp_prov_rtm')) {
        multM *= 1.2;
        multI *= 1.2;
    }

    // 5. Favela / Risco / Subterrânea (x1.2 + R$ 1000 Mensal + R$ 2000 Instalação)
    if (isChecked('sp_favela')) {
        multM *= 1.2;
        multI *= 1.2;
        addM += 1000;
        addI += 2000;
    }

    // 6. Aeroporto (+4200 Mensal e Instalação)
    if (document.getElementById('checkAeroporto').checked) {
        addM += 4200;
        addI += 4200;
    }

    // 7. Datacenter (+1200 Mensal)
    if (document.getElementById('checkDatacenter').checked) {
        addM += 1200;
    }

    // 8. Rádio Backup (+6000 Instalação)
    if (isChecked('sp_radio')) {
        addI += 6000;
    }

    // --- APLICAÇÃO DA LÓGICA ---

    // Passo A: Multiplicadores sobre a base
    calcMensal = calcMensal * multM;
    calcInstal = calcInstal * multI;

    // Passo B: Soma dos valores fixos
    calcMensal += addM;
    calcInstal += addI;

    // --- FÓRMULAS ESPECIAIS (Somadas no final) ---

    // 9. Zona Rural (Apenas Distância e Fibra)
    // Fórmula: (Metros * 3.65) + 500
    // Só aplica se o checkbox Rural estiver marcado, independente se é indústria ou não.
    if (document.getElementById('checkRural').checked) {
        const distInput = document.getElementById('inputDistancia');
        const dist = parseFloat(distInput ? distInput.value : 0) || 0;

        const custoRural = (dist * 3.65) + 500;

        // Adiciona ao valor de instalação acumulado
        calcInstal += custoRural;
    }

    // 10. IPs Fixos
    // Fórmula: SE(Qtd>0; 125 + (Qtd*25); 0)
    if (isChecked('sp_ips')) {
        const ipInput = document.getElementById('val_ips');
        const qtdIp = parseFloat(ipInput ? ipInput.value : 0) || 0;

        if (qtdIp > 0) {
            const costIp = 125 + (qtdIp * 25);
            calcMensal += costIp;
        }
    }

    // --- IMPOSTOS ---
    const taxM = 1.336;
    const taxI = 1.166;

    const finalMensalFull = calcMensal * taxM;
    const finalInstalFull = calcInstal * taxI;

    // --- EXIBIÇÃO ---
    if (impostoMode === 'sem') {
        lblMensal.innerText = formatMoney(calcMensal);
        lblInstal.innerText = formatMoney(calcInstal);
        obsMensal.innerText = "Valor Clean (Sem Impostos)";
        if (obsInstal) obsInstal.innerText = "Valor Clean (Sem Impostos)";
    } else if (impostoMode === 'ambos') {
        lblMensal.innerText = formatMoney(finalMensalFull);
        lblInstal.innerText = formatMoney(finalInstalFull);
        obsMensal.innerText = `Clean: ${formatMoney(calcMensal)}`;
        if (obsInstal) obsInstal.innerText = `Clean: ${formatMoney(calcInstal)}`;
    } else {
        lblMensal.innerText = formatMoney(finalMensalFull);
        lblInstal.innerText = formatMoney(finalInstalFull);
        obsMensal.innerText = "Com Impostos";
        if (obsInstal) obsInstal.innerText = "Com Impostos";
    }

    generateEmail(op, prod, speed, uf, dur, calcMensal, calcInstal, finalMensalFull);
}

// Helper para checar checkboxes do specials.js
function isChecked(id) {
    const el = document.getElementById(`sp_${id}`);
    return el && el.checked;
}

// --- ANÁLISE INTELIGENTE (IA TURBO) ---
async function executarAnaliseReal() {
    const rawCoords = document.getElementById('aiCoords').value;

    if (!rawCoords || !rawCoords.includes(',')) {
        alert("Formato inválido. Use: Latitude, Longitude (ex: -23.63, -46.82)");
        return;
    }

    const [lat, lon] = rawCoords.split(',').map(c => c.trim());
    const btnText = document.getElementById('aiBtnText');
    const loader = document.getElementById('aiLoader');
    const reportDiv = document.getElementById('analysisReport');

    // UI Loading
    if (btnText) btnText.classList.add('hidden');
    if (loader) loader.classList.remove('hidden');
    if (reportDiv) reportDiv.classList.add('hidden');

    try {
        // --- 1. GEOLOCALIZAÇÃO ---
        const responseGeo = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`);
        const geoData = await responseGeo.json();
        const address = geoData.address || {};

        // Detectar UF
        let uf = null;
        if (address["ISO3166-2-lvl4"]) {
            uf = address["ISO3166-2-lvl4"].split('-')[1];
        } else if (address.state_code) {
            uf = address.state_code;
        } else {
            const mapStates = { "São Paulo": "SP", "Rio de Janeiro": "RJ", "Minas Gerais": "MG", "Distrito Federal": "DF" };
            uf = mapStates[address.state] || "SP";
        }

        if (uf) selectVisualUF(uf);

        // --- 2. INFRAESTRUTURA (Overpass) ---
        const query = `[out:json];(
            node(around:800, ${lat}, ${lon})["shop"="mall"];
            way(around:800, ${lat}, ${lon})["shop"="mall"];
            node(around:1000, ${lat}, ${lon})["aeroway"="aerodrome"];
            way(around:800, ${lat}, ${lon})["landuse"="industrial"];
            way(around:800, ${lat}, ${lon})["building"="industrial"];
            way(around:800, ${lat}, ${lon})["building"="warehouse"];
            way(around:800, ${lat}, ${lon})["man_made"="works"];
        );out body;`;

        const responseMap = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
        const mapData = await responseMap.json();

        // --- 3. LÓGICA DE DETECÇÃO ---

        // Reseta checks
        document.getElementById('checkShopping').checked = false;
        document.getElementById('checkAeroporto').checked = false;
        document.getElementById('checkIndustria').checked = false;
        document.getElementById('checkRural').checked = false;
        document.getElementById('ruralOptions').classList.add('hidden');

        const checkFora = document.getElementById('sp_fora_urbana');
        if (checkFora) checkFora.checked = false;

        let logAdicionais = [];
        let foundMall = false;
        let foundAero = false;
        let isIndustrial = false;

        const localName = geoData.display_name ? geoData.display_name.split(',')[0] : "Local";
        if (uf) logAdicionais.push(`📍 Localização: <strong>${localName} (${uf})</strong>`);

        mapData.elements.forEach(el => {
            if (el.tags.shop === 'mall') foundMall = true;
            if (el.tags.aeroway === 'aerodrome') foundAero = true;
            if (el.tags.landuse === 'industrial' ||
                el.tags.building === 'industrial' ||
                el.tags.building === 'warehouse' ||
                el.tags.man_made === 'works') {
                isIndustrial = true;
            }
        });

        // Aplica Regras
        if (foundAero) {
            document.getElementById('checkAeroporto').checked = true;
            logAdicionais.push("✈️ <strong>Aeroporto</strong> detectado");
        }

        if (foundMall) {
            document.getElementById('checkShopping').checked = true;
            logAdicionais.push("🏬 <strong>Shopping Center</strong> detectado");
        }

        if (isIndustrial && !foundMall && !foundAero) {
            document.getElementById('checkIndustria').checked = true;
            logAdicionais.push("🏭 <strong>Zona Industrial</strong> detectada");
        }

        // Lógica de Zona Afastada (Apenas marca Fora de Urbana, NÃO ativa Rural automaticamente)
        let isZonaAfastada = false;
        if (!address.suburb && !address.city_district && !address.quarter) isZonaAfastada = true;
        if (['village', 'hamlet', 'isolated_dwelling', 'farm'].includes(geoData.type)) isZonaAfastada = true;

        if (isZonaAfastada) {
            if (checkFora) {
                checkFora.checked = true;
                logAdicionais.push("⚠️ <strong>Fora da Zona Urbana</strong> detectado");
            }

            // Sugestão visual apenas, não ativa checkbox Rural para não alterar cálculo erradamente
            if (!isIndustrial) {
                logAdicionais.push("ℹ️ Local parece remoto. Verifique se precisa ativar 'Zona Rural'.");
            }
        }

        if (logAdicionais.length === 1) {
            logAdicionais.push("✅ Área Urbana Padrão");
        }

        if (reportDiv) {
            const uniqueLog = [...new Set(logAdicionais)];
            reportDiv.innerHTML = uniqueLog.join('<br>');
            reportDiv.classList.remove('hidden');
        }

        calculate();

    } catch (err) {
        console.error(err);
        alert("Erro na análise. Verifique sua conexão.");
    } finally {
        if (btnText) btnText.classList.remove('hidden');
        if (loader) loader.classList.add('hidden');
    }
}

// --- AUXILIARES E RENDERIZAÇÃO ---

function formatMoney(v) {
    if (v === undefined || v === null || isNaN(v)) return "R$ 0,00";
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function generateEmail(op, prod, speed, uf, dur, cM, cI, fullM) {
    const sLabel = speed >= 1000 ? (speed / 1000) + ' Gbps' : speed + ' Mbps';

    const reportDiv = document.getElementById('analysisReport');
    let aiNotes = "";
    if (reportDiv && !reportDiv.classList.contains('hidden')) {
        aiNotes = "\nNOTAS DE VIABILIDADE:\n" + reportDiv.innerText.replace(/\n/g, '\n- ') + "\n";
    }

    const txt = `Olá, tudo bem?

Segue abaixo a cotação conforme solicitado. Validade de 30 dias.

Produto: ${op} ${prod} ${sLabel} (${uf})
Prazo de Contrato: ${dur} Meses
${aiNotes}
-- Valores Com Impostos --
Mensal: ${formatMoney(fullM)}

-- Valores Clean (Ref.) --
Mensal s/impostos: ${formatMoney(cM)}
Instalação s/impostos: ${formatMoney(cI)}
Prazo de instalação: 60 Dias

Ficamos à disposição.

Atenciosamente,`;

    const template = document.getElementById('emailTemplate');
    if (template) template.value = txt;
}

function copyEmail() {
    const el = document.getElementById('emailTemplate');
    if (!el || !el.value) return;
    el.select();
    document.execCommand('copy');
    alert("Cotação copiada!");
}

function renderOperators() {
    const container = document.getElementById('visualOpGrid');
    if (!container || !window.LPU_DB) return;
    const ops = [...new Set(window.LPU_DB.map(i => i.o))].sort();

    container.innerHTML = '';
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
    const selUF = document.getElementById('selUF');
    if (selUF) selUF.value = uf;

    document.querySelectorAll('.uf-square').forEach(sq => {
        if (sq.dataset.uf === uf) sq.classList.add('active');
        else sq.classList.remove('active');
    });
    updateSpeeds();
    calculate();
}

function renderPrazoButtons() {
    const container = document.getElementById('visualPrazoGrid');
    const hiddenInput = document.getElementById('selPrazo');
    if (!container || !hiddenInput) return;

    container.innerHTML = '';
    const prazos = [12, 24, 36, 48, 60];
    prazos.forEach(p => {
        const btn = document.createElement('div');
        btn.className = 'pill-btn-sm';
        btn.textContent = `${p}m`;
        if (p == 36) btn.classList.add('active'); // Padrão
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
        checkbox.dataset.id = item.id;
        checkbox.addEventListener('change', calculate);

        const label = document.createElement('span');
        label.className = 'toggle-label';

        if (item.input) {
            label.innerHTML = `${item.nome} <br>
                <input type="number" id="val_${item.id}" class="input-text" 
                style="width:100px; margin-top:5px; font-size:0.8rem;" placeholder="Qtd">`;

            setTimeout(() => {
                const inp = document.getElementById(`val_${item.id}`);
                if (inp) inp.addEventListener('input', calculate);
            }, 0);
        } else {
            label.innerText = item.nome;
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

function updateProducts() {
    const op = document.getElementById('selOperadora').value;
    const container = document.getElementById('visualProdGrid');
    if (!container || !window.LPU_DB) return;
    container.innerHTML = '';

    const allProducts = [...new Set(window.LPU_DB.map(i => i.p))].sort();
    let availableProducts = [];
    if (op) {
        availableProducts = [...new Set(window.LPU_DB.filter(i => i.o === op).map(i => i.p))];
    }

    allProducts.forEach(prod => {
        const btn = document.createElement('div');
        btn.textContent = prod;
        if (!op) {
            btn.className = 'pill-btn disabled';
        } else {
            if (availableProducts.includes(prod)) {
                btn.className = 'pill-btn';
                if (document.getElementById('selProduto').value === prod) btn.classList.add('active');
                btn.onclick = () => selectProduct(prod, btn);
            } else {
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

function updateSpeeds() {
    const op = document.getElementById('selOperadora').value;
    const prod = document.getElementById('selProduto').value;
    const uf = document.getElementById('selUF').value;
    const dur = parseInt(document.getElementById('selPrazo').value) || 36;
    const container = document.getElementById('visualSpeedGrid');
    const hiddenInput = document.getElementById('selVelocidade');

    if (!container) return;
    container.innerHTML = '';

    const allSpeeds = window.VELOCIDADES_DISPONIVEIS || [];
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

    if (hiddenInput.value && hasFilters && !availableSpeeds.includes(parseInt(hiddenInput.value))) {
        hiddenInput.value = "";
        calculate();
    }
}

// --- GEMINI AI (Geração de Texto) ---
async function callGeminiAI() {
    const btn = document.getElementById('btnMagicAI');
    const txtArea = document.getElementById('emailTemplate');
    // Sua API Key aqui (mantida a que você enviou anteriormente)
    const API_KEY = "AIzaSyAVAsqH9Y0scMOgBZVIaRA9nQjJPCteux4";

    const op = document.getElementById('selOperadora').value;
    const prod = document.getElementById('selProduto').value;
    const uf = document.getElementById('selUF').value;
    const speed = document.getElementById('selVelocidade').value;
    const prazo = document.getElementById('selPrazo').value;
    const preco = document.getElementById('resMensal').innerText;

    const reportDiv = document.getElementById('analysisReport');
    const geoContext = (reportDiv && !reportDiv.classList.contains('hidden')) ? reportDiv.innerText : "Área Padrão";

    const prompt = `
        Aja como um consultor comercial de telecom (Sitelbra Wholesale).
        Reescreva esta proposta de forma persuasiva.
        
        DADOS:
        - Link: ${op} ${prod} ${speed}Mbps em ${uf}
        - Contrato: ${prazo} meses
        - Valor: ${preco}
        - Contexto Geográfico: ${geoContext}
        
        Se houver taxas extras (Rural/Shopping/Industrial), justifique como investimento em infraestrutura dedicada e SLA.
        Seja breve.
    `;

    const originalText = btn.innerHTML;
    btn.innerHTML = `Gerando...`;
    btn.disabled = true;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        if (data.candidates && data.candidates[0].content) {
            txtArea.value = data.candidates[0].content.parts[0].text;
        }
    } catch (error) {
        console.error(error);
        alert("Erro na IA. Verifique se a chave API tem permissão.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}