// 1. Scene, Camera, Render Setup
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(0, 1.2, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);

// 2. Lighting Setup
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(3, 5, 2);
dirLight.castShadow = true;
scene.add(dirLight);

// 3. GLTF 3D Model Loader Setup
let humanAvatar = null;
const loader = new THREE.GLTFLoader();

// models/avatar.glb file එක Load කිරීම
loader.load(
    'models/avatar.glb',
    (gltf) => {
        humanAvatar = gltf.scene;
        humanAvatar.position.set(0, 0, 0);
        humanAvatar.scale.set(1, 1, 1);
        
        scene.add(humanAvatar);
        console.log("3D Avatar Loaded Successfully!");
        updateBodyScale(); // Initial Scaling Apply කිරීම
    },
    (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    (error) => {
        console.error('3D Model Loading Error:', error);
    }
);

// 4. Controls & Input Elements
const heightInput = document.getElementById('height');
const chestInput = document.getElementById('chest');
const waistInput = document.getElementById('waist');
const shirtSizeInput = document.getElementById('shirt-size');

const heightVal = document.getElementById('height-val');
const chestVal = document.getElementById('chest-val');
const waistVal = document.getElementById('waist-val');

const sizeChart = { S: 88, M: 96, L: 104, XL: 112 };

// 5. Logic Functions
function calculateFit() {
    const c = parseFloat(chestInput.value);
    const selectedSize = shirtSizeInput.value;
    const targetChest = sizeChart[selectedSize];

    const recSizeEl = document.getElementById('rec-size');
    const fitStatusEl = document.getElementById('fit-status');

    if (c < 92) recSizeEl.textContent = 'S';
    else if (c < 100) recSizeEl.textContent = 'M';
    else if (c < 108) recSizeEl.textContent = 'L';
    else recSizeEl.textContent = 'XL';

    const diff = c - targetChest;
    if (Math.abs(diff) <= 4) {
        fitStatusEl.textContent = 'Perfect Fit';
        fitStatusEl.className = 'status-fit';
    } else if (diff > 4) {
        fitStatusEl.textContent = 'Too Tight!';
        fitStatusEl.className = 'status-tight';
    } else {
        fitStatusEl.textContent = 'Too Loose!';
        fitStatusEl.className = 'status-loose';
    }
    // Status evaluation and Heatmap Overlay
    if (humanAvatar) {
        humanAvatar.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Math.abs(diff) <= 4) {
                    // Perfect Fit -> Green Overlay
                    child.material.color.setHex(0x22c55e); 
                } else if (diff > 4) {
                    // Too Tight -> Red Overlay
                    child.material.color.setHex(0xef4444); 
                } else {
                    // Too Loose -> Yellow Overlay
                    child.material.color.setHex(0xeab308); 
                }
            }
        });
}

    
}

function updateBodyScale() {
    const h = parseFloat(heightInput.value);
    const c = parseFloat(chestInput.value);
    const w = parseFloat(waistInput.value);

    heightVal.textContent = h;
    chestVal.textContent = c;
    waistVal.textContent = w;

    // 3D Avatar Model එක Scale කිරීම
    if (humanAvatar) {
        const heightScale = h / 170;
        const chestScale = c / 95;
        const waistScale = w / 80;

        humanAvatar.scale.y = heightScale;
        humanAvatar.scale.x = chestScale;
        humanAvatar.scale.z = waistScale;
    }

    calculateFit();
}

function changeColor(colorHex) {
    if (humanAvatar) {
        humanAvatar.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.color.setHex(colorHex);
            }
        });
    }
}

// 6. Event Listeners
heightInput.addEventListener('input', updateBodyScale);
chestInput.addEventListener('input', updateBodyScale);
waistInput.addEventListener('input', updateBodyScale);
shirtSizeInput.addEventListener('change', updateBodyScale);

window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
function addToCart() {
    const selectedSize = shirtSizeInput.value;
    const recSize = document.getElementById('rec-size').textContent;
    
    if(selectedSize !== recSize) {
        alert(`Note: You selected size ${selectedSize}, but your recommended fit is ${recSize}. Added to cart!`);
    } else {
        alert(`Success! Size ${selectedSize} (Perfect Fit) added to your cart.`);
    }
}
animate();