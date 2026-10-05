// script.js - Interface da cotação Sitelbra.
// Regras de preço: pricing.js | apresentação/status/composição: quote.js | histórico: history.js | IA: ai.js (via /api/ai)

// --- CONFIGURAÇÃO EDITÁVEL ---
// Prazos (em meses) que aparecem como botões. Só funcionam os prazos que existem nas tabelas LPU.
const PRAZOS_DISPONIVEIS = [12, 24, 36, 48, 60];
const PRAZOS_INICIAIS = [36];
let prazosSelecionados = [...PRAZOS_INICIAIS]; // o último marcado é o principal

// Mapa opção (id sem "sp_") -> chave usada por pricing.js
const SP_KEY = { fora_urbana: 'foraUrbana', cid_peq: 'cidPeq', favela: 'favela', fibra_curta: 'fibraCurta', prov_rtm: 'provedor', sla: 'sla', dupla: 'dupla', radio: 'radio', comodato: 'comodato', mtu: 'mtu' };

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = v => Quote.fmtBRL(v);

// --- ÍCONES (SVG inline, sem dependência externa) ---
const ICONS = {
    check: 'M5 12.5l4.5 4.5L19 7.5', alert: 'M12 4l9.5 16.5h-19z M12 10v4.5 M12 17.6v.01', x: 'M6 6l12 12M18 6L6 18',
    copy: 'M9 9h11v11H9z M5 15V4h11', chev: 'M6 9l6 6 6-6', history: 'M4 12a8 8 0 1 0 2.5-5.8 M4 4v4.5h4.5 M12 8v4.5l3 2',
    compare: 'M7 4v16M17 4v16M3 8l4-4 4 4M13 16l4 4 4-4', download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
    sparkle: 'M11 3l1.9 5.6L18.5 10.5 12.9 12.4 11 18l-1.9-5.6L3.5 10.5l5.6-1.9z M19 15l.9 2.4 2.4.9-2.4.9L19 21.6l-.9-2.4-2.4-.9 2.4-.9z',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5.5 M12 7.6v.01', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    open: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6', refresh: 'M20 11a8 8 0 1 0-2.3 6.3 M20 4v7h-7', bolt: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
    save: 'M5 4h11l3 3v13H5z M8 4v5h7V4 M8 20v-6h8v6', checkc: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M8.3 12.4l2.5 2.5 4.9-5',
    xc: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9 9l6 6M15 9l-6 6'
};
const ic = (n, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;
function hydrateIcons(root = document) { root.querySelectorAll('[data-ic]').forEach(el => { if (!el.dataset.done) { el.insertAdjacentHTML('afterbegin', ic(el.dataset.ic)); el.dataset.done = 1; } }); }

// --- TOAST ---
function toast(msg, type = 'ok') {
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.setAttribute('role', type === 'err' ? 'alert' : 'status');
    t.innerHTML = ic(type === 'err' ? 'alert' : 'checkc') + `<span>${esc(msg)}</span>`;
    $('toasts').appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, type === 'err' ? 5000 : 2600);
}

// --- ESTADO ---
let lastQuote = null, lastSig = '', liveText = '', dirty = false, activeTab = 'proposta', detailOpen = false, computing = false;

function getSel() {
    return {
        op: $('selOperadora').value, prod: $('selProduto').value, uf: $('selUF').value,
        speed: parseFloat($('selVelocidade').value) || 0,
        dur: parseInt($('selPrazo').value) || 36,
        prazos: [...prazosSelecionados], opts: readOptions(),
        impostoMode: $('selImpostoMode').value || 'sem'
    };
}

// Helper para checar checkboxes dos projetos especiais (ids sem o prefixo "sp_")
function isChecked(id) { const el = $(`sp_${id}`); return !!(el && el.checked); }

function readOptions() {
    const chk = id => { const el = $(id); return !!(el && el.checked); };
    return {
        shopping: chk('checkShopping'), aeroporto: chk('checkAeroporto'), industria: chk('checkIndustria'), datacenter: chk('checkDatacenter'),
        rural: chk('checkRural'),
        distancia: chk('checkRural') && $('inputDistancia') ? $('inputDistancia').value : 0,
        foraUrbana: isChecked('fora_urbana'), cidPeq: isChecked('cid_peq'), favela: isChecked('favela'), fibraCurta: isChecked('fibra_curta'),
        provedor: isChecked('prov_rtm'), sla: isChecked('sla'), dupla: isChecked('dupla'), radio: isChecked('radio'),
        comodato: isChecked('comodato'), mtu: isChecked('mtu'),
        qtdIp: isChecked('ips') ? ($('val_ips') ? $('val_ips').value : 0) : 0
    };
}

function setOptions(o) {
    o = o || {};
    const set = (id, v) => { const el = $(id); if (el) el.checked = !!v; };
    window.LOCAL_DB.forEach(l => set(l.id, o[l.key]));
    set('checkRural', o.rural);
    $('ruralOptions').hidden = !o.rural;
    $('inputDistancia').value = o.rural && o.distancia ? o.distancia : '';
    Object.keys(SP_KEY).forEach(k => set('sp_' + k, o[SP_KEY[k]]));
    const ipsOn = (parseFloat(o.qtdIp) || 0) > 0;
    set('sp_ips', ipsOn);
    if ($('val_ips')) { $('val_ips').hidden = !ipsOn; $('val_ips').value = ipsOn ? o.qtdIp : ''; }
    updateAdvSummary();
}

