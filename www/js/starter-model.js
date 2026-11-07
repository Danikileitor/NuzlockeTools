/* Preparación de modelos GLB de Pokémon: pose, tamaño y animaciones. Usado por starter.js */
const PokeModel = (() => {
  const norm = n => (n || '').toLowerCase().replace(/^\d+[\s_]+/, '').replace(/^valvebiped\.bip01_/, '').replace(/^mixamorig:?/, '').replace(/_?\d+$/, '');
  const ARM = /^(l|r|left|right)[_ .]?(upper)?arm(_?0?1)?$/, HAND = /^(l|r|left|right)[_ .]?hand$/;

  // Serpientes y gusanos: sin animación llegan como un palo recto. Se curva la cadena de huesos más larga (cola/cuerpo) enroscándola
  function curlBones(root, amp, mode) {
    root.updateMatrixWorld(true);
    const bones = []; root.traverse(o => { if (o.isBone) bones.push(o); });
    const depth = b => { let d = 0; for (const c of b.children) if (c.isBone) d = Math.max(d, 1 + depth(c)); return d; };
    let top = null, td = -1;
    for (const b of bones) if (!b.parent || !b.parent.isBone) { const d = depth(b); if (d > td) { td = d; top = b; } }
    let path = []; let n = top;
    while (n) { path.push(n); let nx = null, nd = -1; for (const c of n.children) if (c.isBone) { const d = depth(c); if (d > nd) { nd = d; nx = c; } } n = nx; }
    // solo se curva la parte de la cola (desde el primer hueso "tail"); si no hay, el último 60 %
    let st = path.findIndex(b => /tail/i.test(b.name));
    if (st < 0) st = Math.floor(path.length * 0.4);
    path = path.slice(st);
    if (path.length < 4) return 0;
    const a = new THREE.Vector3(), b2 = new THREE.Vector3();
    path[0].getWorldPosition(a); path[path.length - 1].getWorldPosition(b2); b2.sub(a);
    const axis = Math.abs(b2.z) > Math.abs(b2.y) ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    const N = path.length, PQ = new THREE.Quaternion(), RW = new THREE.Quaternion();
    const f = t => mode === 'coil' ? Math.pow(t, 1.3) : Math.sin(1.2 * Math.PI * t);
    for (let i = 0; i < N; i++) {
      const d = amp * Math.PI / 180 * (f((i + 1) / N) - f(i / N));
      const b = path[i]; b.parent.updateMatrixWorld(true); b.parent.getWorldQuaternion(PQ);
      RW.setFromAxisAngle(axis, d);
      b.quaternion.premultiply(PQ.clone().invert().multiply(RW).multiply(PQ));
      b.updateMatrixWorld(true);
    }
    return N;
  }
  // Pose manual por grupos de huesos: [regex, grados totales repartidos]; giro en el eje X mundial (+ = cola arriba / cabeza abajo)
  function poseBones(root, groups) {
    root.updateMatrixWorld(true);
    const PQ = new THREE.Quaternion(), RW = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0);
    const bones = []; root.traverse(o => { if (o.isBone) bones.push(o); });
    groups.forEach(([re, deg]) => {
      if (re === 'root') return;
      const bs = bones.filter(b => re.test(b.name)), d = deg * Math.PI / 180 / Math.max(bs.length, 1);
      bs.forEach(b => {
        b.parent.updateMatrixWorld(true); b.parent.getWorldQuaternion(PQ);
        RW.setFromAxisAngle(X, d);
        b.quaternion.premultiply(PQ.clone().invert().multiply(RW).multiply(PQ));
        b.updateMatrixWorld(true);
      });
    });
    groups.forEach(([re, deg]) => { if (re === 'root') root.rotation.x = deg * Math.PI / 180; });   // giro del modelo entero: el arco empieza en la cola
  }
  // Hace rígida la mandíbula: cada vértice pasa a depender solo del hueso indicado (peso >umbral) o solo de su otro hueso, sin mezcla que la curve
  function snapBone(root, name, thr) {
    const GET = ['getX', 'getY', 'getZ', 'getW'], SET = ['setX', 'setY', 'setZ', 'setW'];
    root.traverse(m => {
      if (!m.isSkinnedMesh) return;
      const bi = m.skeleton.bones.findIndex(b => b.name === name); if (bi < 0) return;
      const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight; if (!si || !sw) return;
      for (let v = 0; v < si.count; v++) {
        const idx = GET.map(f => si[f](v)), w = GET.map(f => sw[f](v));
        let tot = 0; for (let j = 0; j < 4; j++) if (idx[j] === bi) tot += w[j];
        if (tot <= 0) continue;
        const keep = tot >= thr;
        for (let j = 0; j < 4; j++) w[j] = idx[j] === bi ? (keep ? 1 : 0) : (keep ? 0 : w[j]);
        if (!keep) { const t = w.reduce((x, y) => x + y, 0); if (t > 0) for (let j = 0; j < 4; j++) w[j] /= t; }
        for (let j = 0; j < 4; j++) sw[SET[j]](v, w[j]);
      }
      sw.needsUpdate = true;
    });
  }
  // Reorienta una cadena de huesos para que cada tramo siga un rumbo dado (grados en el plano YZ: 0 = hacia delante +Z, 90 = arriba).
  // cadena = [[nombre, rumbo del tramo hasta el siguiente hueso], ...]; el último hueso solo marca el final.
  function shapeBones(root, chains, extra) {
    root.updateMatrixWorld(true);
    if (extra && extra.snap) extra.snap.forEach(n => snapBone(root, n, 0.35));
    if (extra && extra.hide) root.traverse(o => { if (o.isBone && extra.hide.includes(o.name)) o.scale.setScalar(0.0001); });   // colapsa los huesos (y su malla) que sobran
    const byName = {}; root.traverse(o => { if (o.isBone) { byName[o.name] = o; byName[o.name.replace(/_\d+$/, '')] = byName[o.name.replace(/_\d+$/, '')] || o; } });   // acepta nombres con sufijo _NN
    if (extra && extra.stretch) { extra.stretch[0].forEach(n => byName[n] && byName[n].position.multiplyScalar(extra.stretch[1])); root.updateMatrixWorld(true); }
    const PQ = new THREE.Quaternion(), A = new THREE.Vector3(), B = new THREE.Vector3(), T = new THREE.Vector3(), Q = new THREE.Quaternion();
    chains.forEach(ch => {
      for (let i = 0; i < ch.length - 1; i++) {
        const b = byName[ch[i][0]], n = byName[ch[i + 1][0]]; if (!b || !n) continue;
        b.updateMatrixWorld(true); n.updateMatrixWorld(true);
        b.getWorldPosition(A); n.getWorldPosition(B); B.sub(A).normalize();
        const a = ch[i][1] * Math.PI / 180; T.set(0, Math.sin(a), Math.cos(a));
        Q.setFromUnitVectors(B, T);                       // giro mundial que lleva la dirección actual al rumbo pedido
        b.parent.updateMatrixWorld(true); b.parent.getWorldQuaternion(PQ);
        b.quaternion.premultiply(PQ.clone().invert().multiply(Q).multiply(PQ));
        b.updateMatrixWorld(true);
      }
    });
    // giros extra en eje Z mundial (brazos): [hueso, grados]
    if (extra && extra.xrot) extra.xrot.forEach(([n, deg, from, t, k]) => {   // giro en eje X mundial (+ = baja el extremo delantero): abre la boca; el pivote está a la fracción t entre `from` y el hueso (comisura)
      const b = byName[n]; if (!b) return;
      b.updateMatrixWorld(true); b.getWorldPosition(A);
      const P = new THREE.Vector3(); if (byName[from]) { byName[from].getWorldPosition(P); P.lerp(A, t); } else P.copy(A);
      if (k && k !== 1) {   // acorta la mandíbula manteniendo fija la comisura
        b.scale.multiplyScalar(k); A.sub(P).multiplyScalar(k).add(P);
        b.position.copy(b.parent.worldToLocal(A.clone())); b.updateMatrixWorld(true);
      }
      b.parent.updateMatrixWorld(true); b.parent.getWorldQuaternion(PQ);
      Q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), deg * Math.PI / 180);
      b.quaternion.premultiply(PQ.clone().invert().multiply(Q).multiply(PQ));
      const O2 = A.clone().sub(P).applyQuaternion(Q).add(P);
      b.position.copy(b.parent.worldToLocal(O2)); b.updateMatrixWorld(true);
    });
    if (extra && extra.zrot) extra.zrot.forEach(([n, deg]) => {
      const b = byName[n]; if (!b) return;
      b.parent.updateMatrixWorld(true); b.parent.getWorldQuaternion(PQ);
      Q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), deg * Math.PI / 180);
      b.quaternion.premultiply(PQ.clone().invert().multiply(Q).multiply(PQ)); b.updateMatrixWorld(true);
    });
  }
  // Modelos sin huesos (cuerpo rígido): se deforma la geometría curvando el cuerpo en el plano (eje largo A, perpendicular O)
  function bendGeo(root, A, O, bentSign, amp, mode, region) {
    root.updateMatrixWorld(true);
    const gc = (at, i, k) => k === 0 ? at.getX(i) : k === 1 ? at.getY(i) : at.getZ(i), sc = (at, i, k, v) => k === 0 ? at.setX(i, v) : k === 1 ? at.setY(i, v) : at.setZ(i, v);
    const meshes = []; root.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) meshes.push(o); });
    let lo = 1e9, hi = -1e9;
    meshes.forEach(m => { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const v = gc(p, i, A); if (v < lo) lo = v; if (v > hi) hi = v; } });
    const Ln = hi - lo; if (!(Ln > 0)) return;
    const ap = bentSign > 0 ? hi - region * Ln : lo + region * Ln, Lb = region * Ln;
    const f = t => mode === 'coil' ? Math.pow(t, 1.3) : Math.sin(1.2 * Math.PI * t);
    const NS = 240, CA = new Float32Array(NS + 1), CO = new Float32Array(NS + 1), TH = new Float32Array(NS + 1), ds = Lb / NS;
    for (let k = 1; k <= NS; k++) {
      const th = amp * Math.PI / 180 * f((k - 0.5) / NS);
      CA[k] = CA[k - 1] + bentSign * Math.cos(th) * ds; CO[k] = CO[k - 1] + bentSign * Math.sin(th) * ds; TH[k] = amp * Math.PI / 180 * f(k / NS);
    }
    meshes.forEach(m => {
      const g = m.geometry, p = g.attributes.position, nr = g.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        const a = gc(p, i, A), o = gc(p, i, O), s = bentSign * (a - ap);
        if (s <= 0) continue;
        const u = Math.min(s, Lb) / ds, k = Math.min(NS - 1, Math.floor(u)), fr = u - k;
        const ca = CA[k] + (CA[k + 1] - CA[k]) * fr, co = CO[k] + (CO[k + 1] - CO[k]) * fr, th = TH[k] + (TH[k + 1] - TH[k]) * fr;
        const c = Math.cos(th), sn = Math.sin(th), extra = Math.max(0, s - Lb);
        // normal N = (-sin, cos) en (A,O); lo que sobra de largo continúa en línea recta
        sc(p, i, A, ap + ca - o * sn + bentSign * extra * Math.cos(TH[NS]));
        sc(p, i, O, co + o * c + bentSign * extra * Math.sin(TH[NS]));
        if (nr) { const na = gc(nr, i, A), no = gc(nr, i, O); sc(nr, i, A, na * c - no * sn); sc(nr, i, O, na * sn + no * c); }
      }
      p.needsUpdate = true; if (nr) nr.needsUpdate = true; g.computeBoundingBox(); g.computeBoundingSphere();
    });
  }
  const GEO = {350:[1,0,-1,120,'coil',0.6], 603:[1,0,-1,110,'coil',0.6], 208:[2,1,1,70,'s',0.7]};
  // Gyarados en S: la cola sube al final, el cuerpo empieza a subir tras las aletas inferiores (Tail3), se inclina atrás
  // y tras las aletas superiores (Spine5/Neck) el cuello baja la cabeza. Rumbos en grados (0 = delante, 90 = arriba, 180 = atrás).
  const SHAPE_S = {336:[
    [['Hips',195],['Tail1',175],['Tail2',155],['Tail3',170],['Tail4',190],['Tail5',205],['Tail6',190],['Tail7',170],['Tail8',155],['Tail9',165],['Tail10',185],['Tail11',200],['Tail12',190],['Tail13',170],['Tail14',145],['Tail15',115],['Tail16',0]],
    [['Spine1',20],['Spine2',0],['Spine3',-10],['Spine4',0],['Spine5',15],['Spine6',35],['Spine7',55],['Spine8',70],['Spine9',80],['Spine10',85],['Spine11',90],['Spine12',90],['Spine13',90],['Spine14',88],['Neck',88],['Head',85],['EndHead',0]]
  ],
    497:[
    [['Waist',265],['Tail1',245],['Tail2',215],['Tail3',185],['Tail4',155],['Tail5',125],['Tail6',100],['Tail7',85],['Tail8',80],['Tail9',85],['Tail10',100],['Tail11',120],['Tail12',140],['Tail13',160],['Tail14',175],['Tail15',190],['Tail16',0]],
    [['Waist',100],['Spine1',105],['Spine2',100],['Spine3',95],['Spine4',85],['Neck',55],['Head',30],['Jaw1',0]],
    [['LFeelerC1',110],['LFeelerC2',130],['LFeelerC3',150],['LFeelerC4',170],['LFeelerC5',190],['LFeelerC6',205],['LFeelerC7',220],['LFeelerC8',235],['LFeelerC9',245],['LFeelerC10',0]],
    [['RFeelerC1',110],['RFeelerC2',130],['RFeelerC3',150],['RFeelerC4',170],['RFeelerC5',190],['RFeelerC6',205],['RFeelerC7',220],['RFeelerC8',235],['RFeelerC9',245],['RFeelerC10',0]]
  ]};
  const SHAPE_EXTRA = {384:{stretch:[['Spine2','Neck1','Neck2','Head','Jaw'],1.7], zrot:[['LArm',55],['RArm',-55]], xrot:[['Jaw',30,'Head',0.48,0.91]], snap:['Jaw']}, 497:{hide:['LFeelerC1','RFeelerC1','LFeelerA1','RFeelerA1']}};
  const SHAPE = {384:[
    [['Hips',270],['Tail1',235],['Tail2',200],['Tail3',165],['Tail4',130],['Tail5',100],['Tail6',85],['Tail7',85],['Tail8',100],['Tail9',130],['Tail10',165],['Tail11',200],['Tail12',225],['Tail13',245],['Tail14',255],['Tail15',0]],
    [['Spine1',90],['Spine2',95],['Neck1',95],['Neck2',70],['Head',10],['Jaw',-30]]
  ], 130:[
    [['Hips',250],['Tail1',235],['Tail2',215],['Tail3',200],['Tail4',190],['Tail5',182],['Tail6',175],['Tail7',165],['Tail8',155],['Tail9',0]],
    [['Spine1',80],['Spine2',95],['Spine3',105],['Spine4',100],['Spine5',80],['Neck',10],['Head',-15],['UpperBeak',0]]
  ]};
  const CURL = {10:[55],13:[55],23:[140,'coil'],24:[130,'coil'],147:[150,'coil'],148:[150,'coil'],843:[220,'coil']};
  const FAT = {10:1.5,13:1.5,23:2,24:2,147:2,148:2,336:2.3,384:1.6,130:1.5,350:1.8,497:1.6,603:1.7,843:2};   // ensancha el cuerpo (X/Z): los modelos son demasiado delgados
  // Los modelos sin animación llegan en T-pose: baja los brazos (rota el hueso del brazo hacia abajo)
  function lowerArms(root, pid) {
    if (WING.has(pid)) return [];   // sus "brazos" son alas: se dejan abiertas
    root.updateMatrixWorld(true);
    const bones = []; root.traverse(o => { if (o.isBone) bones.push(o); });
    const P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), D = new THREE.Vector3(), T = new THREE.Vector3(), Q = new THREE.Quaternion(), WQ = new THREE.Quaternion(), PQ = new THREE.Quaternion();
    const report = [];
    for (const arm of bones) {
      const side = (ARM.exec(norm(arm.name)) || [])[1]; if (!side) continue;
      let hand = null, fore = null;
      for (let q = arm.parent; q && !hand; q = q.parent) if (q.isBone && ARM.test(norm(q.name))) hand = 0;   // ya cubierto por su hueso padre
      if (hand === 0) continue;
      arm.traverse(o => { if (o === arm || !o.isBone) return; const n = norm(o.name); if (!hand && HAND.test(n)) hand = o; if (!fore && /forearm$/.test(n)) fore = o; });
      hand = hand || fore;
      if (!hand) continue;
      arm.getWorldPosition(P0); hand.getWorldPosition(P1); D.subVectors(P1, P0);
      const len = D.length(); if (len < 1e-6) continue;
      D.divideScalar(len);
      report.push(+D.y.toFixed(2));
      if (D.y < -0.55) continue;                                   // ya cae hacia abajo
      const sx = D.x < 0 ? -1 : 1;
      T.set(sx * 0.3, -1, 0.45).normalize();                       // abajo, un poco hacia fuera y hacia delante (+Z)
      Q.setFromUnitVectors(D, T);
      arm.getWorldQuaternion(WQ); WQ.premultiply(Q);
      arm.parent.getWorldQuaternion(PQ);
      arm.quaternion.copy(PQ.invert().multiply(WQ));
      arm.updateMatrixWorld(true);
      if (fore && hand && hand !== fore && !NOBEND.has(pid)) {     // antebrazo flexionado hacia delante, como en los sprites
        fore.getWorldPosition(P0); hand.getWorldPosition(P1); D.subVectors(P1, P0); const l2 = D.length();
        if (l2 > 1e-6) {
          D.divideScalar(l2); T.set(sx * 0.12, 0.3, 1).normalize(); Q.setFromUnitVectors(D, T);
          fore.getWorldQuaternion(WQ); WQ.premultiply(Q); fore.parent.getWorldQuaternion(PQ);
          fore.quaternion.copy(PQ.invert().multiply(WQ)); fore.updateMatrixWorld(true);
        }
      }
    }
    return report;
  }

  const HIDE = {914:/gel_mesh/, 288:/^Sphere$/, 1000:/^Object_(253|255|257|259|261)$/};   // 1000: monedas sueltas de Gholdengo   // mallas que en la pose base salen estiradas decenas de veces
  // Modelos rígidos (sin esqueleto) exportados en T-pose: baja los brazos deformando la malla alrededor del hombro
  const WING = new Set([16,17,18,21,22,49,142,144,163,164,291,334,380,381,384,566,567,661,662,663,714,715,731,732,733,821,822,823]);   // las alas no se bajan
  const NOBEND = new Set([]);   // sin flexionar el antebrazo
  const TPOSE = new Set([740,97,106,125,126,185,186,190,239,272,288,294,308,354,360,390,391,453,504,505,511,512,513,514,515,516,532,533,534,538,539,552,559,562,592,611,612,614,624,629,765]);
  // Gholdengo (1000): en la serie 0xxxx su cuerpo flota separado de la tabla; en la 1xxxx va sobre ella
  const CLIP_OVERRIDE = {1000:{idle:/_10000_defaultwait01_loop/, hover:/_10400_attack01/, win:/_10300_roar01/}};
  const LAT_X = new Set([612,190,505,552,611,504,513,515,532,559]);       // modelos con cola/cuello largos hacia delante: el eje de los brazos es siempre X
  const FWD = new Set([740]);   // Crabominable: brazos hacia delante, como su sprite
  function dropArms(scene, deg, pid) {
    scene.updateMatrixWorld(true);
    const meshes = []; scene.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && o.visible) meshes.push(o); });
    if (!meshes.length) return false;
    const v = new THREE.Vector3(), mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    const each = fn => { for (const m of meshes) { const pos = m.geometry.attributes.position; for (let k = 0; k < pos.count; k++) { v.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld); fn(v); } } };
    each(p => { for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p.getComponent(i)); mx[i] = Math.max(mx[i], p.getComponent(i)); } });
    const LA = !LAT_X.has(pid) && (mx[2] - mn[2]) > (mx[0] - mn[0]) ? 2 : 0;            // eje lateral = el de los brazos (suele ser X)
    const cx = (mn[LA] + mx[LA]) / 2, S = (mx[LA] - mn[LA]) / 2, H = mx[1] - mn[1];
    let sy = 0, sn = 0;
    each(p => { if (Math.abs(p.getComponent(LA) - cx) > 0.8 * S) { sy += p.y; sn++; } });   // altura de las manos
    if (!sn) return false;
    const FW = FWD.has(pid), DA = LA === 0 ? 2 : 0;   // FW: los brazos giran hacia delante (+Z) en vez de hacia abajo
    let sd = 0; if (FW) each(p => { if (Math.abs(p.getComponent(LA) - cx) > 0.8 * S) sd += p.getComponent(DA); }); sd = FW ? sd / sn : 0;
    const ys = sy / sn, xs = 0.3 * S, th = (deg || (FW ? 85 : 70)) * Math.PI / 180, band = 0.2 * H;
    const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const inv = new THREE.Matrix4(), nm = new THREE.Matrix3(), n = new THREE.Vector3();
    for (const m of meshes) {
      m.geometry = m.geometry.clone();                              // las geometrías pueden compartirse
      const pos = m.geometry.attributes.position, nor = m.geometry.attributes.normal;
      inv.copy(m.matrixWorld).invert(); nm.getNormalMatrix(m.matrixWorld);
      const nInv = new THREE.Matrix3().getNormalMatrix(inv);
      for (let k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld);
        const dx = v.getComponent(LA) - cx, side = dx < 0 ? -1 : 1, ax = Math.abs(dx), dy = v.y - ys;
        const w = sm(xs, xs + 0.15 * S, ax) * (1 - sm(band, band * 1.7, Math.abs(dy)));
        if (w <= 0) continue;
        const a = th * w, c = Math.cos(a), s2 = Math.sin(a), px = ax - xs;
        if (FW) { const dz = v.getComponent(DA) - sd; v.setComponent(LA, cx + side * (xs + px * c - dz * s2)); v.setComponent(DA, sd + px * s2 + dz * c); }
        else { v.setComponent(LA, cx + side * (xs + px * c + dy * s2)); v.y = ys - px * s2 + dy * c; }   // gira hacia abajo respecto al hombro
        v.applyMatrix4(inv); pos.setXYZ(k, v.x, v.y, v.z);
        if (nor) {
          n.fromBufferAttribute(nor, k).applyMatrix3(nm);
          const nl = n.getComponent(LA) * side;
          if (FW) { const nd = n.getComponent(DA); n.setComponent(LA, (nl * c - nd * s2) * side); n.setComponent(DA, nl * s2 + nd * c); }
          else { n.setComponent(LA, (nl * c + n.y * s2) * side); n.y = -nl * s2 + n.y * c; }
          n.applyMatrix3(nInv).normalize(); nor.setXYZ(k, n.x, n.y, n.z);
        }
      }
      pos.needsUpdate = true; if (nor) nor.needsUpdate = true;
      m.geometry.computeBoundingBox(); m.geometry.computeBoundingSphere();
    }
    return true;
  }

  // vértices (ya deformados por el esqueleto) en el espacio de wrap
  function points(wrap) {
    wrap.updateMatrixWorld(true);
    const out = [], v = new THREE.Vector3();
    wrap.traverse(o => {
      if (!o.isMesh || !o.visible) return;
      const pos = o.geometry.attributes.position, sk = o.isSkinnedMesh && (o.applyBoneTransform || o.boneTransform);
      if (o.isSkinnedMesh) o.skeleton.update();
      for (let k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k); if (sk) sk.call(o, k, v);
        v.applyMatrix4(o.matrixWorld); out.push(v.x, v.y, v.z);
      }
    });
    return out;
  }
  // caja completa y caja "robusta" (sin el 0,5 % de vértices más extremos: puntas sueltas, huesos auxiliares...)
  function measure(wrap) {
    const p = points(wrap), n = p.length / 3, full = new THREE.Box3(), rob = new THREE.Box3();
    if (!n) return {full, rob};
    const lo = [], hi = [];
    for (let ax = 0; ax < 3; ax++) {
      const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = p[i * 3 + ax];
      a.sort(); lo.push(a[Math.floor(n * 0.005)]); hi.push(a[Math.min(n - 1, Math.ceil(n * 0.995))]);
      full.min.setComponent(ax, a[0]); full.max.setComponent(ax, a[n - 1]);
    }
    rob.min.fromArray(lo); rob.max.fromArray(hi);
    return {full, rob};
  }

  // devuelve {obj, mixer, acts, info}; el modelo queda centrado y con ~2.6 de alto máx.
  function prep(g, pid) {
    const wrap = new THREE.Group(); wrap.add(g.scene);
    // oculta mallas auxiliares: versiones LOD superpuestas y mallas totalmente transparentes
    let hasMain = false;
    g.scene.traverse(o => { if (o.isMesh && !/lod[1-9]/i.test(o.name) && !(HIDE[pid] && HIDE[pid].test(o.name))) hasMain = true; });
    g.scene.traverse(o => {
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      // metalness 1 sin mapa de entorno deja el modelo casi negro
      ms.forEach(m => { if (m && m.metalness > 0.3) m.metalness = 0.1; });
      if ((hasMain && /lod[1-9]/i.test(o.name)) || (HIDE[pid] && HIDE[pid].test(o.name)) || ms.every(m => m.transparent && m.opacity === 0)) o.visible = false;
    });
    const clips = (g.animations || []).filter(c => !/eye|mouth|blink/i.test(c.name));
    let mixer = null, acts = null, arms = [];
    if (clips.length) {
      mixer = new THREE.AnimationMixer(g.scene);
      const find = re => clips.find(c => re.test(c.name)), act = c => c && mixer.clipAction(c);
      const ov = CLIP_OVERRIDE[pid];     // modelos con varias series de animaciones: elegir la que mantiene las piezas unidas
      if (ov) {
        acts = {idle:act(find(ov.idle)) || null, hover:act(find(ov.hover || ov.idle)), win:act(find(ov.win || ov.hover || ov.idle))};
        if (acts.idle) { acts.idle.play(); mixer.update(0); } else acts = null;
      }
      if (!acts) {
      const idle = find(/defaultwait01_loop|aidle|wait.*loop|idle|idol|stand|wait|base layer|armatureaction|^animation$|take 001/i) || clips[0];
      acts = {idle:act(idle), hover:act(find(/glad|happy|jump_s|fight_b|attack01|attack/i)), win:act(find(/glad|happy|jump_e|roar|attack01|attack|fight_d/i))};
      acts.idle.play(); mixer.update(0);
      }
    } else { arms = lowerArms(g.scene, pid); if (!arms.length && TPOSE.has(pid)) arms = [dropArms(g.scene, undefined, pid) ? 'malla' : 'no']; }
    if (!clips.length && GEO[pid]) bendGeo(g.scene, ...GEO[pid]);
    if (!clips.length && CURL[pid]) curlBones(g.scene, CURL[pid][0], CURL[pid][1]);
    if (SHAPE_S[pid]) SHAPE[pid] = SHAPE_S[pid];
    if (!clips.length && SHAPE[pid]) shapeBones(g.scene, SHAPE[pid], SHAPE_EXTRA[pid]);
    if (!clips.length && FAT[pid]) g.scene.scale.set(FAT[pid], 1, FAT[pid]);
    let m = measure(wrap), size = m.rob.getSize(new THREE.Vector3()), fs = m.full.getSize(new THREE.Vector3());
    const raw = fs.toArray().map(x => +x.toFixed(3));
    let k = 2.6 / Math.max(size.y, 0.75 * Math.max(size.x, size.z), 0.001);
    k = Math.min(k, 4.6 / Math.max(fs.x, fs.y, fs.z, 0.001));      // sin que ninguna parte se salga de la escena
    g.scene.scale.multiplyScalar(k);
    const box = measure(wrap).full;
    g.scene.position.sub(box.getCenter(new THREE.Vector3()));
    const dims = box.getSize(new THREE.Vector3());
    wrap.userData.half = dims.y / 2;   // para apoyarlo justo sobre la Poké Ball
    if (pid === 802) wrap.traverse(o => { if (o.isMesh && o.name === 'Object_39') o.visible = false; });   // mancha negra plana (ya medida)
    // la esfera de recorte de un modelo con esqueleto usa la pose base (muy distinta): sin esto partes como los ojos desaparecen
    wrap.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    return {obj:wrap, mixer, acts, info:{clips:clips.length, arms, raw, dims:dims.toArray().map(x => +x.toFixed(2))}};
  }
  const MODEL_BASE = 'https://raw.githubusercontent.com/Pokemon-3D-api/assets/main/models/opt/regular/';
  const NO_3D = new Set([850,851,852,853,854,859,860,861,863,864,866,868,873,878,879,882,883,918,919,931,935,936,938,939,940,944,950,951,952,953,954,955,956,961,963,964,968,969,970,971,972,976,977,986,988,989,991,992,993,1011,1012,1013,1022,1024]);
  const GENDER = new Set([521, 668, 916]);   // solo existen como -M / -F
  const MODEL_ROOT = MODEL_BASE.replace('regular/', '');
  // Zygarde: el modelo "regular" es solo una Célula; las formas reales están en multiform / mega
  const zygarde = name => /mega/i.test(name || '') ? 'mega/718' : /10/.test(name || '') ? 'multiform/718_1' : /complete/i.test(name || '') ? 'multiform/718_3' : 'multiform/718_2';
  const FORM_MODEL = {10118: 'multiform/718_1', 10120: 'multiform/718_3'};   // Zygarde 10% / Completo (ids de formas de PokeAPI)
  const modelUrl = (p, name) => FORM_MODEL[p] ? MODEL_ROOT + FORM_MODEL[p] + '.glb' : (p >= 10000 || NO_3D.has(p)) ? null : p === 718 ? MODEL_ROOT + zygarde(name) + '.glb' : MODEL_BASE + p + (GENDER.has(p) ? '-M' : '') + '.glb';
  return {prep, measure, TPOSE, modelUrl};
})();
