(() => {
'use strict';
const {gens: GENS, es: ES} = DATA;
let species, moves, items, natures, SP, MV, speciesOpts, allAbilities, learnBits, ALLM;
const STAT_NAMES = ['PS','Ataque','Defensa','At. Esp.','Def. Esp.','Velocidad'];
const statName = i => prefs.gen === 1 && i === 3 ? t('special') : t('stat' + i);
const STAT_KEYS  = ['HP','Atk','Def','SpA','SpD','Spe'];
const TYPE_COLORS = {Normal:'#9fa19f',Fire:'#e8622c',Water:'#3a8de0',Electric:'#e8b90c',Grass:'#4fae3d',Ice:'#4cc7c0',Fighting:'#d0364e',Poison:'#a350cc',Ground:'#b9743a',Flying:'#7d9fe0',Psychic:'#f0577b',Bug:'#90a516',Rock:'#b5a76a',Ghost:'#5a6bb5',Dragon:'#0d6ac0',Dark:'#5a5266',Steel:'#4f8aa2',Fairy:'#ee7ccf',Stellar:'#44bdb0'};
const CAT_ES = {P:'Fís.',S:'Esp.',T:'Est.'}, CAT_EN = {P:'Phys.',S:'Spec.',T:'Stat.'};
const catName = c => (prefs.lang === 'es' ? CAT_ES : CAT_EN)[c];
const TYPE_ES = {Normal:'Normal',Fire:'Fuego',Water:'Agua',Electric:'Eléctrico',Grass:'Planta',Ice:'Hielo',Fighting:'Lucha',Poison:'Veneno',Ground:'Tierra',Flying:'Volador',Psychic:'Psíquico',Bug:'Bicho',Rock:'Roca',Ghost:'Fantasma',Dragon:'Dragón',Dark:'Siniestro',Steel:'Acero',Fairy:'Hada',Stellar:'Astral'};
const trType = t => (prefs.lang === 'es' && TYPE_ES[t]) || t;
const KEY = 'rival-team-gen9-v1';   // formato antiguo (solo Gen 9)
const KEY2 = 'pokemon-teamsheet-v2';
const PREF = 'rival-team-gen9-prefs';
let prefs = {lang:'es', random:false, gen:9};
try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF) || '{}')); } catch(e) {}
const savePrefs = () => { try { localStorage.setItem(PREF, JSON.stringify(prefs)); } catch(e) {} };
// k: 'a' habilidad, 'm' movimiento, 'i' objeto
const NAT_ES = {Adamant:'Firme',Bashful:'Tímida',Bold:'Osada',Brave:'Audaz',Calm:'Serena',Careful:'Cauta',Docile:'Dócil',Gentle:'Amable',Hardy:'Fuerte',Hasty:'Activa',Impish:'Agitada',Jolly:'Alegre',Lax:'Floja',Lonely:'Huraña',Mild:'Afable',Modest:'Modesta',Naive:'Ingenua',Naughty:'Pícara',Quiet:'Mansa',Quirky:'Rara',Rash:'Alocada',Relaxed:'Plácida',Sassy:'Grosera',Serious:'Seria',Timid:'Miedosa'};
const trNat = n => (prefs.lang === 'es' && NAT_ES[n]) || n;
const tr = (k, n) => {
  if (!n || prefs.lang !== 'es') return n;
  if (ES[k][n]) return ES[k][n];
  if (k === 'm' && n.startsWith('Hidden Power ')) return 'Poder Oculto ' + trType(n.slice(13));
  return n;
};