// --- RENDERIZAÇÃO DOS CONTROLES ---
function chip(text, { pressed = false, disabled = false, onclick, cls = 'chip', data } = {}) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.textContent = text;
    b.setAttribute('aria-pressed', String(!!pressed));
    if (disabled) b.disabled = true;
    if (data) Object.assign(b.dataset, data);
    if (onclick && !disabled) b.addEventListener('click', onclick);
    return b;
}

function renderOperators() {
    const c = $('visualOpGrid'); c.innerHTML = '';
    [...new Set(window.LPU_DB.map(i => i.o))].sort().forEach(op =>
        c.appendChild(chip(op, { pressed: $('selOperadora').value === op, onclick: () => selectOperator(op) })));
}
function selectOperator(op) {
    $('selOperadora').value = op; $('selProduto').value = ''; $('selVelocidade').value = '';
    clearErr('op'); renderOperators(); updateProducts(); updateSpeeds(); calculate();
}

function updateProducts() {
    const op = $('selOperadora').value, c = $('visualProdGrid'); c.innerHTML = '';
    const all = [...new Set(window.LPU_DB.map(i => i.p))].sort();
    const avail = op ? new Set(window.LPU_DB.filter(i => i.o === op).map(i => i.p)) : new Set();
    all.forEach(p => c.appendChild(chip(p, { pressed: $('selProduto').value === p, disabled: !avail.has(p), onclick: () => selectProduct(p) })));
}
function selectProduct(p) {
    $('selProduto').value = p; $('selVelocidade').value = '';
    clearErr('prod'); updateProducts(); updateSpeeds(); calculate();
}

// Cor de cada estado = quanto a mensalidade da LPU (operadora + produto + prazo + velocidade escolhidos) fica acima da UF mais barata.
// Muda sozinha quando você troca operadora, produto, prazo ou velocidade. Faixas editáveis aqui:
const UF_TIERS = [
    { id: 't1', max: 1.10, label: 'Barato', hint: 'até 10% acima da UF mais barata' },
    { id: 't2', max: 1.30, label: 'Médio', hint: 'de 10% a 30% acima' },
    { id: 't3', max: 1.70, label: 'Caro', hint: 'de 30% a 70% acima' },
    { id: 't4', max: Infinity, label: 'Muito caro', hint: 'mais de 70% acima: local ruim' }
];
function ufTiers() {
    const op = $('selOperadora').value, prod = $('selProduto').value, dur = parseInt($('selPrazo').value) || 36;
    if (!op || !prod) return null;
    const rows = window.LPU_DB.filter(i => i.o === op && i.p === prod && i.d === dur);
    const speeds = [...new Set(rows.map(i => i.s))].sort((a, b) => a - b);
    const chosen = parseInt($('selVelocidade').value) || 0;
    const ref = speeds.includes(chosen) ? chosen : (speeds.includes(100) ? 100 : speeds[0]);
    if (!ref) return { ref: 0, by: {} };
    const price = {};
    rows.filter(i => i.s === ref).forEach(i => { price[i.u] = i.m.c; });
    const min = Math.min(...Object.values(price));
    const by = {};
    Object.keys(window.UF_GROUPS).forEach(uf => {
        const v = price[uf];
        by[uf] = v == null ? { id: 'none', label: 'Sem preço na LPU' } : Object.assign({ v, pct: (v / min - 1) * 100 }, UF_TIERS.find(t => v / min <= t.max));
    });
    return { ref, by };
}
function renderVisualUF() {
    const c = $('visualUFGrid'); c.innerHTML = '';
    const T = ufTiers();
    Object.keys(window.UF_GROUPS).sort().forEach(uf => {
        const b = chip(uf, { pressed: $('selUF').value === uf, cls: 'chip', data: { uf }, onclick: () => selectVisualUF(uf) });
        const t = T && T.by[uf];
        if (t) {
            b.dataset.tier = t.id;
            const tip = t.id === 'none' ? `${uf}: ${t.label}` : `${uf}: ${t.label} (${t.pct < 0.5 ? 'mais barata' : '+' + Math.round(t.pct) + '%'}), mensal ${money(t.v)} s/ imp. em ${Quote.speedLabel(T.ref)}`;
            b.title = tip; b.setAttribute('aria-label', tip);
        }
        c.appendChild(b);
    });
    const lg = $('ufLegend');
    lg.innerHTML = T && T.ref ? UF_TIERS.map(t => `<span class="lg" data-tier="${t.id}" title="${esc(t.hint)}"><i></i>${t.label}</span>`).join('') + `<span class="lg" data-tier="none"><i></i>Sem preço</span><small>Comparado em ${Quote.speedLabel(T.ref)}, valor sem impostos</small>`
        : '<small>Escolha operadora e produto para colorir os estados pelo preço.</small>';
}
function selectVisualUF(uf) {
    $('selUF').value = uf; clearErr('uf');
    updateSpeeds(); calculate();
}

function renderPrazoButtons() {
    const c = $('visualPrazoGrid'), hidden = $('selPrazo');
    c.innerHTML = '';
    hidden.value = prazosSelecionados[prazosSelecionados.length - 1] || PRAZOS_DISPONIVEIS[0];
    const refresh = () => c.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(prazosSelecionados.includes(parseInt(b.dataset.prazo)))));
    PRAZOS_DISPONIVEIS.forEach(p => {
        c.appendChild(chip(`${p} meses`, { data: { prazo: p }, onclick: () => {
            const idx = prazosSelecionados.indexOf(p);
            if (idx >= 0) {
                if (prazosSelecionados.length === 1) return; // mantém pelo menos 1 prazo
                prazosSelecionados.splice(idx, 1);
                if (parseInt(hidden.value) === p) hidden.value = prazosSelecionados[prazosSelecionados.length - 1];
            } else { prazosSelecionados.push(p); hidden.value = p; }
            refresh(); updateSpeeds(); calculate();
        } }));
    });
    refresh();
}

