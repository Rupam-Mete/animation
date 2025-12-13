// --- CONFIGURATION ---
const PARTICLE_COUNT = 3500;
const PARTICLE_SIZE = 0.25;

// --- THREE.JS SETUP ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
// Wider FOV (Field of View) helps text fit better on small screens
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// --- RESPONSIVE CAMERA LOGIC ---
let isPortrait = window.innerWidth < window.innerHeight;

function handleResize() {
    isPortrait = window.innerWidth < window.innerHeight;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Adjust Camera Z based on screen shape
    // If Portrait (Mobile): Move back to 65 to see more width
    // If Landscape (PC): Move closer to 40
    camera.position.z = isPortrait ? 65 : 40;
}
window.addEventListener('resize', handleResize);
handleResize(); // Run once

// --- PARTICLE SYSTEM ---
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);
const targetPositions = new Float32Array(PARTICLE_COUNT * 3);
const colorBase = new THREE.Color();

for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3] = 0; positions[i * 3 + 1] = 0; positions[i * 3 + 2] = 0;
    
    colorBase.setHSL(Math.random(), 0.8, 0.6);
    colors[i * 3] = colorBase.r;
    colors[i * 3 + 1] = colorBase.g;
    colors[i * 3 + 2] = colorBase.b;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const sprite = new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/disc.png');
const material = new THREE.PointsMaterial({
    size: PARTICLE_SIZE, vertexColors: true, map: sprite,
    alphaTest: 0.5, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

// --- SHAPE GENERATORS ---

// 2D Text Generator
function getTextPoints(text) {
    const canvas = document.createElement('canvas');
    const w = 300, h = 80; // Wider canvas for text
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'black'; ctx.fillRect(0, 0, w, h);
    ctx.font = 'bold 50px Arial'; ctx.fillStyle = 'white';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w/2, h/2);
    
    const data = ctx.getImageData(0, 0, w, h).data;
    const points = [];
    for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
            if (data[(y * w + x) * 4] > 128) {
                points.push({
                    x: (x - w / 2) * 0.35,
                    y: -(y - h / 2) * 0.35,
                    z: 0 
                });
            }
        }
    }
    return points;
}

const pORI = getTextPoints("ORI");
const pBABUI = getTextPoints("BABUI");
const pBUBU = getTextPoints("BUBU");

const shapes = {
    'Sphere': {
        is3D: true, 
        gen: (i) => {
            const r = 12;
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(2 * Math.random() - 1);
            return { x: r * Math.sin(phi) * Math.cos(theta), y: r * Math.sin(phi) * Math.sin(theta), z: r * Math.cos(phi) };
        }
    },
    'Saturn': {
        is3D: true, 
        gen: (i) => {
            if (Math.random() > 0.4) { 
                const angle = Math.random() * Math.PI * 2;
                const r = 14 + Math.random() * 6;
                return { x: Math.cos(angle) * r, y: (Math.random()-0.5)*0.5, z: Math.sin(angle) * r };
            } else { 
                const r = 7;
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.acos(2 * Math.random() - 1);
                return { x: r * Math.sin(phi) * Math.cos(theta), y: r * Math.sin(phi) * Math.sin(theta), z: r * Math.cos(phi) };
            }
        }
    },
    // --- REPLACED CAKE WITH 3D HEART ---
    'Heart': {
        is3D: true,
        gen: (i) => {
            // Heart Formula
            const t = Math.random() * Math.PI * 2;
            let x = 16 * Math.pow(Math.sin(t), 3);
            let y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
            
            // Random internal scaling to fill the volume (makes it solid)
            const scale = Math.sqrt(Math.random()); 
            x *= scale;
            y *= scale;
            
            // Add Z-depth (Thickness)
            // We taper the thickness so it's not a block, but a rounded heart
            const z = (Math.random() - 0.5) * 5 * scale;
            
            // Scale down to fit screen and shift up slightly
            return { x: x * 0.6, y: (y * 0.6) + 2, z: z };
        }
    },
    'ORI': { is3D: false, isText: true, gen: (i) => pORI[i % pORI.length] },
    'BABUI': { is3D: false, isText: true, gen: (i) => pBABUI[i % pBABUI.length] },
    'BUBU': { is3D: false, isText: true, gen: (i) => pBUBU[i % pBUBU.length] }
};

let currentShapeKey = 'Sphere';
let is3DMode = true;

function setShape(key) {
    if (currentShapeKey === key) return;
    
    currentShapeKey = key;
    document.getElementById('shape-name').innerText = key;
    
    const shapeObj = shapes[key];
    is3DMode = shapeObj.is3D;
    
    // SMART SCALING
    // If it's Text AND we are on Mobile (Portrait), scale it down to 60%
    // If it's a 3D object, keep it full size (scale 1.0)
    let scale = 1.0;
    if (shapeObj.isText && isPortrait) {
        scale = 0.6; // Shrink text on mobile
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = shapeObj.gen(i);
        targetPositions[i * 3] = p.x * scale;
        targetPositions[i * 3 + 1] = p.y * scale;
        targetPositions[i * 3 + 2] = p.z * scale;
    }
}

// Init
setShape('Sphere');

// --- HAND TRACKING ---
const videoElement = document.getElementById('input_video');
let canSwitchShape = true;

function onResults(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) return;
    const lm = results.multiHandLandmarks[0];

    const iUp = lm[8].y < lm[6].y;
    const mUp = lm[12].y < lm[10].y;
    const rUp = lm[16].y < lm[14].y;
    const pUp = lm[20].y < lm[18].y;
    const pinch = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);

    // Gestures
    if (iUp && mUp && !rUp && !pUp) setShape("ORI");
    else if (iUp && !mUp && !rUp && !pUp) setShape("BABUI");
    else if (pinch < 0.05 && !mUp && !pUp) setShape("BUBU");
    
    // Cycle Shape (Open Hand - Once)
    else if (iUp && mUp && rUp && pUp) {
        if (canSwitchShape) {
            cycleShape();
            canSwitchShape = false;
        }
    }
    // Reset Trigger (Fist)
    else if (!iUp && !mUp && !rUp && !pUp) {
        canSwitchShape = true;
    }

    // ROTATION CONTROL
    if (is3DMode) {
        // Full rotation for 3D objects
        const handX = lm[9].x; 
        const handY = lm[9].y;
        
        const targetRotY = (handX - 0.5) * 3;
        const targetRotX = (handY - 0.5) * 3;
        
        particles.rotation.y += (targetRotY - particles.rotation.y) * 0.05;
        particles.rotation.x += (targetRotX - particles.rotation.x) * 0.05;
    } else {
        // Flatten rotation for Text/2D to ensure readability
        particles.rotation.x += (0 - particles.rotation.x) * 0.1;
        particles.rotation.y += (0 - particles.rotation.y) * 0.1;
        particles.rotation.z += (0 - particles.rotation.z) * 0.1;
    }
}

// --- UPDATED CYCLE LIST WITH HEART ---
const cycleList = ['Sphere', 'Saturn', 'Heart'];
let cycleIdx = 0;
function cycleShape() {
    cycleIdx = (cycleIdx + 1) % cycleList.length;
    setShape(cycleList[cycleIdx]);
}

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5 });
hands.onResults(onResults);

const cameraUtils = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 640, height: 480
});
cameraUtils.start();

// --- ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);

    const pos = geometry.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
        pos[i] += (targetPositions[i] - pos[i]) * 0.08;
    }
    geometry.attributes.position.needsUpdate = true;

    if (is3DMode) {
        particles.rotation.z += 0.001; // Subtle idle spin for 3D
    }

    renderer.render(scene, camera);
}
animate();