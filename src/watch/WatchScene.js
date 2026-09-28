import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  DIAL_Z,
  DIAL_R,
  createMaterials,
  createStudioEnvironment,
  buildCase,
  buildLugsAndStrap,
  buildCrown,
  buildIndices,
  buildHands,
  buildCrystal,
  createDialTexture,
  createSunburstAnisotropyMap,
  createWindow,
} from './watchParts.js';

const MOON_Y = -0.58;
const MOON_R = 0.25;
const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const COLORS = {
  focus: 0x0d9488,
};

const HOME_DIRECTION = new THREE.Vector3(0, 2.4, 4.2).normalize();
const WATCH_RADIUS = 1.9; // case, crown and lugs — used to fit the camera

// Where each settable part sits on the dial (watch-local coordinates).
const PARTS = {
  crown: { shape: 'ring', x: 1.76, y: 0, r: 0.2 },
  hands: { shape: 'ring', x: 0, y: 0, r: 0.16 },
  moon: { shape: 'ring', x: 0, y: MOON_Y, r: MOON_R * 1.28 },
  day: { shape: 'frame', x: 0, y: 0.69, w: 0.66, h: 0.22 },
  date: { shape: 'frame', x: 0, y: 0.495, w: 0.34, h: 0.22 },
  dayDate: { shape: 'frame', x: 0, y: 0.6, w: 0.7, h: 0.44 },
  month: { shape: 'frame', x: 0.75, y: 0, w: 0.5, h: 0.24 },
  year: { shape: 'frame', x: -0.75, y: 0, w: 0.56, h: 0.24 },
};