function updateSpeeds() {
    renderVisualUF();
    const op = $('selOperadora').value, prod = $('selProduto').value, uf = $('selUF').value, dur = parseInt($('selPrazo').value) || 36;
    const c = $('visualSpeedGrid'), hidden = $('selVelocidade'); c.innerHTML = '';
    const has = !!(op && prod && uf);
    if (!has) { c.innerHTML = '<div class="speed-hint">Escolha operadora, produto e UF para ver as velocidades.</div>'; return; }
    const avail = new Set(window.LPU_DB.filter(i => i.o == op && i.p == prod && i.u == uf && i.d == dur).map(i => i.s));
    if (!avail.size) { c.innerHTML = `<div class="speed-hint">Sem velocidades na LPU para ${esc(prod)} em ${esc(uf)} com ${dur} meses.</div>`; }
    (window.VELOCIDADES_DISPONIVEIS || []).filter(s => avail.has(s)).forEach(s =>
        c.appendChild(chip(Quote.speedLabel(s), { pressed: parseInt(hidden.value) === s, onclick: () => { hidden.value = s; clearErr('speed'); updateSpeeds(); calculate(); } })));
    if (hidden.value && !avail.has(parseInt(hidden.value))) hidden.value = '';
}

// Opções avançadas
function optRow({ id, nome, tag, desc, input }) {
    const l = document.createElement('label'); l.className = 'opt'; l.htmlFor = id;
    l.innerHTML = `<input type="checkbox" id="${id}"><span class="opt-main"><span class="opt-name">${esc(nome)}</span>${tag ? `<span class="opt-tag">${esc(tag)}</span>` : ''}${input ? `<input type="number" id="${input}" class="input" min="1" step="1" inputmode="numeric" placeholder="Quantidade de IPs" hidden>` : ''}</span>` +
        (desc ? `<span class="tipwrap"><span class="tip-btn" tabindex="0" role="img" aria-label="${esc(desc)}">${ic('info')}</span><span class="tip" role="tooltip">${esc(desc)}</span></span>` : '');
    l.querySelector('.tipwrap')?.addEventListener('click', e => e.preventDefault());
    return l;
}
function renderOptions() {
    const loc = $('localContainer'); loc.innerHTML = '';
    window.LOCAL_DB.forEach(o => loc.appendChild(optRow(o)));
    loc.appendChild(optRow({ id: 'checkRural', nome: 'Zona rural', tag: 'instalação por distância', desc: 'A instalação passa a ser calculada pela distância informada e substitui a instalação urbana.' }));
    const groups = { local: $('specialsLocal'), circuito: $('specialsCircuito'), ips: $('specialsIps') };
    Object.values(groups).forEach(g => g.innerHTML = '');
    window.SPECIALS_DB.forEach(s => groups[s.grupo || 'circuito'].appendChild(optRow({ id: `sp_${s.id}`, nome: s.nome, tag: s.tag, desc: s.desc, input: s.input ? `val_${s.id}` : null })));
}
function updateAdvSummary() {
    const n = document.querySelectorAll('#advDetails input[type=checkbox]:checked').length;
    $('advSummary').textContent = n ? `${n} ${n === 1 ? 'opção ativa' : 'opções ativas'}` : 'SLA, dupla abordagem, IPs, MTU, local e outras regras';
}

// --- VALIDAÇÃO ---
function clearErr(f) { const el = document.querySelector(`.field[data-field="${f}"]`); if (el) { el.classList.remove('err'); el.querySelector('.ferr').textContent = ''; } }
function setErr(f, msg) { const el = document.querySelector(`.field[data-field="${f}"]`); if (el) { el.classList.add('err'); el.querySelector('.ferr').textContent = msg; } }
function validate(sel) {
    let first = null;
    const bad = (f, msg) => { setErr(f, msg); first = first || document.querySelector(`.field[data-field="${f}"]`); };
    if (!sel.op) bad('op', 'Escolha a operadora.');
    if (!sel.prod) bad('prod', sel.op ? 'Escolha o produto.' : 'Escolha a operadora primeiro.');
    if (!sel.uf) bad('uf', 'Escolha a UF.');
    if (!sel.speed) bad('speed', 'Escolha a velocidade.');
    let advErr = false;
    $('errDist').textContent = ''; $('inputDistancia').classList.remove('bad');
    if (sel.opts.rural) {
        const d = parseFloat(sel.opts.distancia);
        if (!(d > 0)) { $('errDist').textContent = 'Informe a distância em metros (maior que zero).'; $('inputDistancia').classList.add('bad'); advErr = true; }
    }
    if (isChecked('ips') && !(parseFloat(sel.opts.qtdIp) >= 1)) { toast('Informe a quantidade de IPs fixos (1 ou mais).', 'err'); advErr = true; }
    if (advErr) { setAdv(true); }
    return { ok: !first && !advErr, first };
}

// --- CÁLCULO ---
function calculate() { renderResult(false); }

