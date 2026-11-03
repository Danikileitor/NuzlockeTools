/* Estado compartido entre páginas: Randomlocke (se guarda en localStorage y se sincroniza entre pestañas) */
const PMRandom = (() => {
  const KEY = 'pm-random', subs = [];
  const get = () => { try { return JSON.parse(localStorage.getItem(KEY)) === true; } catch (e) { return false; } };
  const set = v => { try { localStorage.setItem(KEY, JSON.stringify(!!v)); } catch (e) {} };
  const onChange = fn => subs.push(fn);
  window.addEventListener('storage', e => { if (e.key === KEY) subs.forEach(fn => fn(get())); });
  return {get, set, onChange};
})();
