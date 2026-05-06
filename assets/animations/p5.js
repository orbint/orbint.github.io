let angle = 0;
const earthRadius = 80;
let camX = 0, camY = 0, camZoom = 1;
const PAN_SPEED = 5;
let worldBorders = null;
let globeLon = 10, globeLat = 45;

async function initGlobe() {
    const world = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
        .then(r => r.json());
    worldBorders = topojson.mesh(world, world.objects.countries);
}

document.getElementById('lonSlider').addEventListener('input', function() {
    document.getElementById('lonVal').textContent = this.value;
    globeLon = parseInt(this.value);
});
document.getElementById('latSlider').addEventListener('input', function() {
    document.getElementById('latVal').textContent = this.value;
    globeLat = parseInt(this.value);
});

initGlobe();

let groundStations = [];
let vicActiveIndex = -1;

let emitters = [];

function addEmitter(deg) {
    const rad = -deg * Math.PI / 180;
    emitters.push({
        angleDeg: deg,
        x: Math.cos(rad) * earthRadius,
        y: Math.sin(rad) * earthRadius,
        surfaceAngle: rad
    });
    renderEmitterList();
}

function removeEmitter(i) {
    emitters.splice(i, 1);
    renderEmitterList();
}

function renderEmitterList() {
    const list = document.getElementById('emitterList');
    list.innerHTML = '';
    emitters.forEach((em, i) => {
        const el = document.createElement('div');
        el.style.cssText = 'border-top:1px solid var(--col-faint);padding-top:6px;margin-top:4px;';
        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:12px">${em.angleDeg}°</span>
                <button onclick="removeEmitter(${i})"
                    style="background:transparent;border:none;color:var(--col);font-family:monospace;font-size:14px;cursor:pointer;opacity:0.7;padding:0 4px;line-height:1;">×</button>
            </div>`;
        list.appendChild(el);
    });
}

function addGroundStation(deg, vicinity = 100, elevMin = 5) {
    const rad = -deg * Math.PI / 180;
    groundStations.push({
        angleDeg: deg,
        x: Math.cos(rad) * earthRadius,
        y: Math.sin(rad) * earthRadius,
        surfaceAngle: rad,
        vicinity,
        elevMin
    });
    renderGsList();
}

function removeGroundStation(i) {
    groundStations.splice(i, 1);
    renderGsList();
}

function renderGsList() {
    const list = document.getElementById('gsList');
    list.innerHTML = '';
    groundStations.forEach((gs, i) => {
        const el = document.createElement('div');
        el.style.cssText = 'border-top:1px solid var(--col-faint);padding-top:6px;margin-top:4px;';
        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="font-size:12px">${gs.angleDeg}°</span>
                <button onclick="removeGroundStation(${i})"
                    style="background:transparent;border:none;color:var(--col);font-family:monospace;font-size:14px;cursor:pointer;opacity:0.7;padding:0 4px;line-height:1;">×</button>
            </div>
            <div class="rgb-row">
                <label style="width:28px;font-size:11px">Vic</label>
                <input type="range" min="20" max="300" value="${gs.vicinity}" style="width:100px"
                    oninput="groundStations[${i}].vicinity=parseInt(this.value);this.nextElementSibling.textContent=this.value"
                    onpointerdown="vicActiveIndex=${i}" onpointerup="vicActiveIndex=-1">
                <span style="width:28px">${gs.vicinity}</span>
            </div>
            <div class="rgb-row">
                <label style="width:28px;font-size:11px">Elev</label>
                <input type="range" min="0" max="90" value="${gs.elevMin}" style="width:100px"
                    oninput="groundStations[${i}].elevMin=parseInt(this.value);this.nextElementSibling.textContent=this.value+'°'">
                <span style="width:28px">${gs.elevMin}°</span>
            </div>`;
        list.appendChild(el);
    });
}

