// Scene & Camera Setup
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lighting Setup
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(3, 5, 2);
dirLight.castShadow = true;
scene.add(dirLight);

let humanAvatar = null;
const loader = new THREE.GLTFLoader();

const avatarModels = {
    men: 'models/avatar.glb',
    women: 'models/avatar.glb',
    kids: 'models/avatar.glb'
};

// Preset baseline values in Inches
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

function centerAndFitModel(object) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    object.position.x -= center.x;
    object.position.y -= center.y;
    object.position.z -= center.z;

    controls.target.set(0, 0, 0);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.3;

    camera.position.set(0, 0, cameraZ);
    camera.lookAt(0, 0, 0);
    controls.update();
}

function loadAvatar(category) {
    if (humanAvatar) scene.remove(humanAvatar);

    const modelPath = avatarModels[category] || avatarModels.men;

    loader.load(
        modelPath,
        (gltf) => {
            humanAvatar = gltf.scene;
            
            // Set base skin material color (realistic natural skin tone)
            humanAvatar.traverse((child) => {
                if (child.isMesh) {
                    child.material = new THREE.MeshStandardMaterial({
                        color: 0xd2a382, // Standard Skin Tone Color
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

// UI Controls Mappings
const genderSelect = document.getElementById('gender-type');
const bodyTypeSelect = document.getElementById('body-type');
const bodyTypeWrapper = document.getElementById('body-type-wrapper');
const shirtSizeInput = document.getElementById('shirt-size');

const fields = ['height', 'chest', 'hip'];

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

function populateBodyTypeDropdown(category) {
    bodyTypeSelect.innerHTML = '';

    if (category === 'kids') {
        bodyTypeWrapper.style.display = 'none';
    } else {
        bodyTypeWrapper.style.display = 'flex';
        const options = [
            { value: 'ectomorph', text: 'Ectomorph (Slim / Lean)' },
            { value: 'mesomorph', text: 'Mesomorph (Athletic / Normal)' },
            { value: 'endomorph', text: 'Endomorph (Curvy / Heavy)' }
        ];

        options.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt.value;
            el.textContent = opt.text;
            if (opt.value === 'mesomorph') el.selected = true;
            bodyTypeSelect.appendChild(el);
        });
    }
}

function onGenderChange() {
    const category = genderSelect.value;
    populateBodyTypeDropdown(category);
    onBodyTypeChange();
    loadAvatar(category);
}

function onBodyTypeChange() {
    const category = genderSelect.value;
    const bodyType = category === 'kids' ? 'standard' : bodyTypeSelect.value;
    const preset = bodyTypePresets[category][bodyType];

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

populateBodyTypeDropdown('men');

// 3D Body Scaling & Heatmap Logic
function updateBodyScale() {
    const hInches = getValueInInches('height');
    const cInches = getValueInInches('chest');
    const hipInches = getValueInInches('hip');

    if (humanAvatar) {
        const scaleY = hInches / 67;               
        const scaleX = cInches / 38;               
        const scaleZ = (hipInches / 38) * 0.95;   

        humanAvatar.scale.set(scaleX, scaleY, scaleZ);
    }

    calculateFit(cInches);
}

// Fit Calculation and Material Overlay
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
    let heatColor = 0xd2a382; // Default Skin Tone

    if (Math.abs(diff) <= 1.5) {
        fitStatusEl.textContent = 'Perfect Fit';
        fitStatusEl.className = 'status-fit';
        heatColor = 0x22c55e; // Green Heatmap
    } else if (diff > 1.5) {
        fitStatusEl.textContent = 'Too Tight!';
        fitStatusEl.className = 'status-tight';
        heatColor = 0xef4444; // Red Heatmap
    } else {
        fitStatusEl.textContent = 'Too Loose!';
        fitStatusEl.className = 'status-loose';
        heatColor = 0xeab308; // Yellow Heatmap
    }

    // Apply Heatmap overlay on chest/upper body region while maintaining natural look
    if (humanAvatar) {
        humanAvatar.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.color.setHex(heatColor);
            }
        });
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