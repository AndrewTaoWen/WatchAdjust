import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const MOON_Y = -0.55;
const MOON_R = 0.19;
const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export class WatchScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.targetDate = new Date();
    this.sceneState = {};
    this.moonDisc = null;
    this.hourHand = null;
    this.minuteHand = null;
    this.secondHand = null;
    this.dayLabel = null;
    this.dateLabel = null;
    this.monthLabel = null;
    this.yearLabel = null;
    this.moonGroup = null;
    this.moonHoleCover = null;
    this.dayDateGroup = null;
    this.monthGroup = null;
    this.yearGroup = null;

    this.init();
  }

  init() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.sortObjects = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0c);

    this.camera = new THREE.PerspectiveCamera(
      35,
      this.canvas.clientWidth / this.canvas.clientHeight,
      0.1,
      100,
    );
    this.camera.position.set(0, 2.8, 4.2);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 8;
    this.controls.maxPolarAngle = Math.PI / 1.8;
    this.controls.target.set(0, 0, 0);

    this.setupLights();
    this.buildWatch();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
    window.addEventListener('resize', () => this.onResize());
  }

  setupLights() {
    const ambient = new THREE.AmbientLight(0xfff5e6, 0.35);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, 5, 4);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xc4d4ff, 0.45);
    fill.position.set(-4, 2, -2);
    this.scene.add(fill);

    const rim = new THREE.PointLight(0xffd699, 0.25, 12);
    rim.position.set(0, 1.5, 3);
    this.scene.add(rim);
  }

  buildWatch() {
    const watch = new THREE.Group();
    this.watchGroup = watch;

    // Case
    const caseGeo = new THREE.CylinderGeometry(1.55, 1.55, 0.28, 64);
    const caseMat = new THREE.MeshStandardMaterial({
      color: 0xc9a962,
      metalness: 0.92,
      roughness: 0.18,
    });
    const caseMesh = new THREE.Mesh(caseGeo, caseMat);
    caseMesh.rotation.x = Math.PI / 2;
    watch.add(caseMesh);

    // Bezel
    const bezelGeo = new THREE.TorusGeometry(1.52, 0.06, 16, 64);
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0xd4af5a,
      metalness: 0.95,
      roughness: 0.12,
    });
    const bezel = new THREE.Mesh(bezelGeo, bezelMat);
    bezel.position.z = 0.12;
    watch.add(bezel);

    // Dial
    const dialGeo = new THREE.CircleGeometry(1.38, 64);
    const dialMat = new THREE.MeshStandardMaterial({
      color: 0x1a1814,
      metalness: 0.15,
      roughness: 0.85,
    });
    const dial = new THREE.Mesh(dialGeo, dialMat);
    dial.position.z = 0.13;
    dial.renderOrder = 1;
    watch.add(dial);

    // Cover moon sub-dial when complication is hidden
    this.moonHoleCover = this.createMoonHoleCover();
    watch.add(this.moonHoleCover);

    // Hour markers
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(i % 3 === 0 ? 0.06 : 0.03, i % 3 === 0 ? 0.22 : 0.14, 0.02),
        new THREE.MeshStandardMaterial({ color: 0xd4c5a0, metalness: 0.8, roughness: 0.3 }),
      );
      marker.position.set(Math.cos(angle) * 1.15, Math.sin(angle) * 1.15, 0.155);
      marker.rotation.z = angle + Math.PI / 2;
      marker.renderOrder = 2;
      watch.add(marker);
    }

    // Hands pivot
    const pivot = new THREE.Group();
    pivot.position.z = 0.19;
    watch.add(pivot);

    this.hourHand = this.createHand(0.55, 0.045, 0xd4c5a0, 4);
    this.minuteHand = this.createHand(0.82, 0.032, 0xe8dcc8, 5);
    this.secondHand = this.createHand(0.9, 0.012, 0xc9a962, 6);

    pivot.add(this.hourHand);
    pivot.add(this.minuteHand);
    pivot.add(this.secondHand);

    // Center cap
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.04, 32),
      caseMat,
    );
    cap.rotation.x = Math.PI / 2;
    cap.position.z = 0.205;
    cap.renderOrder = 7;
    watch.add(cap);

    // Moon phase — disk behind dial, gold frame above
    this.moonGroup = this.buildMoonPhase();
    this.moonGroup.position.set(0, MOON_Y, 0.152);
    watch.add(this.moonGroup);

    // Day-date at 12 o'clock
    this.dayDateGroup = this.buildDayDate();
    this.dayDateGroup.position.set(0, 0.62, 0.165);
    watch.add(this.dayDateGroup);

    // Month at 3 o'clock
    this.monthGroup = this.buildMonthWindow();
    this.monthGroup.position.set(0.75, 0, 0.165);
    watch.add(this.monthGroup);

    // Year at 9 o'clock
    this.yearGroup = this.buildYearWindow();
    this.yearGroup.position.set(-0.75, 0, 0.165);
    watch.add(this.yearGroup);

    // Crown
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.18, 24),
      caseMat,
    );
    crown.rotation.z = Math.PI / 2;
    crown.position.set(1.65, 0, 0);
    watch.add(crown);

    // Crystal dome
    const crystal = new THREE.Mesh(
      new THREE.SphereGeometry(1.42, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2.2),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 0.05,
        transmission: 0.85,
        thickness: 0.2,
        ior: 1.45,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      }),
    );
    crystal.rotation.x = -Math.PI / 2;
    crystal.position.z = 0.22;
    crystal.renderOrder = 20;
    watch.add(crystal);

    watch.rotation.x = -0.35;
    this.scene.add(watch);
  }

  createHand(length, width, color, renderOrder = 4) {
    const geo = new THREE.BoxGeometry(width, length, 0.012);
    geo.translate(0, length / 2, 0);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.25 }),
    );
    mesh.renderOrder = renderOrder;
    return mesh;
  }

  createMoonHoleCover() {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(MOON_R, 48),
      new THREE.MeshBasicMaterial({ color: 0x1a1814 }),
    );
    mesh.position.set(0, MOON_Y, 0.153);
    mesh.renderOrder = 3;
    mesh.visible = false;
    return mesh;
  }

  buildMoonPhase() {
    const group = new THREE.Group();
    group.renderOrder = 3;

    // Recessed pocket ring
    const pocket = new THREE.Mesh(
      new THREE.RingGeometry(MOON_R * 0.98, MOON_R * 1.02, 64),
      new THREE.MeshBasicMaterial({ color: 0x0a0908 }),
    );
    pocket.position.z = -0.001;
    pocket.renderOrder = 2;
    group.add(pocket);

    const { texture, canvas, ctx } = this.createMoonDisplayTexture(0);
    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(MOON_R * 0.96, 96),
      new THREE.MeshBasicMaterial({ map: texture }),
    );
    disk.renderOrder = 3;
    this.moonDisc = disk;
    disk.userData.canvas = canvas;
    disk.userData.ctx = ctx;
    disk.userData.texture = texture;
    group.add(disk);

    const frame = new THREE.Mesh(
      new THREE.RingGeometry(MOON_R * 0.94, MOON_R * 1.06, 64),
      new THREE.MeshBasicMaterial({ color: 0xc9a962 }),
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
    this.drawMoonDisplay(ctx, size / 2, size / 2, size * 0.46, phase);

    const texture = new THREE.CanvasTexture(canvas);
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
    this.drawAccurateMoon(ctx, cx, cy, r * 0.82, phase);
    ctx.restore();
  }

  drawAccurateMoon(ctx, cx, cy, radius, phase) {
    phase = ((phase % 1) + 1) % 1;

    if (phase < 0.008 || phase > 0.992) return;

    ctx.save();
    this.traceLitMoonLobe(ctx, cx, cy, radius, phase);
    const waxing = phase <= 0.5;
    const p = waxing ? phase * 2 : (1 - phase) * 2;
    if (p > 1 && Math.abs(phase - 0.5) >= 0.008) {
      ctx.clip('evenodd');
    } else {
      ctx.clip();
    }
    this.drawLunarSurface(ctx, cx, cy, radius);
    ctx.restore();
  }

  /** Curved terminator — lit portion of the lunar disc. */
  traceLitMoonLobe(ctx, cx, cy, radius, phase) {
    phase = ((phase % 1) + 1) % 1;

    if (Math.abs(phase - 0.5) < 0.008) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      return;
    }

    const waxing = phase <= 0.5;
    const p = waxing ? phase * 2 : (1 - phase) * 2;

    ctx.beginPath();
    if (p <= 1) {
      const theta = Math.acos(Math.max(-1, Math.min(1, 1 - p)));
      const innerR = radius * Math.sin(theta);
      const innerX = cx + (waxing ? 1 : -1) * radius * Math.cos(theta);
      ctx.arc(cx, cy, radius, -Math.PI / 2, Math.PI / 2, waxing);
      ctx.arc(innerX, cy, innerR, Math.PI / 2, -Math.PI / 2, !waxing);
      ctx.closePath();
    } else {
      const p2 = p - 1;
      const theta = Math.acos(Math.max(-1, Math.min(1, 1 - p2)));
      const innerR = radius * Math.sin(theta);
      const innerX = cx + (waxing ? -1 : 1) * radius * Math.cos(theta);
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.arc(innerX, cy, innerR, Math.PI / 2, -Math.PI / 2, waxing);
    }
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

  updateMoonPhase(phase) {
    if (!this.moonDisc) return;
    const { canvas, ctx, texture } = this.moonDisc.userData;
    this.drawMoonDisplay(ctx, canvas.width / 2, canvas.height / 2, canvas.width * 0.46, phase);
    texture.needsUpdate = true;
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
    const group = new THREE.Group();
    group.renderOrder = 3;

    const bg = this.createWindowPlane(0.7, 0.28);
    group.add(bg);

    this.dayLabel = this.createTextSprite('MON', 0.22);
    this.dayLabel.position.set(0, 0.06, 0.01);
    group.add(this.dayLabel);

    this.dateLabel = this.createTextSprite('21', 0.32);
    this.dateLabel.position.set(0, -0.08, 0.01);
    group.add(this.dateLabel);

    return group;
  }

  buildMonthWindow() {
    const group = new THREE.Group();
    group.renderOrder = 3;
    const bg = this.createWindowPlane(0.45, 0.2);
    group.add(bg);
    this.monthLabel = this.createTextSprite('JUN', 0.2);
    this.monthLabel.position.z = 0.01;
    group.add(this.monthLabel);
    return group;
  }

  buildYearWindow() {
    const group = new THREE.Group();
    group.renderOrder = 3;
    const bg = this.createWindowPlane(0.5, 0.2);
    group.add(bg);
    this.yearLabel = this.createTextSprite('2026', 0.18);
    this.yearLabel.position.z = 0.01;
    group.add(this.yearLabel);
    return group;
  }

  createWindowPlane(width, height) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: 0x0d0d0d }),
    );
    mesh.renderOrder = 3;
    return mesh;
  }

  createTextSprite(text, scale = 0.25) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d4c5a0';
    ctx.font = '600 52px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scale * 2.2, scale, 1);
    sprite.renderOrder = 4;
    mat.depthTest = true;
    mat.depthWrite = false;
    sprite.userData.text = text;
    sprite.userData.canvas = canvas;
    sprite.userData.ctx = ctx;
    sprite.userData.texture = texture;
    return sprite;
  }

  updateTextSprite(sprite, text) {
    if (sprite.userData.text === text) return;
    const { canvas, ctx, texture } = sprite.userData;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#d4c5a0';
    ctx.font = '600 52px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 64);
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

    if (this.moonGroup) this.moonGroup.visible = showMoon;
    if (this.moonHoleCover) this.moonHoleCover.visible = !showMoon;
    if (this.dayDateGroup) this.dayDateGroup.visible = showDayDate;
    if (this.monthGroup) this.monthGroup.visible = showMonth;
    if (this.yearGroup) this.yearGroup.visible = showYear;

    this.updateMoonPhase(moonPhase);

    if (this.dayLabel) this.updateTextSprite(this.dayLabel, DAY_LABELS[dayIndex] ?? 'MON');
    if (this.dateLabel) this.updateTextSprite(this.dateLabel, String(dateNum));
    if (this.monthLabel) this.updateTextSprite(this.monthLabel, MONTH_LABELS[monthIndex] ?? 'JAN');
    if (this.yearLabel) this.updateTextSprite(this.yearLabel, String(year));
  }

  updateHands() {
    const d = this.targetDate;
    const hours = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    const minutes = d.getMinutes() + d.getSeconds() / 60;
    const seconds = d.getSeconds();

    if (this.hourHand) this.hourHand.rotation.z = -(hours / 12) * Math.PI * 2;
    if (this.minuteHand) this.minuteHand.rotation.z = -(minutes / 60) * Math.PI * 2;
    if (this.secondHand) this.secondHand.rotation.z = -(seconds / 60) * Math.PI * 2;
  }

  onResize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  animate() {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
    window.removeEventListener('resize', () => this.onResize());
  }
}
