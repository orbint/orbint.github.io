/* ORBINT — the hero constellation.

   The hero field already stands in for one equirectangular projection of the
   globe: script.js reads the pointer out as a latitude and a longitude. Three
   CubeSats fly above that map in formation — an equilateral cluster, one
   fixed separation, every belly pointing the same way down at the ground.

   On load the three fly in from wide and close up into formation, turning
   onto station as they come; after that the cluster is rigid, and scrolling
   the hero away slews all three together, the way a real constellation is
   turned onto a target rather than flown apart. The pointer is left to the
   cursor readout.

   They are drawn as a hidden-line technical illustration — a near-paper fill
   in a few quantised tones, and the model's hard edges as 1px lines in the
   site's own rule grey. Both are read off the CSS custom properties, so the
   scene cannot drift away from the palette.

   Progressive enhancement throughout: without modules, WebGL2, or the mesh,
   the hero is the type on the paper, which is what it was before. */

const MESH_URL = 'assets/models/cubesat.glb';

/* The formation, in fractions of the hero field so the composition survives
   every viewport. The cluster is an equilateral triangle of `spread`
   circumradius, lying in a plane tilted towards the reader, and every
   satellite is the same `size` and the same attitude — which is the whole
   point of a formation. */
const FORMATION = {
  centre: [0.505, 0.385],   /* the cluster's centroid across the field */
  spread: 1.100,            /* circumradius of the triangle */
  size: 0.118,              /* each satellite's length */
  phase: 3.578,             /* which way round the triangle sits */
  plane: [0.10, 1.10],      /* the formation plane's normal, x and y of it */
};

/* The same formation over a portrait field — the phone, where the hero is one
   centred column of type. The satellite is the same drawing at the same size;
   what changes is the angle the formation is seen from. Tilting the plane the
   other way stands the triangle up, so it frames a column of type instead of
   straddling a band of it: the pair above the headline, the single below, and
   the spread opening until the headline is inside it. */
const PORTRAIT = {
  phase: Math.PI / 2,       /* two high, one low, as it stands on the desktop */
  plane: [1.10, 0.10],      /* the same tilt, taken about the other axis */
  size: 0.70,               /* of the size it is drawn at elsewhere: a small field */
  margin: 0.94,             /* of the width it is offered, so it clears the margins */
  legible: 0.18,            /* of the field's width; narrower than this is dirt, not a drawing */
};

/* The satellite's own half-extents on screen, in units of its length: a long
   flat thing lying across the field, drawn a little wider than its own frame
   by the attitude it holds and the perspective it is seen in. Measured off
   the render, and generous on purpose — it is what keeps the outer pair off
   the margins. */
const BODY = { across: 1.25, down: 0.60 };

/* The model: its solar array lies in the Y–Z plane, and the bus with its two
   antennas stands off the +X face — so +X is the belly. It points down the
   field at the map and well over towards the reader, which is the attitude
   that shows the payload side rather than the back of the array. The array
   itself runs across the field, on the heading. */
const BELLY = [0.12, -0.80, 0.59];
const HEADING = [1, 0, 0];
const TURN = Math.PI;             /* turn about the vertical, after the above */

const FOV = 20 * Math.PI / 180;   /* narrow: near-axonometric, as a drawing is */
const CAMERA_Z = 12;
const LIGHT = norm([-0.35, 0.72, 0.60]);
const STEPS = 4;                  /* tones in the quantised shading */
const MAX_DPR = 2;

/* The arrival. The formation starts this far off its own pose — turned round
   in its plane, opened wider, banked — and closes onto it over `ms`. */
const ARRIVE = { ms: 2600, spin: 1.1, spread: 0.85, yaw: -0.42, pitch: 0.28 };

/* The slew, at the moment the hero has scrolled fully away: the turn in the
   plane, the pitch, and how far the cluster rises, in half-fields. */
const SLEW = { spin: 0.45, pitch: 0.32, rise: 0.30 };

/* ── vector and matrix helpers ─────────────────────────────────────────── */

function norm(v) {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
}

function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] +
                       a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect; out[5] = f; out[11] = -1;
  out[10] = (far + near) / (near - far);
  out[14] = 2 * far * near / (near - far);
  return out;
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/* Rotations are carried as 3×3 bases, column by column: each column is where
   one model axis lands in the world. Composing two is the usual product. */
function rotate(a, b) {
  const out = [];
  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 3; r++) {
      out[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2];
    }
  }
  return out;
}

