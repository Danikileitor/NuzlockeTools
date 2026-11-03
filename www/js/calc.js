/* Damage Calculator · UI. Usa los datos de teamsheet-data.js y el motor calc-engine.js */
(() => {
'use strict';
const {gens: GENS, es: ES} = DATA, E = CalcEngine;
const $ = id => document.getElementById(id);
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  kids.forEach(k => e.append(k));
  return e;
};

/* ---------- Preferencias y estado ---------- */
const LS = 'dmgcalc-v1', LANG = 'pm-lang';
let lang = 'es';
try { lang = JSON.parse(localStorage.getItem(LANG)) || 'es'; } catch (e) {}
const blankMove = () => ({n:'', bp:'', hits:'', crit:false, z:false});
const blankSide = () => ({sp:'', lvl:50, nat:'', ab:'', abOn:false, item:'', status:'', hpPct:100, gender:'', tera:'', dmax:false, iv:[31,31,31,31,31,31], ev:[0,0,0,0,0,0], stages:[0,0,0,0,0], reflect:false, lscreen:false, mv:[0,1,2,3].map(blankMove)});
const S = {gen:9, random:false, weather:'', terrain:'', sides:[Object.assign(blankSide(), {sp:'Charizard'}), Object.assign(blankSide(), {sp:'Blastoise'})]};
try {
  const o = JSON.parse(localStorage.getItem(LS) || 'null');
  if (o) { S.gen = o.gen || 9; S.random = !!o.random; S.weather = o.weather || ''; S.terrain = o.terrain || ''; if (o.sides) S.sides = o.sides.map(x => Object.assign(blankSide(), x, {mv:[0,1,2,3].map(j => Object.assign(blankMove(), (x.mv || [])[j]))})); }
} catch (e) {}
S.random = PMRandom.get();   // Randomlocke compartido entre páginas
const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} };

