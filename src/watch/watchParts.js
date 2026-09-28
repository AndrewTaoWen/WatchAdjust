import * as THREE from 'three';

/*
 * Procedural builders for the realistic watch: case, lugs, strap, crown,
 * applied indices, faceted hands, printed dial, recessed windows and a
 * studio lighting environment. Units: the case is ~1.57 in radius, the dial
 * surface sits at z = DIAL_Z and faces +z.
 */

export const DIAL_Z = 0.12;
export const DIAL_R = 1.385;

// ---------- Materials ----------

export function createMaterials() {
  return {
    polished: new THREE.MeshPhysicalMaterial({
      color: 0xd9dde2,
      metalness: 1,
      roughness: 0.12,
    }),
    // Circular-brushed case flank: anisotropy runs along the lathe's U (around the case).
    brushed: new THREE.MeshPhysicalMaterial({
      color: 0xc9cdd3,
      metalness: 1,
      roughness: 0.32,
      anisotropy: 0.8,
    }),
    // Heat-blued steel — classic on cream dials and very legible.
    blued: new THREE.MeshPhysicalMaterial({
      color: 0x2146a8,
      metalness: 1,
      roughness: 0.2,
    }),
    secondsHand: new THREE.MeshPhysicalMaterial({
      color: 0xb4231c,
      metalness: 0.3,
      roughness: 0.35,
      clearcoat: 0.6,
    }),
    crystal: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.02,
      transmission: 1,
      thickness: 0.04,
      ior: 1.77, // sapphire
      specularIntensity: 1,
      specularColor: new THREE.Color(0xdde8ff), // faint blue anti-reflective tint
    }),
  };
}

// ---------- Studio environment ----------

/** A dark studio with softboxes, so polished steel gets crisp highlight strips. */
export function createStudioEnvironment(renderer) {
  const env = new THREE.Scene();

  const room = new THREE.Mesh(
    new THREE.BoxGeometry(30, 30, 30),
    new THREE.MeshBasicMaterial({ color: 0x6a707a, side: THREE.BackSide }),
  );
  env.add(room);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshBasicMaterial({ color: 0x2a2d33 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -6;
  env.add(floor);

  const softbox = (w, h, position, intensity, color = 0xffffff) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(intensity),
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    env.add(mesh);
  };

  softbox(10, 5, [0, 9, 4], 5); // overhead key
  softbox(2.5, 10, [-9, 2, 4], 3.5); // left strip
  softbox(2.5, 10, [9, 1, 3], 2.5, 0xfff2e0); // warm right strip
  softbox(8, 3, [0, 1, 10], 1.2); // soft front fill (lights the dial face)

  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return texture;
}

// ---------- Case ----------

/** Revolve a (radius, z) profile around the watch axis. */
function lathe(points, segments = 128) {
  const geo = new THREE.LatheGeometry(
    points.map(([r, z]) => new THREE.Vector2(r, z)),
    segments,
  );
  geo.rotateX(Math.PI / 2); // lathe Y axis → watch Z axis
  return geo;
}

export function buildCase(materials) {
  const group = new THREE.Group();

  // Mid-case: caseback step, then a curved flank up to the bezel.
  const midcase = new THREE.Mesh(
    lathe([
      [0, -0.2],
      [1.2, -0.2],
      [1.32, -0.185],
      [1.42, -0.15],
      [1.49, -0.1],
      [1.54, -0.04],
      [1.565, 0.02],
      [1.568, 0.07],
      [1.558, 0.11],
    ]),
    materials.brushed,
  );
  group.add(midcase);

  // Polished bezel with a sloped inner ring (rehaut) down to the dial.
  const bezel = new THREE.Mesh(
    lathe([
      [1.558, 0.105],
      [1.565, 0.14],
      [1.55, 0.175],
      [1.515, 0.2],
      [1.465, 0.213],
      [1.425, 0.214],
      [1.408, 0.2],
      [1.395, 0.16],
      [1.386, DIAL_Z],
    ]),
    materials.polished,
  );
  group.add(bezel);

  group.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return group;
}

// ---------- Lugs & strap ----------

const LUG_X = 0.6;
const STRAP_WIDTH = 1.0;

function lugGeometry() {
  // Side profile (y along the watch, z up), extruded across the watch.
  const s = new THREE.Shape();
  s.moveTo(1.2, -0.16);
  s.lineTo(1.2, 0.06);
  s.quadraticCurveTo(1.6, 0.065, 1.88, -0.02);
  s.quadraticCurveTo(1.96, -0.05, 1.93, -0.1);
  s.quadraticCurveTo(1.7, -0.12, 1.45, -0.16);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 4,
    curveSegments: 16,
  });
  // (shapeX, shapeY, extrude) → (x = extrude, y = shapeX, z = shapeY)
  geo.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  geo.translate(-0.05, 0, 0);
  return geo;
}