function renderResult() {
    const sel = getSel();
    const q = Quote.buildQuote(sel, { db: window.LPU_DB, Pricing: window.Pricing });
    lastQuote = q;
    const empty = $('resEmpty'), content = $('resContent'), details = $('details');
    if (!q.ok) {
        content.hidden = true; details.classList.add('noq'); empty.hidden = false;
        const inv = q.motivo === 'sem_lpu';
        empty.classList.toggle('bad', inv);
        empty.querySelector('.empty-ic').innerHTML = ic(inv ? 'xc' : 'bolt', 'ic');
        empty.querySelector('h3').textContent = inv ? 'Inviável: sem preço na LPU' : 'Sua cotação aparece aqui';
        $('emptyMsg').textContent = inv ? q.status.reasons[0] : 'Escolha operadora, produto, UF e velocidade. O prazo já vem marcado em 36 meses.';
        $('emptyList').innerHTML = inv ? '' : q.missing.map(m => `<li>Falta: ${esc(m)}</li>`).join('');
        if (activeTab === 'comparar') renderCompare();
        return q;
    }
    empty.hidden = true; content.hidden = false; details.classList.remove('noq');
    const s = q.status, d = q.display;
    $('badge').className = 'badge ' + s.level;
    $('badge').querySelector('.b-ic').innerHTML = ic(s.level === 'viavel' ? 'checkc' : s.level === 'atencao' ? 'alert' : 'xc', 'ic');
    $('badge').querySelector('.b-ic svg').setAttribute('style', 'width:26px;height:26px');
    $('badgeTxt').textContent = s.label;
    $('reasons').innerHTML = s.reasons.map(r => `<li>${esc(r)}</li>`).join('');
    $('viab').style.setProperty('--st', s.level);

    $('resMensal').textContent = money(d.mensal);
    $('resInstalacao').textContent = money(d.inst);
    const notaI = sel.opts.rural ? ' | Instalação zona rural' : '';
    $('resMensalObs').textContent = (d.sub ? `${d.rotulo} | ${d.sub.rotulo}: ${money(d.sub.mensal)}` : d.rotulo) + d.nota;
    $('resInstalacaoObs').textContent = (d.sub ? `${d.rotulo} | ${d.sub.rotulo}: ${money(d.sub.inst)}` : d.rotulo) + notaI;
    $('metaLine').innerHTML = [['Prazo', `${sel.dur} meses`], ['Velocidade', Quote.speedLabel(sel.speed)], ['Operadora', sel.op], ['Produto', sel.prod], ['UF', sel.uf]]
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');

    renderPrazos(q);
    renderComposition(q);
    $('factsList').innerHTML = q.factors.map(f => `<li>${ic('check')}${esc(f.label)}</li>`).join('');
    const ig = $('factsIgnored'); ig.hidden = !q.ignorados.length;
    ig.textContent = q.ignorados.length ? `Marcado, mas sem efeito no preço: ${q.ignorados.join(', ')}.` : '';
    renderDados(q); renderResumo(q);

    const sig = JSON.stringify([sel.op, sel.prod, sel.uf, sel.speed, sel.prazos, sel.opts]);
    if (sig !== lastSig) {
        lastSig = sig;
        liveText = Quote.buildCommercialText(q);
        $('emailTemplate').value = liveText; dirty = false;
        $('emailSubject').value = Quote.buildEmailSubject(sel);
        $('iaBody').className = 'ia-empty';
        $('iaBody').textContent = 'Gere observações sobre instalação, fatores de maior impacto e prazo, usando apenas os dados desta cotação.';
        document.querySelectorAll('.m-v, .viab').forEach(el => { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); });
    }
    if (activeTab === 'comparar') renderCompare();
    return q;
}

const valsByMode = (r, mode) => mode === 'sem' ? [r.mensalClean, r.instalacaoClean] : [r.mensalFull, r.instalacaoFull];

function renderPrazos(q) {
    const box = $('prazosTable');
    if (q.porPrazo.length < 2) { box.hidden = true; return; }
    box.hidden = false;
    const mode = q.sel.impostoMode;
    box.innerHTML = `<div class="table-wrap"><table class="tbl"><thead><tr><th>Prazo</th><th class="n">Mensalidade</th><th class="n">Instalação</th></tr></thead><tbody>` +
        q.porPrazo.map(p => { if (!p.ok) return `<tr><td>${p.dur} meses</td><td class="n na" colspan="2">Sem valor na LPU</td></tr>`; const [m, i] = valsByMode(p.r, mode);
            return `<tr class="${p.dur === q.sel.dur ? 'cur' : ''}"><td>${p.dur} meses${p.dur === q.sel.dur ? '<span class="tag">principal</span>' : ''}</td><td class="n">${money(m)}</td><td class="n">${money(i)}</td></tr>`; }).join('') + '</tbody></table></div>';
}

function stepVal(p) { return p.tipo === 'add' ? `<span class="v pos">+ ${money(p.valor)}</span>` : `<span class="v ${p.pct < 0 ? 'neg' : 'pos'}">${Quote.fmtPct(p.pct)}</span>`; }