function getElevation(satX, satY, gs) {
    const nx = Math.cos(gs.surfaceAngle), ny = Math.sin(gs.surfaceAngle);
    const dx = satX - gs.x, dy = satY - gs.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d === 0) return 0;
    return Math.asin(Math.max(-1, Math.min(1, (dx * nx + dy * ny) / d))) * 180 / Math.PI;
}

let speedSlider, orbitSlider;
let speedVal, orbitVal;

let currentColor = { r: 255, g: 165, b: 0 };
let lineThickness = 0.25;

// ── Color picker wiring ──────────────────────────────────────
function toHex(n) { return n.toString(16).padStart(2, '0').toUpperCase(); }

function applyColor(r, g, b) {
    currentColor = { r, g, b };
    const rgb   = `rgb(${r},${g},${b})`;
    const faint = `rgba(${r},${g},${b},0.3)`;
    const bg08  = `rgba(${r},${g},${b},0.08)`;
    document.documentElement.style.setProperty('--col',       rgb);
    document.documentElement.style.setProperty('--col-faint', faint);
    document.documentElement.style.setProperty('--col-08',    bg08);
    document.getElementById('swatch').style.background = rgb;
}

function syncFromSliders() {
    const r = parseInt(document.getElementById('rSlider').value);
    const g = parseInt(document.getElementById('gSlider').value);
    const b = parseInt(document.getElementById('bSlider').value);
    document.getElementById('rVal').textContent = r;
    document.getElementById('gVal').textContent = g;
    document.getElementById('bVal').textContent = b;
    const hex = toHex(r) + toHex(g) + toHex(b);
    const hexInput = document.getElementById('hexInput');
    hexInput.value = hex;
    hexInput.classList.remove('invalid');
    applyColor(r, g, b);
}

function syncFromHex(raw) {
    const hexInput = document.getElementById('hexInput');
    const cleaned = raw.replace(/[^0-9a-fA-F]/g, '');
    if (cleaned.length !== 6) { hexInput.classList.add('invalid'); return; }
    hexInput.classList.remove('invalid');
    const r = parseInt(cleaned.slice(0,2), 16);
    const g = parseInt(cleaned.slice(2,4), 16);
    const b = parseInt(cleaned.slice(4,6), 16);
    document.getElementById('rSlider').value = r;
    document.getElementById('gSlider').value = g;
    document.getElementById('bSlider').value = b;
    document.getElementById('rVal').textContent = r;
    document.getElementById('gVal').textContent = g;
    document.getElementById('bVal').textContent = b;
    applyColor(r, g, b);
}

document.getElementById('rSlider').addEventListener('input', syncFromSliders);
document.getElementById('gSlider').addEventListener('input', syncFromSliders);
document.getElementById('bSlider').addEventListener('input', syncFromSliders);
document.getElementById('hexInput').addEventListener('input', e => syncFromHex(e.target.value));
document.getElementById('thickSlider').addEventListener('input', function() {
    lineThickness = Number.parseFloat(this.value);
    document.getElementById('thickVal').textContent = lineThickness;
});

// ── p5 sketch ────────────────────────────────────────────────
function setup() {
    createCanvas(windowWidth, windowHeight);

    addGroundStation(90);

    document.getElementById('gsAddBtn').addEventListener('click', () => {
        const deg = parseFloat(document.getElementById('gsAngleInput').value) || 0;
        addGroundStation(deg);
    });

    document.getElementById('emAddBtn').addEventListener('click', () => {
        const deg = parseFloat(document.getElementById('emAngleInput').value) || 0;
        addEmitter(deg);
    });

    speedSlider = document.getElementById('speedSlider');
    orbitSlider = document.getElementById('orbitSlider');
    speedVal    = document.getElementById('speedVal');
    orbitVal    = document.getElementById('orbitVal');

    // Zoom so default orbit fills ~85% of the shorter screen edge
    const initOrbitKm = 100 * Math.pow(422, parseInt(document.getElementById('orbitSlider').value) / 100);
    const initOrbitRadius = earthRadius + initOrbitKm * earthRadius / 6371;
    camZoom = min(width, height) / 2 * 0.85 / initOrbitRadius;

    speedSlider.addEventListener('input', () => {
        const v = parseInt(speedSlider.value);
        const s = v === 0 ? 0 : Math.round(Math.pow(10, 1 + v / 100 * 4));
        speedVal.textContent = s.toLocaleString() + 'x';
    });
    orbitSlider.addEventListener('input', () => {
        const km = Math.round(100 * Math.pow(422, parseInt(orbitSlider.value) / 100));
        orbitVal.textContent = km.toLocaleString() + ' km';
    });
}

