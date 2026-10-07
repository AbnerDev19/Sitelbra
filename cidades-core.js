// cidades-core.js - Cidade informada na cotação (lógica pura, sem DOM, testável no Node: node tests/cidades.test.js)
//
// Dados (gerados das planilhas por tools/gerar-dados.py, arquivo cidades-data.js):
//   CIDADES_REDE_PROPRIA : { UF: [[cidade, origem], ...] }  cidades atendidas por rede própria Sitelbra
//   CIDADES_NORTE        : { UF: { cidades: { nome: [acima de 20 Mb, até 20 Mb] }, demais: [..] } }
//
// Duas coisas diferentes:
//   1) redePropria(uf, cidade)        -> só INFORMA se a cidade tem rede própria. Não mexe em preço.
//   2) regraNorte(uf, cidade, speed)  -> AM, RO, AP, AC, RR e PA: a cidade é LPU normal, tem multiplicador
//                                        (que depende da velocidade: até 20 Mb ou acima de 20 Mb) ou é inviável.
//
// Códigos de regra nos dados: 1 = LPU normal | número = multiplicador | 'INV' = inviável | 'SAT' = apenas satélite
//                             'NAO' = não atende | 'STAR' = somente Starlink (cidade não listada no Amazonas)
(function (root) {

    // Velocidade (Mbps) que separa as duas colunas da planilha do Norte
    const CORTE_MBPS = 20;

    const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const dados = () => ({
        rede: (root.CIDADES_REDE_PROPRIA || {}),
        norte: (root.CIDADES_NORTE || {})
    });

    const ehNorte = uf => !!dados().norte[String(uf || '').toUpperCase()];

    // Nomes para o autocompletar da caixa de cidade (rede própria + cidades do Norte da UF), sem repetir.
    function listaUF(uf) {
        const U = String(uf || '').toUpperCase(), d = dados(), vistos = new Set(), out = [];
        const add = n => { const k = norm(n); if (k && !vistos.has(k)) { vistos.add(k); out.push(n); } };
        (d.rede[U] || []).forEach(x => add(x[0]));
        if (d.norte[U]) Object.keys(d.norte[U].cidades).forEach(add);
        return out.sort((a, b) => norm(a).localeCompare(norm(b)));
    }

    // Nomes parecidos (começa com / contém o que foi digitado). Serve para "você quis dizer...".
    function parecidas(uf, texto, max) {
        const alvo = norm(texto);
        if (alvo.length < 3) return [];
        const nomes = listaUF(uf);
        const ini = nomes.filter(n => norm(n).startsWith(alvo));
        const cont = nomes.filter(n => !ini.includes(n) && norm(n).includes(alvo));
        return ini.concat(cont).slice(0, max || 6);
    }

    // ---------- REDE PRÓPRIA ----------
    // -> null (sem cidade) | { tem: true, nome, origem } | { tem: false, parecidas: [nomes com rede própria] }
    function redePropria(uf, cidade) {
        const alvo = norm(cidade);
        if (!alvo) return null;
        const lista = dados().rede[String(uf || '').toUpperCase()] || [];
        const achou = lista.find(x => norm(x[0]) === alvo);
        if (achou) return { tem: true, nome: achou[0], origem: achou[1] || '' };
        // Ex.: "Taguatinga" no DF não está sozinha na lista, mas há Taguatinga Norte/Sul/Centro.
        const alvoLen = alvo.length;
        const par = alvoLen >= 3 ? lista.filter(x => norm(x[0]).startsWith(alvo) || norm(x[0]).includes(' ' + alvo)).map(x => x[0]) : [];
        return { tem: false, parecidas: par.slice(0, 6) };
    }

    // ---------- REGRA DO NORTE ----------
    function interpretar(cod) {
        if (cod === 1) return { tipo: 'ok', mult: 1, curto: 'LPU normal' };
        if (typeof cod === 'number' && cod > 0) return { tipo: 'mult', mult: cod, curto: 'LPU x' + fmtMult(cod) };
        if (cod === 'INV') return { tipo: 'inviavel', mult: null, curto: 'Inviável', msg: 'Inviável nesta cidade para esta velocidade.' };
        if (cod === 'SAT') return { tipo: 'inviavel', mult: null, curto: 'Apenas satélite', msg: 'Nesta cidade só é possível por satélite (não há rede terrestre).' };
        if (cod === 'NAO') return { tipo: 'inviavel', mult: null, curto: 'Não atende', msg: 'Não atendemos esta cidade nesta velocidade.' };
        if (cod === 'STAR') return { tipo: 'inviavel', mult: null, curto: 'Somente Starlink', msg: 'Cidade fora da lista de atendimento: somente Starlink.' };
        return null;
    }

    // -> null (UF fora do Norte da planilha, sem cidade ou sem velocidade)
    //    | { tipo: 'ok'|'mult'|'inviavel', mult, cidade, listada, faixa, msg }
    function regraNorte(uf, cidade, speedMbps) {
        const U = String(uf || '').toUpperCase(), blk = dados().norte[U];
        if (!blk || !norm(cidade) || !(parseFloat(speedMbps) > 0)) return null;
        const faixa = parseFloat(speedMbps) > CORTE_MBPS ? 0 : 1;           // 0 = acima de 20 Mb | 1 = até 20 Mb
        const faixaTxt = faixa === 0 ? `acima de ${CORTE_MBPS} Mb` : `até ${CORTE_MBPS} Mb`;
        const nome = Object.keys(blk.cidades).find(n => norm(n) === norm(cidade));
        const listada = !!nome;
        const par = listada ? blk.cidades[nome] : blk.demais;
        if (!par) return null;                                              // a planilha não traz regra para as demais cidades desta UF
        const r = interpretar(par[faixa]);
        if (!r) return null;
        return Object.assign(r, { cidade: listada ? nome : String(cidade).trim(), listada, faixa: faixaTxt });
    }

    // Texto curto da regra (para a caixa de cidade e para os motivos do status)
    function descreverNorte(r) {
        if (!r) return '';
        const onde = r.listada ? `${r.cidade} está na lista do Norte` : `${r.cidade} não está na lista do Norte (vale a regra "demais cidades")`;
        if (r.tipo === 'ok') return `${onde}: LPU normal (${r.faixa}).`;
        if (r.tipo === 'mult') return `${onde}: LPU x${fmtMult(r.mult)} (${r.faixa}).`;
        return `${onde}: ${r.msg}`;
    }
    const fmtMult = m => Number(m).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

    const api = { CORTE_MBPS, norm, ehNorte, listaUF, parecidas, redePropria, regraNorte, descreverNorte, fmtMult };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.Cidades = api;

})(typeof window !== 'undefined' ? window : globalThis);