/* ---------- Traducciones ---------- */
const TYPE_ES = {Normal:'Normal',Fire:'Fuego',Water:'Agua',Electric:'Eléctrico',Grass:'Planta',Ice:'Hielo',Fighting:'Lucha',Poison:'Veneno',Ground:'Tierra',Flying:'Volador',Psychic:'Psíquico',Bug:'Bicho',Rock:'Roca',Ghost:'Fantasma',Dragon:'Dragón',Dark:'Siniestro',Steel:'Acero',Fairy:'Hada'};
const TYPE_COLORS = {Normal:'#9fa19f',Fire:'#e8622c',Water:'#3a8de0',Electric:'#e8b90c',Grass:'#4fae3d',Ice:'#4cc7c0',Fighting:'#d0364e',Poison:'#a350cc',Ground:'#b9743a',Flying:'#7d9fe0',Psychic:'#f0577b',Bug:'#90a516',Rock:'#b5a76a',Ghost:'#5a6bb5',Dragon:'#0d6ac0',Dark:'#5a5266',Steel:'#4f8aa2',Fairy:'#ee7ccf'};
const NAT_ES = {Adamant:'Firme',Bashful:'Tímida',Bold:'Osada',Brave:'Audaz',Calm:'Serena',Careful:'Cauta',Docile:'Dócil',Gentle:'Amable',Hardy:'Fuerte',Hasty:'Activa',Impish:'Agitada',Jolly:'Alegre',Lax:'Floja',Lonely:'Huraña',Mild:'Afable',Modest:'Modesta',Naive:'Ingenua',Naughty:'Pícara',Quiet:'Mansa',Quirky:'Rara',Rash:'Alocada',Relaxed:'Plácida',Sassy:'Grosera',Serious:'Seria',Timid:'Miedosa'};
const tt = x => lang === 'es' ? (TYPE_ES[x] || x) : x;
const trNat = n => lang === 'es' ? (NAT_ES[n] || n) : n;
const tr = (k, n) => {
  if (!n || lang !== 'es') return n;
  if (ES[k][n]) return ES[k][n];
  if (k === 'm' && n.startsWith('Hidden Power ')) return 'Poder Oculto ' + tt(n.slice(13));
  return n;
};
const I = {
  es: {
    title:'Calculadora de daño', gen:'Generación', rnd:'Randomlocke', rndOn:'Randomlocke activado: puedes elegir cualquier habilidad y cualquier movimiento de la generación', rndOff:'Randomlocke desactivado: solo habilidades y movimientos que el Pokémon puede tener',
    weather:'Clima', w:{'':'Ninguno', Sun:'Sol', Rain:'Lluvia', Sand:'Tormenta de arena', Hail:'Granizo', Snow:'Nieve', 'Harsh Sun':'Sol abrasador', 'Heavy Rain':'Lluvia intensa'},
    p1:'Pokémon 1', p2:'Pokémon 2', swap:'⇄ Intercambiar', search:'Buscar Pokémon…', level:'Nivel', nature:'Naturaleza', ability:'Habilidad', abOn:'Habilidad activa', item:'Objeto', noItem:'Sin objeto',
    status:'Estado', st:{'':'Sano', brn:'Quemado', par:'Paralizado', psn:'Envenenado', tox:'Gravemente envenenado', slp:'Dormido', frz:'Congelado'}, hp:'PS actuales (%)',
    stats:['PS','Ataque','Defensa','At. Esp.','Def. Esp.','Velocidad'], special:'Especial', base:'Base', iv:'IV', dv:'DV', ev:'EV', se:'Exp.', total:'Total', stage:'Niv.',
    moves:'Movimientos', move:'Movimiento…', bp:'Pot.', crit:'Crítico', hits:'Golpes', reflect:'Pantalla de Luz / Reflejo', phys:'Fís.', spec:'Esp.', stat:'Est.',
    noDmg:'No hace daño', immune:'Sin efecto', vs:'contra', faster:'es más rápido', tie:'Empate de velocidad', speed:'Velocidad',
    ko1:'OHKO garantizado', koP:(p, n) => `${p}% de probabilidad de ${n === 1 ? 'OHKO' : n + 'HKO'}`, koG:n => `${n}HKO garantizado`, koMore:n => `Necesita ${n}+ golpes`, koPossible:n => `posible ${n}HKO`,
    none:'No existe en esta generación', noRes:'Sin resultados', neutral:'neutra', pickNat:'— Neutra —', reset:'Reiniciar', screens:'Pantallas', refl:'Reflejo', ls:'Pantalla de Luz',
    foot:(g, n, m) => `Datos de la Gen ${g} de Pokémon Showdown (${n} Pokémon, ${m} movimientos) · Sprites de play.pokemonshowdown.com · Cálculo aproximado: no cubre todas las habilidades, objetos ni movimientos especiales · Se guarda en tu navegador.`,
    gensel:'Generación',
    gender:'Género', gen_:{'':'—', M:'♂ Macho', F:'♀ Hembra'}, tera:'Teracristal', noTera:'— Sin teracristalizar —', dmax:'Dynamax', zm:'Z', zTip:'Movimiento Z',
    preset:'Preset', presetPick:'— Elegir preset —', gSmogon:'Sets de Smogon', gGeneric:'Genéricos', gMine:'Mis presets', save:'Guardar', del:'Borrar',
    saveAsk:'Nombre del preset:', delAsk:'¿Borrar este preset?', saveTip:'Guarda la configuración actual de este Pokémon como preset', delTip:'Borra el preset guardado seleccionado',
    terrain:'Terreno', ter:{'':'Ninguno', Electric:'Eléctrico', Grassy:'Hierba', Misty:'Niebla', Psychic:'Psíquico'}, maxTag:'Movimiento Max', zTag:'Movimiento Z',
    gp:{neutral:'Sin inversión (0 EV, naturaleza neutra)', physFast:'Físico rápido (Alegre, 252 Atq/Vel)', physPow:'Físico potente (Firme, 252 Atq/Vel)', specFast:'Especial rápido (Miedosa, 252 AtE/Vel)', specPow:'Especial potente (Modesta, 252 AtE/Vel)', physWall:'Muro físico (Osada, 252 PS/Def)', specWall:'Muro especial (Serena, 252 PS/DefE)', max:'Máximo (252 EV en Atq/AtE/Vel…)'}
  },
  en: {
    title:'Damage Calculator', gen:'Generation', rnd:'Randomlocke', rndOn:'Randomlocke on: any ability and any move of the generation can be chosen', rndOff:'Randomlocke off: only abilities and moves the Pokémon can have',
    weather:'Weather', w:{'':'None', Sun:'Sun', Rain:'Rain', Sand:'Sandstorm', Hail:'Hail', Snow:'Snow', 'Harsh Sun':'Harsh Sunlight', 'Heavy Rain':'Heavy Rain'},
    p1:'Pokémon 1', p2:'Pokémon 2', swap:'⇄ Swap', search:'Search Pokémon…', level:'Level', nature:'Nature', ability:'Ability', abOn:'Ability active', item:'Item', noItem:'No item',
    status:'Status', st:{'':'Healthy', brn:'Burned', par:'Paralyzed', psn:'Poisoned', tox:'Badly poisoned', slp:'Asleep', frz:'Frozen'}, hp:'Current HP (%)',
    stats:['HP','Attack','Defense','Sp. Atk','Sp. Def','Speed'], special:'Special', base:'Base', iv:'IV', dv:'DV', ev:'EV', se:'Exp.', total:'Total', stage:'Stg.',
    moves:'Moves', move:'Move…', bp:'BP', crit:'Crit', hits:'Hits', reflect:'Light Screen / Reflect', phys:'Phys.', spec:'Spec.', stat:'Stat.',
    noDmg:'Deals no damage', immune:'No effect', vs:'vs', faster:'is faster', tie:'Speed tie', speed:'Speed',
    ko1:'Guaranteed OHKO', koP:(p, n) => `${p}% chance to ${n === 1 ? 'OHKO' : n + 'HKO'}`, koG:n => `Guaranteed ${n}HKO`, koMore:n => `Needs ${n}+ hits`, koPossible:n => `possible ${n}HKO`,
    none:'Not available in this generation', noRes:'No results', neutral:'neutral', pickNat:'— Neutral —', reset:'Reset', screens:'Screens', refl:'Reflect', ls:'Light Screen',
    foot:(g, n, m) => `Gen ${g} data from Pokémon Showdown (${n} Pokémon, ${m} moves) · Sprites from play.pokemonshowdown.com · Approximate: not every ability, item or special move is covered · Saved in your browser.`,
    gensel:'Generation',
    gender:'Gender', gen_:{'':'—', M:'♂ Male', F:'♀ Female'}, tera:'Tera Type', noTera:'— Not terastallized —', dmax:'Dynamax', zm:'Z', zTip:'Z-Move',
    preset:'Preset', presetPick:'— Pick preset —', gSmogon:'Smogon sets', gGeneric:'Generic', gMine:'My presets', save:'Save', del:'Delete',
    saveAsk:'Preset name:', delAsk:'Delete this preset?', saveTip:'Save this Pokémon\'s current setup as a preset', delTip:'Delete the selected saved preset',
    terrain:'Terrain', ter:{'':'None', Electric:'Electric', Grassy:'Grassy', Misty:'Misty', Psychic:'Psychic'}, maxTag:'Max Move', zTag:'Z-Move',
    gp:{neutral:'No investment (0 EVs, neutral nature)', physFast:'Fast physical (Jolly, 252 Atk/Spe)', physPow:'Strong physical (Adamant, 252 Atk/Spe)', specFast:'Fast special (Timid, 252 SpA/Spe)', specPow:'Strong special (Modest, 252 SpA/Spe)', physWall:'Physical wall (Bold, 252 HP/Def)', specWall:'Special wall (Calm, 252 HP/SpD)', max:'Maxed (252 EVs in Atk/SpA/Spe…)'}
  }
};
const t = k => I[lang][k];

