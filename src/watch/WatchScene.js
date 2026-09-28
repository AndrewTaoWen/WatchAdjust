import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const MOON_Y = -0.58;
const MOON_R = 0.25;
const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Palette — steel case, cream "opaline" dial, navy print. Legible for anyone.
const COLORS = {
  case: 0xc8ccd2,
  bezel: 0xdfe2e6,
  dial: 0xe9e0cc,
  print: 0x1c2a44,
  hands: 0x1c2a44,
  seconds: 0xc2410c,
  windowBg: 0xfbfaf6,
  windowText: '#1c2a44',
  moonFrame: 0xc8ccd2,
  focus: 0x0d9488,
};

const HOME_DIRECTION = new THREE.Vector3(0, 2.4, 4.2).normalize();
const WATCH_RADIUS = 1.8; // case + crown, used to fit the camera

// Where each settable part sits on the dial (watch-local coordinates).
const PARTS = {
  crown: { shape: 'ring', x: 1.68, y: 0, r: 0.2 },
  hands: { shape: 'ring', x: 0, y: 0, r: 0.16 },
  moon: { shape: 'ring', x: 0, y: MOON_Y, r: MOON_R * 1.28 },
  day: { shape: 'frame', x: 0, y: 0.69, w: 0.78, h: 0.19 },
  date: { shape: 'frame', x: 0, y: 0.55, w: 0.78, h: 0.19 },
  dayDate: { shape: 'frame', x: 0, y: 0.62, w: 0.8, h: 0.36 },
  month: { shape: 'frame', x: 0.75, y: 0, w: 0.55, h: 0.28 },
  year: { shape: 'frame', x: -0.75, y: 0, w: 0.6, h: 0.28 },
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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 0);

    // Transparent background — the page's CSS gradient shows through, so the
    // scene follows the light/dark theme automatically.
    this.scene = new THREE.Scene();
    // Soft studio reflections so polished steel reads as metal, not grey plastic.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.8;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

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
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404858, 0.5));

    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(3, 5, 4);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.4);
    fill.position.set(-4, 2, 3);
    this.scene.add(fill);
  }

  buildWatch() {
    const watch = new THREE.Group();
    this.watchGroup = watch;

    const caseMat = new THREE.MeshStandardMaterial({
      color: COLORS.case,
      metalness: 0.9,
      roughness: 0.28,
    });

    // Case
    const caseMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.28, 64), caseMat);
    caseMesh.rotation.x = Math.PI / 2;
    watch.add(caseMesh);

    // Bezel
    const bezel = new THREE.Mesh(
      new THREE.TorusGeometry(1.52, 0.06, 16, 64),
      new THREE.MeshStandardMaterial({ color: COLORS.bezel, metalness: 0.95, roughness: 0.15 }),
    );
    bezel.position.z = 0.12;
    watch.add(bezel);

    // Dial
    const dial = new THREE.Mesh(
      new THREE.CircleGeometry(1.46, 64),
      new THREE.MeshStandardMaterial({ color: COLORS.dial, metalness: 0, roughness: 0.7 }),
    );
    dial.position.z = 0.142;
    dial.renderOrder = 1;
    watch.add(dial);

    // Cover moon sub-dial when complication is hidden
    this.moonHoleCover = new THREE.Mesh(
      new THREE.CircleGeometry(MOON_R * 1.08, 48),
      new THREE.MeshStandardMaterial({ color: COLORS.dial, metalness: 0, roughness: 0.7 }),
    );
    this.moonHoleCover.position.set(0, MOON_Y, 0.158);
    this.moonHoleCover.renderOrder = 3;
    this.moonHoleCover.visible = false;
    watch.add(this.moonHoleCover);

    // Hour markers
    const markerMat = new THREE.MeshStandardMaterial({ color: COLORS.print, metalness: 0.4, roughness: 0.4 });
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const major = i % 3 === 0;
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(major ? 0.07 : 0.035, major ? 0.24 : 0.15, 0.02),
        markerMat,
      );
      marker.position.set(Math.cos(angle) * 1.2, Math.sin(angle) * 1.2, 0.15);
      marker.rotation.z = angle + Math.PI / 2;
      marker.renderOrder = 2;
      watch.add(marker);
    }

    // Hands
    const pivot = new THREE.Group();
    pivot.position.z = 0.19;
    watch.add(pivot);

    this.hourHand = this.createHand(0.58, 0.055, COLORS.hands, 4);
    this.minuteHand = this.createHand(0.9, 0.038, COLORS.hands, 5);
    this.secondHand = this.createHand(1.0, 0.014, COLORS.seconds, 6);
    this.hourHand.position.z = 0;
    this.minuteHand.position.z = 0.008;
    this.secondHand.position.z = 0.016;
    pivot.add(this.hourHand, this.minuteHand, this.secondHand);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.04, 32),
      new THREE.MeshStandardMaterial({ color: COLORS.seconds, metalness: 0.6, roughness: 0.3 }),
    );
    cap.rotation.x = Math.PI / 2;
    cap.position.z = 0.215;
    cap.renderOrder = 7;
    watch.add(cap);

    this.moonGroup = this.buildMoonPhase();
    this.moonGroup.position.set(0, MOON_Y, 0.154);
    watch.add(this.moonGroup);

    this.dayDateGroup = this.buildDayDate();
    this.dayDateGroup.position.set(0, 0.62, 0.158);
    watch.add(this.dayDateGroup);

    this.monthGroup = this.buildLabelWindow(0.48, 0.21, 'JAN', 0.19);
    this.monthLabel = this.monthGroup.userData.label;
    this.monthGroup.position.set(0.75, 0, 0.158);
    watch.add(this.monthGroup);

    this.yearGroup = this.buildLabelWindow(0.53, 0.21, '2026', 0.17);
    this.yearLabel = this.yearGroup.userData.label;
    this.yearGroup.position.set(-0.75, 0, 0.158);
    watch.add(this.yearGroup);

    // Crown
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.2, 24), caseMat);
    crown.rotation.z = Math.PI / 2;
    crown.position.set(1.66, 0, 0);
    watch.add(crown);

    // Crystal
    const crystal = new THREE.Mesh(
      new THREE.SphereGeometry(1.46, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2.4),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.05,
        transparent: true,
        opacity: 0.06,
        depthWrite: false,
      }),
    );
    crystal.rotation.x = -Math.PI / 2;
    crystal.scale.z = 0.25;
    crystal.position.z = 0.2;
    crystal.renderOrder = 20;
    watch.add(crystal);

    this.highlight = this.buildHighlight();
    watch.add(this.highlight);

    watch.rotation.x = -0.3;
    this.scene.add(watch);
  }

  createHand(length, width, color, renderOrder = 4) {
    const geo = new THREE.BoxGeometry(width, length, 0.012);
    geo.translate(0, length / 2 - 0.08, 0);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.35 }),
    );
    mesh.renderOrder = renderOrder;
    return mesh;
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
    [this.hourHand, this.minuteHand].forEach((h) => h.material.emissive.setHex(handGlow));

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

  buildMoonPhase() {
    const group = new THREE.Group();
    group.renderOrder = 3;

    const { texture, canvas, ctx } = this.createMoonDisplayTexture(0);
    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(MOON_R * 0.96, 96),
      new THREE.MeshBasicMaterial({ map: texture }),
    );
    disk.renderOrder = 3;
    this.moonDisc = disk;
    disk.userData = { canvas, ctx, texture };
    group.add(disk);

    const frame = new THREE.Mesh(
      new THREE.RingGeometry(MOON_R * 0.94, MOON_R * 1.08, 64),
      new THREE.MeshStandardMaterial({ color: COLORS.moonFrame, metalness: 0.9, roughness: 0.25 }),
    );
    frame.position.z = 0.004;
    frame.renderOrder = 4;
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

  buildDayDate() {
    const group = this.buildLabelWindow(0.72, 0.3, '', 0);
    this.dayLabel = this.createTextSprite('MON', 0.17);
    this.dayLabel.position.set(0, 0.07, 0.01);
    group.add(this.dayLabel);

    this.dateLabel = this.createTextSprite('21', 0.2);
    this.dateLabel.position.set(0, -0.07, 0.01);
    group.add(this.dateLabel);
    return group;
  }

  buildLabelWindow(width, height, text, scale) {
    const group = new THREE.Group();
    group.renderOrder = 3;

    const border = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 0.04, height + 0.04),
      new THREE.MeshStandardMaterial({ color: COLORS.case, metalness: 0.9, roughness: 0.3 }),
    );
    border.position.z = -0.002;
    border.renderOrder = 3;
    group.add(border);

    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: COLORS.windowBg }),
    );
    bg.renderOrder = 3;
    group.add(bg);

    if (text) {
      const label = this.createTextSprite(text, scale);
      label.position.z = 0.01;
      group.add(label);
      group.userData.label = label;
    }
    return group;
  }

  createTextSprite(text, scale = 0.25) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scale * 2, scale, 1);
    sprite.renderOrder = 4;
    sprite.userData = { text: null, canvas, ctx, texture };
    this.updateTextSprite(sprite, text);
    return sprite;
  }

  updateTextSprite(sprite, text) {
    if (sprite.userData.text === text) return;
    const { canvas, ctx, texture } = sprite.userData;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = COLORS.windowText;
    ctx.font = '700 84px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 68, 244);
    texture.needsUpdate = true;
    sprite.userData.text = text;
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
    this.moonHoleCover.visible = !showMoon;
    this.dayDateGroup.visible = showDayDate;
    this.monthGroup.visible = showMonth;
    this.yearGroup.visible = showYear;

    if (showMoon && moonPhase !== this.lastMoonPhase) {
      this.updateMoonPhase(moonPhase);
      this.lastMoonPhase = moonPhase;
    }

    this.updateTextSprite(this.dayLabel, DAY_LABELS[dayIndex] ?? 'MON');
    this.updateTextSprite(this.dateLabel, String(dateNum));
    this.updateTextSprite(this.monthLabel, MONTH_LABELS[monthIndex] ?? 'JAN');
    this.updateTextSprite(this.yearLabel, String(year));
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
