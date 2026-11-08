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
  // Engorda el cuerpo hinchando los vértices a lo largo de su normal; d en unidades de la malla, con fade hacia la cabeza (y > y0..y1)
  function inflate(root, d, y0, y1) {
    root.traverse(m => {
      if (!m.isSkinnedMesh) return;
      const pos = m.geometry.attributes.position, nor = m.geometry.attributes.normal;
      if (!nor || pos.count < 1000) return;
      for (let v = 0; v < pos.count; v++) {
        const y = pos.getY(v), t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0))), k = d * (1 - t * t * (3 - 2 * t));
        pos.setXYZ(v, pos.getX(v) + nor.getX(v) * k, pos.getY(v) + nor.getY(v) * k, pos.getZ(v) + nor.getZ(v) * k);
      }
      pos.needsUpdate = true;
    });
  }
  // Suaviza el skinning a lo largo de una cadena de huesos: cada vértice reparte su peso con los huesos vecinos (1/4, 1/2, 1/4), así las curvas salen redondas sin picos
  function smoothSkin(root, order, passes) {
    const GET = ['getX', 'getY', 'getZ', 'getW'], SET = ['setX', 'setY', 'setZ', 'setW'];
    root.traverse(m => {
      if (!m.isSkinnedMesh) return;
      const bones = m.skeleton.bones, idxOf = {};
      order.forEach((n, k) => { const bi = bones.findIndex(b => b.name === n || b.name.replace(/_\d+$/, '') === n); if (bi >= 0) idxOf[bi] = k; });
      const chain = order.map(n => bones.findIndex(b => b.name === n || b.name.replace(/_\d+$/, '') === n));
      const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight; if (!si || !sw) return;
      for (let v = 0; v < si.count; v++) {
        let inf = new Map();
        for (let j = 0; j < 4; j++) { const w = sw[GET[j]](v); if (w > 0) inf.set(si[GET[j]](v), w); }
        for (let ps = 0; ps < passes; ps++) {
          const nx = new Map();
          inf.forEach((w, bi) => {
            const k = idxOf[bi];
            if (k === undefined) { nx.set(bi, (nx.get(bi) || 0) + w); return; }
            const a = chain[k - 1], c = chain[k + 1];
            const sp = (b, f) => { if (b !== undefined && b >= 0) nx.set(b, (nx.get(b) || 0) + w * f); else nx.set(bi, (nx.get(bi) || 0) + w * f); };
            sp(a, 0.25); nx.set(bi, (nx.get(bi) || 0) + w * 0.5); sp(c, 0.25);
          });
          inf = nx;
        }
        const top = [...inf.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4), tot = top.reduce((x, y) => x + y[1], 0) || 1;
        for (let j = 0; j < 4; j++) { const e = top[j]; si[SET[j]](v, e ? e[0] : 0); sw[SET[j]](v, e ? e[1] / tot : 0); }
      }
      si.needsUpdate = true; sw.needsUpdate = true;
    });
  }
  // Reorienta una cadena de huesos para que cada tramo siga un rumbo dado (grados en el plano YZ: 0 = hacia delante +Z, 90 = arriba).
  // cadena = [[nombre, rumbo del tramo hasta el siguiente hueso], ...]; el último hueso solo marca el final.
  function shapeBones(root, chains, extra) {
    root.updateMatrixWorld(true);
    if (extra && extra.smooth) smoothSkin(root, extra.smooth[0], extra.smooth[1]);
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
  const SHAPE_S = {
    671:[[['LFeelerE01',110],['LFeelerE02',140],['LFeelerE03',170],['LFeelerE04',200],['LFeelerE05',225],['LFeelerE06',245],['LFeelerE07',258],['LFeelerE08',265],['LFeelerE09',268],['LFeelerE10',270],['LFeelerE11',270],['LFeelerE12',0]],
      [['RFeelerE01',110],['RFeelerE02',140],['RFeelerE03',170],['RFeelerE04',200],['RFeelerE05',225],['RFeelerE06',245],['RFeelerE07',258],['RFeelerE08',265],['RFeelerE09',268],['RFeelerE10',270],['RFeelerE11',270],['RFeelerE12',0]]],
    495:[[['LFeelerC01',95],['LFeelerC02',115],['LFeelerC03',140],['LFeelerC04',165],['LFeelerC05',190],['LFeelerC06',215],['LFeelerC07',235],['LFeelerC08',250],['LFeelerC09',260],['LFeelerC10',0]],
      [['RFeelerC01',95],['RFeelerC02',115],['RFeelerC03',140],['RFeelerC04',165],['RFeelerC05',190],['RFeelerC06',215],['RFeelerC07',235],['RFeelerC08',250],['RFeelerC09',260],['RFeelerC10',0]]],
    496:[[['LFeelerB1',95],['LFeelerB2',115],['LFeelerB3',140],['LFeelerB4',165],['LFeelerB5',190],['LFeelerB6',215],['LFeelerB7',235],['LFeelerB8',250],['LFeelerB9',260],['LFeelerB10',0]],
      [['RFeelerB1',95],['RFeelerB2',115],['RFeelerB3',140],['RFeelerB4',165],['RFeelerB5',190],['RFeelerB6',215],['RFeelerB7',235],['RFeelerB8',250],['RFeelerB9',260],['RFeelerB10',0]]],
    336:[
    [['Hips',225],['Tail1',180],['Tail2',180],['Tail3',180],['Tail4',124],['Tail5',92],['Tail6',124],['Tail7',202],['Tail8',280],['Tail9',312],['Tail10',280],['Tail11',202],['Tail12',180],['Tail13',161],['Tail14',124],['Tail15',105],['Tail16',105],['EndTail16',0]],
    [['Spine1',64],['Spine2',45],['Spine3',0],['Spine4',-60],['Spine5',-85],['Spine6',-60],['Spine7',0],['Spine8',0],['Spine9',0],['Spine10',50],['Spine11',73],['Spine12',74],['Spine13',81],['Spine14',90],['Neck',90],['Head',85],['EndHead',0]],
    [['Tongue1',6],['Tongue2',6],['Tongue3',-40],['Tongue4',-85],['Tongue5',-95]]
  ],
    497:[
    [['Waist',265],['Tail1',245],['Tail2',215],['Tail3',185],['Tail4',155],['Tail5',125],['Tail6',100],['Tail7',85],['Tail8',80],['Tail9',85],['Tail10',100],['Tail11',120],['Tail12',140],['Tail13',160],['Tail14',175],['Tail15',190],['Tail16',0]],
    [['Waist',100],['Spine1',105],['Spine2',100],['Spine3',95],['Spine4',85],['Neck',55],['Head',30],['Jaw1',0]],
    [['LFeelerC1',110],['LFeelerC2',130],['LFeelerC3',150],['LFeelerC4',170],['LFeelerC5',190],['LFeelerC6',205],['LFeelerC7',220],['LFeelerC8',235],['LFeelerC9',245],['LFeelerC10',0]],
    [['RFeelerC1',110],['RFeelerC2',130],['RFeelerC3',150],['RFeelerC4',170],['RFeelerC5',190],['RFeelerC6',205],['RFeelerC7',220],['RFeelerC8',235],['RFeelerC9',245],['RFeelerC10',0]]
  ]};
  const SHAPE_EXTRA = {38:{xrot:[['014_LTailA1',35],['015_LTailA2',18],['016_LTailA3',12],['017_LTailA4',10],['018_LTailA5',8],['019_LTailA6',8],['020_LTailA7',8],['022_LTailB1',35],['023_LTailB2',18],['024_LTailB3',12],['025_LTailB4',10],['026_LTailB5',8],['027_LTailB6',8],['028_LTailB7',8],['030_LTailC1',35],['031_LTailC2',18],['032_LTailC3',12],['033_LTailC4',10],['034_LTailC5',8],['035_LTailC6',8],['037_LTailD1',35],['038_LTailD2',18],['039_LTailD3',12],['040_LTailD4',10],['041_LTailD5',8],['051_RTailA1',35],['052_RTailA2',18],['053_RTailA3',12],['054_RTailA4',10],['055_RTailA5',8],['056_RTailA6',8],['057_RTailA7',8],['059_RTailB1',35],['060_RTailB2',18],['061_RTailB3',12],['062_RTailB4',10],['063_RTailB5',8],['064_RTailB6',8],['065_RTailB7',8],['067_RTailC1',35],['068_RTailC2',18],['069_RTailC3',12],['070_RTailC4',10],['071_RTailC5',8],['072_RTailC6',8],['074_RTailD1',35],['075_RTailD2',18],['076_RTailD3',12],['077_RTailD4',10],['078_RTailD5',8],['080_TailA1',35],['081_TailA2',18],['082_TailA3',12],['083_TailA4',10],['084_TailA5',8],['085_TailA6',8],['086_TailA7',8],['087_TailA8',8]]}, 671:{stretch:[['LFeelerE02','LFeelerE03','LFeelerE04','LFeelerE05','LFeelerE06','LFeelerE07','LFeelerE08','LFeelerE09','LFeelerE10','LFeelerE11','LFeelerE12','RFeelerE02','RFeelerE03','RFeelerE04','RFeelerE05','RFeelerE06','RFeelerE07','RFeelerE08','RFeelerE09','RFeelerE10','RFeelerE11','RFeelerE12'],0.45]}, 495:{stretch:[['LFeelerC02','LFeelerC03','LFeelerC04','LFeelerC05','LFeelerC06','LFeelerC07','LFeelerC08','LFeelerC09','LFeelerC10','RFeelerC02','RFeelerC03','RFeelerC04','RFeelerC05','RFeelerC06','RFeelerC07','RFeelerC08','RFeelerC09','RFeelerC10'],0.4]}, 496:{stretch:[['LFeelerB2','LFeelerB3','LFeelerB4','LFeelerB5','LFeelerB6','LFeelerB7','LFeelerB8','LFeelerB9','LFeelerB10','RFeelerB2','RFeelerB3','RFeelerB4','RFeelerB5','RFeelerB6','RFeelerB7','RFeelerB8','RFeelerB9','RFeelerB10'],0.55]}, 123:{xrot:[['LArm',-65],['RArm',-65]]}, 428:{zrot:[['LEar2',-30],['LEar3',-25],['LEar4',-20],['LEar5',-15],['REar2',30],['REar3',25],['REar4',20],['REar5',15]]}, 336:{smooth:[['Tail16','Tail15','Tail14','Tail13','Tail12','Tail11','Tail10','Tail9','Tail8','Tail7','Tail6','Tail5','Tail4','Tail3','Tail2','Tail1','Hips','Spine1','Spine2','Spine3','Spine4','Spine5','Spine6','Spine7','Spine8','Spine9','Spine10','Spine11','Spine12','Spine13','Spine14','Neck','Head'],3]},
    384:{stretch:[['Spine2','Neck1','Neck2','Head','Jaw'],1.7], zrot:[['LArm',55],['RArm',-55]], xrot:[['Jaw',30,'Head',0.48,0.91]], snap:['Jaw']}, 497:{hide:['LFeelerC1','RFeelerC1','LFeelerA1','RFeelerA1']}};
  const SHAPE = {38:[], 123:[], 428:[], 384:[
    [['Hips',270],['Tail1',235],['Tail2',200],['Tail3',165],['Tail4',130],['Tail5',100],['Tail6',85],['Tail7',85],['Tail8',100],['Tail9',130],['Tail10',165],['Tail11',200],['Tail12',225],['Tail13',245],['Tail14',255],['Tail15',0]],
    [['Spine1',90],['Spine2',95],['Neck1',95],['Neck2',70],['Head',10],['Jaw',-30]]
  ], 130:[
    [['Hips',250],['Tail1',235],['Tail2',215],['Tail3',200],['Tail4',190],['Tail5',182],['Tail6',175],['Tail7',165],['Tail8',155],['Tail9',0]],
    [['Spine1',80],['Spine2',95],['Spine3',105],['Spine4',100],['Spine5',80],['Neck',10],['Head',-15],['UpperBeak',0]]
  ]};
  const CURL = {10:[55],13:[55],23:[140,'coil'],24:[130,'coil'],147:[150,'coil'],148:[150,'coil'],843:[220,'coil']};
  // Mallas con una parte desmesuradamente larga (p. ej. la espiral de Burmy): comprime las coordenadas locales de eje y por debajo de t con el factor k
  const SQUASH = {412: {t: -1.9, k: 0.11, r: 0.3}};
  function squash(root, c) {
    root.traverse(o => {
      if (!o.isMesh || o.geometry.attributes.position.count < 1000) return;
      const pa = o.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); if (y < c.t) { const f = 1 + (c.r - 1) * Math.min(1, (c.t - y) / 0.8); pa.setY(i, c.t + (y - c.t) * c.k); pa.setX(i, pa.getX(i) * f); pa.setZ(i, pa.getZ(i) * f); } }
      pa.needsUpdate = true; o.geometry.computeBoundingSphere(); o.geometry.computeBoundingBox();
    });
  }
  // Modelos sin esqueleto con los brazos en T dentro de la malla: se doblan hacia abajo moviendo los vértices (lat = eje lateral local, up = eje vertical local,
  // x0 = donde empieza el brazo, p = altura del hombro, th = grados, len = longitud de la curva, sc = escala de la longitud del brazo, dn = sentido local de "abajo")
  const DROOP = {465: {lat: 'X', up: 'Z', x0: 1.0, p: -0.98, th: 58, len: 1.0, sc: 0.42, dn: 1}, 563: {lat: 'Z', up: 'Y', x0: 6, p: -7.9, th: 80, len: 14, sc: 0.3, dn: 1},
    124: {lat: 'X', up: 'Y', x0: 55, p: 70, th: 55, len: 35, sc: 0.55, dn: 1, band: 25}};
  function droop(root, c) {
    root.traverse(o => {
      if (!o.isMesh || o.geometry.attributes.position.count < 1000) return;
      const pa = o.geometry.attributes.position, gl = 'get' + c.lat, gu = 'get' + c.up, sl = 'set' + c.lat, su = 'set' + c.up;
      for (let i = 0; i < pa.count; i++) {
        const lx = pa[gl](i), u = pa[gu](i), l = Math.abs(lx); if (l <= c.x0) continue;
        if (c.band && Math.abs(u - c.p) > c.band) continue;
        const sg = Math.sign(lx), d = (l - c.x0) * c.sc, t = Math.min(1, (l - c.x0) / c.len), th = c.th * Math.PI / 180 * t * t * (3 - 2 * t), du = u - c.p;
        pa[sl](i, sg * (c.x0 + d * Math.cos(th) - c.dn * du * Math.sin(th)));
        pa[su](i, c.p + c.dn * d * Math.sin(th) + du * Math.cos(th));
      }
      pa.needsUpdate = true; o.geometry.computeBoundingSphere(); o.geometry.computeBoundingBox();
    });
  }
  // Texturas de llama en escala de grises que en el juego se tiñen: se les da color y brillo propio (name del material -> [color, emisivo, intensidad])
  const TINT = {78: {FireCoreA: [0xffc24a, 0xff9a2a, 1.2], FireStenA: [0xff7a28, 0xff5a14, 1, true]}};
  function tintMats(root, map) {
    const seen = new Set();
    root.traverse(o => {
      if (!o.isMesh) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
        const t = map[m.name]; if (!t || seen.has(m.uuid)) return; seen.add(m.uuid);
        m.color.setHex(t[0]); m.emissive.setHex(t[1]); if (!t[3]) m.emissiveMap = m.map; else m.map = null; m.emissiveIntensity = t[2]; m.metalness = 0; m.needsUpdate = true;
      });
    });
  }
  // Materiales con transparencia activada pero sin nada transparente (se ve el interior a través de la malla): se pasan a opacos
  const TONGUE_DZ = -0.12, TONGUE_DY = -0.02, TONGUE_RDZ = -0.095, TONGUE_RDY = 0.02;   // avance (en unidades del modelo, antes de escalar) de la raíz de la lengua de Seviper
  const OPAQUE = {83: ['Body']};
  function makeOpaque(root, names) {
    root.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { 
      if (names.includes(m.name)) { m.transparent = false; m.depthWrite = true; m.needsUpdate = true; } }); });
  }
  const ROTY = {539: -Math.PI / 2};
  const FAT = {10:1.5,13:1.5,23:2,24:2,147:2,148:2,336:1,384:1.6,130:1.5,350:1.8,497:1.6,603:1.7,843:2};   // ensancha el cuerpo (X/Z): los modelos son demasiado delgados
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

  const HIDE = {83:/^Object_7$/, 914:/gel_mesh/, 288:/^Sphere$/, 1000:/^Object_(253|255|257|259|261)$/};   // 1000: monedas sueltas de Gholdengo   // mallas que en la pose base salen estiradas decenas de veces
  // Modelos rígidos (sin esqueleto) exportados en T-pose: baja los brazos deformando la malla alrededor del hombro
  const WING = new Set([120,16,17,18,21,22,49,142,144,163,164,291,334,380,381,384,566,567,661,662,663,714,715,731,732,733,821,822,823]);   // las alas no se bajan
  const NOBEND = new Set([]);   // sin flexionar el antebrazo
  const TPOSE = new Set([740,96,97,106,125,126,185,186,190,239,272,288,294,308,354,360,390,391,453,504,505,511,512,513,514,515,516,532,533,534,538,539,552,559,562,592,611,612,614,624,629,765]);
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
    if (pid === 336 && !g.scene.userData.inflated) { inflate(g.scene, 5, 60, 105); g.scene.userData.inflated = true; }
    if (SHAPE_S[pid]) SHAPE[pid] = SHAPE_S[pid];
    if (!clips.length && SHAPE[pid]) shapeBones(g.scene, SHAPE[pid], SHAPE_EXTRA[pid]);
    if (pid === 336 && !clips.length) {   // lengua: se adelanta el arranque para que cruce el labio desde dentro de la boca
      let t1 = null; g.scene.traverse(o => { if (o.isBone && /^Tongue1(_\d+)?$/.test(o.name)) t1 = o; });
      g.scene.updateMatrixWorld(true);
      g.scene.traverse(m => {   // los hilos rojos (Object_10) pertenecen a la cabeza: se retrasan el mismo avance
        if (m.isSkinnedMesh && m.name === 'Object_10' && !m.userData.tongueMoved) {
          m.userData.tongueMoved = true;
          const d = new THREE.Vector3(0, TONGUE_RDY, TONGUE_RDZ).transformDirection(new THREE.Matrix4().copy(m.matrixWorld).invert()).multiplyScalar(0);
          const inv = new THREE.Matrix4().copy(m.matrixWorld).invert();
          const o0 = new THREE.Vector3().applyMatrix4(inv), o1 = new THREE.Vector3(0, TONGUE_RDY, TONGUE_RDZ).applyMatrix4(inv);
          d.copy(o1).sub(o0);
          const P = m.geometry.attributes.position;
          for (let i = 0; i < P.count; i++) P.setXYZ(i, P.getX(i) + d.x, P.getY(i) + d.y, P.getZ(i) + d.z);
          P.needsUpdate = true; m.geometry.computeBoundingSphere(); m.frustumCulled = false;
        }
      });
      if (t1) { g.scene.updateMatrixWorld(true); const w = new THREE.Vector3(); t1.getWorldPosition(w); w.z += TONGUE_DZ; w.y += TONGUE_DY; t1.position.copy(t1.parent.worldToLocal(w)); g.scene.updateMatrixWorld(true); }
    }
    if (OPAQUE[pid]) makeOpaque(g.scene, OPAQUE[pid]);
    if (TINT[pid]) tintMats(g.scene, TINT[pid]);
    if (DROOP[pid] && !clips.length) droop(g.scene, DROOP[pid]);
    if (SQUASH[pid] && !clips.length) squash(g.scene, SQUASH[pid]);
    if (!clips.length && FAT[pid]) g.scene.scale.set(FAT[pid], 1, FAT[pid]);
    if (ROTY[pid]) g.scene.rotation.y += ROTY[pid];   // modelos que miran hacia el lado en vez de hacia delante
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
    if (pid === 336 && !g.scene.userData.eyes) {   // Seviper: la zona ocular (malla Object_12) tiene el hueco de la textura transparente -> se rellena de rojo y se dibuja el ojo plano
      g.scene.userData.eyes = true;
      g.scene.traverse(m => {
        if (!m.isMesh || m.name !== 'Object_12' || !m.material.map || !m.material.map.image) return;
        const im = m.material.map.image, W = im.width, H = im.height, k = W / 256;
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0);
        const id = cx.getImageData(0, 0, W, H), d = id.data;
        // Hueco real del ojo = píxeles transparentes del mosaico que quedan encerrados por el marco amarillo.
        // El marco de la mitad derecha tiene una abertura: se cierra con una pared virtual entre la punta (100,216) y la cresta (114,232).
        const TX1 = Math.round(128 * k), TY0 = Math.round(192 * k), TY1 = Math.round(256 * k);
        const wall = new Uint8Array(W * H);
        for (let t = 0; t <= 1; t += 0.5 / (16 * k)) { const wx = Math.round((100 + 14 * t) * k), wy = Math.round((216 + 16 * t) * k); for (let a = -1; a <= 1; a++) for (let b2 = -1; b2 <= 1; b2++) wall[(wy + a) * W + wx + b2] = 1; }
        const trans = q => d[q * 4 + 3] < 128, outer = new Uint8Array(W * H), st = [];
        for (let x = 0; x < TX1; x++) { const q = Math.round(199 * k) * W + x; if (trans(q) && !wall[q]) { outer[q] = 1; st.push(q); } }
        while (st.length) { const c0 = st.pop(), yy = (c0 / W) | 0, xx = c0 - yy * W;
          for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = xx + ax, ny = yy + ay; if (nx < 0 || nx >= TX1 || ny < TY0 || ny >= TY1) continue; const c1 = ny * W + nx; if (!outer[c1] && !wall[c1] && trans(c1)) { outer[c1] = 1; st.push(c1); } } }
        const holeAll = new Uint8Array(W * H);
        for (let y = TY0; y < TY1; y++) for (let x = 0; x < TX1; x++) { const q = y * W + x; if (trans(q) && !outer[q] && !wall[q]) holeAll[q] = 1; }
        for (const [x0, x1] of [[0, 64], [64, 128]]) {
          const X0 = Math.round(x0 * k), X1 = Math.round(x1 * k), Y0 = TY0, Y1 = TY1 - 1;
          const hole = new Uint8Array(W * H); let sx = 0, sy = 0, n = 0, bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1;
          for (let y = Y0; y <= Y1; y++) for (let x = X0; x < X1; x++) if (holeAll[y * W + x]) { hole[y * W + x] = 1; sx += x; sy += y; n++; bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
          if (!n) continue;
          const cxm = sx / n, cym = sy / n, rw = (bx1 - bx0) / 2 + 1, rh = (by1 - by0) / 2 + 1;
          for (let y = Y0; y <= Y1; y++) for (let x = X0; x < X1; x++) {
            if (!hole[y * W + x]) continue;
            const q = (y * W + x) * 4;
            const dx = (x - cxm) / rw, dy = (y - cym) / rh, r = Math.sqrt(dx * dx + dy * dy);
            let edge = false;
            for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + ax, yy = y + ay; if (xx < 0 || yy < 0 || xx >= W || yy >= H || !hole[yy * W + xx]) { edge = true; break; } }
            let c;
            if (edge) c = [42, 7, 7];                                   // contorno oscuro
            else if ((dx / 0.13) ** 2 + (dy / 0.6) ** 2 < 1) c = [10, 5, 5];   // pupila rasgada vertical
            else if (Math.hypot(dx + 0.38, dy + 0.4) < 0.12) c = [255, 235, 200];  // brillo
            else { const t = Math.min(1, r); c = [Math.round(255 - 115 * t), Math.round(90 - 55 * t), Math.round(60 - 40 * t)]; }   // iris rojo
            d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = 255;
          }
        }
        cx.putImageData(id, 0, 0);
        m.material.map.image = cv; m.material.map.needsUpdate = true;
      });
    }
    if (pid === 83 && !g.scene.userData.cap) {   // Farfetch'd: a la cabeza le falta la parte delantera (esfera) -> se tapa con una esfera del color de la cabeza
      g.scene.userData.cap = true;
      let hb = null; g.scene.traverse(o => { if (o.isBone && /^Head_/.test(o.name)) hb = o; });
      if (hb) {
        wrap.updateMatrixWorld(true);
        // textura de la cara: cuencas oscuras alrededor de las pupilas y cejas marcadas (sprite: ceño fruncido, cejas inclinadas hacia el pico)
        const W = 1024, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const cx = cv.getContext('2d'), P = 1024 / 360;
        cx.fillStyle = '#bfa296'; cx.fillRect(0, 0, W, H);
        const U = (sg, dg) => (0.25 + sg * dg / 360) * W, V = th => th * P;
        for (const sg of [-1, 1]) {
          cx.save(); cx.translate(U(sg, 31), V(82)); cx.scale(1, 1.9);
          const gr = cx.createRadialGradient(0, 0, 3, 0, 0, 24 * P / 1.9 * 1.0); gr.addColorStop(0, 'rgba(58,38,32,1)'); gr.addColorStop(0.65, 'rgba(70,48,40,0.95)'); gr.addColorStop(1, 'rgba(90,64,54,0)');
          cx.fillStyle = gr; cx.beginPath(); cx.arc(0, 0, 24 * P / 1.9, 0, Math.PI * 2); cx.fill(); cx.restore();
          cx.save(); cx.translate(U(sg, 31), V(82)); cx.scale(1, 2.1);   // blanco del ojo
          cx.beginPath(); cx.arc(0, 0, 8.6 * P, 0, Math.PI * 2); cx.fillStyle = '#f6f1e8'; cx.fill(); cx.lineWidth = 1.2 * P; cx.strokeStyle = '#2d1c16'; cx.stroke(); cx.restore();
          cx.lineCap = 'round'; cx.strokeStyle = '#3a241c'; cx.lineWidth = 5 * P;
          cx.beginPath(); cx.moveTo(U(sg, 47), V(57)); cx.lineTo(U(sg, 28), V(61)); cx.lineTo(U(sg, 11), V(72)); cx.stroke();
        }
        const ctex = new THREE.CanvasTexture(cv); if (THREE.sRGBEncoding) ctex.encoding = THREE.sRGBEncoding;
        const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 36), new THREE.MeshStandardMaterial({map: ctex, roughness: 0.9}));
        cap.scale.setScalar(0.435); cap.position.set(-0.26, 0.48, 0.08);
        wrap.add(cap); wrap.updateMatrixWorld(true); hb.attach(cap);
      }
    }
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