function apply(basis, v) {
  return [
    basis[0] * v[0] + basis[3] * v[1] + basis[6] * v[2],
    basis[1] * v[0] + basis[4] * v[1] + basis[7] * v[2],
    basis[2] * v[0] + basis[5] * v[1] + basis[8] * v[2],
  ];
}

/* A turn about the world Y axis — the vertical — so it swings the satellite
   round on the spot without tipping it. */
function turn(angle) {
  const [s, c] = [Math.sin(angle), Math.cos(angle)];
  return [c, 0, -s, 0, 1, 0, s, 0, c];
}

/* Pitch about the world X axis, then yaw about Y: how the cluster banks. */
function bank(pitch, yaw) {
  const [sp, cp] = [Math.sin(pitch), Math.cos(pitch)];
  const [sy, cy] = [Math.sin(yaw), Math.cos(yaw)];
  return rotate(
    [1, 0, 0, 0, cp, sp, 0, -sp, cp],
    [cy, 0, -sy, 0, 1, 0, sy, 0, cy]
  );
}

/* The attitude every satellite in the formation holds: the belly on the given
   heading, and the solar array squared up to it. */
function attitude(belly, heading) {
  const x = norm(belly);
  const along = norm(heading);
  const dot = along[0] * x[0] + along[1] * x[1] + along[2] * x[2];
  const z = norm(along.map((c, i) => c - x[i] * dot));
  return [...x, ...cross(z, x), ...z];
}

/* Model matrix from a basis, a position and a uniform scale. */
function compose(basis, pos, scale) {
  const m = new Float32Array(16);
  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 3; r++) m[c * 4 + r] = basis[c * 3 + r] * scale;
  }
  m[12] = pos[0]; m[13] = pos[1]; m[14] = pos[2]; m[15] = 1;
  return m;
}

/* ── the mesh ──────────────────────────────────────────────────────────── */

/* A GLB reader for exactly the file tools/build-satellite-mesh.mjs writes:
   one mesh, one quantised POSITION accessor, a TRIANGLES primitive and a
   LINES primitive over it. Anything else is not our asset, and we stop. */
async function loadMesh(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const buf = await res.arrayBuffer();
  const view = new DataView(buf);

  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLen = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  const binOffset = 20 + jsonLen + 8;

  const read = (accessorIndex, Type) => {
    const accessor = json.accessors[accessorIndex];
    const bv = json.bufferViews[accessor.bufferView];
    const components = accessor.type === 'VEC3' ? 3 : 1;
    return new Type(buf, binOffset + (bv.byteOffset || 0), accessor.count * components);
  };

  const [fill, lines] = json.meshes[0].primitives;
  const Index = json.accessors[fill.indices].componentType === 5125 ? Uint32Array : Uint16Array;
  return {
    positions: read(fill.attributes.POSITION, Int16Array),
    tris: read(fill.indices, Index),
    lines: lines ? read(lines.indices, Index) : null,
  };
}

/* ── shaders ───────────────────────────────────────────────────────────── */

/* Positions arrive as normalised shorts; the attribute pointer dequantises
   them, so the vertex shader sees the model in its own -1..1 frame. */
const VERT = `#version 300 es
in vec3 aPos;
uniform mat4 uModel, uViewProj;
out vec3 vWorld;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vWorld = world.xyz;
  gl_Position = uViewProj * world;
}`;

/* No normals are shipped: the facet normal is the cross product of the
   screen-space derivatives of the world position, which is exactly the flat
   shading a drawing wants. N·L is then quantised into a few tones, and the
   whole ramp is set per satellite, so distance reads as less contrast. */
const FRAG_FILL = `#version 300 es
precision highp float;
in vec3 vWorld;
uniform vec3 uLight, uEye, uLit, uShade;
uniform float uSteps;
out vec4 fragColor;
void main() {
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (dot(n, uEye - vWorld) < 0.0) n = -n;
  float lambert = dot(n, uLight) * 0.5 + 0.5;
  float band = floor(clamp(lambert, 0.0, 0.999) * uSteps) / (uSteps - 1.0);
  fragColor = vec4(mix(uShade, uLit, band), 1.0);
}`;

const FRAG_LINE = `#version 300 es
precision highp float;
in vec3 vWorld;
uniform vec3 uInk;
out vec4 fragColor;
void main() { fragColor = vec4(uInk, 1.0); }`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'shader compile failed');
  }
  return shader;
}

function program(gl, fragSource, uniforms) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fragSource));
  gl.bindAttribLocation(prog, 0, 'aPos');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) || 'program link failed');
  }
  const at = {};
  for (const name of uniforms) at[name] = gl.getUniformLocation(prog, name);
  return { prog, at };
}