/* ---------- Datos de la generación ---------- */
const spriteUrls = id => [`https://play.pokemonshowdown.com/sprites/ani/${id}.gif`, `https://play.pokemonshowdown.com/sprites/dex/${id}.png`, `https://play.pokemonshowdown.com/sprites/gen5/${id}.png`];
let G = null;   // datos de la gen actual
function loadGen(g) {
  const d = GENS[g], MV = Object.fromEntries(d.moves.map(m => [m[0], m]));
  // Todos los Pokémon: los de la gen elegida mandan; los que no existen en ella se toman de la gen más cercana
  const order = [g]; for (let k = 1; k < 9; k++) { if (g - k >= 1) order.push(g - k); if (g + k <= 9) order.push(g + k); }
  const SP = {}, SRC = {};
  for (const gg of order) GENS[gg].species.forEach((s, i) => { if (!SP[s.n]) { SP[s.n] = s; SRC[s.n] = {gen:gg, idx:i}; } });
  const species = Object.values(SP).sort((x, y) => x.num - y.num || (x.n.includes('-') - y.n.includes('-')) || x.n.localeCompare(y.n));
  const items = d.items.slice();
  species.forEach(s => { if (s.ri && !items.includes(s.ri)) items.push(s.ri); });
  const sets = {};
  const learnSet = name => {
    if (sets[name]) return sets[name];
    const src = SRC[name], set = new Set();
    if (src) {
      const bytes = Uint8Array.from(atob(GENS[src.gen].learn[src.idx]), c => c.charCodeAt(0));
      GENS[src.gen].moves.forEach((m, i) => { if (bytes[i >> 3] & (1 << (i & 7))) set.add(m[0]); });
    }
    if (!set.size) { const base = name.replace(/-(Mega|Primal|Gmax|Ultra|Origin|Crowned|Eternamax).*$/, ''); if (base !== name && SRC[base]) return sets[name] = learnSet(base); }
    return sets[name] = set;
  };
  G = {g, species, SP, SRC, MV, moves:d.moves, items, natures:d.natures, learnSet,
    allAb:[...new Set(species.flatMap(s => s.a))].sort()};
}
const hasAb = () => S.gen >= 3, hasNat = () => S.gen >= 3, hasItem = () => S.gen >= 2, oldGen = () => S.gen <= 2;
const sortEs = arr => lang === 'es' ? arr.slice().sort((a, b) => a.l.localeCompare(b.l, 'es')) : arr;
const catName = c => c === 'P' ? t('phys') : c === 'S' ? t('spec') : t('stat');

/* ---------- Combobox (miniaturas) ---------- */
function thumb(id) {
  const urls = [spriteUrls(id)[1], spriteUrls(id)[2]];
  const img = el('img', {class:'thumb', alt:'', loading:'lazy', decoding:'async', src:urls[0]});
  let n = 0;
  img.onerror = () => { if (++n < urls.length) img.src = urls[n]; else img.style.visibility = 'hidden'; };
  return img;
}
function combobox(input, getOpts, onPick) {
  const dd = el('div', {class:'dd'});
  input.parentElement.append(dd);
  let list = [], act = -1;
  const render = () => {
    const q = norm(input.value), all = getOpts();
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
    list = r.slice(0, 1500); act = list.length && q ? 0 : -1;
    dd.replaceChildren();
    if (!list.length) dd.append(el('div', {class:'empty', text:t('noRes')}));
    list.forEach((o, i) => {
      const label = el('span', {class:'opt'});
      if (o.i) label.append(thumb(o.i));
      label.append(el('span', {text:o.l}));
      const d = el('div', {}, label, o.s ? el('small', {text:o.s}) : '');
      d.addEventListener('mousedown', ev => { ev.preventDefault(); pick(o); });
      if (i === act) d.classList.add('act');
      dd.append(d);
    });
    dd.classList.add('open');
  };
  const close = () => dd.classList.remove('open');
  const pick = o => { close(); input.value = o.l; onPick(o.v); input.blur(); };   // el valor del campo debe ser el elegido: el blur lo vuelve a leer
  const mark = () => { [...dd.children].forEach((c, i) => c.classList.toggle('act', i === act)); dd.children[act]?.scrollIntoView({block:'nearest'}); };
  input.addEventListener('focus', () => { input.dataset.fresh = '1'; input.select(); render(); });
  input.addEventListener('input', () => { input.dataset.fresh = '0'; render(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!dd.classList.contains('open')) render(); act = Math.min(list.length - 1, act + 1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); act = Math.max(0, act - 1); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (list[act]) pick(list[act]); else input.blur(); }
    else if (e.key === 'Escape') input.blur();
  });
  input.addEventListener('blur', () => {
    close();
    const v = input.value.trim();
    if (!v) { onPick(''); return; }
    const exact = getOpts().find(o => norm(o.l) === norm(v) || (o.alt && norm(o.alt) === norm(v)));
    onPick(exact ? exact.v : undefined);   // undefined = revertir
  });
}

/* ---------- Opciones ---------- */
const speciesOpts = () => G.species.map(s => ({v:s.n, l:s.n, s:'#' + s.num, i:s.i}));
const abilityOpts = side => {
  const sp = G.SP[side.sp];
  const names = S.random || !sp ? G.allAb : sp.a;
  return sortEs(names.map(n => ({v:n, l:tr('a', n), alt:n})));
};
const itemOpts = () => sortEs(G.items.map(n => ({v:n, l:tr('i', n), alt:n})));
const moveOpts = side => {
  const sp = G.SP[side.sp], all = S.random || !sp, out = [], set = sp ? G.learnSet(sp.n) : null;
  G.moves.forEach((m, i) => {
    if (all || set.has(m[0])) out.push({v:m[0], l:tr('m', m[0]), alt:m[0], s:`${tt(m[1])} · ${catName(m[2])}${m[3] ? ' · ' + m[3] : ''}`});
  });
  return sortEs(out);
};

/* ---------- Cálculo de cada lado ---------- */
const NAT = side => G.natures.find(n => n[0] === side.nat) || null;
function finalStats(side) {
  const sp = G.SP[side.sp]; if (!sp) return null;
  const iv = side.iv.slice();
  if (oldGen()) iv[0] = E.hpDV(iv);
  return E.calcStats(S.gen, sp.s, {lvl:side.lvl, iv, ev:side.ev, nat:hasNat() ? NAT(side) : null});
}
const monOf = side => {
  const sp = G.SP[side.sp], stats = finalStats(side);
  if (stats && S.gen === 8 && side.dmax) stats[0] *= 2;      // Dynamax duplica los PS
  return {gender:S.gen >= 2 ? side.gender : '', tera:S.gen >= 9 ? side.tera : '', sp, lvl:side.lvl, stats, stages:side.stages, ab:side.ab, abOn:side.abOn, item:side.item, status:side.status, hpPct:side.hpPct, reflect:side.reflect, lscreen:side.lscreen};
};
const FIXED_HITS = {'Double Kick':2, 'Dual Chop':2, 'Bonemerang':2, 'Double Hit':2, 'Gear Grind':2, 'Twineedle':2, 'Dual Wingbeat':2, 'Double Iron Bash':2, 'Surging Strikes':3};