function leatherTexture() {
  const w = 256;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#4a2c1a';
  ctx.fillRect(0, 0, w, h);

  // Pebbled grain
  for (let i = 0; i < 9000; i++) {
    const shade = Math.random() < 0.5 ? '0,0,0' : '255,220,190';
    ctx.fillStyle = `rgba(${shade},${Math.random() * 0.07})`;
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Edge darkening and saddle stitching along both sides
  const edge = ctx.createLinearGradient(0, 0, w, 0);
  edge.addColorStop(0, 'rgba(0,0,0,0.45)');
  edge.addColorStop(0.06, 'rgba(0,0,0,0)');
  edge.addColorStop(0.94, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#d9c7a8';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 9]);
  [0.09, 0.91].forEach((u) => {
    ctx.beginPath();
    ctx.moveTo(u * w, 0);
    ctx.lineTo(u * w, h);
    ctx.stroke();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function strapGeometry() {
  // A straight band bent around an imaginary wrist, curving away from the viewer.
  const length = 1.9;
  const thickness = 0.07;
  const geo = new THREE.BoxGeometry(STRAP_WIDTH, length, thickness, 1, 48, 1);
  const pos = geo.attributes.position;
  const R = 1.1;
  const y0 = 1.8;
  const z0 = -0.075;
  for (let i = 0; i < pos.count; i++) {
    const s = pos.getY(i) + length / 2;
    const t = pos.getZ(i);
    const theta = s / R;
    pos.setY(i, y0 + (R + t) * Math.sin(theta));
    pos.setZ(i, z0 - R + (R + t) * Math.cos(theta));
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildLugsAndStrap(materials) {
  const group = new THREE.Group();
  const lugGeo = lugGeometry();
  const strapGeo = strapGeometry();
  const leather = leatherTexture();
  const strapMat = new THREE.MeshStandardMaterial({
    map: leather,
    bumpMap: leather,
    bumpScale: 0.6,
    roughness: 0.75,
  });

  // Build the 12 o'clock side, then rotate a copy for 6 o'clock.
  [0, Math.PI].forEach((rotation) => {
    const side = new THREE.Group();
    [-LUG_X, LUG_X].forEach((x) => {
      const lug = new THREE.Mesh(lugGeo, materials.brushed);
      lug.position.x = x;
      side.add(lug);
    });
    side.add(new THREE.Mesh(strapGeo, strapMat));
    side.rotation.z = rotation;
    group.add(side);
  });

  group.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return group;
}

// ---------- Crown ----------

export function buildCrown(materials) {
  const group = new THREE.Group();

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 24), materials.polished);
  stem.position.y = 0.06;
  group.add(stem);

  // Fluted grip: displace the rim to create ridges.
  const crownGeo = new THREE.CylinderGeometry(0.135, 0.135, 0.13, 120, 1);
  const pos = crownGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.1) continue;
    const theta = Math.atan2(z, x);
    const k = 1 - 0.07 * (0.5 + 0.5 * Math.cos(theta * 30));
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  crownGeo.computeVertexNormals();
  const grip = new THREE.Mesh(crownGeo, materials.polished);
  grip.position.y = 0.17;
  group.add(grip);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 32, 12, 0, Math.PI * 2, 0, Math.PI / 5),
    materials.polished,
  );
  cap.scale.y = 0.6;
  cap.position.y = 0.2;
  group.add(cap);

  // Cylinder axis is Y — point it out of the case at 3 o'clock.
  group.rotation.z = -Math.PI / 2;
  group.position.set(1.52, 0, 0);
  group.traverse((o) => {
    o.castShadow = true;
  });
  return group;
}

// ---------- Applied indices ----------

function batonGeometry(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2);
  s.lineTo(w / 2, -h / 2);
  s.lineTo(w / 2, h / 2);
  s.lineTo(-w / 2, h / 2);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 1,
  });
}

export function buildIndices(materials) {
  const group = new THREE.Group();
  const major = batonGeometry(0.05, 0.2);
  const minor = batonGeometry(0.036, 0.15);

  for (let i = 0; i < 12; i++) {
    const angle = Math.PI / 2 - (i / 12) * Math.PI * 2;
    const isMajor = i % 3 === 0;
    const r = isMajor ? 1.13 : 1.155;
    const offsets = i === 0 ? [-0.042, 0.042] : [0];
    offsets.forEach((offset) => {
      const mesh = new THREE.Mesh(isMajor ? major : minor, materials.polished);
      mesh.position.set(
        Math.cos(angle) * r + Math.cos(angle - Math.PI / 2) * offset,
        Math.sin(angle) * r + Math.sin(angle - Math.PI / 2) * offset,
        DIAL_Z + 0.002,
      );
      mesh.rotation.z = angle - Math.PI / 2;
      mesh.castShadow = true;
      group.add(mesh);
    });
  }
  return group;
}

