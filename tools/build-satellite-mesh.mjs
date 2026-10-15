/* Builds assets/models/cubesat.glb — the hero scene's mesh — from the CubeSat
   model in the orbint-software repo.

   The source is a 1.06 MB PBR asset: 194k triangles, four palette materials,
   hard-edged normals that split nearly every vertex. The hero draws it as a
   hidden-line technical drawing at a few hundred pixels, so none of that
   survives: materials, UVs and normals are dropped, the mesh is welded on
   position alone and decimated, and the shader derives flat normals from
   screen-space derivatives. What ships is positions plus two index buffers —
   the triangles for the fill, and the crease edges for the 1px lines.

   Run from the repo root; the deps are only needed to rebuild the asset:
     npm install --no-save @gltf-transform/core@4 @gltf-transform/functions@4 \
                          @gltf-transform/extensions@4 meshoptimizer@0.24.0
     node tools/build-satellite-mesh.mjs [source.glb] [out.glb]
     rm -rf node_modules package-lock.json

   Default source: ../orbint-software/animations/models-api/data/models/cubesat_export_v0.glb
*/

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, dedup, join } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import { writeFileSync } from 'node:fs';

const SOURCE = process.argv[2] ||
  new URL('../../orbint-software/animations/models-api/data/models/cubesat_export_v0.glb', import.meta.url).pathname;
const OUT = process.argv[3] || new URL('../assets/models/cubesat.glb', import.meta.url).pathname;

const RATIO = 0.08;        // target share of vertices kept
const ERROR = 0.02;        // ceiling, as a fraction of mesh radius
const CREASE_DEG = 75;     // dihedral angle above which an edge is drawn

/* ── read, strip, decimate ─────────────────────────────────────────────── */

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
await MeshoptSimplifier.ready;

const doc = await io.read(SOURCE);
const root = doc.getRoot();

for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    // Normals are what split the vertices: dropping them lets the welder
    // collapse 168k vertices to 96k, which is what frees the simplifier.
    for (const sem of prim.listSemantics()) if (sem !== 'POSITION') prim.setAttribute(sem, null);
    prim.setMaterial(null);
  }
}
await doc.transform(
  prune(), dedup(), join({ keepNamed: false }), weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: ERROR, lockBorder: false })
);

const prims = root.listMeshes().flatMap((m) => m.listPrimitives());
if (prims.length !== 1) throw new Error(`expected one primitive after join, got ${prims.length}`);
const prim = prims[0];

const srcPos = prim.getAttribute('POSITION').getArray();
const srcIdx = Uint32Array.from(prim.getIndices().getArray());
const vertexCount = srcPos.length / 3;

/* The source node carries a scale; bake it in, then centre the model on its
   bounding box and normalise the longest axis to 1 so the runtime places
   satellites in units of their own length. */
const node = root.listNodes().find((n) => n.getMesh());
const [sx, sy, sz] = node ? node.getScale() : [1, 1, 1];
const [tx, ty, tz] = node ? node.getTranslation() : [0, 0, 0];

const pos = new Float32Array(srcPos.length);
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < vertexCount; i++) {
  const v = [srcPos[i * 3] * sx + tx, srcPos[i * 3 + 1] * sy + ty, srcPos[i * 3 + 2] * sz + tz];
  for (let a = 0; a < 3; a++) {
    pos[i * 3 + a] = v[a];
    if (v[a] < min[a]) min[a] = v[a];
    if (v[a] > max[a]) max[a] = v[a];
  }
}
const centre = min.map((lo, a) => (lo + max[a]) / 2);
const span = Math.max(...max.map((hi, a) => hi - min[a]));
for (let i = 0; i < vertexCount; i++) {
  for (let a = 0; a < 3; a++) pos[i * 3 + a] = (pos[i * 3 + a] - centre[a]) / span * 2;
}

/* ── crease edges ──────────────────────────────────────────────────────── */

function faceNormal(a, b, c) {
  const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
  const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
  const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
  const m = Math.hypot(...n) || 1;
  return n.map((k) => k / m);
}