/* ---------- Interfaz de cada lado ---------- */
const sides = [];
const STAGES = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
function buildSide(idx) {
  const side = () => S.sides[idx];
  const root = el('section', {class:'side'});
  const title = el('h2', {text:''});
  const sprite = el('div', {class:'sprite'});
  const types = el('div', {class:'types'});

  const inSp = el('input', {type:'text', autocomplete:'off', spellcheck:'false'});
  const inLvl = el('input', {type:'number', min:1, max:100});
  const selNat = el('select');
  const inAb = el('input', {type:'text', autocomplete:'off', spellcheck:'false'});
  const chkAb = el('input', {type:'checkbox'});
  const inItem = el('input', {type:'text', autocomplete:'off', spellcheck:'false'});
  const selSt = el('select');
  const inHp = el('input', {type:'number', min:1, max:100});
  const chkRef = el('input', {type:'checkbox'}), chkLs = el('input', {type:'checkbox'});
  const selGen = el('select'), selTera = el('select'), chkDmax = el('input', {type:'checkbox'});
  const selPre = el('select', {class:'presel'}), bSave = el('button', {type:'button', class:'btn small'}), bDel = el('button', {type:'button', class:'btn small'});
  const lbls = {};
  const f = (key, node, cls = '') => { const l = el('label', {text:''}); lbls[key] = l; return el('div', {class:cls}, l, node); };
  const wrap = n => el('div', {class:'cb'}, n);

  const top = el('div', {class:'top'},
    el('div', {class:'who'}, sprite, types),
    el('div', {class:'fields'},
      f('pokemon', wrap(inSp), 'span2'),
      f('level', inLvl), f('nature', selNat),
      f('ability', wrap(inAb), 'span2'), f('abOn', el('label', {class:'chk'}, chkAb, el('span', {class:'abtxt'})), 'chkcell'), f('gender', selGen),
      f('item', wrap(inItem), 'span2'), f('status', selSt),
      f('hp', inHp), f('tera', selTera, 'span2 tera'), f('dmax', el('label', {class:'chk'}, chkDmax, el('span', {class:'dmtxt'})), 'chkcell dmax')));

  // tabla de stats
  const tbl = el('div', {class:'stats'});
  const rows = [];
  const head = el('div', {class:'srow shead'}, el('span'), ...['base', 'iv', 'ev', 'total', 'stage'].map(k => { const s = el('span', {text:''}); s.dataset.k = k; return s; }));
  tbl.append(head);
  for (let i = 0; i < 6; i++) {
    const nm = el('span', {class:'sname'});
    const base = el('span', {class:'base'});
    const iv = el('input', {type:'number', min:0}), ev = el('input', {type:'number', min:0});
    const tot = el('span', {class:'tot'});
    const stg = i ? el('select', {class:'stg'}, ...STAGES.map(v => el('option', {value:v, text:(v > 0 ? '+' : '') + v}))) : el('span');
    iv.oninput = () => { side().iv[i] = clamp(+iv.value, 0, oldGen() ? 15 : 31); save(); refresh(); };
    ev.oninput = () => { side().ev[i] = clamp(+ev.value, 0, oldGen() ? 65535 : 252); save(); refresh(); };
    if (i) stg.onchange = () => { side().stages[i - 1] = +stg.value; save(); refresh(); };
    const row = el('div', {class:'srow'}, nm, base, iv, ev, tot, stg);
    rows.push({row, nm, base, iv, ev, tot, stg});
    tbl.append(row);
  }

  // movimientos
  const movesBox = el('div', {class:'moves'});
  const mrows = [0, 1, 2, 3].map(j => {
    const inM = el('input', {type:'text', autocomplete:'off', spellcheck:'false'});
    const info = el('span', {class:'minfo'});
    const bp = el('input', {type:'number', min:0, class:'bpin'});
    const hits = el('input', {type:'number', min:1, max:10, class:'hitin'});
    const crit = el('input', {type:'checkbox'});
    const critL = el('label', {class:'chk small'}, crit, el('span'));
    const zc = el('input', {type:'checkbox'});
    const zL = el('label', {class:'chk small zl'}, zc, el('span'));
    const res = el('div', {class:'res'});
    const bar = el('div', {class:'bar'}, el('i'), el('b'));
    const row = el('div', {class:'mrow'}, el('div', {class:'mline'}, wrap(inM), info, bp, hits, critL, zL), res, bar);
    combobox(inM, () => moveOpts(side()), v => {
      if (v === undefined) { inM.value = side().mv[j].n ? tr('m', side().mv[j].n) : ''; return; }
      side().mv[j].n = v; if (v) { const fh = FIXED_HITS[v]; if (fh) side().mv[j].hits = fh; }
      save(); refresh();
    });
    bp.oninput = () => { side().mv[j].bp = bp.value === '' ? '' : +bp.value; save(); refresh(); };
    hits.oninput = () => { side().mv[j].hits = hits.value === '' ? '' : clamp(+hits.value, 1, 10); save(); refresh(); };
    crit.onchange = () => { side().mv[j].crit = crit.checked; save(); refresh(); };
    zc.onchange = () => { side().mv[j].z = zc.checked; save(); refresh(); };
    movesBox.append(row);
    return {inM, info, bp, hits, crit, critL, zc, zL, res, bar, row};
  });

  const scr = el('div', {class:'screens'}, el('span', {class:'sclbl'}), el('label', {class:'chk small'}, chkRef, el('span', {class:'t1'})), el('label', {class:'chk small'}, chkLs, el('span', {class:'t2'})));
  const speedLine = el('div', {class:'speed'});
  const reset = el('button', {type:'button', class:'btn small', text:''});
  const mh = el('h3', {text:''});
  const presets = el('div', {class:'presets'}, selPre, bSave, bDel);
  root.classList.add(idx === 0 ? 's0' : 's1');
  root.append(el('div', {class:'shead2'}, title, reset), presets, top, tbl, scr, mh, movesBox);

  // handlers
  combobox(inSp, speciesOpts, v => {
    if (v === undefined) { inSp.value = side().sp; return; }
    if (v !== side().sp) { const prev = G.SP[side().sp]; side().sp = v; autoAbility(side()); autoItem(side(), prev); side().mv.forEach((m, j) => { if (m.n && v && !S.random && !learnable(side(), m.n)) { m.n = ''; m.hits = ''; } }); }
    save(); refreshAll();
  });
  combobox(inAb, () => abilityOpts(side()), v => {
    if (v === undefined) { inAb.value = side().ab ? tr('a', side().ab) : ''; return; }
    side().ab = v; save(); refresh();
  });
  combobox(inItem, itemOpts, v => {
    if (v === undefined) { inItem.value = side().item ? tr('i', side().item) : ''; return; }
    side().item = v; save(); refresh();
  });
  inLvl.oninput = () => { side().lvl = clamp(+inLvl.value || 1, 1, 100); save(); refresh(); };
  inHp.oninput = () => { side().hpPct = clamp(+inHp.value || 1, 1, 100); save(); refresh(); };
  selNat.onchange = () => { side().nat = selNat.value; save(); refresh(); };
  selSt.onchange = () => { side().status = selSt.value; save(); refresh(); };
  chkAb.onchange = () => { side().abOn = chkAb.checked; save(); refresh(); };
  selGen.onchange = () => { side().gender = selGen.value; save(); refresh(); };
  selTera.onchange = () => { side().tera = selTera.value; save(); refreshAll(); };
  chkDmax.onchange = () => { side().dmax = chkDmax.checked; save(); refresh(); };
  selPre.onchange = () => { const v = selPre.value; selPre.value = ''; if (v) applyPreset(idx, v); };
  bSave.onclick = () => saveUserPreset(idx);
  bDel.onclick = () => deleteUserPreset(idx);
  chkRef.onchange = () => { side().reflect = chkRef.checked; save(); refresh(); };
  chkLs.onchange = () => { side().lscreen = chkLs.checked; save(); refresh(); };
  reset.onclick = () => { const sp = side().sp; S.sides[idx] = Object.assign(blankSide(), {sp}); save(); refreshAll(); };

  const o = {selGen, selTera, chkDmax, selPre, bSave, bDel, idx, root, title, sprite, types, inSp, inLvl, selNat, inAb, chkAb, inItem, selSt, inHp, chkRef, chkLs, rows, mrows, lbls, head, scr, reset, mh, speedLine};
  sides.push(o);
  return o;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, isNaN(v) ? a : v));