const I18N = {
  es: {resetAll:'Liberar todo', clear:'Liberar', pokemon:'Pokémon', nick:'Mote', ability:'Habilidad', item:'Objeto', nature:'Naturaleza',
       baseStats:'Stats base', moves:'Movimientos', total:'Total', searchPh:'Buscar Pokémon…', itemPh:'Sin objeto', movePh:'Movimiento',
       none:'No existe en esta gen', pickNat:'— Naturaleza —', pickAb:'— Habilidad —', own:'Del Pokémon', allAb:'Todas las habilidades',
       neutral:'neutra', wipe:'Borrar todos los equipos', confirmWipe:'¿Borrar TODOS los equipos de TODAS las generaciones? Esta acción no se puede deshacer.', copy:'Copiar', paste:'Pegar', copied:'¡Copiado!', team:'Equipo', illegal:'Este Pokémon no aprende este movimiento en esta gen', noRes:'Sin resultados', confirmReset:'¿Liberar los 6 Pokémon?', genTitle:'Generación', langTitle:'Idioma',
       rndOn:'Randomlocke: permite elegir cualquier habilidad y cualquier movimiento de cualquier generación', rndOff:'Las habilidades existen a partir de la Gen 3',
       stat0:'PS', stat1:'Ataque', stat2:'Defensa', stat3:'At. Esp.', stat4:'Def. Esp.', stat5:'Velocidad', special:'Especial',
       ab:['Atq','Def','AtE','DfE','Vel'],
       foot:(g,n,m,mega) => `Datos de la Gen ${g} de Pokémon Showdown (${n} Pokémon, ${m} movimientos${mega ? ', incluye megaevoluciones' : ''}) · Sprites de play.pokemonshowdown.com · Se guarda automáticamente en tu navegador, un equipo por generación.`},
  en: {resetAll:'Release all', clear:'Release', pokemon:'Pokémon', nick:'Nickname', ability:'Ability', item:'Item', nature:'Nature',
       baseStats:'Base stats', moves:'Moves', total:'Total', searchPh:'Search Pokémon…', itemPh:'No item', movePh:'Move',
       none:'Not available in this gen', pickNat:'— Nature —', pickAb:'— Ability —', own:"Pokémon's own", allAb:'All abilities',
       neutral:'neutral', wipe:'Delete all teams', confirmWipe:'Delete ALL teams from ALL generations? This cannot be undone.', copy:'Copy', paste:'Paste', copied:'Copied!', team:'Team', illegal:"This Pokémon can't learn this move in this gen", noRes:'No results', confirmReset:'Release all 6 Pokémon?', genTitle:'Generation', langTitle:'Language',
       rndOn:'Randomlocke: allows any ability and any move from any generation', rndOff:'Abilities exist from Gen 3 onwards',
       stat0:'HP', stat1:'Attack', stat2:'Defense', stat3:'Sp. Atk', stat4:'Sp. Def', stat5:'Speed', special:'Special',
       ab:['Atk','Def','SpA','SpD','Spe'],
       foot:(g,n,m,mega) => `Gen ${g} data from Pokémon Showdown (${n} Pokémon, ${m} moves${mega ? ', includes Mega Evolutions' : ''}) · Sprites from play.pokemonshowdown.com · Saved automatically in your browser, one team per generation.`}
};
const t = k => I18N[prefs.lang][k];
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'');
const el = (tag, attrs={}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k,v);
  }
  kids.forEach(k => e.append(k));
  return e;
};

/* ---------- Estado ---------- */
const blank = () => ({sp:'', ab:'', item:'', nat:'', nick:'', mv:['','','','']});
const clean = arr => Array.from({length:6}, (_, i) => { const x = (arr && arr[i]) || {}; return Object.assign(blank(), x, {mv:[0,1,2,3].map(j => (x.mv||[])[j] || '')}); });
let all = {};   // por generación: {a: equipo activo, t: [equipo1, equipo2, equipo3]} (cada equipo = 6 huecos)
let team = 0;
try {
  all = JSON.parse(localStorage.getItem(KEY2) || 'null') || {};
  if (!all[9]) { const old = JSON.parse(localStorage.getItem(KEY) || 'null'); if (Array.isArray(old)) all[9] = old; }
} catch(e) { all = {}; }
const normGen = g => {
  let x = all[g];
  if (Array.isArray(x)) x = {a:0, t:[x]};            // formato anterior: un solo equipo
  if (!x || !Array.isArray(x.t)) x = {a:0, t:[]};
  while (x.t.length < 3) x.t.push(null);
  if (!(x.a >= 0 && x.a < 3)) x.a = 0;
  return all[g] = x;
};
let state = [];
const save = () => { const gd = normGen(prefs.gen); gd.a = team; gd.t[team] = state; try { localStorage.setItem(KEY2, JSON.stringify(all)); } catch(e) {} };

