// rede.js - Aba "Rede própria": login (Firebase Auth), base de ativos (Firestore), importação da planilha do Metabase,
// busca por endereço/coordenadas e comparação com a LPU. Lógica pura em rede-core.js. Depende de script.js (toast, esc, ic...).
(function () {
    const $ = id => document.getElementById(id);
    const RC = window.RedeCore;
    Object.assign(ICONS, {
        pin: 'M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
        upload: 'M12 16V5M7 9l5-5 5 5M5 20h14', net: 'M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 19.5v.01',
        user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0'
    });
    const money = v => Quote.fmtBRL(v);
    const fmtDist = m => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km`;
    const mapsUrl = (lat, lon) => `https://www.google.com/maps?q=${lat},${lon}`;

    // ---------- ESTADO ----------
    const S = { fb: null, user: null, ready: false, point: null, geo: [], found: [], sheet: null, rows: [], map: {}, lastPayload: null, busy: false };
    const COST_KEY = 'sitelbra.rede.custoMetro';

    // ---------- FIREBASE ----------
    async function initFirebase() {
        const cfg = window.FIREBASE_CONFIG;
        if (!cfg || !cfg.apiKey || !cfg.projectId) return false;
        const base = `https://www.gstatic.com/firebasejs/${window.FIREBASE_VERSAO_SDK || '10.14.1'}/`;
        const [app, auth, fs] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')]);
        const a = app.initializeApp(cfg);
        S.fb = { auth: auth.getAuth(a), db: fs.getFirestore(a), A: auth, F: fs };
        S.fb.A.onAuthStateChanged(S.fb.auth, u => { S.user = u; renderAuth(); if (u) loadMeta(); });
        // a IA usa o token de quem está logado (ver ai.js)
        window.SitelbraAuth = { token: async () => (S.user ? S.user.getIdToken() : null) };
        return true;
    }
    const friendlyAuthErr = e => ({
        'auth/invalid-credential': 'E-mail ou senha incorretos.', 'auth/wrong-password': 'E-mail ou senha incorretos.', 'auth/user-not-found': 'E-mail ou senha incorretos.',
        'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.', 'auth/network-request-failed': 'Sem conexão com o Firebase.', 'auth/invalid-email': 'E-mail inválido.'
    }[e && e.code] || 'Não foi possível entrar. Confira os dados.');
    const friendlyDbErr = e => e && e.code === 'permission-denied' ? 'Sem permissão. Entre com uma conta liberada (e, para importar, que esteja na lista de administradores das regras).' : (e && e.message) || 'Erro no Firebase.';

    // ---------- AUTENTICAÇÃO / TELAS ----------
    function renderAuth() {
        const chip = $('userChip'), gate = $('rGate'), body = $('rBody');
        const cfg = !!S.fb, logged = !!S.user;
        chip.hidden = !logged; chip.querySelector('.u-mail').textContent = logged ? S.user.email : '';
        $('btnLoginTop').hidden = logged || !cfg;
        body.hidden = !logged;
        $('rBuscar').disabled = !logged;
        if (!cfg) {
            gate.hidden = false;
            gate.innerHTML = `<div class="gate-card"><h2>Falta conectar o Firebase</h2>
                <p>A base de ativos da rede própria fica no Firestore. Para ligar:</p>
                <ol><li>No <b>console.firebase.google.com</b>, crie (ou abra) um projeto e adicione um <b>app Web</b>.</li>
                <li>Em <b>Authentication</b>, ative <b>E-mail/senha</b>, desligue o cadastro público e crie seu usuário.</li>
                <li>Crie o <b>Firestore Database</b> e cole as regras do arquivo <code>firestore.rules</code>.</li>
                <li>Cole o objeto de configuração em <code>firebase-config.js</code> e recarregue.</li></ol></div>`;
        } else if (!logged) {
            gate.hidden = false;
            gate.innerHTML = `<div class="gate-card"><h2>Entrar</h2><p>A base de ativos é restrita. Use o usuário criado no Firebase.</p>
                <div class="form-group"><label for="lgMail">E-mail</label><input id="lgMail" class="input" type="email" autocomplete="username"></div>
                <div class="form-group"><label for="lgPass">Senha</label><input id="lgPass" class="input" type="password" autocomplete="current-password"></div>
                <div class="ferr" id="lgErr" role="alert"></div>
                <div class="actions"><button type="button" class="btn primary" id="lgGo"><span class="spin" aria-hidden="true"></span><span class="lbl">Entrar</span></button>
                <button type="button" class="btn link" id="lgReset">Esqueci a senha</button></div></div>`;
            $('lgGo').addEventListener('click', doLogin);
            $('lgPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
            $('lgReset').addEventListener('click', async () => {
                const m = $('lgMail').value.trim(); if (!m) { $('lgErr').textContent = 'Digite o e-mail para receber o link.'; return; }
                try { await S.fb.A.sendPasswordResetEmail(S.fb.auth, m); toast('Se o e-mail existir, o link de redefinição foi enviado.'); } catch (e) { $('lgErr').textContent = friendlyAuthErr(e); }
            });
        } else gate.hidden = true;
    }
    async function doLogin() {
        const btn = $('lgGo'); $('lgErr').textContent = ''; busy(btn, true);
        try { await S.fb.A.signInWithEmailAndPassword(S.fb.auth, $('lgMail').value.trim(), $('lgPass').value); }
        catch (e) { $('lgErr').textContent = friendlyAuthErr(e); } finally { busy(btn, false); }
    }

    // ---------- BASE: STATUS ----------
    async function loadMeta() {
        const box = $('baseStatus'); box.textContent = 'Lendo a base…';
        try {
            const { F, db } = S.fb, snap = await F.getDoc(F.doc(db, 'meta', 'ativos'));
            if (!snap.exists()) { box.innerHTML = '<b>Base vazia.</b> Importe a planilha do Metabase abaixo.'; return; }
            const m = snap.data(), dt = m.atualizadoEm && m.atualizadoEm.toDate ? m.atualizadoEm.toDate().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
            box.innerHTML = `<b>${(m.total || 0).toLocaleString('pt-BR')} ativos</b> na base${dt ? `, atualizada em ${esc(dt)}` : ''}${m.arquivo ? ` (${esc(m.arquivo)})` : ''}.`;
        } catch (e) { box.textContent = friendlyDbErr(e); }
    }

    // ---------- IMPORTAÇÃO DA PLANILHA ----------
    function loadSheetJS() {
        if (window.XLSX) return Promise.resolve();
        return new Promise((ok, fail) => {
            const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            s.onload = ok; s.onerror = () => fail(new Error('Não foi possível carregar o leitor de planilhas (cdnjs).')); document.head.appendChild(s);
        });
    }
    async function onFile(file) {
        if (!file) return;
        $('impMsg').textContent = 'Lendo a planilha…'; $('impMap').hidden = true; $('btnImport').disabled = true;
        try {
            await loadSheetJS();
            const wb = /\.csv$/i.test(file.name) ? XLSX.read(await file.text(), { type: 'string' }) : XLSX.read(await file.arrayBuffer(), { type: 'array' });
            S.sheet = { name: file.name, wb };
            const sel = $('impSheet'); sel.innerHTML = wb.SheetNames.map((n, i) => `<option value="${i}">${esc(n)}</option>`).join('');
            sel.parentElement.hidden = wb.SheetNames.length < 2;
            readSheet(0);
        } catch (e) { $('impMsg').textContent = e.message || 'Não foi possível ler este arquivo.'; }
    }
    function readSheet(i) {
        const ws = S.sheet.wb.Sheets[S.sheet.wb.SheetNames[i]];
        const all = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }).filter(r => r.some(c => String(c).trim() !== ''));
        if (all.length < 2) { $('impMsg').textContent = 'A aba está vazia ou só tem o cabeçalho.'; return; }
        S.headers = all[0].map(h => String(h).trim()); S.rows = all.slice(1);
        S.map = RC.detectColumns(S.headers);
        renderMapping(); evaluate();
    }
    function renderMapping() {
        const opts = '<option value="-1">— não tem —</option>' + S.headers.map((h, i) => `<option value="${i}">${esc(h || '(coluna ' + (i + 1) + ')')}</option>`).join('');
        $('impFields').innerHTML = RC.CAMPOS.map(c => `<label class="map-row"><span>${esc(c.label)}</span><select class="input" data-k="${c.key}">${opts}</select></label>`).join('');
        $('impFields').querySelectorAll('select').forEach(s => { s.value = String(S.map[s.dataset.k]); });
        $('impMap').hidden = false;
    }
    function evaluate() {
        S.assets = []; let semCoord = 0; const vistos = new Set();
        S.rows.forEach(r => { const x = RC.rowToAsset(r, S.headers, S.map); if (x.ok) { x.ativo._docId = RC.docId(x.ativo, vistos); x.ativo._pend = !!x.pendente; S.assets.push(x.ativo); } else semCoord++; });
        S.semCoord = semCoord;
        const n = S.assets.length, pend = S.assets.filter(a => a._pend).length, unicos = new Set(S.assets.filter(a => a._pend).map(a => RC.buildQuery(a))).size;
        const min = Math.ceil(unicos * 1.1 / 60);
        const warn = n > 15000 ? ' O plano gratuito do Firebase aceita ~20 mil gravações por dia: considere importar em dias diferentes.' : '';
        $('impMsg').innerHTML = n ? `<b>${n.toLocaleString('pt-BR')}</b> ativos prontos${pend ? `, sendo <b>${pend.toLocaleString('pt-BR')}</b> só com endereço: serão localizados na importação (${unicos.toLocaleString('pt-BR')} endereços diferentes, cerca de <b>${min} min</b>; deixe esta aba aberta)` : ''}${semCoord ? `. <b>${semCoord.toLocaleString('pt-BR')}</b> linhas ignoradas (sem coordenada e sem endereço)` : ''}.${warn}`
            : `Nenhuma linha utilizável. Aponte a coluna de <b>Endereço</b> (ou Latitude/Longitude) abaixo.`;
        $('impPreview').innerHTML = S.assets.slice(0, 3).map(a => `<li>${esc(a.id || a._docId)} | ${a.mbps ? Quote.speedLabel(a.mbps) : 'sem velocidade'} | ${a._pend ? esc(RC.buildQuery(a)) : a.lat + ', ' + a.lon}</li>`).join('');
        $('btnImport').disabled = !n || !S.user;
    }

    // ---------- GEOCODIFICAÇÃO NA IMPORTAÇÃO ----------
    // OpenStreetMap (Nominatim): gratuito, limite de 1 consulta/segundo. Resultados ficam em "geocache" (Firestore):
    // reimportar ou retomar uma importação interrompida não repete consultas.
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let lastNet = 0;
    const TIPOS_OK = ['building', 'amenity', 'office', 'shop', 'craft', 'tourism', 'man_made', 'highway', 'landuse', 'industrial', 'commercial'];
    async function nominatim(q, uf) {
        const wait = 1100 - (Date.now() - lastNet); if (wait > 0) await sleep(wait);
        lastNet = Date.now();
        const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=br&accept-language=pt-BR&q=' + encodeURIComponent(q));
        if (!r.ok) throw new Error('O serviço de endereços recusou a consulta (' + r.status + '). Aguarde alguns minutos e envie de novo: o que já foi localizado fica guardado.');
        for (const x of await r.json()) {
            const ad = x.address || {}, xuf = (ad['ISO3166-2-lvl4'] || '').replace('BR-', '');
            if (!(ad.road || ad.house_number || TIPOS_OK.includes(x.category))) continue;      // descarta resultado só de cidade/bairro
            if (uf && xuf && uf !== xuf) continue;                                             // descarta outra UF
            const lat = +x.lat, lon = +x.lon; if (!RC.inBrasil(lat, lon)) continue;
            return { lat: +lat.toFixed(6), lon: +lon.toFixed(6), prec: ad.house_number ? 'endereco' : 'rua' };
        }
        return null;
    }
    async function geoQuery(q, uf, memo) {
        if (memo.has(q)) return memo.get(q);
        const { F, db } = S.fb, ref = F.doc(db, 'geocache', 'g_' + RC.hashStr(q));
        let res, snap = null;
        try { snap = await F.getDoc(ref); } catch (e) { /* sem cache: segue */ }
        if (snap && snap.exists() && snap.data().q === q) res = snap.data().ok ? { lat: snap.data().lat, lon: snap.data().lon, prec: snap.data().prec } : null;
        else {
            res = await nominatim(q, uf);
            try { await F.setDoc(ref, res ? { q, ok: true, ...res, em: F.serverTimestamp() } : { q, ok: false, em: F.serverTimestamp() }); } catch (e) { /* cache é opcional */ }
        }
        memo.set(q, res); return res;
    }
    async function geocodeAll(pend, prog) {
        const memo = new Map(), t0 = Date.now(); let feitos = 0, achados = 0; S.naoLoc = [];
        for (const a of pend) {
            if (S.stop) throw new Error('Interrompido. O que já foi localizado ficou guardado: ao enviar de novo, continua de onde parou.');
            const q1 = RC.buildQuery(a), q2 = RC.buildQuery({ ...a, endereco: RC.stripNumber(a.endereco) });
            let r = await geoQuery(q1, a.uf, memo), prec = r && r.prec;
            if (!r && q2 !== q1) { r = await geoQuery(q2, a.uf, memo); prec = r ? 'rua' : null; }
            if (r) { a.lat = r.lat; a.lon = r.lon; a.geoPrec = prec === 'endereco' ? 'endereco' : 'rua'; a._pend = false; achados++; } else S.naoLoc.push(a);
            feitos++; if (feitos % 5 === 0 || feitos === pend.length) prog(feitos, pend.length, achados, (Date.now() - t0) / feitos);
        }
    }
    function baixarNaoLocalizados() {
        const linhas = [['Designacao', 'Endereco', 'Cidade', 'UF', 'Consulta usada']].concat(S.naoLoc.map(a => [a.id, a.endereco, a.cidade, a.uf, RC.buildQuery(a)]));
        const csv = '\ufeff' + linhas.map(l => l.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
        const u = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a');
        a.href = u; a.download = 'ativos_nao_localizados.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 2000);
    }
    async function doImport() {
        if (!S.assets.length || S.busy) return;
        const pend0 = S.assets.filter(a => a._pend).length;
        if (!confirm(`Enviar ${S.assets.length.toLocaleString('pt-BR')} ativos para o Firebase${pend0 ? ` (${pend0.toLocaleString('pt-BR')} serão localizados pelo endereço primeiro)` : ''}${$('impStale').checked ? ' e remover os que não estão mais na planilha' : ''}?`)) return;
        S.busy = true; S.stop = false; const btn = $('btnImport'); busy(btn, true); $('btnNaoLoc').hidden = true;
        const { F, db } = S.fb, importId = Date.now().toString(36), prog = $('impProg'); prog.hidden = false; prog.value = 0;
        try {
            const pend = S.assets.filter(a => a._pend);
            if (pend.length) {
                $('btnImpStop').hidden = false;
                await geocodeAll(pend, (f, t, ach, seg) => { prog.value = Math.round(f / t * 100); const falta = Math.ceil((t - f) * seg / 60000); $('impProgTxt').textContent = `Localizando endereços: ${f.toLocaleString('pt-BR')} de ${t.toLocaleString('pt-BR')} (${ach.toLocaleString('pt-BR')} localizados, faltam ~${falta} min)`; });
                $('btnImpStop').hidden = true;
            }
            const lista = S.assets.filter(a => !a._pend), col = F.collection(db, 'ativos'), tot = lista.length;
            if (!tot) throw new Error('Nenhum endereço foi localizado. Confira a coluna de endereço/cidade/UF.');
            for (let i = 0; i < tot; i += 400) {
                const batch = F.writeBatch(db);
                lista.slice(i, i + 400).forEach(a => {
                    const { _docId, _pend, ...d } = a;
                    batch.set(F.doc(col, _docId), { ...d, g3: RC.geohash(a.lat, a.lon, 3), g4: RC.geohash(a.lat, a.lon, 4), g5: RC.geohash(a.lat, a.lon, 5), importId, atualizadoEm: F.serverTimestamp() });
                });
                await batch.commit(); prog.value = Math.min(100, Math.round(((i + 400) / tot) * 100)); $('impProgTxt').textContent = `Enviando ${Math.min(i + 400, tot).toLocaleString('pt-BR')} de ${tot.toLocaleString('pt-BR')}`;
            }
            let removidos = 0;
            if ($('impStale').checked) {
                $('impProgTxt').textContent = 'Removendo ativos que saíram da planilha…';
                const old = await F.getDocs(F.query(col, F.where('importId', '!=', importId)));
                for (let i = 0; i < old.docs.length; i += 400) { const b = F.writeBatch(db); old.docs.slice(i, i + 400).forEach(d => b.delete(d.ref)); await b.commit(); }
                removidos = old.docs.length;
            }
            const nl = (S.naoLoc || []).length;
            await F.setDoc(F.doc(db, 'meta', 'ativos'), { importId, total: tot, arquivo: S.sheet.name, semCoordenada: S.semCoord, naoLocalizados: nl, removidos, atualizadoEm: F.serverTimestamp(), por: S.user.email });
            toast(`Base atualizada: ${tot.toLocaleString('pt-BR')} ativos${nl ? `, ${nl.toLocaleString('pt-BR')} sem localização` : ''}.`);
            $('impProgTxt').textContent = `Concluído: ${tot.toLocaleString('pt-BR')} ativos enviados${nl ? `. ${nl.toLocaleString('pt-BR')} endereços não foram localizados e ficaram de fora.` : '.'}`;
            $('btnNaoLoc').hidden = !nl; loadMeta();
        } catch (e) { toast(friendlyDbErr(e), 'err'); $('impProgTxt').textContent = friendlyDbErr(e); $('btnNaoLoc').hidden = !(S.naoLoc && S.naoLoc.length); }
        finally { S.busy = false; $('btnImpStop').hidden = true; busy(btn, false); }
    }

    // ---------- BUSCA ----------
    async function geocode(q) {
        const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=br&accept-language=pt-BR&q=' + encodeURIComponent(q);
        const r = await fetch(url); if (!r.ok) throw new Error('O serviço de endereços não respondeu. Use as coordenadas.');
        return (await r.json()).map(x => ({ lat: +x.lat, lon: +x.lon, nome: x.display_name, uf: ((x.address || {})['ISO3166-2-lvl4'] || '').replace('BR-', '') }));
    }
    async function resolvePoint() {
        const c = RC.parseCoordPair($('rCoord').value), end = $('rEndereco').value.trim();
        if ($('rCoord').value.trim() && !c) throw new Error('Não entendi as coordenadas. Use o formato -15.7801, -47.9292 (dentro do Brasil).');
        if (c) { S.geo = []; return { lat: c.lat, lon: c.lon, nome: end || 'Coordenadas informadas', uf: '', origem: 'coord' }; }
        if (!end) throw new Error('Informe o endereço ou as coordenadas.');
        S.geo = await geocode(end);
        if (!S.geo.length) throw new Error('Endereço não encontrado. Tente mais detalhes (cidade/UF) ou use as coordenadas.');
        return { ...S.geo[0], origem: 'endereco' };
    }
    async function fetchAssets(pt, raioM) {
        const { F, db } = S.fb, p = [5, 4, 3].find(x => RC.guaranteedRadius(pt.lat, x) >= raioM) || 3;
        const snap = await F.getDocs(F.query(F.collection(db, 'ativos'), F.where('g' + p, 'in', RC.cellsAround(pt.lat, pt.lon, p)), F.limit(3000)));
        return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
    }
    async function onSearch() {
        if (S.busy || !S.user) return; S.busy = true; const btn = $('rBuscar'); busy(btn, true);
        const res = $('rResult'); res.hidden = false; $('rEmpty').hidden = true; res.innerHTML = '<div class="r-load">Buscando…</div>';
        try {
            const pt = await resolvePoint(), raioM = parseFloat($('rRaio').value) * 1000, pedido = parseFloat($('rVel').value) || 0;
            S.point = pt;
            const raw = await fetchAssets(pt, raioM);
            S.found = raw.map(a => ({ ...a, dist: RC.distanceM(pt.lat, pt.lon, a.lat, a.lon) })).filter(a => a.dist <= raioM).sort((a, b) => a.dist - b.dist).slice(0, 15);
            S.found.forEach(a => { a.faixa = RC.faixaDist(a.dist); a.match = RC.matchSpeed(a.mbps, pedido); });
            S.pedido = pedido; S.raioKm = raioM / 1000; S.ufRef = $('rUF').value || pt.uf || (S.found[0] && S.found[0].uf) || '';
            renderResult();
        } catch (e) { res.innerHTML = `<div class="gate-card"><h2>Não foi possível buscar</h2><p>${esc(friendlyDbErr(e))}</p></div>`; }
        finally { S.busy = false; busy(btn, false); }
    }

    // ---------- REFERÊNCIA LPU ----------
    function lpuRef() {
        const prod = $('rProd').value, dur = parseInt($('rPrazo').value) || 36, uf = S.ufRef, speed = S.pedido;
        if (!speed || !uf || !prod) return { rows: [], motivo: !speed ? 'Informe a velocidade desejada para comparar com a LPU.' : !uf ? 'Escolha a UF para comparar com a LPU.' : '' };
        const rows = Quote.compareOperators({ prod, uf, speed, dur, opts: {}, impostoMode: 'sem' }, { db: window.LPU_DB, Pricing: window.Pricing })
            .filter(r => r.ok).map(r => ({ op: r.op, mensal: r.display.mensal, inst: r.display.inst })).sort((a, b) => a.mensal - b.mensal);
        return { rows, prod, dur, uf, speed, motivo: rows.length ? '' : `A LPU não tem ${prod} ${Quote.speedLabel(speed)} em ${uf} com ${dur} meses.` };
    }
    const custoMetro = () => { const v = parseFloat(String($('rCusto').value).replace(',', '.')); return v > 0 ? v : 0; };

    // ---------- RESULTADO ----------
    const TOM = { local: 'ok', muito: 'ok', perto: 'ok', medio: 'warn', longe: 'bad' };
    function verdict() {
        const n = S.found[0];
        if (!n) return { tom: 'bad', titulo: `Nenhum ativo da rede própria em até ${S.raioKm} km`, texto: 'Aumente o raio ou cote com terceiros pela LPU.' };
        const okVel = ['igual', 'maior', 'na'].includes(n.match.id);
        const tom = n.dist <= 500 && okVel ? 'ok' : n.dist <= 2000 ? 'warn' : 'bad';
        const partes = [`${esc(n.id || n.docId)} a ${fmtDist(n.dist)}`, n.mbps ? Quote.speedLabel(n.mbps) : 'sem velocidade cadastrada'];
        return { tom, titulo: tom === 'ok' ? 'Rede própria próxima do cliente' : tom === 'warn' ? 'Rede própria na região, com ressalvas' : 'Rede própria distante', texto: partes.join(' | ') + (n.match.id === 'menor' ? ` (faltam ${Quote.speedLabel(n.match.falta)} para o pedido)` : '') };
    }
    function renderResult() {
        const p = S.point, v = verdict(), ref = lpuRef(), custo = custoMetro(), n = S.found[0];
        const geoAlt = S.geo.length > 1 ? `<div class="geo-alt"><span>Outros endereços encontrados:</span>${S.geo.slice(1).map((g, i) => `<button type="button" class="chip" data-geo="${i + 1}">${esc(g.nome.split(',').slice(0, 3).join(','))}</button>`).join('')}</div>` : '';
        const rows = S.found.map(a => `<tr>
            <td><div class="lk-id">${esc(a.id || a.docId)}</div><div class="lk-sub">${[a.tipo, a.produto, a.pop && 'POP ' + a.pop].filter(Boolean).map(esc).join(' | ') || '&nbsp;'}</div></td>
            <td class="n"><b>${fmtDist(a.dist)}</b><div class="lk-sub tone-${TOM[a.faixa.id]}">${esc(a.faixa.label)}</div>${a.geoPrec === 'rua' ? '<div class="lk-sub">posição só pela rua</div>' : ''}</td>
            <td class="n"><b>${a.mbps ? Quote.speedLabel(a.mbps) : '—'}</b><div class="lk-sub m-${a.match.id}">${esc(a.match.label)}${a.match.falta ? ` (−${Quote.speedLabel(a.match.falta)})` : ''}</div></td>
            <td><div>${esc([a.endereco, a.cidade && a.uf ? a.cidade + '/' + a.uf : a.cidade || a.uf].filter(Boolean).join(' | ') || '—')}</div>
                <div class="lk-sub">${[a.cliente, a.status].filter(Boolean).map(esc).join(' | ')}${a.extra && Object.keys(a.extra).length ? `<details class="lk-more"><summary>Mais dados</summary>${Object.entries(a.extra).map(([k, x]) => `<div><span>${esc(k)}</span> ${esc(x)}</div>`).join('')}</details>` : ''}</div></td>
            <td><a class="btn link" href="${mapsUrl(a.lat, a.lon)}" target="_blank" rel="noopener">Mapa</a></td></tr>`).join('');
        const lpu = ref.rows.length ? `<table class="tbl"><thead><tr><th>Terceiro (LPU)</th><th class="n">Mensalidade</th><th class="n">Instalação</th></tr></thead><tbody>${ref.rows.slice(0, 5).map((r, i) => `<tr class="${i === 0 ? 'cur' : ''}"><td>${esc(r.op)}${i === 0 ? '<span class="tag">mais barata</span>' : ''}</td><td class="n">${money(r.mensal)}</td><td class="n">${money(r.inst)}</td></tr>`).join('')}</tbody></table>
            <p class="note">${esc(ref.prod)} ${Quote.speedLabel(ref.speed)} em ${esc(ref.uf)}, ${ref.dur} meses, sem impostos e sem adicionais. É o custo de buscar o link de um terceiro.</p>` : `<p class="note">${esc(ref.motivo || 'Sem referência de LPU para comparar.')}</p>`;
        const ext = n && custo ? `<div class="ext"><span>Extensão até o link mais próximo</span><b>${money(n.dist * custo)}</b><small>${fmtDist(n.dist)} x ${money(custo)}/m (distância em linha reta; o trajeto real é maior)</small></div>` : (n ? '<p class="note">Informe o custo por metro de extensão na barra lateral para estimar o custo de chegar até o link.</p>' : '');
        $('rResult').innerHTML = `
            <div class="point card"><span class="card-label">Local pesquisado</span><div class="pt-name">${esc(p.nome)}</div>
                <div class="pt-meta"><span>${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}</span>${S.ufRef ? `<span>UF ${esc(S.ufRef)}</span>` : ''}<a href="${mapsUrl(p.lat, p.lon)}" target="_blank" rel="noopener">Abrir no mapa</a>${p.origem === 'endereco' ? '<span class="lk-sub">Posição aproximada pelo endereço: confira no mapa</span>' : ''}</div>${geoAlt}</div>
            <div class="verdict ${v.tom} card"><div class="v-t">${v.titulo}</div><div class="v-x">${v.texto}</div>${n && n.dist <= 500 ? '<div class="v-h">Ativo a menos de 500 m: vale marcar "Fibra a menos de 500 m" nos projetos especiais da cotação.</div>' : ''}</div>
            ${S.found.length ? `<div class="card"><span class="card-label">Links próximos (${S.found.length})</span><div class="table-wrap"><table class="tbl links"><thead><tr><th>Link</th><th class="n">Distância</th><th class="n">Velocidade</th><th>Local</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
                ${S.found.some(a => a.geoPrec) ? '<p class="note">Estes ativos foram localizados pelo endereço (geocodificação): a distância pode variar algumas dezenas de metros, e mais ainda onde aparece "posição só pela rua".</p>' : ''}<p class="note">A velocidade é a do circuito cadastrado: a planilha não informa quanta banda ainda está livre nele. Confirme a capacidade e a viabilidade técnica antes de ofertar.</p></div>` : ''}
            <div class="card"><span class="card-label">Quanto custa</span>${ext}${lpu}</div>
            <div class="card"><span class="card-label">Análise com IA</span><div id="rIaBody" class="ia-empty">Gera um parecer comercial com os links acima e a referência de LPU. Só comenta, não inventa valores.</div>
                <div class="actions"><button type="button" class="btn dark" id="rAnalyze"><span class="spin" aria-hidden="true"></span><span data-ic="sparkle"></span><span class="lbl">Analisar com IA</span></button>
                <button type="button" class="btn secondary" id="rCopy"><span data-ic="copy"></span><span class="lbl">Copiar resumo</span></button></div></div>`;
        hydrateIcons($('rResult'));
        $('rAnalyze').addEventListener('click', analyze); $('rCopy').addEventListener('click', copySummary);
        $('rResult').querySelectorAll('[data-geo]').forEach(b => b.addEventListener('click', () => { const g = S.geo[+b.dataset.geo]; S.geo = [g, ...S.geo.filter(x => x !== g)]; $('rCoord').value = `${g.lat}, ${g.lon}`; onSearch(); }));
    }

    function payload() {
        const ref = lpuRef(), custo = custoMetro(), n = S.found[0];
        return {
            local: { endereco: S.point.nome, uf: S.ufRef || null, coordenadas_por_endereco: S.point.origem === 'endereco' },
            pedido_mbps: S.pedido || null, raio_busca_km: S.raioKm,
            links_proximos: S.found.slice(0, 8).map(a => ({ designacao: a.id || a.docId, tipo: a.tipo || null, mbps: a.mbps || null, distancia_m: Math.round(a.dist), proximidade: a.faixa.label, correspondencia: a.match.label + (a.match.falta ? ` (faltam ${a.match.falta} Mbps)` : ''), cidade: a.cidade || null, uf: a.uf || null, status: a.status || null })),
            referencia_lpu_terceiros: ref.rows.slice(0, 5).map(r => ({ operadora: r.op, mensalidade_sem_impostos: money(r.mensal), instalacao_sem_impostos: money(r.inst), produto: ref.prod, prazo_meses: ref.dur })),
            custo_extensao_por_metro: custo ? money(custo) : null,
            custo_extensao_estimado_ate_o_mais_proximo: n && custo ? money(n.dist * custo) : null
        };
    }
    async function analyze() {
        const btn = $('rAnalyze'), box = $('rIaBody'); busy(btn, true);
        try {
            const out = await AI.rede(payload());
            const itens = out.split(/\n+/).map(l => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean);
            box.className = ''; box.innerHTML = `<ul class="ia-out">${itens.map(i => `<li>${esc(i)}</li>`).join('')}</ul><p class="ia-note">Gerado por IA a partir destes dados. Confira antes de usar.</p>`;
        } catch (e) { box.className = 'ia-err'; box.textContent = e.message; toast(e.message, 'err'); } finally { busy(btn, false); }
    }
    async function copySummary() {
        const p = S.point, n = S.found[0], ref = lpuRef(), l = [`Local: ${p.nome} (${p.lat.toFixed(5)}, ${p.lon.toFixed(5)})`, `Pedido: ${S.pedido ? Quote.speedLabel(S.pedido) : 'não informado'}`];
        if (n) l.push(`Link mais próximo: ${n.id || n.docId} | ${fmtDist(n.dist)} | ${n.mbps ? Quote.speedLabel(n.mbps) : 'sem velocidade'} | ${n.match.label}`); else l.push(`Sem ativos da rede própria em até ${S.raioKm} km`);
        if (ref.rows[0]) l.push(`LPU mais barata (${ref.prod}, ${ref.dur} meses, s/ impostos): ${ref.rows[0].op} ${money(ref.rows[0].mensal)}/mês, instalação ${money(ref.rows[0].inst)}`);
        if (n && custoMetro()) l.push(`Extensão estimada: ${money(n.dist * custoMetro())}`);
        if (await copyText(l.join('\n'))) toast('Resumo copiado!'); else toast('Não foi possível copiar.', 'err');
    }

    // ---------- VISÕES ----------
    function setView(v) {
        const rede = v === 'rede';
        $('viewCotacao').hidden = rede; $('viewRede').hidden = !rede; document.querySelector('.app').classList.toggle('view-rede', rede);
        document.querySelectorAll('.vtab').forEach(b => { const on = b.dataset.view === v; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
        if (rede && !S.ready) { S.ready = true; startRede(); }
    }
    async function startRede() {
        try { await initFirebase(); } catch (e) { toast('Não foi possível carregar o Firebase. Verifique a conexão e o firebase-config.js.', 'err'); S.fb = null; }
        renderAuth();
    }

    function fillStatic() {
        $('rVel').innerHTML = '<option value="0">Qualquer</option>' + (window.VELOCIDADES_DISPONIVEIS || []).map(s => `<option value="${s}">${Quote.speedLabel(s)}</option>`).join('');
        $('rRaio').innerHTML = [1, 2, 5, 10, 20, 50].map(k => `<option value="${k}"${k === 5 ? ' selected' : ''}>${k} km</option>`).join('');
        $('rProd').innerHTML = [...new Set(window.LPU_DB.map(i => i.p))].sort().map(p => `<option>${esc(p)}</option>`).join('');
        $('rPrazo').innerHTML = [12, 24, 36, 48, 60].map(p => `<option value="${p}"${p === 36 ? ' selected' : ''}>${p} meses</option>`).join('');
        $('rUF').innerHTML = '<option value="">Automática</option>' + Object.keys(window.UF_GROUPS).sort().map(u => `<option>${u}</option>`).join('');
        try { $('rCusto').value = localStorage.getItem(COST_KEY) || ''; } catch (e) { /* sem storage */ }
    }

    document.addEventListener('DOMContentLoaded', () => {
        fillStatic(); hydrateIcons();
        document.querySelectorAll('.vtab').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
        $('btnLoginTop').addEventListener('click', () => setView('rede'));
        $('btnLogout').addEventListener('click', () => S.fb && S.fb.A.signOut(S.fb.auth));
        $('rBuscar').addEventListener('click', onSearch);
        ['rEndereco', 'rCoord'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') onSearch(); }));
        $('rCusto').addEventListener('input', () => { try { localStorage.setItem(COST_KEY, $('rCusto').value); } catch (e) { /* sem storage */ } if (S.found.length || S.point) renderResult(); });
        ['rProd', 'rPrazo', 'rUF'].forEach(id => $(id).addEventListener('change', () => { if (S.point) { S.ufRef = $('rUF').value || S.point.uf || (S.found[0] && S.found[0].uf) || ''; renderResult(); } }));
        $('impFile').addEventListener('change', e => onFile(e.target.files[0]));
        $('impSheet').addEventListener('change', e => readSheet(+e.target.value));
        $('impFields').addEventListener('change', e => { const s = e.target.closest('select'); if (s) { S.map[s.dataset.k] = +s.value; evaluate(); } });
        $('btnImport').addEventListener('click', doImport);
        $('btnImpStop').addEventListener('click', () => { S.stop = true; $('btnImpStop').hidden = true; });
        $('btnNaoLoc').addEventListener('click', baixarNaoLocalizados);
    });
})();