function renderComposition(q) {
    const c = q.composition, box = $('compoSimple'), det = $('compoDetail');
    if (!c.consistente) { box.innerHTML = '<p class="note">Não foi possível montar a composição desta combinação com segurança. O valor final do painel continua correto.</p>'; det.innerHTML = ''; $('btnDetail').hidden = true; return; }
    $('btnDetail').hidden = false;
    const mode = q.sel.impostoMode;
    const block = (titulo, bloco, baseLabel, finalLabel, fullVal, tax) => {
        let h = `<div class="compo-sub">${titulo}</div>`;
        if (baseLabel) h += `<div class="compo-row base"><span>${baseLabel}</span><span class="v">${money(bloco.base)}</span></div>`;
        h += bloco.steps.length ? bloco.steps.map(p => `<div class="compo-row"><span>${esc(p.label)}</span>${stepVal(p)}</div>`).join('') : '<div class="compo-row"><span>Sem fatores adicionais</span><span class="v">—</span></div>';
        h += `<div class="compo-row final"><span>${finalLabel}</span><span class="v">${money(bloco.final)}</span></div>`;
        if (mode !== 'sem') h += `<div class="compo-row"><span>Com impostos (x${Quote.fmtNum(tax, 4)})</span><span class="v">${money(fullVal)}</span></div>`;
        return h;
    };
    box.innerHTML = block('Mensalidade (sem impostos)', c.mensal, 'LPU base', 'Mensalidade final', q.r.mensalFull, c.impostos.taxM) +
        block('Instalação (sem impostos)', c.inst, c.inst.rural ? '' : 'LPU base', 'Instalação final', q.r.instalacaoFull, c.impostos.taxI);

    const rows = (titulo, bloco, base) => `<div class="compo-sub">${titulo}</div>` +
        (base !== null ? `<div class="compo-row"><span class="lbl-w">LPU base</span><span class="v">${money(base)}</span></div>` : '') +
        bloco.steps.map(p => `<div class="compo-row"><span class="lbl-w"><span>${esc(p.label)}</span><span class="t">${p.tipo === 'add' ? 'soma' : p.tipo === 'faixa' ? 'faixa aplicada ao total' : 'multiplica'} | subtotal ${money(p.total)}</span></span>${stepVal(p)}</div>`).join('');
    const f = q.r.fatores;
    det.innerHTML = rows('Mensalidade: passo a passo', c.mensal, c.mensal.base) + rows('Instalação: passo a passo', c.inst, c.inst.rural ? null : c.inst.base) +
        `<div class="compo-sub">Impostos</div><p class="note" style="margin-top:0">Razão da própria linha da LPU (com impostos ÷ sem impostos): mensalidade x${Quote.fmtNum(c.impostos.taxM, 4)}, instalação x${Quote.fmtNum(c.impostos.taxI, 4)}.</p>`;
}

function renderDados(q) {
    const regras = Quote.characteristics(q);
    const linhas = [
        ['Data da cotação', new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })],
        ['Tabela utilizada', q.fonte || 'Sem planilha de referência no projeto'],
        ['Regras aplicadas', regras.length ? `${regras.length}: ${regras.join(', ')}` : 'Nenhuma além da LPU'],
        ['Faixa de volume', q.r.faixa === 0.65 ? 'x0,65 (acima de R$ 15 mil)' : q.r.faixa === 0.85 ? 'x0,85 (R$ 10 a 15 mil)' : 'Não aplicada'],
        ['Atualização das tabelas', 'Não informada nos arquivos']
    ];
    $('dadosList').innerHTML = linhas.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
}

function summaryRows(q) {
    const d = q.display, car = Quote.characteristics(q);
    const rows = [['Operadora', q.sel.op], ['Produto', q.sel.prod], ['UF', q.sel.uf], ['Velocidade', Quote.speedLabel(q.sel.speed)], ['Prazo', `${q.sel.dur} meses`],
        [`Mensalidade (${d.rotulo.toLowerCase()})`, money(d.mensal)], [`Instalação (${d.rotulo.toLowerCase()})`, money(d.inst)]];
    if (d.sub) rows.push(['Mensalidade (sem impostos)', money(d.sub.mensal)], ['Instalação (sem impostos)', money(d.sub.inst)]);
    rows.push(['Características adicionais', car.length ? car.join(', ') : 'Nenhuma']);
    return rows;
}
function renderResumo(q) { $('summaryList').innerHTML = summaryRows(q).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join(''); }

// --- COMPARAÇÃO (sem ranking) ---
function renderCompare() {
    const sel = getSel(), tbl = $('cmpTable'), note = $('cmpNote');
    if (!sel.prod || !sel.uf || !sel.speed) {
        tbl.innerHTML = ''; note.textContent = 'Escolha produto, UF e velocidade para comparar as operadoras com os mesmos parâmetros.'; return;
    }
    const rows = Quote.compareOperators(sel, { db: window.LPU_DB, Pricing: window.Pricing });
    const mode = sel.impostoMode, lbl = mode === 'sem' ? 'sem impostos' : 'com impostos';
    note.textContent = `${sel.prod} ${Quote.speedLabel(sel.speed)} em ${sel.uf}, ${sel.dur} meses, valores ${mode === 'ambos' ? 'com impostos' : lbl}, com as mesmas opções avançadas. Ordem alfabética, sem classificação.`;
    tbl.innerHTML = `<thead><tr><th>Operadora</th><th class="n">Mensalidade</th><th class="n">Instalação</th><th>Prazo</th></tr></thead><tbody>` +
        rows.map(r => r.ok
            ? `<tr class="${r.atual ? 'cur' : ''}"><td>${esc(r.op)}${r.atual ? '<span class="tag">selecionada</span>' : ''}</td><td class="n">${money(r.display.mensal)}</td><td class="n">${money(r.display.inst)}</td><td>${sel.dur} meses</td></tr>`
            : `<tr><td>${esc(r.op)}</td><td class="n na" colspan="2">Sem preço na LPU</td><td>${sel.dur} meses</td></tr>`).join('') + '</tbody>';
}
// Abas do painel de resultado
function activateTab(name, focus) {
    activeTab = name;
    document.querySelectorAll('.tab').forEach(t => { const on = t.dataset.tab === name; t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on)); if (on && focus) t.focus(); });
    document.querySelectorAll('.panel').forEach(p => { p.hidden = p.id !== 'tab-' + name; });
    if (name === 'comparar') renderCompare();
}