/* ---------- Combobox ---------- */
function combobox(input, getOpts, onPick) {
  // getOpts() -> [{v: valor, l: etiqueta, s: texto secundario}]
  const dd = el('div', {class:'dd'});
  input.parentElement.append(dd);
  let list = [], act = -1;
  const render = () => {
    const q = norm(input.value);
    const all = getOpts();
    let r;
    if (!q || input.dataset.fresh === '1') r = all;
    else {
      const starts = [], inc = [];
      for (const o of all) {
        const n = norm(o.l), a = o.alt ? norm(o.alt) : '';
        if (n.startsWith(q) || (a && a.startsWith(q))) starts.push(o); else if (n.includes(q) || (a && a.includes(q))) inc.push(o);
      }
      r = starts.concat(inc);
    }
    list = r.slice(0, 2000); act = list.length && q ? 0 : -1;
    dd.replaceChildren();
    if (!list.length) dd.append(el('div', {class:'empty', text:t('noRes')}));
    list.forEach((o,i) => {
      const d = el('div', {}, el('span', {text:o.l}), o.s ? el('small', {text:o.s}) : '');
      d.addEventListener('mousedown', ev => { ev.preventDefault(); pick(o); });
      if (i === act) d.classList.add('act');
      dd.append(d);
    });
    dd.classList.add('open');
  };
  const close = () => dd.classList.remove('open');
  const pick = o => { close(); onPick(o.v); input.blur(); };
  const mark = () => {
    [...dd.children].forEach((c,i) => c.classList.toggle('act', i === act));
    dd.children[act]?.scrollIntoView({block:'nearest'});
  };
  input.addEventListener('focus', () => { input.dataset.fresh = '1'; input.select(); render(); });
  input.addEventListener('input', () => { input.dataset.fresh = '0'; render(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!dd.classList.contains('open')) render(); act = Math.min(list.length-1, act+1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); act = Math.max(0, act-1); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (list[act]) pick(list[act]); else input.blur(); }
    else if (e.key === 'Escape') { input.blur(); }
  });
  input.addEventListener('blur', () => {
    close();
    const t = input.value.trim();
    if (!t) { onPick(''); return; }
    const exact = getOpts().find(o => norm(o.l) === norm(t) || (o.alt && norm(o.alt) === norm(t)));
    if (exact) onPick(exact.v); else onPick(undefined); // undefined = revertir
  });
}

/* ---------- Opciones ---------- */
const sortEs = arr => prefs.lang === 'es' ? arr.slice().sort((a,b) => a.l.localeCompare(b.l, 'es')) : arr;
const itemOpts = () => sortEs(items.map(n => ({v:n, l:tr('i',n), alt:n})));
const hasAb = () => prefs.gen >= 3, hasNat = () => prefs.gen >= 3, hasItem = () => prefs.gen >= 2;
const canLearn = (sp, i) => { const b = learnBits(sp); return !!(b[i >> 3] & (1 << (i & 7))); };
// Movimientos disponibles: los que aprende el Pokémon en la gen elegida (todos si Randomlocke o sin Pokémon)
const moveOptsFor = idx => {
  const sp = SP[state[idx].sp], all = prefs.random || !sp;
  const out = [];
  (prefs.random ? ALLM : moves).forEach((m, i) => {
    if (all || canLearn(sp, i)) out.push({v:m[0], l:tr('m',m[0]), alt:m[0], s:`${trType(m[1])} · ${catName(m[2])}${m[3] ? ' · ' + m[3] : ''}`});
  });
  return sortEs(out);
};

