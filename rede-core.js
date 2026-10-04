// rede-core.js - Lógica pura da aba "Rede própria" (sem DOM, sem Firebase), testável no Node:
//   node tests/rede.test.js
// Geohash, distância, leitura de coordenadas/velocidade, detecção de colunas da planilha do Metabase
// e classificação do resultado (distância e velocidade).
(function (root) {

    // ---------- AJUSTES EDITÁVEIS ----------
    // Faixas de distância (em metros) só descrevem a proximidade. Não são regra de preço.
    const FAIXAS_DIST = [
        { max: 50,   id: 'local',   label: 'No local' },
        { max: 200,  id: 'muito',   label: 'Muito perto' },
        { max: 500,  id: 'perto',   label: 'Perto (até 500 m)' },
        { max: 2000, id: 'medio',   label: 'Precisa de extensão' },
        { max: Infinity, id: 'longe', label: 'Distante' }
    ];
    // Limites aproximados do Brasil: servem para descartar números que não são coordenadas.
    const BR = { latMin: -34, latMax: 6, lonMin: -74.5, lonMax: -33 };

    // ---------- TEXTO / NÚMEROS ----------
    const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

    function parseNum(v) {
        if (typeof v === 'number') return isFinite(v) ? v : null;
        if (v == null) return null;
        let s = String(v).trim().replace(/\s/g, '');
        if (!s) return null;
        if (/,/.test(s) && /\./.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56
        else s = s.replace(',', '.');
        const n = parseFloat(s);
        return isFinite(n) ? n : null;
    }

    const inBrasil = (lat, lon) => lat >= BR.latMin && lat <= BR.latMax && lon >= BR.lonMin && lon <= BR.lonMax;

    // Lê um par "lat, lon" dentro de um texto (ex.: "-15.7801, -47.9292" ou "-15,7801; -47,9292").
    function parseCoordPair(text) {
        if (text == null) return null;
        const s = String(text);
        // "Lat: -16,48 Long: -39,08", "LAT. -15.79, LON.-48.03", "latitude -15.7 longitude -47.9"
        const lab = /lat(?:itude)?[^\d-]{0,6}(-?\d{1,3}(?:[.,]\d+)?)[^\d-]{1,25}?lon(?:g|gitude)?[^\d-]{0,6}(-?\d{1,3}(?:[.,]\d+)?)/i.exec(s);
        if (lab) { const a = parseNum(lab[1]), b = parseNum(lab[2]); if (a != null && b != null && inBrasil(a, b)) return { lat: a, lon: b }; }
        const re = /(-?\d{1,3}[.,]\d{2,})\s*[;,/ ]\s*(-?\d{1,3}[.,]\d{2,})/g;
        let m;
        while ((m = re.exec(s))) {
            const a = parseNum(m[1]), b = parseNum(m[2]);
            if (a != null && b != null && inBrasil(a, b)) return { lat: a, lon: b };
        }
        return null;
    }

    // "100", "100 Mbps", "1 Gbps", "1G", "500M", "1,5 Gbps" -> Mbps
    function parseMbps(v) {
        if (v == null || v === '') return null;
        if (typeof v === 'number') return v > 0 ? v : null;
        const m = String(v).toLowerCase().replace(/\s/g, '').match(/(\d+(?:[.,]\d+)?)(g|gb|gbps|gbit|m|mb|mbps|mbit|k|kb|kbps)?/);
        if (!m) return null;
        let n = parseNum(m[1]); if (n == null) return null;
        const u = m[2] || '';
        if (u[0] === 'g') n *= 1000; else if (u[0] === 'k') n /= 1000;
        return n > 0 ? n : null;
    }

    // ---------- GEOHASH ----------
    const B32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    function geohash(lat, lon, precision) {
        let latR = [-90, 90], lonR = [-180, 180], bit = 0, ch = 0, even = true, out = '';
        while (out.length < precision) {
            const r = even ? lonR : latR, v = even ? lon : lat, mid = (r[0] + r[1]) / 2;
            if (v >= mid) { ch = (ch << 1) | 1; r[0] = mid; } else { ch = ch << 1; r[1] = mid; }
            even = !even;
            if (++bit === 5) { out += B32[ch]; bit = 0; ch = 0; }
        }
        return out;
    }
    function cellSize(precision) {
        const lonBits = Math.ceil(5 * precision / 2), latBits = Math.floor(5 * precision / 2);
        return { dLon: 360 / Math.pow(2, lonBits), dLat: 180 / Math.pow(2, latBits) };
    }
    // A célula do ponto e as 8 vizinhas (no máximo 9 valores, cabe no operador "in" do Firestore).
    function cellsAround(lat, lon, precision) {
        const { dLon, dLat } = cellSize(precision), set = new Set();
        for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
            const la = Math.max(-89.999, Math.min(89.999, lat + y * dLat));
            let lo = lon + x * dLon; if (lo > 180) lo -= 360; if (lo < -180) lo += 360;
            set.add(geohash(la, lo, precision));
        }
        return [...set];
    }
    // Raio (m) que as 9 células sempre cobrem a partir do ponto: se o ativo mais próximo está dentro dele, é o mais próximo de verdade.
    function guaranteedRadius(lat, precision) {
        const { dLon, dLat } = cellSize(precision);
        return Math.min(dLat * 111195, dLon * 111320 * Math.cos(lat * Math.PI / 180));
    }

    function distanceM(lat1, lon1, lat2, lon2) {
        const R = 6371008.8, rad = Math.PI / 180;
        const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
    }

    // ---------- CLASSIFICAÇÃO DO RESULTADO ----------
    const faixaDist = m => FAIXAS_DIST.find(f => m <= f.max);

    // asset = Mbps do ativo; pedido = Mbps que o cliente quer
    function matchSpeed(assetMbps, pedido) {
        if (!pedido) return { id: 'na', label: 'Velocidade não informada' };
        if (!assetMbps) return { id: 'sem', label: 'Ativo sem velocidade na planilha' };
        if (assetMbps === pedido) return { id: 'igual', label: 'Corresponde ao pedido' };
        if (assetMbps > pedido) return { id: 'maior', label: 'Maior que o pedido' };
        return { id: 'menor', label: 'Menor que o pedido', falta: pedido - assetMbps };
    }

    // ---------- PLANILHA ----------
    // Campos do ativo e nomes de coluna aceitos (comparação sem acento/caixa; basta a coluna conter o termo).
    const CAMPOS = [
        { key: 'id',       label: 'Designação / ID do link', exato: ['designacao', 'designacao do circuito', 'circuito', 'id', 'id circuito', 'cod circuito', 'codigo', 'link', 'nome do link', 'terminal'] },
        { key: 'lat',      label: 'Latitude',                exato: ['latitude', 'lat'] },
        { key: 'lon',      label: 'Longitude',               exato: ['longitude', 'long', 'lng', 'lon'] },
        { key: 'coord',    label: 'Coordenadas (lat, long juntas)', exato: ['coordenadas', 'coordenada', 'geolocalizacao', 'lat long', 'lat lon', 'latlong', 'gps'] },
        { key: 'mbps',     label: 'Velocidade / banda',      exato: ['velocidade', 'banda', 'capacidade', 'largura de banda', 'bw', 'mbps', 'velocidade mbps', 'banda contratada'] },
        { key: 'endereco', label: 'Endereço',                exato: ['endereco', 'endereco ponto a', 'ponto a', 'logradouro', 'rua', 'endereco completo'] },
        { key: 'cidade',   label: 'Cidade',                  exato: ['cidade', 'municipio'] },
        { key: 'uf',       label: 'UF',                      exato: ['uf', 'estado'] },
        { key: 'tipo',     label: 'Tipo / tecnologia',       exato: ['tipo', 'tecnologia', 'meio', 'tipo de acesso', 'acesso', 'meio de acesso'] },
        { key: 'produto',  label: 'Produto / serviço',       exato: ['produto', 'servico'] },
        { key: 'cliente',  label: 'Cliente',                 exato: ['cliente', 'razao social', 'nome cliente', 'nome do cliente'] },
        { key: 'status',   label: 'Status',                  exato: ['status', 'situacao'] },
        { key: 'pop',      label: 'POP / nó de rede',        exato: ['pop', 'no', 'node', 'site', 'ponto de presenca'] }
    ];

    // headers: array de nomes de coluna. Devolve { key: indiceDaColuna | -1 }.
    function detectColumns(headers) {
        const hs = headers.map(norm), out = {}, used = new Set();
        CAMPOS.forEach(c => {
            let idx = -1;
            for (const nome of c.exato) { idx = hs.findIndex((h, i) => !used.has(i) && h === nome); if (idx >= 0) break; }
            if (idx < 0) for (const nome of c.exato) { if (nome.length < 4) continue; idx = hs.findIndex((h, i) => !used.has(i) && h.includes(nome)); if (idx >= 0) break; }
            if (idx >= 0) used.add(idx);
            out[c.key] = idx;
        });
        return out;
    }

    // Texto de busca do endereço (para geocodificar). Não repete cidade/UF que já estejam no endereço.
    function buildQuery(a) {
        const parts = [String(a.endereco || '').trim()], n = norm(a.endereco);
        if (a.cidade && !n.includes(norm(a.cidade))) parts.push(a.cidade);
        if (a.uf && !new RegExp('\\b' + a.uf.toLowerCase() + '\\b').test(n)) parts.push(a.uf);
        parts.push('Brasil');
        return parts.filter(Boolean).join(', ');
    }
    // Tira o número da porta ("Rua X, 123" -> "Rua X") para uma segunda tentativa, quando o número não existe no mapa.
    const stripNumber = t => String(t || '').replace(/(,\s*|\bn[º°o.]*\s*)\d{1,5}[A-Za-z]?\b/gi, '').replace(/\s{2,}/g, ' ').trim();
    function hashStr(t) { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + t.length.toString(36); }

    // Converte uma linha (array) em ativo. map = { key: indice }.
    // Devolve { ok:true, ativo } (com lat/lon), { ok:true, pendente:true, ativo } (só endereço: precisa geocodificar) ou { ok:false, motivo }.
    function rowToAsset(row, headers, map) {
        const get = k => (map[k] != null && map[k] >= 0 ? row[map[k]] : undefined);
        const txt = k => { const v = get(k); return v == null ? '' : String(v).trim(); };
        let lat = parseNum(get('lat')), lon = parseNum(get('lon'));
        if (lat != null && lon != null && !inBrasil(lat, lon)) {
            if (inBrasil(lon, lat)) { const t = lat; lat = lon; lon = t; } // colunas trocadas
            else { lat = lon = null; }
        }
        if (lat == null || lon == null) {
            const p = parseCoordPair(get('coord')) || parseCoordPair(get('endereco')) || parseCoordPair(row.join(' ; '));
            if (p) { lat = p.lat; lon = p.lon; }
        }
        const temCoord = lat != null && lon != null;
        if (!temCoord && norm(txt('endereco')).length < 6) return { ok: false, motivo: 'sem_coordenada' };
        const usados = new Set(Object.values(map).filter(i => i >= 0));
        const extra = {};
        headers.forEach((h, i) => { if (!usados.has(i) && row[i] != null && String(row[i]).trim() !== '' && h) extra[String(h).trim().slice(0, 60)] = String(row[i]).trim().slice(0, 200); });
        const ativo = {
            id: txt('id'), lat: temCoord ? +lat.toFixed(6) : null, lon: temCoord ? +lon.toFixed(6) : null,
            mbps: parseMbps(get('mbps')), endereco: txt('endereco'), cidade: txt('cidade'),
            uf: txt('uf').toUpperCase().slice(0, 2), tipo: txt('tipo'), produto: txt('produto'),
            cliente: txt('cliente'), status: txt('status'), pop: txt('pop'), extra
        };
        return temCoord ? { ok: true, ativo } : { ok: true, pendente: true, ativo };
    }

    // ID do documento no Firestore: a designação, sem "/" nem caracteres problemáticos; sem designação, usa as coordenadas.
    function docId(ativo, vistos) {
        let base = (ativo.id || (ativo.lat != null ? `pt_${ativo.lat}_${ativo.lon}_${(ativo.mbps || 0)}` : 'end_' + hashStr(buildQuery(ativo)))).replace(/[\/\\#?\[\]\s]+/g, '_').replace(/^\.+/, '').slice(0, 140) || 'sem_id';
        let id = base, n = 1;
        while (vistos.has(id)) { n++; id = `${base}-${n}`; }
        vistos.add(id);
        return id;
    }

    const api = { FAIXAS_DIST, CAMPOS, norm, parseNum, parseCoordPair, parseMbps, geohash, cellSize, cellsAround, guaranteedRadius,
        distanceM, faixaDist, matchSpeed, detectColumns, rowToAsset, docId, inBrasil, buildQuery, stripNumber, hashStr };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.RedeCore = api;

})(typeof window !== 'undefined' ? window : globalThis);