function draw() {
    const PX_TO_M = 6371000 / earthRadius;
    const orbitKm = 100 * Math.pow(422, parseInt(orbitSlider.value) / 100);
    let orbitRadius = earthRadius + orbitKm * earthRadius / 6371;
    const r_m = orbitRadius * PX_TO_M;
    const omega = Math.sqrt(3.986004418e14 / (r_m * r_m * r_m)); // rad/s
    const sv = parseInt(speedSlider.value);
    const simSpeed = sv === 0 ? 0 : Math.pow(10, 1 + sv / 100 * 4);
    let orbitSpeed = omega * simSpeed / 60; // rad/frame at 60 fps
    let { r, g, b } = currentColor;

    // WASD pan + +/- zoom (skip when an input is focused)
    if (document.activeElement.tagName !== 'INPUT') {
        if (keyIsDown(87)) camY += PAN_SPEED; // W
        if (keyIsDown(83)) camY -= PAN_SPEED; // S
        if (keyIsDown(65)) camX += PAN_SPEED; // A
        if (keyIsDown(68)) camX -= PAN_SPEED; // D
        if (keyIsDown(187) || keyIsDown(61))  camZoom = constrain(camZoom * 1.02, 0.1, 20); // +
        if (keyIsDown(189) || keyIsDown(173)) camZoom = constrain(camZoom * 0.98, 0.1, 20); // -
    }

    background(0);
    translate(width / 2 + camX, height / 2 + camY);
    scale(camZoom);

    // 1. Draw Earth
    if (worldBorders) {
        const proj = d3.geoOrthographic()
            .scale(earthRadius)
            .translate([0, 0])
            .clipAngle(90)
            .rotate([-globeLon, -globeLat]);
        const geoPath = d3.geoPath(proj, drawingContext);
        drawingContext.save();
        drawingContext.fillStyle = '#000';
        drawingContext.beginPath(); geoPath({ type: 'Sphere' }); drawingContext.fill();
        drawingContext.strokeStyle = `rgb(${r},${g},${b})`;
        drawingContext.lineWidth = lineThickness;
        drawingContext.beginPath(); geoPath(worldBorders); drawingContext.stroke();
        drawingContext.restore();
    }
    stroke(r, g, b);
    strokeWeight(lineThickness);
    noFill();
    circle(0, 0, earthRadius * 2);

    // 2. Draw Ground Stations
    for (let i = 0; i < groundStations.length; i++) {
        const gs = groundStations[i];
        drawDish(gs.x, gs.y, gs.surfaceAngle, r, g, b);
        if (vicActiveIndex === i) {
            noFill();
            stroke(r, g, b, 80);
            strokeWeight(lineThickness);
            circle(gs.x, gs.y, gs.vicinity * 2);
        }
    }

    // 3. Draw Emitters
    for (const em of emitters) {
        drawEmitterWaves(em.x, em.y, em.surfaceAngle, r, g, b);
        drawAntenna(em.x, em.y, em.surfaceAngle, r, g, b);
    }

    // 4. Calculate Satellite Position
    let satX = cos(angle) * orbitRadius;
    let satY = sin(angle) * orbitRadius;

    // 5. Draw Orbit Path (Faint)
    noFill();
    stroke(r, g, b, 50);
    strokeWeight(lineThickness);
    circle(0, 0, orbitRadius * 2);

    // 6. Check Proximity & Elevation, Draw Signal
    for (const gs of groundStations) {
        const d = dist(satX, satY, gs.x, gs.y);
        const elev = getElevation(satX, satY, gs);
        if (d < gs.vicinity && elev >= gs.elevMin) {
            const tipX = Math.cos(gs.surfaceAngle) * (earthRadius + 2.5);
            const tipY = Math.sin(gs.surfaceAngle) * (earthRadius + 2.5);
            drawDashedLine(satX, satY, tipX, tipY, r, g, b);
        }
    }

    // 7. Draw Satellite
    fill(r, g, b);
    noStroke();
    rectMode(CENTER);
    square(satX, satY, 2.5);

    angle += orbitSpeed;
}