const spriteUrls = id => [
  `https://play.pokemonshowdown.com/sprites/ani/${id}.gif`,
  `https://play.pokemonshowdown.com/sprites/dex/${id}.png`,
  `https://play.pokemonshowdown.com/sprites/gen5/${id}.png`
];
const UNION = {};
for (let g = 1; g <= 9; g++) GENS[g].moves.forEach(m => { UNION[m[0]] = m; });   // gens altas sobrescriben a las bajas
function setGen(g) {
  prefs.gen = g;
  ({species, moves, items, natures} = GENS[g]);
  SP = Object.fromEntries(species.map(s => [s.n, s]));
  MV = Object.assign({}, UNION, Object.fromEntries(moves.map(m => [m[0], m])));   // la gen actual manda sobre el resto
  ALLM = Object.values(MV).sort((a, b) => a[0].localeCompare(b[0]));
  speciesOpts = species.map(s => ({v:s.n, l:s.n, s:'#' + s.num}));
  allAbilities = [...new Set(species.flatMap(s => s.a))].sort();
  const gd = normGen(g); team = gd.a; state = clean(gd.t[team]);
  const bitsCache = {}, SPI = Object.fromEntries(species.map((s, i) => [s.n, i]));
  learnBits = sp => bitsCache[sp.n] || (bitsCache[sp.n] = Uint8Array.from(atob(GENS[g].learn[SPI[sp.n]]), c => c.charCodeAt(0)));
}
const statColor = v => v < 50 ? '#e5534b' : v < 80 ? '#e8a23a' : v < 100 ? '#d6cf3a' : v < 130 ? '#5cc15c' : '#35c9c0';
const typeChip = t => { const c = el('span', {class:'type', text:trType(t)}); c.style.background = TYPE_COLORS[t] || '#666'; return c; };

/* ---------- Construcción de huecos ---------- */
const board = document.getElementById('board');
const slots = [];
let clip = null;                 // hueco copiado (en memoria)
const pasteBtns = [];
const updatePaste = () => pasteBtns.forEach(b => { b.disabled = !clip; });
// Adapta un hueco copiado a la generación actual (descarta lo que no exista aquí)
const sanitize = c => {
  const o = clean([c])[0];
  if (!SP[o.sp]) return blank();
  if (!hasAb() || !allAbilities.includes(o.ab)) o.ab = '';
  if (!items.includes(o.item)) o.item = '';
  if (!natures.some(n => n[0] === o.nat)) o.nat = '';
  o.mv = o.mv.map(m => MV[m] ? m : '');
  return o;
};

