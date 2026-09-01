// ==========================================
// 1. SCENE, CAMERA & RENDERER SETUP
// ==========================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.clientWidth, container.clientHeight);

// Enable PCF Soft Shadows
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ==========================================
// 2. LIGHTING & PEDESTAL GRID SETUP
// ==========================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(3, 8, 4);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.bias = -0.001;
scene.add(dirLight);

const rimLight = new THREE.DirectionalLight(0x3b82f6, 0.8);
rimLight.position.set(-3, 3, -4);
scene.add(rimLight);

// Dynamic Pedestal References (Created bigger & assigned after avatar loads)
let gridHelper = null;
let shadowFloor = null;

function setupPedestalFloor(bottomY) {
    if (gridHelper) scene.remove(gridHelper);
    if (shadowFloor) scene.remove(shadowFloor);

    // Lighter & Bigger Floor Grid (Radius 5 instead of 3)
    gridHelper = new THREE.PolarGridHelper(5, 16, 8, 64, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = bottomY;
    scene.add(gridHelper);

    // Bigger Shadow Receiving Floor Mesh
    const shadowFloorGeo = new THREE.CircleGeometry(5, 32);
    const shadowFloorMat = new THREE.ShadowMaterial({ opacity: 0.4 });
    shadowFloor = new THREE.Mesh(shadowFloorGeo, shadowFloorMat);
    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.position.y = bottomY - 0.01;
    shadowFloor.receiveShadow = true;
    scene.add(shadowFloor);
}

// ==========================================
// 3. AVATAR & DATA CONFIGURATION
// ==========================================
let humanAvatar = null;
let selectedBodyType = 'mesomorph';
const loader = new THREE.GLTFLoader();

const avatarModels = {
    men: 'models/avatar.glb',
    women: 'models/avatar.glb',
    kids: 'models/avatar.glb'
};

const bodyTypePresets = {
    men: {
        ectomorph: { height: 70, chest: 35, hip: 35 },
        mesomorph: { height: 69, chest: 40, hip: 38 },
        endomorph: { height: 67, chest: 44, hip: 42 }
    },
    women: {
        ectomorph: { height: 66, chest: 32, hip: 34 },
        mesomorph: { height: 65, chest: 36, hip: 38 },
        endomorph: { height: 63, chest: 42, hip: 44 }
    },
    kids: {
        standard: { height: 48, chest: 24, hip: 25 }
    }
};

const sizeChartInches = { S: 36, M: 39, L: 42, XL: 45 };
const fields = ['height', 'chest', 'hip'];

// Perfectly Center Avatar and Dynamic Floor Grid Position
function centerAndFitModel(object) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Center Avatar strictly in 3D Space (0,0,0)
    object.position.x -= center.x;
    object.position.y -= center.y;
    object.position.z -= center.z;

    // Recalculate Box Boundaries after centering
    box.setFromObject(object);

    // Set Floor Grid perfectly below feet (box.min.y)
    setupPedestalFloor(box.min.y);

    // Orbit controls target human center
    controls.target.set(0, 0, 0);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;

    camera.position.set(0, 0, cameraZ);
    camera.lookAt(0, 0, 0);
    controls.update();
}

function reset3DCamera() {
    if (humanAvatar) {
        centerAndFitModel(humanAvatar);
    }
}

function loadAvatar(category) {
    if (humanAvatar) scene.remove(humanAvatar);

    const modelPath = avatarModels[category] || avatarModels.men;

    loader.load(
        modelPath,
        (gltf) => {
            humanAvatar = gltf.scene;
            
            humanAvatar.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.material = new THREE.MeshStandardMaterial({
                        color: 0xd2a382,
                        roughness: 0.6,
                        metalness: 0.1
                    });
                }
            });

            scene.add(humanAvatar);
            centerAndFitModel(humanAvatar);
            updateBodyScale();
        },
        undefined,
        (error) => console.error('Error loading 3D GLTF Avatar:', error)
    );
}

loadAvatar('men');

// ==========================================
// 4. UI INTERACTION LISTENERS & HANDLERS
// ==========================================
const genderSelect = document.getElementById('gender-type');
const bodyTypeWrapper = document.getElementById('body-type-wrapper');
const shirtSizeInput = document.getElementById('shirt-size');

fields.forEach(field => {
    const slider = document.getElementById(`${field}-slider`);
    const num = document.getElementById(`${field}-num`);

    slider.addEventListener('input', () => {
        num.value = slider.value;
        updateBodyScale();
    });
    num.addEventListener('input', () => {
        slider.value = num.value;
        updateBodyScale();
    });
});

