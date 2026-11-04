/* Puente entre la interfaz y el motor oficial de Smogon (@smogon/calc, MIT).
   Mantiene la interfaz y los datos propios; el cálculo lo hace el motor oficial de cada generación. */
const CalcBridge = (() => {
  'use strict';
  const C = (typeof window !== 'undefined' ? window : globalThis).calc;
  const toID = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
  const STATUS_OK = new Set(['slp', 'psn', 'brn', 'frz', 'par', 'tox']);
  const WEATHER = {Sun:'Sun', Rain:'Rain', Sand:'Sand', Hail:'Hail', Snow:'Snow', 'Harsh Sun':'Harsh Sunshine', 'Heavy Rain':'Heavy Rain', 'Strong Winds':'Strong Winds'};
  const SPECIAL_OLD = ['Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Psychic', 'Dark', 'Dragon'];
  const CAT = {P:'Physical', S:'Special', T:'Status'};

  /* ----- generaciones "tolerantes": aceptan Pokémon/movimientos de cualquier generación (modo Randomlocke) ----- */
  const cache = {};
  let extraSp = null, extraMv = null;          // datos propios del cálculo en curso para lo que el motor no conoce en esa generación
  const newest = (kind, id) => { for (let g = 9; g >= 1; g--) { const v = C.Generations.get(g)[kind].get(id); if (v) return v; } return undefined; };
  function genObj(n) {
    if (cache[n]) return cache[n];
    const base = C.Generations.get(n), g = Object.create(base);
    g.species = {get: id => base.species.get(id) || (extraSp && extraSp.id === id ? extraSp.data : undefined), [Symbol.iterator]: () => base.species[Symbol.iterator]()};
    g.moves = {get: id => base.moves.get(id) || (extraMv && extraMv.id === id ? extraMv.data : undefined), [Symbol.iterator]: () => base.moves[Symbol.iterator]()};
    const tc = {};
    g.types = {
      get: id => {
        const t = base.types.get(id); if (tc[id]) return tc[id];
        const eff = t ? t.effectiveness : {};
        const o = Object.assign({}, t || {kind:'Type', id, name:id.charAt(0).toUpperCase() + id.slice(1)}, {effectiveness: new Proxy(eff, {get: (o, k) => k in o ? o[k] : 1})});
        return (tc[id] = o);
      },
      [Symbol.iterator]: () => base.types[Symbol.iterator]()
    };
    return (cache[n] = g);
  }

  const baseId = n => toID(String(n).split('-')[0]);
  function prepSpecies(gen, sp) {
    extraSp = null;
    const id = toID(sp.n);
    if (genObj(gen).species.get(id)) return;
    const ref = newest('species', id) || newest('species', baseId(sp.n));
    const t = sp.t.filter(x => gen >= 6 || x !== 'Fairy');
    extraSp = {id, data: Object.assign({}, ref || {kind:'Species', id, name:sp.n, weightkg:10}, {
      name: sp.n, id, types: t.length ? t : ['Normal'], nfe: false,
      baseStats: {hp:sp.s[0], atk:sp.s[1], def:sp.s[2], spa:sp.s[3], spd:sp.s[4], spe:sp.s[5]},
      baseSpecies: undefined, otherFormes: undefined
    })};
  }
  function prepMove(gen, m) {
    extraMv = null;
    const id = toID(m.n);
    if (genObj(gen).moves.get(id)) return;
    const ref = newest('moves', id);
    extraMv = {id, data: Object.assign({kind:'Move', id, name:m.n, flags:{}, target:'normal'}, ref || {}, {basePower: m.bp, type: m.type, category: CAT[m.cat]})};
  }

  /* ----- construcción de objetos ----- */
  function makeMon(gen, M, extra) {
    prepSpecies(gen, M.sp);
    const G = genObj(gen), old = gen <= 2;
    const boosts = {atk:M.stages[0], def:M.stages[1], spa:M.stages[2], spd:M.stages[3], spe:M.stages[4]};
    if (gen === 1) { boosts.spc = boosts.spa; delete boosts.spa; delete boosts.spd; }
    const opt = {
      level: M.lvl, gender: M.gender || undefined, ability: gen >= 3 && M.ab ? M.ab : undefined, abilityOn: !!M.abOn,
      item: gen >= 2 && M.item ? M.item : undefined, nature: M.nat || undefined, boosts,
      status: STATUS_OK.has(M.status) ? M.status : '', teraType: gen >= 9 && M.tera ? M.tera : undefined,
      isDynamaxed: gen === 8 && M.dmax ? true : undefined,
      alliesFainted: M.alliesFainted || undefined, boostedStat: gen >= 9 ? (M.boostedStat || 'auto') : undefined
    };
    if (!old && M.iv) opt.ivs = {hp:M.iv[0], atk:M.iv[1], def:M.iv[2], spa:M.iv[3], spd:M.iv[4], spe:M.iv[5]};
    if (!old && M.ev) opt.evs = {hp:M.ev[0], atk:M.ev[1], def:M.ev[2], spa:M.ev[3], spd:M.ev[4], spe:M.ev[5]};
    const p = new C.Pokemon(G, M.sp.n, opt);
    // las estadísticas finales son las que muestra la interfaz (IV/EV/naturaleza/DV ya aplicados)
    const [h, a, d, sa, sd, sp] = M.stats;
    p.rawStats = p.stats = {hp:h, atk:a, def:d, spa:sa, spd:gen === 1 ? sa : sd, spe:sp};
    p.stats = Object.assign({}, p.rawStats);
    p.originalCurHP = Math.max(1, Math.min(h, Math.round(h * (M.hpPct == null ? 100 : M.hpPct) / 100)));
    if (M.evo) p.species = Object.assign({}, p.species, {nfe: true});
    return p;
  }
  function makeMove(gen, M, m, extra) {
    prepMove(gen, m);
    const hasBp = m.bp !== '' && m.bp != null && !isNaN(+m.bp);
    const o = {
      isCrit: !!m.crit, ability: gen >= 3 && M.ab ? M.ab : undefined, item: gen >= 2 && M.item ? M.item : undefined,
      useZ: gen === 7 && !!m.z, useMax: gen === 8 && !!M.dmax, isStellarFirstUse: m.stellar !== false,
      timesUsed: m.times || undefined
    };
    if (+m.hits > 1) o.hits = +m.hits;
    if (hasBp && m.bpUser) o.overrides = {basePower: +m.bp};
    const mv = new C.Move(genObj(gen), m.n, o);
    if (gen <= 3 && mv.category === 'Status') mv.category = 'Status';
    return mv;
  }
  const sideOf = (M, f) => {
    const s = {}, x = M.fx || {};
    s.isReflect = !!M.reflect; s.isLightScreen = !!M.lscreen;
    s.isAuroraVeil = !!x.veil; s.isTailwind = !!x.tailwind; s.isHelpingHand = !!x.helpingHand; s.isFriendGuard = !!x.friendGuard;
    s.isBattery = !!x.battery; s.isPowerSpot = !!x.powerSpot; s.isSteelySpirit = !!x.steelySpirit; s.isCharge = !!x.charge;
    s.isFlowerGift = !!x.flowerGift; s.isForesight = !!x.foresight; s.isSaltCured = !!x.saltCure; s.isProtected = !!x.protect;
    s.isSeeded = !!x.seeded; s.isSR = !!x.rocks; s.spikes = x.spikes ? +x.spikes : 0; s.isPowerTrick = !!x.powerTrick;
    if (x.switching) s.isSwitching = 'out';
    return s;
  };
  function makeField(A, D, f) {
    return new C.Field({
      gameType: f.doubles ? 'Doubles' : 'Singles',
      weather: WEATHER[f.weather] || undefined, terrain: f.terrain || undefined,
      isGravity: !!f.gravity, isMagicRoom: !!f.magicRoom, isWonderRoom: !!f.wonderRoom,
      isAuraBreak: !!f.auraBreak, isFairyAura: !!f.fairyAura, isDarkAura: !!f.darkAura,
      isBeadsOfRuin: !!f.beads, isSwordOfRuin: !!f.sword, isTabletsOfRuin: !!f.tablets, isVesselOfRuin: !!f.vessel,
      attackerSide: sideOf(A, f), defenderSide: sideOf(D, f)
    });
  }

  /* Devuelve {rolls, desc, hp, curHP, eff} · null si el movimiento no hace daño */
  function calc(gen, A, D, m, f) {
    const G = genObj(gen);
    const att = makeMon(gen, A), def = makeMon(gen, D);
    const mv = makeMove(gen, A, m);
    if (mv.category === 'Status') return null;
    const res = C.calculate(G, att, def, mv, makeField(A, D, f || {}));
    let dmg = res.damage, rolls;
    if (typeof dmg === 'number') rolls = [dmg];
    else if (Array.isArray(dmg[0])) { const n = dmg[0].length; rolls = Array.from({length:n}, (_, i) => dmg.reduce((s, h) => s + (h[i] != null ? h[i] : h[h.length - 1]), 0)); }
    else rolls = dmg.slice();
    if (mv.hits > 1 && !Array.isArray(res.damage[0])) rolls = rolls.map(v => v);   // el motor ya devuelve el golpe individual
    return {rolls, hits: mv.hits, move: mv, res, desc: safe(() => res.desc()), full: safe(() => res.fullDesc()), hp: def.maxHP(), curHP: def.curHP(), att, def};
  }
  const safe = fn => { try { return fn(); } catch (e) { return ''; } };
  return {calc, genObj};
})();
if (typeof module !== 'undefined') module.exports = CalcBridge;