// --- HISTÓRICO ---
function fmtDate(iso) { try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return ''; } }
function saveToHistory(q) {
    const s = q.sel, d = q.display;
    const assunto = $('emailSubject').value.trim() || Quote.buildEmailSubject(s);
    const list = Historico.add({ op: s.op, prod: s.prod, uf: s.uf, speed: s.speed, prazos: s.prazos, dur: s.dur, opts: s.opts, impostoMode: s.impostoMode, mensal: d.mensal, inst: d.inst, rotulo: d.rotulo,
        assunto, adicionais: Quote.optsLabels(s.opts), local: window.lastLocal || null });
    renderHistory(); return !!list;
}
function histAdicionais(e) {
    const ad = Array.isArray(e.adicionais) ? e.adicionais : Quote.optsLabels(e.opts); // registros antigos não tinham a lista
    const loc = e.local && (e.local.municipio || e.local.endereco) ? `<div class="hist-loc">${ic('pin')}<span>Local analisado: ${esc([e.local.endereco, [e.local.municipio, e.local.uf].filter(Boolean).join('/')].filter(Boolean).join(' | '))}</span></div>` : '';
    return `<div class="hist-ad"><span class="hist-ad-k">Adicionais</span>${ad.length ? ad.map(a => `<span class="hist-chip">${esc(a)}</span>`).join('') : '<span class="hist-none">Nenhum</span>'}</div>${loc}`;
}
function renderHistory() {
    const list = Historico.load(), box = $('histList');
    $('histCount').hidden = !list.length; $('histCount').textContent = list.length;
    $('btnClearHist').hidden = !list.length;
    if (!list.length) { box.innerHTML = '<div class="hist-empty"><strong>Nenhuma cotação salva ainda.</strong><br>Cada vez que você usar "Calcular cotação", ela é registrada aqui, neste navegador.</div>'; return; }
    box.innerHTML = list.map(e => `<article class="hist-item" data-id="${esc(e.id)}">
        <div class="hist-top"><span title="Data e hora em que foi salvo">Salvo em ${esc(fmtDate(e.data))}</span><span>${esc(e.uf)} | ${esc(e.dur)} meses</span></div>
        <div class="hist-subject">${esc(e.assunto || Quote.buildEmailSubject(e))}</div>
        <div class="hist-title">${esc(e.op)} | ${esc(e.prod)} | ${esc(Quote.speedLabel(e.speed))}</div>
        ${histAdicionais(e)}
        <div class="hist-vals"><span>Mensalidade<b>${money(e.mensal)}</b></span><span>Instalação<b>${money(e.inst)}</b></span><span>${esc(e.rotulo || '')}</span></div>
        <div class="hist-act"><button type="button" class="btn secondary sm" data-act="open">${ic('open')}Abrir</button><button type="button" class="btn ghost sm" data-act="dup">${ic('copy')}Duplicar</button><button type="button" class="btn ghost sm" data-act="del">${ic('trash')}Excluir</button></div></article>`).join('');
}
function openEntry(e) {
    if (!window.LPU_DB.some(i => i.o === e.op)) { toast('Essa operadora não existe mais nas tabelas.', 'err'); return; }
    prazosSelecionados = (e.prazos && e.prazos.length ? e.prazos : [e.dur]).filter(p => PRAZOS_DISPONIVEIS.includes(p));
    if (!prazosSelecionados.length) prazosSelecionados = [...PRAZOS_INICIAIS];
    $('selOperadora').value = e.op; $('selProduto').value = e.prod; $('selUF').value = e.uf; $('selVelocidade').value = e.speed;
    setImposto(e.impostoMode || 'sem', true);
    renderPrazoButtons(); renderOperators(); updateProducts(); renderVisualUF(); updateSpeeds(); setOptions(e.opts);
    if (Object.values(e.opts || {}).some(Boolean)) setAdv(true);
    calculate();
    $('emailSubject').value = e.assunto || Quote.buildEmailSubject(e);
    window.lastLocal = e.local || null; if (window.LocalUI) window.LocalUI.restore(e.local);
    toggleDrawer(false); toast('Cotação aberta.');
    $('resultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
let drawerOpener = null;
function toggleDrawer(open) {
    const dr = $('drawer'), sc = $('scrim');
    if (open) { drawerOpener = document.activeElement; renderHistory(); sc.hidden = false; requestAnimationFrame(() => sc.classList.add('on')); dr.classList.add('on'); dr.setAttribute('aria-hidden', 'false'); dr.focus(); }
    else { sc.classList.remove('on'); setTimeout(() => { if (!dr.classList.contains('on')) sc.hidden = true; }, 260); dr.classList.remove('on'); dr.setAttribute('aria-hidden', 'true'); if (drawerOpener && drawerOpener.focus) drawerOpener.focus(); }
}

// --- COPIAR ---
async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
        const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
        let ok = false; try { ok = document.execCommand('copy'); } catch (er) { ok = false; } ta.remove(); return ok;
    }
}
function flash(btn, txt) {
    const l = btn.querySelector('.lbl'), old = l.textContent; l.textContent = txt; btn.classList.add('done');
    setTimeout(() => { l.textContent = old; btn.classList.remove('done'); }, 1800);
}
async function copySummary(btn) {
    if (!lastQuote || !lastQuote.ok) return;
    if (await copyText(Quote.buildSummaryText(lastQuote))) { flash(btn, 'Resumo copiado!'); toast('Resumo copiado!'); } else toast('Não foi possível copiar. Selecione o texto e copie manualmente.', 'err');
}
async function copyEmail() {
    const v = $('emailTemplate').value; if (!v) return;
    if (await copyText(v)) { flash($('btnCopy'), 'Texto copiado!'); toast('Texto comercial copiado!'); } else toast('Não foi possível copiar. Selecione o texto e copie manualmente.', 'err');
}

