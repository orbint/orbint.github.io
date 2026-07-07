// ── HALFTONE SPECTROGRAM OVERLAY (hero + dark section backgrounds) ──
// Hero: <canvas data-halftone id="hero-halftone"> already in the markup, scrolls with the hero.
// Everything else: any element with [data-halftone-bg] gets a canvas created for it here and
// dropped into the fixed #bg-halftone-layer, so adding the effect to a new section is a
// one-attribute change — no markup or JS to duplicate per section.
(async function () {
  const heroCanvas = document.querySelector('canvas[data-halftone]');
  const bgTargets = Array.from(document.querySelectorAll('[data-halftone-bg]'));
  const layer = document.getElementById('bg-halftone-layer');
  if ((!heroCanvas && !(layer && bgTargets.length)) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const THREE = await import('https://unpkg.com/three@0.160.0/build/three.module.js');

  const CELL_SIZE_PX = 22;
  const MOBILE_BREAKPOINT_PX = 767;
  const MOBILE_CELL_SIZE_PX = 16;
  const NAV_HEIGHT_PX = 64;
  const NAV_HEIGHT_MOBILE_PX = 60;
  const NAV_FADE_BUFFER_PX = 60;

  const VERT = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `;

  const FRAG = `
    precision highp float;
    varying vec2 vUv;
    uniform float uTime;
    uniform vec2  uGrid;
    uniform float uCellAspect;
    uniform vec3  uDotColor;
    uniform float uScroll;
    uniform float uRadiusMin;
    uniform float uRadiusMax;
    uniform float uNoiseAmt;
    uniform float uFalloff;
    uniform float uFadeLeft;
    uniform float uFadeBottom;
    uniform float uNavCutoff;
    uniform float uFadeTop;
    uniform float uOpacity;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i),                  hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }

    float fbm(vec2 p) {
      float v = 0.0;
      v += 0.55 * vnoise(p);
      v += 0.30 * vnoise(p * 2.03 + 17.7);
      v += 0.15 * vnoise(p * 4.11 + 53.1);
      return v;
    }

    float ridge(float f, float center, float width) {
      float d = (f - center) / width;
      return exp(-d * d);
    }

    void main() {
      vec2 g      = vUv * uGrid;
      vec2 cell   = floor(g);
      vec2 cellUV = fract(g) - 0.5;

      float tx   = (cell.x + 0.5) / uGrid.x + uTime * uScroll;
      float freq = 1.0 - (cell.y + 0.5) / uGrid.y;

      float falloff = pow(freq, uFalloff);
      float grain   = fbm(vec2(tx * 9.0, freq * 7.0));

      float f0 = 0.14 + 0.07 * sin(tx * 4.0) + 0.03 * sin(tx * 9.3 + 2.0);
      float h  = 0.0;
      h += 1.00 * ridge(freq, f0,       0.045);
      h += 0.55 * ridge(freq, f0 * 2.0, 0.050);
      h += 0.30 * ridge(freq, f0 * 3.0, 0.055);

      float burstGate = smoothstep(0.78, 0.95, vnoise(vec2(tx * 6.0, 3.3)));
      float burst = burstGate * (0.4 + 0.5 * freq);

      float mag = falloff * (0.18 + uNoiseAmt * grain) + 0.62 * falloff * h + burst;
      mag = clamp(mag, 0.0, 1.0);

      float radius = mix(uRadiusMin, uRadiusMax, mag);

      vec2  corrected = vec2(cellUV.x * uCellAspect, cellUV.y);
      float d         = length(corrected);
      float alpha     = smoothstep(radius, radius - 0.02, d);

      float intensity = 0.35 + 0.65 * mag;

      float fadeLeft   = uFadeLeft   > 0.0 ? smoothstep(0.0, uFadeLeft, vUv.x)         : 1.0;
      float fadeBottom = uFadeBottom > 0.0 ? smoothstep(0.0, uFadeBottom, vUv.y)       : 1.0;
      float fadeTop    = uFadeTop    > 0.0 ? smoothstep(uNavCutoff, uFadeTop, 1.0 - vUv.y) : 1.0;

      gl_FragColor = vec4(uDotColor * intensity, alpha * fadeLeft * fadeBottom * fadeTop * uOpacity);
    }
  `;

  const DEFAULTS = {
    dotColor:   '#ffffff',
    scroll:     0.05,
    radiusMin:  0.0,
    radiusMax:  0.16,
    noiseAmt:   0.4,
    falloff:    1.7,
    fadeLeft:   0.15,
    fadeBottom: 0.3,
    fadeTop:    0.2,
    opacity:    0.14,
    avoidNav:   false, // reserve top clearance for the fixed nav bar
  };

  const instances = []; // { canvas, target } — target is undefined for the hero canvas

  if (heroCanvas) {
    instances.push({ canvas: heroCanvas, cfg: { ...DEFAULTS, fadeBottom: 0.55, fadeTop: 0.2, opacity: 0.2, avoidNav: true } });
  }

  // Per-section tweaks read straight off the target element, e.g. data-halftone-opacity="0.18"
  // — no id-keyed lookup table to keep in sync as sections are added or removed.
  bgTargets.forEach((target) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'bg-halftone';
    layer.appendChild(canvas);
    const cfg = { ...DEFAULTS };
    if (target.dataset.halftoneOpacity) cfg.opacity = parseFloat(target.dataset.halftoneOpacity);
    instances.push({ canvas, cfg, target });
  });

  instances.forEach(({ canvas, cfg, target }) => initHalftone(canvas, cfg, target));

  // The section-backed canvases live in a fixed, full-viewport backdrop layer so the dot
  // pattern stays put while the page scrolls. Only the canvas for whichever section currently
  // has the most visible area is faded in.
  const backdrops = instances.filter((i) => i.target);
  if (backdrops.length) {
    const ratios = new Map(backdrops.map((b) => [b.target, 0]));
    const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => ratios.set(entry.target, entry.intersectionRatio));
      let winner = null, best = 0.05; // dead zone so nothing lights up between sections
      backdrops.forEach(({ target }) => {
        const r = ratios.get(target);
        if (r > best) { best = r; winner = target; }
      });
      backdrops.forEach(({ canvas, target }) => canvas.classList.toggle('is-active', target === winner));
    }, { threshold: THRESHOLDS });

    backdrops.forEach(({ target }) => io.observe(target));
  }

  function initHalftone(canvas, cfg, target) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();

    const uniforms = {
      uTime:       { value: 0 },
      uGrid:       { value: new THREE.Vector2(1, 1) },
      uCellAspect: { value: 1 },
      uDotColor:   { value: new THREE.Color(cfg.dotColor) },
      uScroll:     { value: cfg.scroll },
      uRadiusMin:  { value: cfg.radiusMin },
      uRadiusMax:  { value: cfg.radiusMax },
      uNoiseAmt:   { value: cfg.noiseAmt },
      uFalloff:    { value: cfg.falloff },
      uFadeLeft:   { value: cfg.fadeLeft },
      uFadeBottom: { value: cfg.fadeBottom },
      uNavCutoff:  { value: 0 },
      uFadeTop:    { value: cfg.fadeTop },
      uOpacity:    { value: cfg.opacity },
    };

    scene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true })
    ));

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      const isMobile = w <= MOBILE_BREAKPOINT_PX;
      const cellSize = isMobile ? MOBILE_CELL_SIZE_PX : CELL_SIZE_PX;
      const cols = Math.max(1, Math.round(w / cellSize));
      const rows = Math.max(1, Math.round(h / cellSize));
      renderer.setSize(w, h, false);
      uniforms.uGrid.value.set(cols, rows);
      uniforms.uCellAspect.value = (w / h) * (rows / cols);

      if (cfg.avoidNav) {
        const navHeight = isMobile ? NAV_HEIGHT_MOBILE_PX : NAV_HEIGHT_PX;
        const navCutoffPx = navHeight + cellSize; // safety margin for dot radius bleed
        uniforms.uNavCutoff.value = navCutoffPx / h;
        uniforms.uFadeTop.value = (navCutoffPx + NAV_FADE_BUFFER_PX) / h;
      }
    }

    new ResizeObserver(resize).observe(canvas);
    resize();

    // Backdrop canvases sit in a fixed full-viewport layer, so they're always
    // geometrically "in view" — their real visibility is the .is-active class toggled by
    // the section IntersectionObserver above. The hero canvas has no target section, so it
    // pauses based on its own on-screen presence instead.
    const isBackdrop = !!target;
    let visible = true;
    if (!isBackdrop) {
      new IntersectionObserver((entries) => {
        entries.forEach((entry) => { visible = entry.isIntersecting; });
      }, { rootMargin: '200px 0px' }).observe(canvas);
    }

    const clock = new THREE.Clock();
    (function tick() {
      if (isBackdrop ? canvas.classList.contains('is-active') : visible) {
        uniforms.uTime.value = clock.getElapsedTime();
        renderer.render(scene, camera);
      }
      requestAnimationFrame(tick);
    })();
  }
})();