function buildSlot(idx) {
  const root = el('section', {class:'slot'});
  const bCopy = el('button', {type:'button', 'data-i':'copy', text:t('copy')});
  const bPaste = el('button', {type:'button', 'data-i':'paste', text:t('paste')});
  const bClear = el('button', {type:'button', 'data-i':'clear', text:t('clear')});
  const num = el('div', {class:'num'}, bCopy, bPaste, bClear, el('span', {text:'#' + (idx+1)}));
  bClear.onclick = () => { state[idx] = blank(); save(); refresh(); };
  bCopy.onclick = () => {
    clip = clean([state[idx]])[0]; updatePaste();
    bCopy.removeAttribute('data-i'); bCopy.textContent = t('copied');
    setTimeout(() => { bCopy.dataset.i = 'copy'; bCopy.textContent = t('copy'); }, 900);
  };
  bPaste.onclick = () => { if (!clip) return; state[idx] = sanitize(clip); save(); refresh(); };
  pasteBtns.push(bPaste);

  // sprite
  const sprite = el('div', {class:'sprite'});
  const types = el('div', {class:'types'});

  // campos
  const inSp = el('input', {type:'text', 'data-ph':'searchPh', placeholder:t('searchPh'), autocomplete:'off', spellcheck:'false'});
  const inNick = el('input', {type:'text', 'data-ph':'nick', placeholder:t('nick'), maxlength:'12', autocomplete:'off'});
  const selAb = el('select');
  const inItem = el('input', {type:'text', placeholder:t('itemPh'), autocomplete:'off', spellcheck:'false'});
  const selNat = el('select');
  const SN = {Atk:0,Def:1,SpA:2,SpD:3,Spe:4}, sn = k => t('ab')[SN[k]];
  const fillNat = () => {
    selNat.replaceChildren(el('option', {value:'', text: hasNat() ? t('pickNat') : t('none')}));
    natures.forEach(([n,p,m]) => selNat.append(el('option', {value:n, text: p ? `${trNat(n)} (+${sn(p)} −${sn(m)})` : `${trNat(n)} (${t('neutral')})`})));
  };

  const f = (key, node, cls='') => el('div', {class:cls}, el('label', {'data-i':key, text:t(key)}), node);
  const wrap = n => el('div', {class:'cb'}, n);
  const fields = el('div', {class:'fields'},
    f('pokemon', wrap(inSp), 'full'),
    f('nick', inNick),
    f('ability', selAb),
    f('item', wrap(inItem)),
    f('nature', selNat));
  root.append(num, el('div', {class:'top'}, el('div', {}, sprite, types), fields));

  // stats
  const statsBox = el('div', {class:'stats'});
  const rows = STAT_NAMES.map((n,i) => {
    const l = el('span', {class:'l'}), v = el('span', {class:'v', text:'–'}), bi = el('i'), df = el('i', {class:'df'});
    const box = el('div', {class:'stat'}, l, v, el('div', {class:'bar'}, bi, df));
    statsBox.append(box);
    return {box, l, v, bi, df};
  });
  const bst = el('div', {class:'bst'}, el('span', {'data-i':'total', text:t('total')}), el('b', {text:'–'}));
  statsBox.append(bst);

  // movimientos
  const mvBox = el('div', {class:'moves'});
  const mvEls = [0,1,2,3].map(i => {
    const input = el('input', {type:'text', placeholder:`${t('movePh')} ${i+1}`, autocomplete:'off', spellcheck:'false'});
    const dot = el('span', {class:'dot'}), meta = el('span', {class:'mm'});
    const box = el('div', {class:'mv cb'}, input, dot, meta);
    mvBox.append(box);
    return {input, dot, meta};
  });
  root.append(el('div', {class:'bottom'}, el('div', {}, el('label', {'data-i':'baseStats', text:t('baseStats')}), statsBox), el('div', {}, el('label', {'data-i':'moves', text:t('moves')}), mvBox)));

  /* --- render --- */
  const render = () => {
    const s = state[idx], sp = SP[s.sp];
    // sprite
    sprite.replaceChildren();
    if (sp) {
      const urls = spriteUrls(sp.i); let k = 0;
      const img = el('img', {alt:sp.n, src:urls[0]});
      img.onerror = () => { k++; if (k < urls.length) img.src = urls[k]; else { img.remove(); sprite.append(el('span', {class:'ph', text:'?'})); } };
      sprite.append(img);
    } else sprite.append(el('span', {class:'ph', text:'?'}));
    types.replaceChildren(...(sp ? sp.t.map(typeChip) : []));
    // campos
    inSp.value = s.sp; inNick.value = s.nick; inItem.value = tr('i', s.item); fillNat(); selNat.value = s.nat;
    inItem.disabled = !hasItem(); inItem.placeholder = hasItem() ? t('itemPh') : t('none');
    selNat.disabled = !hasNat();
    selAb.replaceChildren();
    if (!hasAb()) { selAb.append(el('option', {value:'', text:t('none')})); selAb.disabled = true; s.ab = ''; }
    else if (!sp) { selAb.append(el('option', {value:'', text:'—'})); selAb.disabled = true; }
    else {
      selAb.disabled = false;
      const own = sp.a.slice();
      const byName = (a,b) => tr('a',a).localeCompare(tr('a',b), prefs.lang);
      if (own.length > 1 || prefs.random) selAb.append(el('option', {value:'', text:t('pickAb')}));
      if (prefs.random) {
        const g1 = el('optgroup', {label:t('own')}), g2 = el('optgroup', {label:t('allAb')});
        own.forEach(a => g1.append(el('option', {value:a, text:tr('a',a)})));
        allAbilities.filter(a => !own.includes(a)).sort(byName).forEach(a => g2.append(el('option', {value:a, text:tr('a',a)})));
        selAb.append(g1, g2);
      } else own.forEach(a => selAb.append(el('option', {value:a, text:tr('a',a)})));
      const valid = prefs.random ? allAbilities.includes(s.ab) : own.includes(s.ab);
      selAb.value = valid ? s.ab : (!prefs.random && own.length === 1 ? own[0] : '');
      s.ab = selAb.value;
    }
    // stats
    const nat = hasNat() ? natures.find(n => n[0] === s.nat) : null;
    rows.forEach((r,i) => {
      r.box.style.display = prefs.gen === 1 && i === 4 ? 'none' : '';
      const val = sp ? sp.s[i] : null;
      const tag = nat && nat[1] && i > 0 ? (STAT_KEYS[i] === nat[1] ? '<span class="up"> ▲</span>' : STAT_KEYS[i] === nat[2] ? '<span class="dn"> ▼</span>' : '') : '';
      r.l.innerHTML = statName(i) + tag;
      const dir = nat && nat[1] && i > 0 ? (STAT_KEYS[i] === nat[1] ? 1 : STAT_KEYS[i] === nat[2] ? -1 : 0) : 0;
      const mod = val ? (dir > 0 ? Math.floor(val * 1.1) : dir < 0 ? Math.floor(val * 0.9) : val) : null;
      const pct = x => Math.min(100, x / 180 * 100);
      r.v.textContent = mod ?? '–';
      r.v.className = 'v' + (dir > 0 ? ' up' : dir < 0 ? ' dn' : '');
      // barra: parte común + diferencia superpuesta (roja si sube, azul si baja)
      const lo = val ? Math.min(val, mod) : 0;
      r.bi.style.width = val ? pct(lo) + '%' : '0';
      r.bi.style.background = val ? statColor(val) : 'transparent';
      r.df.className = 'df' + (dir > 0 ? ' up' : dir < 0 ? ' dn' : '');
      r.df.style.left = pct(lo) + '%';
      r.df.style.width = dir ? (pct(Math.max(val, mod)) - pct(lo)) + '%' : '0';
    });
    bst.lastChild.textContent = sp ? sp.s.reduce((a,b,i) => a + (prefs.gen === 1 && i === 4 ? 0 : b), 0) : '–';
    // movimientos
    mvEls.forEach((m,i) => {
      const mv = MV[s.mv[i]];
      m.input.value = tr('m', s.mv[i]);
      m.dot.style.background = mv ? (TYPE_COLORS[mv[1]] || '#666') : 'var(--line)';
      m.meta.textContent = mv ? `${catName(mv[2])}${mv[3] ? ' ' + mv[3] : ''}` : '';
      m.input.classList.toggle('has-meta', !!mv);
      const bad = !!(mv && sp && !prefs.random && !canLearn(sp, moves.indexOf(mv)));
      m.input.classList.toggle('illegal', bad);
      m.input.title = bad ? t('illegal') : '';
    });
  };

  /* --- eventos --- */
  const commit = () => { save(); render(); };
  combobox(inSp, () => speciesOpts, v => {
    if (v === undefined) return render();
    const s = state[idx];
    if (v !== s.sp) {
      s.sp = v; s.ab = '';
      const sp = SP[v];
      if (sp && sp.m && sp.ri && !s.item) s.item = sp.ri; // sugerir megapiedra
    }
    commit();
  });
  combobox(inItem, itemOpts, v => { if (v !== undefined) state[idx].item = v; commit(); });
  inNick.addEventListener('input', () => { state[idx].nick = inNick.value; save(); });
  selAb.addEventListener('change', () => { state[idx].ab = selAb.value; save(); });
  selNat.addEventListener('change', () => commit.call(null, state[idx].nat = selNat.value));
  mvEls.forEach((m,i) => combobox(m.input, () => moveOptsFor(idx), v => { if (v !== undefined) state[idx].mv[i] = v; commit(); }));

  board.append(root);
  const r = () => render(); r.mvPh = () => mvEls.forEach((m,i) => { m.input.placeholder = `${t('movePh')} ${i+1}`; });
  return r;
}