// --- IA (via servidor; a chave nunca fica no navegador) ---
function busy(btn, on) { btn.classList.toggle('loading', on); btn.disabled = on; }
async function callGeminiAI() {
    const q = lastQuote; if (!q || !q.ok) return;
    const btn = $('btnMagicAI'); $('errTexto').textContent = ''; busy(btn, true);
    try {
        const payload = Quote.buildAiPayload(q, $('emailTemplate').value);
        delete payload.operadora; // o texto ao cliente não cita a operadora
        const out = await AI.melhorar(payload);
        $('emailTemplate').value = out; dirty = true; toast('Texto melhorado. Revise antes de enviar.');
    } catch (e) { $('errTexto').textContent = e.message; toast(e.message, 'err'); } finally { busy(btn, false); }
}
async function analyzeAI() {
    const q = lastQuote; if (!q || !q.ok) return;
    const btn = $('btnAnalyze'), box = $('iaBody'); busy(btn, true);
    try {
        const out = await AI.analisar(Quote.buildAiPayload(q, ''));
        const itens = out.split(/\n+/).map(l => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean);
        box.className = ''; box.innerHTML = `<ul class="ia-out">${itens.map(i => `<li>${esc(i)}</li>`).join('')}</ul><p class="ia-note">Gerado por IA a partir dos dados desta cotação. Não altera valores: confira antes de usar.</p>`;
    } catch (e) { box.className = 'ia-err'; box.textContent = e.message; toast(e.message, 'err'); } finally { busy(btn, false); }
}