function onUnitChange(field) {
    const num = document.getElementById(`${field}-num`);
    const slider = document.getElementById(`${field}-slider`);
    const unit = document.getElementById(`${field}-unit`).value;

    let currentVal = parseFloat(num.value) || 0;

    if (unit === 'cm') {
        currentVal = Math.round(currentVal * 2.54 * 10) / 10;
        slider.min = field === 'height' ? 120 : 50;
        slider.max = field === 'height' ? 220 : 150;
    } else {
        currentVal = Math.round((currentVal / 2.54) * 10) / 10;
        slider.min = field === 'height' ? 50 : 20;
        slider.max = field === 'height' ? 85 : 60;
    }

    num.value = slider.value = currentVal;
    updateBodyScale();
}

function getValueInInches(field) {
    const numVal = parseFloat(document.getElementById(`${field}-num`).value) || 0;
    const unit = document.getElementById(`${field}-unit`).value;
    return unit === 'cm' ? (numVal / 2.54) : numVal;
}

function selectBodyCard(type) {
    selectedBodyType = type;

    document.querySelectorAll('.body-card').forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-value') === type);
    });

    applyBodyPreset();
}

function applyBodyPreset() {
    const category = genderSelect.value;
    const preset = bodyTypePresets[category]?.[selectedBodyType];

    if (preset) {
        fields.forEach(field => {
            const unit = document.getElementById(`${field}-unit`).value;
            const mult = unit === 'cm' ? 2.54 : 1;
            const val = Math.round(preset[field] * mult * 10) / 10;

            document.getElementById(`${field}-num`).value = val;
            document.getElementById(`${field}-slider`).value = val;
        });
    }

    updateBodyScale();
}

function onGenderChange() {
    const category = genderSelect.value;
    if (category === 'kids') {
        bodyTypeWrapper.style.display = 'none';
        selectedBodyType = 'standard';
    } else {
        bodyTypeWrapper.style.display = 'flex';
        selectedBodyType = 'mesomorph';
        selectBodyCard('mesomorph');
    }
    applyBodyPreset();
    loadAvatar(category);
}

// ==========================================
// 5. 3D SCALING & REALTIME FIT CALCULATIONS
// ==========================================
function updateBodyScale() {
    const hInches = getValueInInches('height');
    const cInches = getValueInInches('chest');
    const hipInches = getValueInInches('hip');

    if (humanAvatar) {
        const scaleY = hInches / 67;               
        const scaleX = cInches / 38;               
        const scaleZ = (hipInches / 38) * 0.95;   

        humanAvatar.scale.set(scaleX, scaleY, scaleZ);

        // Adjust floor dynamic position as avatar height scales
        const box = new THREE.Box3().setFromObject(humanAvatar);
        if (gridHelper && shadowFloor) {
            gridHelper.position.y = box.min.y;
            shadowFloor.position.y = box.min.y - 0.01;
        }
    }

    calculateFit(cInches);
}

function calculateFit(chestInInches) {
    const selectedSize = shirtSizeInput.value;
    const targetChest = sizeChartInches[selectedSize];

    const recSizeEl = document.getElementById('rec-size');
    const fitStatusEl = document.getElementById('fit-status');

    if (!recSizeEl || !fitStatusEl) return;

    if (chestInInches < 37) recSizeEl.textContent = 'S';
    else if (chestInInches < 41) recSizeEl.textContent = 'M';
    else if (chestInInches < 44) recSizeEl.textContent = 'L';
    else recSizeEl.textContent = 'XL';

    const diff = chestInInches - targetChest;
    let heatColor = 0xd2a382; 

    if (Math.abs(diff) <= 1.5) {
        fitStatusEl.textContent = 'Perfect Fit';
        fitStatusEl.className = 'status-fit';
        heatColor = 0x22c55e;
    } else if (diff > 1.5) {
        fitStatusEl.textContent = 'Too Tight!';
        fitStatusEl.className = 'status-tight';
        heatColor = 0xef4444;
    } else {
        fitStatusEl.textContent = 'Too Loose!';
        fitStatusEl.className = 'status-loose';
        heatColor = 0xeab308;
    }

    if (humanAvatar) {
        humanAvatar.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.color.setHex(heatColor);
            }
        });
    }

    const matchPercent = Math.max(50, Math.min(100, Math.round(100 - Math.abs(diff) * 8)));
    const progressFill = document.getElementById('fit-progress-fill');
    const progressText = document.getElementById('fit-match-text');

    if (progressFill && progressText) {
        progressFill.style.width = `${matchPercent}%`;
        progressText.textContent = `${matchPercent}% Match`;
        
        if (matchPercent > 85) progressFill.style.background = '#22c55e';
        else if (matchPercent > 70) progressFill.style.background = '#eab308';
        else progressFill.style.background = '#ef4444';
    }
}

function addToCart() {
    const selectedSize = shirtSizeInput.value;
    const recSize = document.getElementById('rec-size').textContent;
    alert(selectedSize !== recSize ? 
        `Note: You selected size ${selectedSize}, recommended fit is ${recSize}. Added to cart!` : 
        `Success! Size ${selectedSize} (Perfect Fit) added to cart.`);
}

shirtSizeInput.addEventListener('change', updateBodyScale);

window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();