setGen(GENS[prefs.gen] ? prefs.gen : 9);
for (let i = 0; i < 6; i++) slots.push(buildSlot(i));
const refresh = () => slots.forEach(r => r());

const genSel = document.getElementById('gen'), foot = document.getElementById('foot'), teamsBox = document.getElementById('teams');
const teamBtns = [0,1,2].map(i => {
  const b = el('button', {type:'button', class:'teambtn', text:String(i+1)});
  b.onclick = () => { if (i === team) return; save(); team = i; state = clean(normGen(prefs.gen).t[i]); save(); syncPrefs(); refresh(); };
  teamsBox.append(b);
  return b;
});
for (let g = 1; g <= 9; g++) genSel.append(el('option', {value:g, text:'Gen ' + g}));
const langSel = document.getElementById('lang'), rndBtn = document.getElementById('randomlocke');
const syncPrefs = () => {
  genSel.value = prefs.gen;
  teamBtns.forEach((b,i) => { b.classList.toggle('on', i === team); b.setAttribute('aria-pressed', i === team); b.title = `${t('team')} ${i+1}`; });
  langSel.value = prefs.lang;
  rndBtn.classList.toggle('on', prefs.random);
  rndBtn.setAttribute('aria-pressed', prefs.random);
  rndBtn.title = t('rndOn');
  document.documentElement.lang = prefs.lang;
  const g = prefs.gen;
  foot.textContent = t('foot')(g, species.length, moves.length, g >= 6 && g !== 8);
  genSel.title = t('genTitle'); langSel.title = t('langTitle');
  document.getElementById('resetAll').textContent = t('resetAll');
  document.getElementById('wipe').textContent = t('wipe');
  document.querySelectorAll('[data-i]').forEach(e => { e.textContent = t(e.dataset.i); });
  document.querySelectorAll('[data-ph]').forEach(e => { e.placeholder = t(e.dataset.ph); });
  slots.forEach(sl => sl.mvPh());
};
genSel.onchange = () => { save(); setGen(+genSel.value); savePrefs(); syncPrefs(); refresh(); };
langSel.onchange = () => { prefs.lang = langSel.value; savePrefs(); syncPrefs(); refresh(); };
rndBtn.onclick = () => { prefs.random = !prefs.random; savePrefs(); syncPrefs(); refresh(); };
syncPrefs();
updatePaste();
refresh();

document.getElementById('wipe').onclick = () => {
  if (!confirm(t('confirmWipe'))) return;
  all = {}; team = 0;
  try { localStorage.removeItem(KEY2); localStorage.removeItem(KEY); } catch(e) {}
  state = clean(); save(); syncPrefs(); refresh();
};
document.getElementById('resetAll').onclick = () => {
  if (state.some(s => s.sp || s.nick || s.item || s.nat || s.mv.some(Boolean)) && !confirm(t('confirmReset'))) return;
  state = clean(); save(); refresh();
};
})();