const learnable = (side, name) => { const sp = G.SP[side.sp]; return !sp || G.learnSet(sp.n).has(name); };
function autoAbility(side) {
  const sp = G.SP[side.sp];
  if (!sp || !hasAb()) { side.ab = ''; return; }
  if (S.random ? !G.allAb.includes(side.ab) : !sp.a.includes(side.ab)) side.ab = sp.a[0] || '';
}

// Al elegir una megaevolución (o forma con objeto obligatorio) se pone su objeto; al dejarla se quita
function autoItem(side, prev) {
  const sp = G.SP[side.sp];
  if (!hasItem()) return;
  if (sp && sp.ri) side.item = sp.ri;
  else if (prev && prev.ri && side.item === prev.ri) side.item = '';
}

/* ---------- Presets ---------- */
const PKEY = 'dmgcalc-presets-v1';
const userPresets = () => { try { return JSON.parse(localStorage.getItem(PKEY)) || []; } catch (e) { return []; } };
const saveUserPresets = l => { try { localStorage.setItem(PKEY, JSON.stringify(l)); } catch (e) {} };
const GENERIC = {
  neutral:{nat:'', ev:[0, 0, 0, 0, 0, 0]},
  physFast:{nat:'Jolly', ev:[4, 252, 0, 0, 0, 252]}, physPow:{nat:'Adamant', ev:[4, 252, 0, 0, 0, 252]},
  specFast:{nat:'Timid', ev:[4, 0, 0, 252, 0, 252]}, specPow:{nat:'Modest', ev:[4, 0, 0, 252, 0, 252]},
  physWall:{nat:'Bold', ev:[252, 0, 252, 0, 4, 0]}, specWall:{nat:'Calm', ev:[252, 0, 4, 0, 252, 0]},
  max:{nat:'', ev:[0, 252, 0, 252, 0, 252]}
};
const setsLoaded = {};
function loadSets(gen, cb) {
  if (window.CALC_SETS && CALC_SETS[gen]) return;
  if (setsLoaded[gen]) return;
  setsLoaded[gen] = true;
  const sc = document.createElement('script'); sc.src = 'js/sets/gen' + gen + '.js';
  sc.onload = () => { sides.forEach(fillPresets); }; sc.onerror = () => {};
  document.head.append(sc);
}
const smogonSets = sp => ((window.CALC_SETS || {})[S.gen] || {})[sp] || {};
function fillPresets(o) {
  const side = S.sides[o.idx], sel = o.selPre;
  sel.replaceChildren(el('option', {value:'', text:t('presetPick')}));
  const smo = Object.keys(smogonSets(side.sp));
  if (smo.length) { const g = el('optgroup', {label:t('gSmogon')}); smo.forEach(n => g.append(el('option', {value:'s:' + n, text:n}))); sel.append(g); }
  const gg = el('optgroup', {label:t('gGeneric')});
  Object.keys(GENERIC).forEach(k => { if (!(oldGen() && k === 'neutral' && false)) gg.append(el('option', {value:'g:' + k, text:t('gp')[k]})); });
  sel.append(gg);
  const mine = userPresets();
  if (mine.length) {
    const g = el('optgroup', {label:t('gMine')});
    mine.slice().sort((a, b) => (b.sp === side.sp) - (a.sp === side.sp)).forEach(p => g.append(el('option', {value:'u:' + p.id, text:(p.sp ? p.sp + ' · ' : '') + p.name})));
    sel.append(g);
  }
  o.bSave.textContent = t('save'); o.bDel.textContent = t('del'); o.bSave.title = t('saveTip'); o.bDel.title = t('delTip');
  o.bSave.disabled = !side.sp; o.bDel.disabled = !mine.some(p => p.id === o.lastUser);
}
const toStatExp = v => v >= 252 ? 65535 : v * 260;
function applyData(side, p) {          // p: {level, item, ab, nat, tera, ev:[6], iv:[6|null]|0, moves:[]}
  if (p.level) side.lvl = p.level;
  if (p.nat !== undefined) side.nat = hasNat() && G.natures.some(n => n[0] === p.nat) ? p.nat : '';
  if (p.ev) {
    side.ev = oldGen() ? p.ev.map(toStatExp) : p.ev.slice();
    side.iv = side.iv.map(() => oldGen() ? 15 : 31);
    if (p.iv) p.iv.forEach((v, i) => { if (v != null) side.iv[i] = oldGen() ? Math.min(15, Math.round(v / 2)) : v; });
  }
  if ('item' in p) side.item = hasItem() && G.items.includes(p.item) ? p.item : (G.SP[side.sp] && G.SP[side.sp].ri) || '';
  if (p.ab && hasAb()) side.ab = p.ab;
  if ('tera' in p) side.tera = S.gen >= 9 && TERAS.includes(p.tera) ? p.tera : '';
  if (p.moves) side.mv = [0, 1, 2, 3].map(j => Object.assign(blankMove(), p.moves[j] && G.MV[p.moves[j]] ? {n:p.moves[j]} : {}));
}
function applyPreset(idx, v) {
  const side = S.sides[idx], [k, name] = [v.slice(0, 1), v.slice(2)];
  if (k === 's') {
    const r = smogonSets(side.sp)[name]; if (!r) return;
    applyData(side, {level:r[0], item:r[1], ab:r[2], nat:r[3], tera:r[4], ev:r[5], iv:r[6], moves:r[7]});
    if (S.random && side.ab) {} else if (side.sp && hasAb() && !(G.SP[side.sp].a || []).includes(side.ab)) autoAbility(side);
  } else if (k === 'g') {
    applyData(side, GENERIC[name]);
  } else if (k === 'u') {
    const p = userPresets().find(x => String(x.id) === name); if (!p) return;
    applyData(side, p.data); sides[idx].lastUser = p.id;
  }
  sanitize(); save(); refreshAll();
}
function saveUserPreset(idx) {
  const side = S.sides[idx]; if (!side.sp) return;
  const name = prompt(t('saveAsk'), '');
  if (!name || !name.trim()) return;
  const l = userPresets();
  l.push({id:Date.now(), name:name.trim(), sp:side.sp, data:{level:side.lvl, item:side.item, ab:side.ab, nat:side.nat, tera:side.tera, ev:side.ev.slice(), iv:side.iv.slice(), moves:side.mv.map(m => m.n).filter(Boolean)}});
  saveUserPresets(l); sides.forEach(fillPresets);
}
function deleteUserPreset(idx) {
  const o = sides[idx], l = userPresets(), target = l.find(p => p.id === o.lastUser);
  if (!target || !confirm(t('delAsk') + '\n' + (target.sp ? target.sp + ' · ' : '') + target.name)) return;
  o.lastUser = null; saveUserPresets(l.filter(p => p.id !== target.id)); sides.forEach(fillPresets);
}
const TERAS = ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];