// --- EXPORTAR PROPOSTA (PDF via impressão do navegador) ---
function exportProposal() {
    const q = lastQuote; if (!q || !q.ok) return;
    const s = q.sel, d = q.display, c = q.composition, car = Quote.characteristics(q);
    const steps = b => b.steps.map(p => `<tr><td>${esc(p.label)}</td><td class="n">${p.tipo === 'add' ? '+ ' + money(p.valor) : Quote.fmtPct(p.pct)}</td></tr>`).join('') || '<tr><td colspan="2">Sem fatores adicionais</td></tr>';
    const prazos = q.porPrazo.filter(p => p.ok).map(p => { const [m, i] = valsByMode(p.r, s.impostoMode === 'sem' ? 'sem' : 'com'); return `<tr><td>${p.dur} meses</td><td class="n">${money(m)}</td><td class="n">${money(i)}</td></tr>`; }).join('');
    $('printRoot').innerHTML = `
        <div class="p-head"><div class="p-brand"><div class="p-logo">S</div><div><h1>Proposta comercial</h1><div class="p-sub">Sitelbra Wholesale</div></div></div><div class="p-sub">${esc(new Date().toLocaleDateString('pt-BR'))}<br>Validade: 30 dias</div></div>
        <section><h2>Dados da cotação</h2><table><tr><td>Produto</td><td class="n">${esc(s.prod)}</td></tr><tr><td>UF</td><td class="n">${esc(s.uf)}</td></tr><tr><td>Velocidade</td><td class="n">${Quote.speedLabel(s.speed)}</td></tr><tr><td>Prazo contratual</td><td class="n">${s.dur} meses</td></tr></table></section>
        <section><h2>Valores (${esc(d.rotulo.toLowerCase())})</h2><div class="p-big"><div>Mensalidade<b>${money(d.mensal)}</b></div><div>Instalação<b>${money(d.inst)}</b></div></div>
        ${q.porPrazo.length > 1 ? `<table><tr><th>Prazo</th><th class="n">Mensalidade</th><th class="n">Instalação</th></tr>${prazos}</table>` : ''}</section>
        <section><h2>Características</h2><p>${car.length ? esc(car.join(', ')) : 'Configuração padrão, sem adicionais.'}</p></section>
        ${c.consistente ? `<section><h2>Composição do preço</h2><table><tr><th>Mensalidade</th><th class="n"></th></tr><tr><td>LPU base</td><td class="n">${money(c.mensal.base)}</td></tr>${steps(c.mensal)}<tr><td><b>Mensalidade final (sem impostos)</b></td><td class="n"><b>${money(c.mensal.final)}</b></td></tr></table><br>
        <table><tr><th>Instalação</th><th class="n"></th></tr>${c.inst.rural ? '' : `<tr><td>LPU base</td><td class="n">${money(c.inst.base)}</td></tr>`}${steps(c.inst)}<tr><td><b>Instalação final (sem impostos)</b></td><td class="n"><b>${money(c.inst.final)}</b></td></tr></table></section>` : ''}
        <section><h2>Texto comercial</h2><pre>${esc($('emailTemplate').value)}</pre></section>
        <div class="p-foot">Documento gerado pelo sistema de cotação Sitelbra Wholesale. Valores sujeitos à confirmação de viabilidade técnica.</div>`;
    const oldTitle = document.title; document.title = `Proposta Sitelbra - ${s.prod} ${Quote.speedLabel(s.speed)} ${s.uf}`;
    const done = () => { document.title = oldTitle; $('printRoot').innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    toast('Na janela de impressão, escolha "Salvar como PDF".');
    setTimeout(() => window.print(), 250);
}

// --- UI auxiliar ---
// Análise avançada: sempre aberta no desktop; recolhível em telas pequenas
function setAdv(open) { $('advDetails').open = !!open; }
const mqDesk = window.matchMedia('(min-width: 1101px)');
function syncAdv() { if (mqDesk.matches) $('advDetails').open = true; }
function setImposto(mode, silent) { $('selImpostoMode').value = mode; if (!silent) calculate(); }

// Botão principal: valida, mostra loading, salva no histórico e leva ao resultado
function onCalcClick() {
    if (computing) return;
    ['op', 'prod', 'uf', 'speed'].forEach(clearErr);
    const sel = getSel(), v = validate(sel);
    if (!v.ok) { if (v.first) v.first.scrollIntoView({ behavior: 'smooth', block: 'center' }); toast('Revise os campos destacados.', 'err'); calculate(); return; }
    computing = true; const btn = $('btnCalc'); busy(btn, true);
    setTimeout(() => {
        const q = renderResult();
        busy(btn, false); computing = false;
        if (q.ok) {
            const saved = saveToHistory(q);
            toast(saved ? 'Cotação calculada e salva no histórico.' : 'Cotação calculada. O histórico não pôde ser salvo neste navegador.', saved ? 'ok' : 'err');
            if (!mqDesk.matches) $('resultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else toast(q.status ? q.status.reasons[0] : 'Revise os campos.', 'err');
    }, 380);
}

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    $('currentDate').textContent = new Date().toLocaleDateString('pt-BR');
    renderOptions(); renderOperators(); renderVisualUF(); renderPrazoButtons(); updateProducts(); updateSpeeds(); hydrateIcons(); renderHistory();

    $('btnCalc').addEventListener('click', onCalcClick);
    syncAdv(); (mqDesk.addEventListener ? mqDesk.addEventListener('change', syncAdv) : mqDesk.addListener(syncAdv));
    if (!mqDesk.matches) $('advDetails').open = false;

    // Opções avançadas: um único listener delegado
    $('advDetails').addEventListener('change', e => {
        const t = e.target;
        if (t.id === 'checkRural') $('ruralOptions').hidden = !t.checked;
        if (t.id === 'sp_ips' && $('val_ips')) { $('val_ips').hidden = !t.checked; if (t.checked) $('val_ips').focus(); }
        updateAdvSummary(); calculate();
    });
    $('advDetails').addEventListener('input', e => { if (e.target.type === 'number') { e.target.classList.remove('bad'); $('errDist').textContent = ''; calculate(); } });

    $('selImpostoMode').addEventListener('change', calculate);
    document.querySelector('.tabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) activateTab(t.dataset.tab); });
    $('btnOpenCompare').addEventListener('click', () => { activateTab('comparar'); $('details').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
    const logo = $('brandLogo'), logoFail = () => { logo.hidden = true; $('brandFallback').hidden = false; };
    logo.addEventListener('error', logoFail); if (logo.complete && logo.naturalWidth === 0) logoFail();
    $('btnCopySummary').addEventListener('click', e => copySummary(e.currentTarget));
    $('btnCopySummary2').addEventListener('click', e => copySummary(e.currentTarget));
    $('btnCopy').addEventListener('click', copyEmail);
    $('btnCopySubject').addEventListener('click', async () => { const v = $('emailSubject').value; if (!v) return; if (await copyText(v)) { flash($('btnCopySubject'), 'Assunto copiado!'); toast('Assunto copiado!'); } else toast('Não foi possível copiar.', 'err'); });
    $('btnMagicAI').addEventListener('click', callGeminiAI);
    $('btnAnalyze').addEventListener('click', analyzeAI);
    $('btnRegen').addEventListener('click', () => {
        if (!lastQuote || !lastQuote.ok) return;
        if (dirty && !confirm('Substituir o texto atual pelo texto padrão? Suas edições e o texto da IA serão perdidos.')) return;
        $('emailTemplate').value = Quote.buildCommercialText(lastQuote); $('emailSubject').value = Quote.buildEmailSubject(lastQuote.sel); dirty = false; toast('Texto e assunto regenerados.');
    });
    $('emailTemplate').addEventListener('input', () => { dirty = true; });
    $('btnExport').addEventListener('click', exportProposal);
    $('btnSaveNow').addEventListener('click', () => { if (lastQuote && lastQuote.ok) toast(saveToHistory(lastQuote) ? 'Cotação salva no histórico.' : 'Não foi possível salvar neste navegador.', 'ok'); });
    $('btnDetail').addEventListener('click', () => {
        detailOpen = !detailOpen; $('compoDetail').hidden = !detailOpen; $('btnDetail').setAttribute('aria-expanded', String(detailOpen));
        $('btnDetail').querySelector('.lbl').textContent = detailOpen ? 'Ocultar cálculo detalhado' : 'Ver cálculo detalhado';
    });
    $('compoDetail').hidden = true;

    $('btnOpenHistory').addEventListener('click', () => toggleDrawer(true));
    $('btnCloseHistory').addEventListener('click', () => toggleDrawer(false));
    $('scrim').addEventListener('click', () => toggleDrawer(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('drawer').classList.contains('on')) toggleDrawer(false); });
    $('btnClearHist').addEventListener('click', () => { if (confirm('Excluir todo o histórico de cotações deste navegador?')) { Historico.clear(); renderHistory(); toast('Histórico limpo.'); } });
    $('histList').addEventListener('click', e => {
        const b = e.target.closest('button[data-act]'); if (!b) return;
        const id = b.closest('.hist-item').dataset.id;
        if (b.dataset.act === 'open') { const en = Historico.get(id); if (en) openEntry(en); }
        else if (b.dataset.act === 'dup') { Historico.duplicate(id); renderHistory(); toast('Cotação duplicada.'); }
        else if (b.dataset.act === 'del') { Historico.remove(id); renderHistory(); toast('Cotação excluída.'); }
    });
    calculate();
});
