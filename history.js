// history.js - Histórico local de cotações (localStorage). Sem backend.
// Cada registro guarda o necessário para ABRIR a cotação de novo (seleção + opções) e para listar.
window.Historico = (function () {
    const KEY = 'sitelbra.historico.v1';
    const MAX = 200;

    function load() {
        try {
            const a = JSON.parse(localStorage.getItem(KEY) || '[]');
            return Array.isArray(a) ? a : [];
        } catch (e) { return []; }
    }
    function persist(list) {
        try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); return true; }
        catch (e) { return false; }
    }
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const sig = e => JSON.stringify([e.op, e.prod, e.uf, e.speed, e.prazos, e.opts, e.impostoMode]);

    // Salva a cotação. Se for idêntica à última salva, só atualiza a data (evita repetição ao recalcular).
    function add(entry) {
        const list = load();
        const novo = Object.assign({ id: uid(), data: new Date().toISOString() }, entry);
        // Mesma cotação da última: atualiza data, assunto e local (o que a pessoa pode ter mudado), sem duplicar.
        if (list[0] && sig(list[0]) === sig(novo)) { list[0] = Object.assign({}, novo, { id: list[0].id }); }
        else list.unshift(novo);
        return persist(list) ? list : null;
    }
    function duplicate(id) {
        const list = load();
        const orig = list.find(e => e.id === id);
        if (!orig) return list;
        list.unshift(Object.assign({}, orig, { id: uid(), data: new Date().toISOString() }));
        persist(list);
        return list;
    }
    function remove(id) {
        const list = load().filter(e => e.id !== id);
        persist(list);
        return list;
    }
    function clear() { persist([]); return []; }
    function get(id) { return load().find(e => e.id === id) || null; }

    return { load, add, duplicate, remove, clear, get };
})();