/* ---------- Pintado ---------- */
function paintSprite(o) {
  const sp = G.SP[S.sides[o.idx].sp];
  o.sprite.replaceChildren(); o.types.replaceChildren();
  if (!sp) return;
  const urls = spriteUrls(sp.i);
  const img = el('img', {alt:sp.n, src:urls[0]}); let n = 0;
  img.onerror = () => { if (++n < urls.length) img.src = urls[n]; else img.style.visibility = 'hidden'; };
  o.sprite.append(img);
  const ts = S.gen >= 9 && S.sides[o.idx].tera ? [S.sides[o.idx].tera] : sp.t;
  ts.forEach(x => { const c = el('span', {class:'type', text:(ts !== sp.t ? '◆ ' : '') + tt(x)}); c.style.background = TYPE_COLORS[x] || '#666'; o.types.append(c); });
}
const fmtPct = (x, hp) => (x * 100 / hp).toFixed(1).replace(/\.0$/, '');
function koText(rolls, hp) {
  const k = E.koSummary(rolls, hp);
  if (!k.n) return '';
  if (k.n === 1) return k.chance >= 1 ? t('ko1') : t('koP')((k.chance * 100).toFixed(1), 1);
  if (k.n > 4) return k.n > 6 ? t('koMore')(7) : t('koPossible')(k.n);
  return k.chance >= 1 ? t('koG')(k.n) : k.chance > 0 ? t('koP')((k.chance * 100).toFixed(1), k.n) : t('koG')(k.n + 1);
}
function renderOne(o) {
  const atk = S.sides[o.idx], def = S.sides[1 - o.idx];
  const A = G.SP[atk.sp] ? monOf(atk) : null, D = G.SP[def.sp] ? monOf(def) : null;
  o.mrows.forEach((r, j) => {
    const m = atk.mv[j], mdata = G.MV[m.n];
    r.res.className = 'res'; r.res.textContent = ''; r.res.removeAttribute('title');
    r.bar.firstChild.style.width = '0%'; r.bar.lastChild.style.width = '0%';
    r.bar.hidden = true;
    r.info.replaceChildren(); r.bp.placeholder = t('bp'); r.hits.placeholder = t('hits');
    r.bp.disabled = r.hits.disabled = r.crit.disabled = r.zc.disabled = !mdata;
    r.zL.hidden = S.gen !== 7;
    if (!mdata) return;
    const c = el('span', {class:'type', text:tt(mdata[1])}); c.style.background = TYPE_COLORS[mdata[1]] || '#666';
    r.info.append(c, el('span', {class:'cat c' + mdata[2], text:catName(mdata[2])}));
    r.bp.placeholder = mdata[3] ? String(mdata[3]) : t('bp');
    if (!A || !D) return;
    const bp = m.bp === '' ? mdata[3] : m.bp;
    let mvo = {n:m.n, type:mdata[1], cat:mdata[2], bp, hits:m.hits || FIXED_HITS[m.n] || 1, crit:m.crit}, tag = '';
    if (mdata[2] !== 'T') {
      if (S.gen === 7 && m.z) { mvo = Object.assign(mvo, {n:'', bp:E.zPower(bp), hits:1}); tag = 'zTag'; }
      else if (S.gen === 8 && atk.dmax) { mvo = Object.assign(mvo, {n:'', bp:E.maxPower(bp, mdata[1]), hits:1}); tag = 'maxTag'; }
    }
    const out = E.calc(S.gen, A, D, mvo, {weather:S.weather, terrain:S.terrain});
    if (!out) { r.res.textContent = mdata[2] === 'T' ? '' : t('noDmg'); r.res.classList.add('none'); return; }
    const rolls = out.rolls, hp = D.stats[0], curHP = Math.max(1, Math.round(hp * D.hpPct / 100)), mn = rolls[0], mx = rolls[rolls.length - 1];
    if (mx <= 0) { r.res.textContent = t('immune') + (out.notes[0] && out.notes[0].includes(':') ? ' (' + (out.notes[0].startsWith('ab:') ? tr('a', out.notes[0].slice(3)) : tr('i', out.notes[0].slice(5))) + ')' : ''); r.res.classList.add('none'); return; }
    const eff = out.eff, ef = eff === 1 ? '' : eff > 1 ? ' ×' + eff : ' ×' + eff;
    r.res.innerHTML = '';
    if (tag) r.res.append(el('span', {class:'tag', text:t(tag)}));
    r.res.append(el('b', {text:`${mn}–${mx}`}), el('span', {text:` (${fmtPct(mn, hp)}–${fmtPct(mx, hp)}%)`}), el('em', {text:ef}), el('span', {class:'ko', text:' · ' + koText(rolls, curHP)}));
    r.res.classList.add(eff > 1 ? 'se' : eff < 1 ? 'nve' : 'nm');
    r.res.title = `${A.sp.n} ${m.n} ${t('vs')} ${D.sp.n}: ${mn}-${mx}  (${out.rolls.length} rolls)`;
    r.bar.hidden = false;
    r.bar.firstChild.style.width = Math.min(100, mn * 100 / curHP) + '%';
    r.bar.lastChild.style.width = Math.min(100, Math.max(0, (mx - mn) * 100 / curHP)) + '%';
    r.bar.lastChild.style.left = Math.min(100, mn * 100 / curHP) + '%';
  });
}
function speedOf(side) {
  const st = finalStats(side); if (!st) return null;
  let v = Math.floor(st[5] * E.stageMul(S.gen, side.stages[4]));
  if (side.status === 'par') v = Math.floor(v * (S.gen >= 7 ? 0.5 : 0.25));
  if (side.item === 'Choice Scarf') v = Math.floor(v * 1.5);
  if (side.item === 'Iron Ball' || side.item === 'Macho Brace') v = Math.floor(v * 0.5);
  if (hasAb() && ((side.ab === 'Swift Swim' && S.weather === 'Rain') || (side.ab === 'Chlorophyll' && S.weather === 'Sun') || (side.ab === 'Sand Rush' && S.weather === 'Sand') || (side.ab === 'Slush Rush' && (S.weather === 'Hail' || S.weather === 'Snow')))) v *= 2;
  return v;
}
function paintLabels(o) {
  const side = S.sides[o.idx], sp = G.SP[side.sp];
  o.title.textContent = t(o.idx ? 'p2' : 'p1');
  const L = o.lbls;
  L.pokemon.textContent = 'Pokémon'; L.level.textContent = t('level'); L.nature.textContent = t('nature'); L.ability.textContent = t('ability');
  L.abOn.textContent = ''; o.chkAb.parentElement.querySelector('.abtxt').textContent = t('abOn');
  L.item.textContent = t('item'); L.status.textContent = t('status'); L.hp.textContent = t('hp');
  L.gender.textContent = t('gender'); L.tera.textContent = t('tera'); L.dmax.textContent = ''; o.chkDmax.parentElement.querySelector('.dmtxt').textContent = t('dmax');
  o.inSp.placeholder = t('search'); o.inItem.placeholder = t('noItem'); o.inAb.placeholder = '—';
  o.reset.textContent = t('reset'); o.mh.textContent = t('moves');
  o.head.children[1].textContent = t('base'); o.head.children[2].textContent = oldGen() ? t('dv') : t('iv');
  o.head.children[3].textContent = oldGen() ? t('se') : t('ev'); o.head.children[4].textContent = t('total'); o.head.children[5].textContent = t('stage');
  o.scr.querySelector('.sclbl').textContent = t('screens') + ':'; o.scr.querySelector('.t1').textContent = t('refl'); o.scr.querySelector('.t2').textContent = t('ls');
  o.mrows.forEach(r => { r.crit.parentElement.querySelector('span').textContent = t('crit'); r.zc.parentElement.querySelector('span').textContent = t('zm'); r.zL.title = t('zTip'); r.inM.placeholder = t('move'); });
}
function paintValues(o) {
  const side = S.sides[o.idx], sp = G.SP[side.sp];
  const setv = (inp, v) => { if (document.activeElement !== inp) inp.value = v; };
  setv(o.inSp, side.sp); setv(o.inLvl, side.lvl); setv(o.inHp, side.hpPct);
  setv(o.inAb, side.ab ? tr('a', side.ab) : ''); setv(o.inItem, side.item ? tr('i', side.item) : '');
  o.inAb.disabled = !hasAb(); o.inAb.placeholder = hasAb() ? '—' : t('none');
  o.chkAb.disabled = !hasAb(); o.chkAb.checked = side.abOn;
  o.inItem.disabled = !hasItem(); o.inItem.placeholder = hasItem() ? t('noItem') : t('none');
  o.selNat.disabled = !hasNat();
  o.selNat.replaceChildren(el('option', {value:'', text:hasNat() ? t('pickNat') : t('none')}));
  const SN = {Atk:1, Def:2, SpA:3, SpD:4, Spe:5}, sn = k => I[lang].stats[SN[k]];
  G.natures.forEach(([n, p, m]) => { if (p) o.selNat.append(el('option', {value:n, text:`${trNat(n)} (+${sn(p)} −${sn(m)})`})); });
  o.selNat.value = hasNat() ? side.nat : '';
  o.selSt.replaceChildren(...Object.entries(t('st')).map(([k, v]) => el('option', {value:k, text:v}))); o.selSt.value = side.status;
  o.chkRef.checked = side.reflect; o.chkLs.checked = side.lscreen;
  o.selGen.replaceChildren(...Object.entries(t('gen_')).map(([k, v]) => el('option', {value:k, text:v}))); o.selGen.value = side.gender; o.selGen.disabled = S.gen < 2;
  o.selTera.replaceChildren(el('option', {value:'', text:t('noTera')}), ...TERAS.map(x => el('option', {value:x, text:tt(x)}))); o.selTera.value = side.tera;
  o.selTera.parentElement.hidden = S.gen < 9;
  o.chkDmax.checked = side.dmax; o.chkDmax.parentElement.parentElement.hidden = S.gen !== 8;
  fillPresets(o);
  if (S.gen) loadSets(S.gen, () => fillPresets(o));
  const stats = finalStats(side);
  o.rows.forEach((r, i) => {
    const hide = S.gen === 1 && i === 4;
    r.row.hidden = hide;
    r.nm.textContent = S.gen === 1 && i === 3 ? t('special') : I[lang].stats[i];
    r.base.textContent = sp ? sp.s[i] : '–';
    const iv = oldGen() && i === 0 ? E.hpDV(side.iv) : side.iv[i];
    r.iv.disabled = oldGen() && i === 0; r.iv.max = oldGen() ? 15 : 31; r.ev.max = oldGen() ? 65535 : 252;
    setv(r.iv, iv); setv(r.ev, side.ev[i]);
    r.tot.textContent = stats ? stats[i] : '–';
    if (i) r.stg.value = side.stages[i - 1];
  });
  o.chkRef.parentElement.hidden = false;
}
function paintSpeed() {
  const [a, b] = S.sides.map(speedOf), line = $('speedline');
  if (a == null || b == null) { line.textContent = ''; return; }
  const na = S.sides[0].sp, nb = S.sides[1].sp;
  line.textContent = a === b ? `${t('tie')} (${a})` : `${a > b ? na : nb} ${t('faster')} (${Math.max(a, b)} ${t('vs')} ${Math.min(a, b)})`;
}
function paintStats(o) {
  const side = S.sides[o.idx], stats = finalStats(side);
  o.rows.forEach((r, i) => { r.tot.textContent = stats ? stats[i] : '–'; });
}
function paintMoves(o) {
  const side = S.sides[o.idx];
  o.mrows.forEach((r, j) => {
    const m = side.mv[j];
    if (document.activeElement !== r.inM) r.inM.value = m.n ? tr('m', m.n) : '';
    if (document.activeElement !== r.bp) r.bp.value = m.bp;
    if (document.activeElement !== r.hits) r.hits.value = m.hits;
    r.crit.checked = m.crit;
  });
}
function refresh() { sides.forEach(paintStats); sides.forEach(paintMoves); sides.forEach(renderOne); paintSpeed(); }
function refreshAll() {
  sides.forEach(o => { paintLabels(o); paintValues(o); paintSprite(o); });
  $('gensel').value = S.gen; $('weather').value = S.weather;
  $('rnd').classList.toggle('on', S.random); $('rnd').setAttribute('aria-pressed', S.random);
  refresh();
}