const faces = [];
for (let f = 0; f < srcIdx.length; f += 3) faces.push(faceNormal(srcIdx[f], srcIdx[f + 1], srcIdx[f + 2]));

const byEdge = new Map();   // "lo,hi" → face indices
for (let f = 0; f < srcIdx.length; f += 3) {
  for (let k = 0; k < 3; k++) {
    const a = srcIdx[f + k], b = srcIdx[f + (k + 1) % 3];
    const key = a < b ? `${a},${b}` : `${b},${a}`;
    const seen = byEdge.get(key);
    if (seen) seen.push(f / 3); else byEdge.set(key, [f / 3]);
  }
}

const cosCrease = Math.cos(CREASE_DEG * Math.PI / 180);
const edges = [];
for (const [key, fs] of byEdge) {
  let draw = fs.length === 1;            // an open border is always an outline
  if (!draw && fs.length === 2) {
    const [p, q] = fs.map((i) => faces[i]);
    draw = p[0] * q[0] + p[1] * q[1] + p[2] * q[2] < cosCrease;
  }
  if (draw) { const [a, b] = key.split(','); edges.push(+a, +b); }
}

/* ── write ─────────────────────────────────────────────────────────────── */

const quant = new Int16Array(pos.length);
for (let i = 0; i < pos.length; i++) quant[i] = Math.round(Math.max(-1, Math.min(1, pos[i])) * 32767);

const Idx = vertexCount > 65535 ? Uint32Array : Uint16Array;
const tris = Idx.from(srcIdx);
const lines = Idx.from(edges);

function pad4(n) { return (4 - (n % 4)) % 4; }
const parts = [quant, tris, lines];
const views = [];
let offset = 0;
for (const part of parts) {
  const bytes = part.byteLength;
  views.push({ buffer: 0, byteOffset: offset, byteLength: bytes });
  offset += bytes + pad4(bytes);
}
const bin = new Uint8Array(offset);
for (let i = 0; i < parts.length; i++) bin.set(new Uint8Array(parts[i].buffer, parts[i].byteOffset, parts[i].byteLength), views[i].byteOffset);

const idxComponent = Idx === Uint32Array ? 5125 : 5123;
const gltf = {
  asset: { version: '2.0', generator: 'orbint tools/build-satellite-mesh.mjs' },
  extensionsUsed: ['KHR_mesh_quantization'],
  extensionsRequired: ['KHR_mesh_quantization'],
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'CubeSat' }],
  meshes: [{
    name: 'CubeSat',
    primitives: [
      { attributes: { POSITION: 0 }, indices: 1, mode: 4 },   // fill
      { attributes: { POSITION: 0 }, indices: 2, mode: 1 },   // crease edges
    ],
  }],
  accessors: [
    {
      bufferView: 0, componentType: 5122, normalized: true, count: vertexCount, type: 'VEC3',
      min: [-32767, -32767, -32767], max: [32767, 32767, 32767],
    },
    { bufferView: 1, componentType: idxComponent, count: tris.length, type: 'SCALAR' },
    { bufferView: 2, componentType: idxComponent, count: lines.length, type: 'SCALAR' },
  ],
  bufferViews: views,
  buffers: [{ byteLength: offset }],
};

const json = new TextEncoder().encode(JSON.stringify(gltf));
const jsonPad = pad4(json.length);
const jsonLen = json.length + jsonPad;
const total = 12 + 8 + jsonLen + 8 + bin.length;

const glb = new Uint8Array(total);
const dv = new DataView(glb.buffer);
dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
dv.setUint32(12, jsonLen, true); dv.setUint32(16, 0x4e4f534a, true);
glb.set(json, 20); glb.fill(0x20, 20 + json.length, 20 + jsonLen);
dv.setUint32(20 + jsonLen, bin.length, true); dv.setUint32(24 + jsonLen, 0x004e4942, true);
glb.set(bin, 28 + jsonLen);

writeFileSync(OUT, glb);
console.log(
  `${vertexCount} vertices · ${tris.length / 3} triangles · ${lines.length / 2} crease edges` +
  ` · ${(total / 1024).toFixed(0)} KB`
);