const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export class WatchScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.targetDate = new Date();
    this.sceneState = {};
    this.cameraGoal = null;
    this.highlightedPart = null;
    this.homeDistance = 6;

    this.init();
  }

  init() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Neutral tone mapping keeps the cream dial and blued hands true to colour.
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);

    // Transparent background — the page's CSS gradient shows through, so the
    // scene follows the light/dark theme automatically.
    this.scene = new THREE.Scene();
    // Studio softboxes reflected in the polished steel are what make it read as metal.
    this.scene.environment = createStudioEnvironment(this.renderer);

    // A long lens, like product photography — less distortion than a wide view.
    this.camera = new THREE.PerspectiveCamera(20, 1, 0.1, 200);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    // Keep the dial facing the viewer so nobody gets lost behind the watch.
    this.controls.minAzimuthAngle = -0.9;
    this.controls.maxAzimuthAngle = 0.9;
    this.controls.minPolarAngle = 0.3;
    this.controls.maxPolarAngle = 1.45;
    this.controls.addEventListener('start', () => {
      this.cameraGoal = null;
    });

    this.setupLights();
    this.buildWatch();

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.canvas);
    this.onResize();
    this.camera.position.copy(HOME_DIRECTION).multiplyScalar(this.homeDistance);

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupLights() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3f48, 0.35));

    // Key light casts the soft shadows of hands and indices onto the dial —
    // the single biggest cue that parts sit at different heights.
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-2.5, 5, 6);
    key.castShadow = true;
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
    const cam = key.shadow.camera;
    cam.left = -2.4;
    cam.right = 2.4;
    cam.top = 2.4;
    cam.bottom = -2.4;
    cam.near = 1;
    cam.far = 16;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.01;
    key.shadow.radius = 4;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xdce8ff, 0.5);
    fill.position.set(4, 1, 4);
    this.scene.add(fill);
  }

  buildWatch() {
    const watch = new THREE.Group();
    this.watchGroup = watch;
    const materials = createMaterials();
    this.materials = materials;

    watch.add(buildCase(materials));
    watch.add(buildLugsAndStrap(materials));
    watch.add(buildCrown(materials));

    const dial = new THREE.Mesh(
      new THREE.CircleGeometry(DIAL_R, 128),
      new THREE.MeshPhysicalMaterial({
        map: createDialTexture(),
        roughness: 0.42,
        metalness: 0.12,
        anisotropy: 0.75,
        anisotropyMap: createSunburstAnisotropyMap(),
      }),
    );
    dial.position.z = DIAL_Z;
    dial.receiveShadow = true;
    watch.add(dial);

    watch.add(buildIndices(materials));

    const hands = buildHands(materials);
    this.hourHand = hands.hourHand;
    this.minuteHand = hands.minuteHand;
    this.secondHand = hands.secondHand;
    this.handMaterial = hands.handMaterial;
    watch.add(hands.hourHand, hands.minuteHand, hands.secondHand, hands.cap);

    this.moonGroup = this.buildMoonPhase(materials);
    this.moonGroup.position.set(0, MOON_Y, 0);
    watch.add(this.moonGroup);

    this.dayWindow = createWindow(materials, { w: 0.58, h: 0.15 });
    this.dayWindow.group.position.y = 0.69;
    this.dateWindow = createWindow(materials, { w: 0.26, h: 0.15, fontScale: 0.7 });
    this.dateWindow.group.position.y = 0.495;
    this.dayDateGroup = new THREE.Group();
    this.dayDateGroup.add(this.dayWindow.group, this.dateWindow.group);
    watch.add(this.dayDateGroup);

    this.monthWindow = createWindow(materials, { w: 0.42, h: 0.16 });
    this.monthGroup = this.monthWindow.group;
    this.monthGroup.position.x = 0.75;
    watch.add(this.monthGroup);

    this.yearWindow = createWindow(materials, { w: 0.48, h: 0.16 });
    this.yearGroup = this.yearWindow.group;
    this.yearGroup.position.x = -0.75;
    watch.add(this.yearGroup);

    watch.add(buildCrystal(materials));

    this.highlight = this.buildHighlight();
    watch.add(this.highlight);

    watch.rotation.x = -0.3;
    this.scene.add(watch);
  }

  /** Pulsing outline drawn on top of whatever part the user is setting. */
  buildHighlight() {
    const group = new THREE.Group();
    group.visible = false;
    group.renderOrder = 30;
    const mat = new THREE.MeshBasicMaterial({
      color: COLORS.focus,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.highlightMaterial = mat;
    this.highlightMesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    this.highlightMesh.renderOrder = 30;
    group.add(this.highlightMesh);
    group.position.z = 0.24;
    return group;
  }

  highlightPart(part) {
    if (part === this.highlightedPart) return;
    this.highlightedPart = part;
    const cfg = PARTS[part];

    const handGlow = part === 'hands' ? COLORS.focus : 0x000000;
    this.handMaterial.emissive.setHex(handGlow);

    if (!cfg) {
      this.highlight.visible = false;
      this.resetView();
      return;
    }

    this.highlightMesh.geometry.dispose();
    this.highlightMesh.geometry =
      cfg.shape === 'ring'
        ? new THREE.RingGeometry(cfg.r, cfg.r + 0.035, 64)
        : frameGeometry(cfg.w, cfg.h, 0.03);
    this.highlight.position.x = cfg.x;
    this.highlight.position.y = cfg.y;
    this.highlight.visible = true;

    if (part === 'hands') {
      this.resetView();
    } else {
      this.focusOn(cfg.x, cfg.y);
    }
  }

  focusOn(x, y) {
    const world = new THREE.Vector3(x, y, 0.2);
    this.watchGroup.localToWorld(world);
    const target = world.multiplyScalar(0.55);
    const position = HOME_DIRECTION.clone().multiplyScalar(this.homeDistance * 0.75).add(target);
    this.setCameraGoal(position, target);
  }

  resetView() {
    this.setCameraGoal(
      HOME_DIRECTION.clone().multiplyScalar(this.homeDistance),
      new THREE.Vector3(0, 0, 0),
    );
  }

  setCameraGoal(position, target) {
    if (reducedMotion) {
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.cameraGoal = null;
      return;
    }
    this.cameraGoal = { position, target };
  }

  buildMoonPhase(materials) {
    const group = new THREE.Group();

    const { texture, canvas, ctx } = this.createMoonDisplayTexture(0);
    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(MOON_R, 96),
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.6,
        emissiveMap: texture,
        emissive: 0x555555, // the painted moon should stay readable in shadow
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    );
    disk.position.z = DIAL_Z + 0.002;
    disk.receiveShadow = true;
    this.moonDisc = disk;
    disk.userData = { canvas, ctx, texture };
    group.add(disk);

    const frame = new THREE.Mesh(new THREE.TorusGeometry(MOON_R + 0.012, 0.02, 16, 96), materials.polished);
    frame.position.z = DIAL_Z + 0.008;
    frame.scale.z = 0.6;
    frame.castShadow = true;
    group.add(frame);

    return group;
  }

  createMoonDisplayTexture(phase) {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    this.drawMoonDisplay(ctx, size / 2, size / 2, size * 0.5, phase);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return { texture, canvas, ctx };
  }

  drawMoonDisplay(ctx, cx, cy, r, phase) {
    ctx.clearRect(0, 0, cx * 2, cy * 2);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    const sky = ctx.createRadialGradient(cx, cy - r * 0.15, 0, cx, cy, r);
    sky.addColorStop(0, '#1e3a5f');
    sky.addColorStop(0.6, '#0f2038');
    sky.addColorStop(1, '#081018');
    ctx.fillStyle = sky;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    this.drawStarField(ctx, cx, cy, r);

    // Unlit side, faintly visible (earthshine) so the whole moon reads as a disc.
    ctx.fillStyle = 'rgba(120, 140, 170, 0.14)';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.84, 0, Math.PI * 2);
    ctx.fill();

    this.drawAccurateMoon(ctx, cx, cy, r * 0.84, phase);

    // Recessed look: shade just inside the rim, heavier at the top.
    const lip = ctx.createRadialGradient(cx, cy + r * 0.08, r * 0.8, cx, cy, r);
    lip.addColorStop(0, 'rgba(0,0,0,0)');
    lip.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = lip;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  drawAccurateMoon(ctx, cx, cy, radius, phase) {
    phase = ((phase % 1) + 1) % 1;
    if (phase < 0.01 || phase > 0.99) return;

    ctx.save();
    this.traceLitMoonLobe(ctx, cx, cy, radius, phase);
    ctx.clip();
    this.drawLunarSurface(ctx, cx, cy, radius);
    ctx.restore();
  }

  /**
   * Lit portion of the lunar disc, as seen from the northern hemisphere:
   * a half-circle limb on the sunlit side, closed by the terminator — an
   * ellipse whose half-width is r·|cos(2π·phase)|. The terminator bulges
   * toward the lit limb for a crescent and away from it for a gibbous moon.
   */
  traceLitMoonLobe(ctx, cx, cy, radius, phase) {
    const waxing = phase < 0.5;
    const rx = radius * Math.abs(Math.cos(phase * Math.PI * 2));
    const crescent = phase < 0.25 || phase > 0.75;
    const top = -Math.PI / 2;
    const bottom = Math.PI / 2;

    ctx.beginPath();
    if (waxing) {
      // Right limb: top → right → bottom
      ctx.arc(cx, cy, radius, top, bottom, false);
      if (crescent) ctx.ellipse(cx, cy, rx, radius, 0, bottom, top, true);
      else ctx.ellipse(cx, cy, rx, radius, 0, bottom, top + Math.PI * 2, false);
    } else {
      // Left limb: bottom → left → top
      ctx.arc(cx, cy, radius, bottom, top + Math.PI * 2, false);
      if (crescent) ctx.ellipse(cx, cy, rx, radius, 0, top + Math.PI * 2, bottom, true);
      else ctx.ellipse(cx, cy, rx, radius, 0, top, bottom, false);
    }
    ctx.closePath();
  }

  updateMoonPhase(phase) {
    if (!this.moonDisc) return;
    const { canvas, ctx, texture } = this.moonDisc.userData;
    this.drawMoonDisplay(ctx, canvas.width / 2, canvas.height / 2, canvas.width * 0.5, phase);
    texture.needsUpdate = true;
  }

  drawLunarSurface(ctx, cx, cy, r) {
    const base = ctx.createRadialGradient(
      cx - r * 0.15,
      cy - r * 0.2,
      r * 0.05,
      cx,
      cy,
      r,
    );
    base.addColorStop(0, '#f5f0e4');
    base.addColorStop(0.55, '#e6dcc8');
    base.addColorStop(0.85, '#cfc3aa');
    base.addColorStop(1, '#a89880');
    ctx.fillStyle = base;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Maria — darker basalt plains
    const maria = [
      { x: -0.18, y: -0.08, rx: 0.34, ry: 0.26, rot: -0.35, alpha: 0.22 },
      { x: 0.22, y: 0.06, rx: 0.2, ry: 0.16, rot: 0.25, alpha: 0.18 },
      { x: -0.04, y: 0.24, rx: 0.16, ry: 0.12, rot: 0.15, alpha: 0.15 },
      { x: 0.08, y: -0.22, rx: 0.12, ry: 0.1, rot: -0.1, alpha: 0.12 },
    ];
    maria.forEach(({ x, y, rx, ry, rot, alpha }) => {
      ctx.save();
      ctx.translate(cx + x * r, cy + y * r);
      ctx.rotate(rot);
      ctx.fillStyle = `rgba(70, 65, 55, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * r, ry * r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Craters — rim shadow + central highlight
    const craters = [
      [0.12, -0.18, 0.11], [-0.24, 0.08, 0.09], [0.2, 0.2, 0.07],
      [-0.08, -0.05, 0.06], [0.05, 0.12, 0.05], [-0.15, -0.22, 0.08],
      [0.28, -0.05, 0.05], [-0.3, -0.08, 0.06], [0.0, 0.28, 0.04],
    ];
    craters.forEach(([ox, oy, size]) => {
      this.drawCrater(ctx, cx + ox * r, cy + oy * r, size * r);
    });

    // Limb darkening — edges fall off like the real moon
    const limb = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
    limb.addColorStop(0, 'rgba(0, 0, 0, 0)');
    limb.addColorStop(0.75, 'rgba(40, 35, 28, 0.08)');
    limb.addColorStop(1, 'rgba(20, 18, 14, 0.35)');
    ctx.fillStyle = limb;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCrater(ctx, x, y, radius) {
    ctx.fillStyle = 'rgba(55, 50, 42, 0.3)';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(90, 82, 68, 0.35)';
    ctx.lineWidth = Math.max(0.5, radius * 0.12);
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.92, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(220, 210, 190, 0.2)';
    ctx.beginPath();
    ctx.arc(x - radius * 0.18, y - radius * 0.18, radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  drawStarField(ctx, cx, cy, radius) {
    // Subtle stars only — keep the moon readable
    const stars = [
      [0.15, 0.2, 0.9, 0.5], [0.72, 0.18, 0.8, 0.45], [0.25, 0.75, 0.7, 0.4],
      [0.82, 0.65, 0.8, 0.4], [0.48, 0.35, 0.6, 0.35], [0.62, 0.82, 0.7, 0.38],
    ];

    stars.forEach(([nx, ny, dotR, alpha]) => {
      const x = cx + (nx - 0.5) * radius * 1.7;
      const y = cy + (ny - 0.5) * radius * 1.7;
      ctx.fillStyle = `rgba(255, 248, 230, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      ctx.fill();
    });

    // One subtle sparkle
    [[0.55, 0.3]].forEach(([nx, ny]) => {
      const x = cx + (nx - 0.5) * radius * 1.7;
      const y = cy + (ny - 0.5) * radius * 1.7;
      this.drawSparkle(ctx, x, y, 4, 'rgba(255, 250, 235, 0.85)');
    });
  }

  drawSparkle(ctx, x, y, size, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.stroke();
  }

  setTargetDate(date) {
    this.targetDate = new Date(date);
    this.updateHands();
  }

  applySceneState(state) {
    this.sceneState = state;
    const {
      showMoon = false,
      showDayDate = false,
      showMonth = false,
      showYear = false,
      moonPhase = 0,
      dayIndex = 0,
      dateNum = 1,
      monthIndex = 0,
      year = new Date().getFullYear(),
    } = state;

    this.moonGroup.visible = showMoon;
    this.dayDateGroup.visible = showDayDate;
    this.monthGroup.visible = showMonth;
    this.yearGroup.visible = showYear;

    if (showMoon && moonPhase !== this.lastMoonPhase) {
      this.updateMoonPhase(moonPhase);
      this.lastMoonPhase = moonPhase;
    }

    this.dayWindow.setText(DAY_LABELS[dayIndex] ?? 'MON');
    this.dateWindow.setText(String(dateNum));
    this.monthWindow.setText(MONTH_LABELS[monthIndex] ?? 'JAN');
    this.yearWindow.setText(String(year));
  }

  updateHands() {
    const d = this.targetDate;
    const hours = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    const minutes = d.getMinutes() + d.getSeconds() / 60;
    const seconds = d.getSeconds();

    this.hourHand.rotation.z = -(hours / 12) * Math.PI * 2;
    this.minuteHand.rotation.z = -(minutes / 60) * Math.PI * 2;
    this.secondHand.rotation.z = -(seconds / 60) * Math.PI * 2;
  }

  onResize() {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    // updateStyle=false: CSS owns the canvas size so it can shrink with the layout.
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    // Fit the whole watch in view regardless of aspect ratio (phones are tall and narrow).
    const vHalf = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect);
    const previous = this.homeDistance;
    this.homeDistance = (WATCH_RADIUS * 1.06) / Math.sin(Math.min(vHalf, hHalf));
    this.controls.minDistance = this.homeDistance * 0.45;
    this.controls.maxDistance = this.homeDistance * 1.6;

    // Keep the user's zoom level relative to the new fit.
    if (previous && this.camera.position.lengthSq() > 0) {
      const offset = this.camera.position.clone().sub(this.controls.target);
      offset.multiplyScalar(this.homeDistance / previous);
      this.camera.position.copy(this.controls.target).add(offset);
    }
    if (this.cameraGoal && this.highlightedPart && PARTS[this.highlightedPart]) {
      const { x, y } = PARTS[this.highlightedPart];
      if (this.highlightedPart !== 'hands') this.focusOn(x, y);
    }
  }

  animate() {
    requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const t = this.clock.elapsedTime;

    if (this.cameraGoal) {
      const k = 1 - Math.exp(-dt * 5);
      this.camera.position.lerp(this.cameraGoal.position, k);
      this.controls.target.lerp(this.cameraGoal.target, k);
      if (
        this.camera.position.distanceToSquared(this.cameraGoal.position) < 1e-5 &&
        this.controls.target.distanceToSquared(this.cameraGoal.target) < 1e-5
      ) {
        this.cameraGoal = null;
      }
    }

    if (this.highlight.visible) {
      this.highlightMaterial.opacity = reducedMotion ? 0.9 : 0.55 + 0.4 * Math.sin(t * 4);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
  }
}

function frameGeometry(w, h, t) {
  const outer = new THREE.Shape();
  outer.moveTo(-w / 2 - t, -h / 2 - t);
  outer.lineTo(w / 2 + t, -h / 2 - t);
  outer.lineTo(w / 2 + t, h / 2 + t);
  outer.lineTo(-w / 2 - t, h / 2 + t);
  outer.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-w / 2, -h / 2);
  hole.lineTo(-w / 2, h / 2);
  hole.lineTo(w / 2, h / 2);
  hole.lineTo(w / 2, -h / 2);
  hole.closePath();
  outer.holes.push(hole);
  return new THREE.ShapeGeometry(outer);
}