/* ---------- Cabecera y arranque ---------- */
function sanitize() {
  S.sides.forEach(side => {
    if (!G.SP[side.sp]) side.sp = '';
    if (!hasAb()) { side.ab = ''; side.abOn = false; } else if (side.sp && !(S.random ? G.allAb.includes(side.ab) : (G.SP[side.sp].a || []).includes(side.ab))) autoAbility(side);
    if (!hasItem() || !G.items.includes(side.item)) side.item = '';
    if (S.gen < 9) side.tera = ''; if (S.gen !== 8) side.dmax = false; if (S.gen < 2) side.gender = '';
    side.mv.forEach(m => { if (S.gen !== 7) m.z = false; });
    { const sp = G.SP[side.sp]; if (sp && sp.ri && hasItem() && !side.item) side.item = sp.ri; }
    if (!hasNat() || !G.natures.some(n => n[0] === side.nat)) side.nat = '';
    side.mv.forEach(m => { if (m.n && (!G.MV[m.n] || (!S.random && side.sp && !learnable(side, m.n)))) { m.n = ''; m.hits = ''; } });
    // IV/EV según la generación
    const old = oldGen();
    side.iv = side.iv.map(v => old ? Math.min(v, 15) : v); side.ev = side.ev.map(v => old ? v : Math.min(v, 252));
  });
}
function setGen(g, reset) {
  const wasOld = oldGen();
  S.gen = g; loadGen(g);
  if (wasOld !== oldGen()) S.sides.forEach(s => { s.iv = s.iv.map(() => oldGen() ? 15 : 31); s.ev = s.ev.map(() => oldGen() ? 65535 : 0); });
  if (S.gen < 6 && (S.weather === 'Harsh Sun' || S.weather === 'Heavy Rain')) S.weather = '';
  if (S.gen < 9 && S.weather === 'Snow') S.weather = '';
  if (S.gen < 2) S.weather = '';
  sanitize(); fillWeather(); save();
  $('foot').textContent = t('foot')(S.gen, G.species.length, G.moves.length);
}
function fillWeather() {
  const ws = ['']; if (S.gen >= 2) ws.push('Sun', 'Rain'); if (S.gen >= 3) ws.push('Sand', 'Hail'); if (S.gen >= 9) ws.push('Snow'); if (S.gen >= 6) ws.push('Harsh Sun', 'Heavy Rain');
  const sel = $('weather'); sel.replaceChildren(...ws.map(k => el('option', {value:k, text:t('w')[k]}))); sel.value = ws.includes(S.weather) ? S.weather : '';
  S.weather = sel.value;
  $('weather').disabled = S.gen < 2;
  const ts = ['']; if (S.gen >= 6) ts.push('Electric', 'Grassy', 'Misty', 'Psychic');
  const tsel = $('terrain'); tsel.replaceChildren(...ts.map(k => el('option', {value:k, text:t('ter')[k]}))); tsel.value = ts.includes(S.terrain) ? S.terrain : '';
  S.terrain = tsel.value; tsel.disabled = S.gen < 6;
}
function paintHeader() {
  document.documentElement.lang = lang; $('lang').value = lang;
  document.querySelector('h1').firstChild.textContent = lang === 'es' ? 'Calculadora de ' : 'Damage ';
  document.querySelector('h1 span').textContent = lang === 'es' ? 'daño' : 'Calculator';
  document.title = lang === 'es' ? 'Calculadora de daño' : 'Damage Calculator';
  $('lblWeather').textContent = t('weather'); $('lblTerrain').textContent = t('terrain'); $('swap').textContent = t('swap');
  $('rnd').title = S.random ? t('rndOn') : t('rndOff'); $('gensel').title = t('gensel');
  [...$('gensel').options].forEach(o => { o.textContent = 'Gen ' + o.value; });
}