function drawDish(x, y, surfaceAngle, r, g, b) {
    push();
    translate(x, y);
    rotate(surfaceAngle + HALF_PI);
    stroke(r, g, b);
    strokeWeight(lineThickness);
    noFill();

    // mast
    line(0, 0, 0, -3.5);
    // dish face (bowl toward Earth, opening toward space)
    arc(0, -3.5, 5, 4, 0.35, PI - 0.35);
    // struts from mast to dish rim
    line(0, -2, -2.35, -2.8);
    line(0, -2,  2.35, -2.8);
    // focal point
    circle(0, -4.3, 0.6);

    pop();
}

function drawAntenna(x, y, surfaceAngle, r, g, b) {
    push();
    translate(x, y);
    rotate(surfaceAngle + HALF_PI);
    stroke(r, g, b);
    strokeWeight(lineThickness);
    noFill();

    // mast
    line(0, 0, 0, -3.5);
    // crossbar
    line(-1.25, -2.75, 1.25, -2.75);
    // diagonal struts
    line(-1.25, -2.75, -0.5, -1);
    line(1.25, -2.75, 0.5, -1);

    pop();
}

function drawEmitterWaves(x, y, surfaceAngle, r, g, b) {
    push();
    translate(x, y);
    rotate(surfaceAngle + HALF_PI);

    const tipY = -3.5;
    const period = 100;
    const numWaves = 3;
    const maxR = 8;

    noFill();
    strokeWeight(lineThickness);
    for (let i = 0; i < numWaves; i++) {
        const t = ((frameCount + i * (period / numWaves)) % period) / period;
        const wr = t * maxR;
        const alpha = (1 - t) * 180;
        stroke(r, g, b, alpha);
        arc(0, tipY, wr * 2, wr * 2, PI, TWO_PI);
    }

    pop();
}

function drawDashedLine(x1, y1, x2, y2, r, g, b) {
    stroke(r, g, b);
    strokeWeight(lineThickness);
    const dashLen = 1, gapLen = 3;
    const d = dist(x1, y1, x2, y2);
    if (d === 0) return;
    const dx = (x2 - x1) / d, dy = (y2 - y1) / d;
    let pos = 0;
    while (pos < d) {
        const end = min(pos + dashLen, d);
        line(x1 + dx * pos, y1 + dy * pos, x1 + dx * end, y1 + dy * end);
        pos += dashLen + gapLen;
    }
}

let isDraggingCanvas = false;

function mousePressed(event) {
    isDraggingCanvas = event.target.tagName === 'CANVAS';
}

function mouseDragged() {
    if (isDraggingCanvas) {
        camX += movedX;
        camY += movedY;
        return false;
    }
}

function mouseWheel(event) {
    const zoomFactor = event.delta > 0 ? 0.9 : 1.1;
    const worldX = (mouseX - width / 2 - camX) / camZoom;
    const worldY = (mouseY - height / 2 - camY) / camZoom;
    camZoom = constrain(camZoom * zoomFactor, 0.1, 20);
    camX = mouseX - width / 2 - worldX * camZoom;
    camY = mouseY - height / 2 - worldY * camZoom;
    return false; // prevent page scroll
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}