// ---------- Hands ----------

/**
 * Dauphine hand: a long diamond with a raised central ridge, so each half
 * catches the light differently — the signature look of a dress watch.
 */
function dauphineGeometry(length, width, tail, ridge) {
  const base = length * 0.14;
  const P0 = new THREE.Vector3(0, -tail, 0);
  const P1 = new THREE.Vector3(-width, base, 0);
  const P2 = new THREE.Vector3(0, length, 0);
  const P3 = new THREE.Vector3(width, base, 0);
  const C = new THREE.Vector3(0, base, ridge);
  const T = new THREE.Vector3(0, -tail, ridge * 0.4);

  const tris = [
    [P1, P2, C],
    [C, P2, P3],
    [P0, P1, C],
    [P0, C, P3],
    [P0, T, C],
    [P1, P0, P2],
    [P2, P0, P3],
  ];
  return trianglesToGeometry(tris);
}

function trianglesToGeometry(tris) {
  const up = new THREE.Vector3(0, 0, 1);
  const positions = [];
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  tris.forEach(([a, b, c], i) => {
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    const n = ab.cross(ac);
    // The last two triangles are the underside and should face down.
    const wantUp = i < tris.length - 2;
    const facesUp = n.dot(up) >= 0;
    const [p, q, r] = facesUp === wantUp ? [a, b, c] : [a, c, b];
    positions.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals(); // non-indexed → flat facets
  return geo;
}

function secondsGeometry() {
  const geo = new THREE.BoxGeometry(0.012, 1.45, 0.006);
  geo.translate(0, 1.45 / 2 - 0.27, 0);
  const counterweight = new THREE.CylinderGeometry(0.04, 0.04, 0.006, 32);
  counterweight.rotateX(Math.PI / 2);
  counterweight.translate(0, -0.2, 0);
  const merged = mergeGeometries([geo.toNonIndexed(), counterweight.toNonIndexed()]);
  merged.computeVertexNormals();
  return merged;
}

function mergeGeometries(geos) {
  const positions = [];
  const normals = [];
  geos.forEach((g) => {
    positions.push(...g.attributes.position.array);
    normals.push(...g.attributes.normal.array);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

export function buildHands(materials) {
  // Separate materials so the hour/minute hands can glow when highlighted.
  const handMat = materials.blued.clone();
  const hourHand = new THREE.Mesh(dauphineGeometry(0.74, 0.055, 0.1, 0.018), handMat);
  const minuteHand = new THREE.Mesh(dauphineGeometry(1.12, 0.045, 0.13, 0.016), handMat);
  const secondHand = new THREE.Mesh(secondsGeometry(), materials.secondsHand);

  hourHand.position.z = DIAL_Z + 0.04;
  minuteHand.position.z = DIAL_Z + 0.056;
  secondHand.position.z = DIAL_Z + 0.075;

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    materials.secondsHand,
  );
  cap.rotation.x = Math.PI / 2;
  cap.scale.y = 0.5;
  cap.position.z = DIAL_Z + 0.078;

  [hourHand, minuteHand, secondHand, cap].forEach((m) => {
    m.castShadow = true;
  });
  return { hourHand, minuteHand, secondHand, cap, handMaterial: handMat };
}

// ---------- Dial ----------

const DIAL_PX = 2048;

/** Printed dial: cream sunburst base, minute track, brand line. Redraw when fonts load. */
export function createDialTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = DIAL_PX;
  canvas.height = DIAL_PX;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const draw = () => {
    drawDial(canvas.getContext('2d'));
    texture.needsUpdate = true;
  };
  draw();
  document.fonts?.ready.then(draw);
  return texture;
}

function drawDial(ctx) {
  const c = DIAL_PX / 2;
  const S = c / DIAL_R; // px per world unit
  const P = (x, y) => [c + x * S, c - y * S];

  // Base: warm cream with a gentle vignette toward the rim.
  const base = ctx.createRadialGradient(c, c * 0.9, 0, c, c, c);
  base.addColorStop(0, '#f3ecdc');
  base.addColorStop(0.75, '#ebe2cd');
  base.addColorStop(1, '#d8cdb4');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, DIAL_PX, DIAL_PX);

  // Sunburst: faint radial rays.
  ctx.save();
  ctx.translate(c, c);
  for (let i = 0; i < 720; i++) {
    const a = (i / 720) * Math.PI * 2;
    ctx.strokeStyle = `rgba(${i % 2 ? '255,255,255' : '120,100,70'},${0.025 + Math.random() * 0.025})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * c, Math.sin(a) * c);
    ctx.stroke();
  }
  ctx.restore();

  // Minute track: two rings with 60 ticks.
  const ink = '#1c2a44';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  [1.285, 1.345].forEach((r) => {
    ctx.beginPath();
    ctx.arc(c, c, r * S, 0, Math.PI * 2);
    ctx.stroke();
  });
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const five = i % 5 === 0;
    ctx.lineWidth = five ? 7 : 3;
    ctx.beginPath();
    ctx.moveTo(c + Math.sin(a) * 1.285 * S, c - Math.cos(a) * 1.285 * S);
    ctx.lineTo(c + Math.sin(a) * (five ? 1.345 : 1.33) * S, c - Math.cos(a) * (five ? 1.345 : 1.33) * S);
    ctx.stroke();
  }

  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Brand and caption.
  ctx.font = `600 ${0.1 * S}px "Cormorant Garamond", Georgia, serif`;
  ctx.letterSpacing = `${0.012 * S}px`;
  ctx.fillText('WATCHADJUST', ...P(0, 0.31));
  ctx.font = `italic 500 ${0.052 * S}px "Cormorant Garamond", Georgia, serif`;
  ctx.letterSpacing = '0px';
  ctx.fillText('Automatic', ...P(0, 0.215));
}

/**
 * Anisotropy direction map for the dial: radial directions give the sweeping
 * "sunburst" highlight real dials have. CircleGeometry UVs are planar, so
 * tangent = +x and bitangent = +y.
 */
export function createSunburstAnisotropyMap(size = 256) {
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = (i + 0.5) / size - 0.5;
      const y = (j + 0.5) / size - 0.5;
      const len = Math.hypot(x, y) || 1;
      const k = (j * size + i) * 4;
      data[k] = ((x / len) * 0.5 + 0.5) * 255;
      data[k + 1] = ((y / len) * 0.5 + 0.5) * 255;
      data[k + 2] = 255;
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

// ---------- Crystal ----------

export function buildCrystal(materials) {
  const mesh = new THREE.Mesh(
    lathe(
      [
        [0, 0.262],
        [0.7, 0.256],
        [1.15, 0.24],
        [1.42, 0.213],
        [1.42, 0.205],
      ],
      96,
    ),
    materials.crystal,
  );
  mesh.renderOrder = 20;
  return mesh;
}

// ---------- Recessed windows ----------

function frameShape(w, h, t) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 - t, -h / 2 - t);
  s.lineTo(w / 2 + t, -h / 2 - t);
  s.lineTo(w / 2 + t, h / 2 + t);
  s.lineTo(-w / 2 - t, h / 2 + t);
  s.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-w / 2, -h / 2);
  hole.lineTo(-w / 2, h / 2);
  hole.lineTo(w / 2, h / 2);
  hole.lineTo(w / 2, -h / 2);
  hole.closePath();
  s.holes.push(hole);
  return s;
}

/**
 * A date-style window: a printed disc showing through a cut-out, with an
 * inner shadow so it reads as recessed, framed by a polished bevel.
 */
export function createWindow(materials, { w, h, fontScale = 0.62, serif = false }) {
  const group = new THREE.Group();

  const W = 512;
  const H = Math.max(64, Math.round((W * h) / w));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  face.position.z = DIAL_Z + 0.002;
  face.receiveShadow = true;
  group.add(face);

  const frame = new THREE.Mesh(
    new THREE.ExtrudeGeometry(frameShape(w, h, 0.008), {
      depth: 0.003,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 2,
    }),
    materials.polished,
  );
  frame.position.z = DIAL_Z + 0.001;
  frame.castShadow = true;
  group.add(frame);

  let current = null;
  const setText = (text) => {
    if (text === current) return;
    current = text;
    ctx.fillStyle = '#fbf9f4';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#141414';
    const family = serif ? '"Cormorant Garamond", Georgia, serif' : '"DM Sans", system-ui, sans-serif';
    ctx.font = `700 ${Math.round(H * fontScale)}px ${family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, H * 0.54, W * 0.9);

    // Inner shadow: light comes from above, so the top and left lips cast shade.
    const top = ctx.createLinearGradient(0, 0, 0, H * 0.35);
    top.addColorStop(0, 'rgba(0,0,0,0.45)');
    top.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, H * 0.35);
    const left = ctx.createLinearGradient(0, 0, W * 0.06, 0);
    left.addColorStop(0, 'rgba(0,0,0,0.3)');
    left.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = left;
    ctx.fillRect(0, 0, W * 0.06, H);

    texture.needsUpdate = true;
  };

  document.fonts?.ready.then(() => {
    const text = current;
    current = null;
    if (text != null) setText(text);
  });

  return { group, setText };
}