/* The cluster: an equilateral triangle in the plan's own plane, which the bank
   then carries as one piece. Offsets are in units of the circumradius, so the
   separation is fixed and only the scale of the whole rig changes. `reach` is
   how far those offsets land from the centroid on screen, up, down and across
   — measured off the triangle rather than guessed at, so the framing knows
   exactly how much room the formation is asking for. */
function rig(plan) {
  const normal = norm([plan.plane[0], plan.plane[1], 1]);
  const across = norm(cross(normal, Math.abs(normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const down = cross(normal, across);
  /* `spin` turns the triangle round in its own plane, off its station. */
  const station = (i, spin = 0) => {
    const angle = plan.phase + spin + i * 2 * Math.PI / 3;
    const [c, s] = [Math.cos(angle), Math.sin(angle)];
    return across.map((a, k) => a * c + down[k] * s);
  };
  const stations = [0, 1, 2].map((i) => station(i));
  const xs = stations.map((p) => p[0]);
  const ys = stations.map((p) => p[1]);
  return {
    station,
    reach: {
      across: (Math.max(...xs) - Math.min(...xs)) / 2,
      shift: (Math.max(...xs) + Math.min(...xs)) / 2,   /* off centre, and by how much */
      up: Math.max(...ys),
      down: -Math.min(...ys),
    },
  };
}

/* The two the page uses: the composition the formation was drawn for, and the
   same triangle stood up for a column of type. */
const LANDSCAPE = rig(FORMATION);
const TALL = rig(PORTRAIT);

/* ── colour ────────────────────────────────────────────────────────────── */

/* The scene borrows the page's greys rather than restating them. */
function token(styles, name, fallback) {
  const value = styles.getPropertyValue(name).trim() || fallback;
  const hex = value.replace('#', '');
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
  const n = parseInt(full, 16);
  if (!isFinite(n)) return [0, 0, 0];
  /* sRGB to linear: the framebuffer is sRGB-encoded on output, so the
     uniforms have to be linear for the tones to land where the tokens are. */
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((c) => c / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
}

function mixRGB(a, b, t) { return a.map((c, i) => c + (b[i] - c) * t); }

/* While the boot screen holds the page, the formation waits, and sets out as
   it lifts — on its timer or on a click, whichever comes first. A mesh that
   arrives after that does not wait at all. */
function afterIntro(fn) {
  const root = document.documentElement;
  const done = () => !root.classList.contains('has-intro') || root.classList.contains('intro-lifted');
  if (done()) return fn();
  const observer = new MutationObserver(() => {
    if (!done()) return;
    observer.disconnect();
    fn();
  });
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });
}

/* ── the scene ─────────────────────────────────────────────────────────── */

function start(canvas, mesh, reduceMotion) {
  const gl = canvas.getContext('webgl2', {
    alpha: true, antialias: true, premultipliedAlpha: true,
    depth: true, powerPreference: 'low-power',
  });
  if (!gl) return;

  const styles = getComputedStyle(document.documentElement);
  const paper = token(styles, '--paper', '#FFFFFF');
  const rule = token(styles, '--rule', '#C4C4C4');
  const ink55 = token(styles, '--ink-55', '#6E6E6E');

  const fill = program(gl, FRAG_FILL, ['uModel', 'uViewProj', 'uLight', 'uEye', 'uLit', 'uShade', 'uSteps']);
  const line = program(gl, FRAG_LINE, ['uModel', 'uViewProj', 'uInk']);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const positions = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positions);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.SHORT, true, 0, 0);

  const triBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.tris, gl.STATIC_DRAW);

  let lineBuffer = null;
  if (mesh.lines) {
    lineBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.lines, gl.STATIC_DRAW);
  }
  const indexType = mesh.tris instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  /* The fill is pushed back a hair so the edges sit on it instead of in it. */
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(1.2, 1.2);
  gl.clearColor(0, 0, 0, 0);

  /* Every satellite in the formation holds the same attitude. */
  const hold = rotate(turn(TURN), attitude(BELLY, HEADING));

  const sats = [0, 1, 2].map(() => ({ pos: [0, 0, 0], scale: 1 }));

  let viewProj = null, width = 0, height = 0, halfH = 0, aspect = 1;
  let centre = [0, 0, 0], spread = 0, size = 0, drawn = true;
  let cluster = LANDSCAPE;

  const field = canvas.parentElement;
  const head = field.querySelector('.hero-grid');
  const foot = field.querySelector('.hero-colophon');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (w === width && h === height) return false;

    width = canvas.width = w;
    height = canvas.height = h;
    gl.viewport(0, 0, w, h);

    aspect = w / h;
    const proj = perspective(FOV, aspect, 0.1, 100);
    const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -CAMERA_Z, 1]);
    viewProj = multiply(proj, view);

    /* The cluster flies over the plane z = 0, which is the map. At that
       distance the field is 2·tan(fov/2)·CAMERA_Z tall, and that is what turns
       a fraction of the hero into a position in the world — so the formation
       holds its place in the composition whatever the viewport does. */
    halfH = Math.tan(FOV / 2) * CAMERA_Z;
    return true;
  }

  /* What the type leaves the drawing, in world units: where the middle of the
     headline block sits, and how much clear field there is above it and below
     it before the credits. Measured rather than assumed, because the headline
     breaks to a different number of lines on every phone. */
  function room() {
    const box = canvas.getBoundingClientRect();
    if (!box.height) return { mid: 0, half: 0, above: 0, below: 0 };
    const type = head.getBoundingClientRect();
    const credits = foot ? foot.getBoundingClientRect().top : box.bottom;
    const perPx = 2 * halfH / box.height;
    return {
      mid: (box.top + box.bottom - type.top - type.bottom) / 2 * perPx,
      half: type.height / 2 * perPx,
      above: Math.max(type.top - box.top, 0) * perPx,
      below: Math.max(credits - type.bottom, 0) * perPx,
    };
  }

  /* Framing. The satellite is the same drawing at the same size either way — a
     fixed fraction of the field's height. Landscape is the composition the
     formation was drawn for and is left alone. Portrait sets the cluster on
     the headline instead and opens it until the headline is inside it, as far
     as the width and the field above and below the type will take. */
  function fit() {
    const natural = FORMATION.size * halfH;
    size = natural;
    drawn = true;

    if (aspect >= 1 || !head) {
      cluster = LANDSCAPE;
      centre = [
        (FORMATION.centre[0] * 2 - 1) * halfH * aspect,
        (1 - FORMATION.centre[1] * 2) * halfH,
        0,
      ];
      spread = FORMATION.spread * halfH;
      return;
    }

    cluster = TALL;
    const small = natural * PORTRAIT.size;
    const { mid, half, above, below } = room();
    const { across, shift, up, down } = cluster.reach;

    /* The satellite first. It is small here by design, and smaller still if
       the field cannot hold the triangle open around the type at that size —
       the width, which the pair runs into, or the clear field above and below
       the block. Solved rather than guessed at, because the block is a
       different height on every phone. */
    const reach = up + down;
    const taper = across / reach;
    const halfW = halfH * aspect * PORTRAIT.margin;
    size = Math.min(
      small,
      (halfW - 2 * taper * half) / (1 + 2 * taper * BODY.down),
      Math.min(above, below) / (2 * BODY.down),
    );

    /* Then the spread. The pair is hung one satellite clear of the top of the
       block, which fixes the centroid; the triangle then opens as far as the
       margins and the credits allow, so it frames the type instead of
       huddling around it. Both bounds are wide enough to clear the block by
       construction — that is what the size above was solved for. */
    const clear = half + BODY.down * size;
    spread = Math.min(
      (halfW - BODY.across * size) / across,
      (2 * half + below) * PORTRAIT.margin / reach,
    );
    centre = [-shift * spread, mid + clear - up * spread, 0];

    /* Squeezed past the size at which the drawing reads as a drawing — on a
       field too short to hold the type and the formation both — it is not
       drawn at all. */
    drawn = BODY.across * size > PORTRAIT.legible * halfH * aspect;
  }

  /* Placing the cluster: the bank turns the whole rig — the stations around
     the centroid and the attitude they all hold — as one body. The pose adds
     what the arrival and the scroll have still to take up: a turn of the
     triangle in its plane, how much wider than its own it is open, and how
     far it has risen. */
  function place(pose) {
    const banked = bank(pose.pitch, pose.yaw);
    const basis = rotate(banked, hold);
    const at = [centre[0], centre[1] + pose.rise * halfH, centre[2]];
    sats.forEach((sat, i) => {
      const offset = apply(banked, cluster.station(i, pose.spin));
      sat.pos = at.map((c, k) => c + offset[k] * spread * pose.open);
      /* Perspective already makes the near one larger; scale is the same for
         all three, because they are the same satellite. */
      sat.scale = size;
      sat.basis = basis;
    });
  }

  function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!drawn) return;
    gl.bindVertexArray(vao);

    for (const sat of sats) {
      const model = compose(sat.basis, sat.pos, sat.scale);
      /* Aerial perspective: the further back in the cluster a satellite
         flies, the fainter it is drawn. */
      const near = 1 - 0.34 * Math.max(0, Math.min(1, 0.5 - sat.pos[2] / (2 * spread)));

      gl.useProgram(fill.prog);
      gl.uniformMatrix4fv(fill.at.uModel, false, model);
      gl.uniformMatrix4fv(fill.at.uViewProj, false, viewProj);
      gl.uniform3fv(fill.at.uLight, LIGHT);
      gl.uniform3f(fill.at.uEye, 0, 0, CAMERA_Z);
      gl.uniform3fv(fill.at.uLit, mixRGB(paper, rule, 0.05 * near));
      gl.uniform3fv(fill.at.uShade, mixRGB(paper, ink55, 0.32 * near));
      gl.uniform1f(fill.at.uSteps, STEPS);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triBuffer);
      gl.drawElements(gl.TRIANGLES, mesh.tris.length, indexType, 0);

      if (!lineBuffer) continue;
      gl.useProgram(line.prog);
      gl.uniformMatrix4fv(line.at.uModel, false, model);
      gl.uniformMatrix4fv(line.at.uViewProj, false, viewProj);
      gl.uniform3fv(line.at.uInk, mixRGB(paper, ink55, 0.72 * near));
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineBuffer);
      gl.drawElements(gl.LINES, mesh.lines.length, indexType, 0);
    }
  }

  /* How much of the arrival is still to come — 1 before the formation sets
     out, 0 once it is on station — and how far the hero has scrolled away,
     0 to 1. Between them they are the whole of the motion. */
  let ahead = reduceMotion ? 0 : 1;
  let away = 0;

  function pose() {
    return {
      spin: ahead * ARRIVE.spin + away * SLEW.spin,
      open: 1 + ahead * ARRIVE.spread,
      yaw: ahead * ARRIVE.yaw,
      pitch: ahead * ARRIVE.pitch + away * SLEW.pitch,
      rise: away * SLEW.rise,
    };
  }

  let refit = true;

  function render() {
    if (resize() || refit) { fit(); refit = false; }
    place(pose());
    draw();
  }

  /* A resize is the one thing that can invalidate a settled frame without the
     page moving. Observing the box beats measuring it every frame, which
     would force a layout on each one. */
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(() => { refit = true; render(); });
    observer.observe(canvas);
    /* The type is watched as well: a headline that rewraps moves the band
       without the field ever changing size. */
    if (head) observer.observe(head);
  } else {
    window.addEventListener('resize', () => { refit = true; render(); });
  }
  render();
  if (reduceMotion) return;

  /* ── motion ──────────────────────────────────────────────────────────── */

  const hero = field.closest('.hero') || field;
  function scrolled() {
    const box = hero.getBoundingClientRect();
    return box.height ? Math.min(1, Math.max(0, -box.top / box.height)) : 0;
  }
  away = scrolled();

  /* The arrival, once, after the boot screen has lifted. Eased out hard, so
     the formation lands on station rather than stops at it. Its frame loop
     ends with it: a formation on station is a still drawing. */
  let begin = null;
  function arrive(now) {
    if (begin === null) begin = now;
    const t = Math.min(1, (now - begin) / ARRIVE.ms);
    ahead = Math.pow(1 - t, 4);
    render();
    if (t < 1) requestAnimationFrame(arrive);
  }
  afterIntro(() => requestAnimationFrame(arrive));

  /* The slew follows the scroll: one frame per frame at most, and none once
     the hero is gone, since every position past it is the same. */
  let queued = false;
  window.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const next = scrolled();
      if (next === away) return;
      away = next;
      if (!ahead) render();   /* while it arrives, the arrival draws */
    });
  }, { passive: true });
}

/* ── entry ─────────────────────────────────────────────────────────────── */

const canvas = document.querySelector('.hero-scene');
if (canvas) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  /* The hero holds the screen in portrait too, so width is no longer the
     question — height is. Below the stylesheet's own threshold the headline
     fills the field on its own and nothing is fetched. */
  const tall = window.matchMedia('(min-height: 480px)');
  let loading = false;

  function load() {
    if (loading || saveData || !tall.matches) return;
    loading = true;
    loadMesh(new URL(MESH_URL, document.baseURI).href)
      .then((mesh) => {
        start(canvas, mesh, reduceMotion);
        canvas.classList.add('is-ready');
      })
      .catch(() => { /* the hero is the type on the paper, as before */ });
  }

  tall.addEventListener('change', load);
  load();
}