(() => {
  const gs = $('gensel');
  for (let g = 1; g <= 9; g++) gs.append(el('option', {value:g, text:'Gen ' + g}));
  loadGen(S.gen); sanitize();
  buildSide(0); buildSide(1);
  const board = $('board'); board.append(sides[0].root, sides[1].root);
  // línea de velocidad entre ambos (debajo del campo)
  gs.onchange = () => { setGen(+gs.value); refreshAll(); paintHeader(); };
  $('weather').onchange = () => { S.weather = $('weather').value; save(); refresh(); };
  $('terrain').onchange = () => { S.terrain = $('terrain').value; save(); refresh(); };
  $('rnd').onclick = () => { S.random = !S.random; PMRandom.set(S.random); sanitize(); save(); refreshAll(); paintHeader(); };
  PMRandom.onChange(v => { S.random = v; sanitize(); save(); refreshAll(); paintHeader(); });
  $('swap').onclick = () => { S.sides.reverse(); save(); refreshAll(); };
  $('lang').onchange = e => { lang = e.target.value; try { localStorage.setItem(LANG, JSON.stringify(lang)); } catch (_) {} fillWeather(); $('foot').textContent = t('foot')(S.gen, G.species.length, G.moves.length); refreshAll(); paintHeader(); };
  setGen(S.gen); fillWeather(); refreshAll(); paintHeader();
})();
})();
