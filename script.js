// ==========================================
// 1. SCENE, CAMERA & RENDERER SETUP
// ==========================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// LIGHTING & PEDESTAL
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(3, 8, 4);
dirLight.castShadow = true;
scene.add(dirLight);

const rimLight = new THREE.DirectionalLight(0x3b82f6, 0.8);
rimLight.position.set(-3, 3, -4);
scene.add(rimLight);

let gridHelper = null;
let shadowFloor = null;

function setupPedestalFloor(bottomY) {
    if (gridHelper) scene.remove(gridHelper);
    if (shadowFloor) scene.remove(shadowFloor);

    gridHelper = new THREE.PolarGridHelper(5, 16, 8, 64, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = bottomY;
    scene.add(gridHelper);

    const shadowFloorGeo = new THREE.CircleGeometry(5, 32);
    const shadowFloorMat = new THREE.ShadowMaterial({ opacity: 0.4 });
    shadowFloor = new THREE.Mesh(shadowFloorGeo, shadowFloorMat);
    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.position.y = bottomY - 0.01;
    shadowFloor.receiveShadow = true;
    scene.add(shadowFloor);
}

// ==========================================
// 2. DATA CONFIGURATION
// ==========================================
let humanAvatar = null;
let selectedBodyType = 'mesomorph';
let currentProductCategory = 'top';
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
        standard: { height: 42, chest: 24, hip: 25 } // 42 inches = ~106cm (Standard Kids Height)
    }
};

const shirtSizeChart = { 'XS': 34, 'S': 36, 'M': 39, 'L': 42, 'XL': 45, 'XXL': 48 };
const trouserSizeChart = { '28 W': 28, '30 W': 30, '32 W': 32, '34 W': 34, '36 W': 36, '38 W': 38 };
const fields = ['height', 'chest', 'hip'];

function centerAndFitModel(object) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    object.position.x -= center.x;
    object.position.y -= center.y;
    object.position.z -= center.z;

    setupPedestalFloor(box.min.y - center.y);

    controls.target.set(0, 0, 0);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.25;

    camera.position.set(0, 0, cameraZ);
    camera.lookAt(0, 0, 0);
    controls.update();
}

function reset3DCamera() {
    if (humanAvatar) centerAndFitModel(humanAvatar);
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
                        color: 0xd2a382, roughness: 0.6, metalness: 0.1
                    });
                }
            });

            scene.add(humanAvatar);
            updateBodyScale();
            centerAndFitModel(humanAvatar);
        },
        undefined,
        (error) => {
            console.error('Error loading avatar GLB:', error);
        }
    );
}

// ==========================================
// 3. DYNAMIC URL PARSER & PRODUCT ENGINE
// ==========================================
function loadProductFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    
    const pTitle = urlParams.get('title') || 'Casual Polo T-Shirt';
    const pPrice = urlParams.get('price') || 'Rs. 3,490.00';
    currentProductCategory = urlParams.get('category') || 'top'; 

    document.getElementById('product-title-display').textContent = pTitle;
    document.getElementById('product-price-display').textContent = pPrice;

    const chestGroup = document.getElementById('group-chest');
    const garmentSizeSelect = document.getElementById('garment-size');

    garmentSizeSelect.innerHTML = '';

    if (currentProductCategory === 'bottom') {
        if (chestGroup) chestGroup.style.display = 'none';

        Object.keys(trouserSizeChart).forEach(size => {
            const opt = document.createElement('option');
            opt.value = size; opt.textContent = size;
            garmentSizeSelect.appendChild(opt);
        });
    } else {
        if (chestGroup) chestGroup.style.display = 'block';

        Object.keys(shirtSizeChart).forEach(size => {
            const opt = document.createElement('option');
            opt.value = size; opt.textContent = size;
            garmentSizeSelect.appendChild(opt);
        });
    }

    updateBodyScale();
}

// ==========================================
// 4. UI EVENT LISTENERS
// ==========================================
fields.forEach(field => {
    const slider = document.getElementById(`${field}-slider`);
    const num = document.getElementById(`${field}-num`);

    if (slider && num) {
        slider.addEventListener('input', () => { num.value = slider.value; updateBodyScale(); });
        num.addEventListener('input', () => { slider.value = num.value; updateBodyScale(); });
    }
});

function adjustSliderRangesForCategory(category) {
    const heightSlider = document.getElementById('height-slider');
    const heightUnit = document.getElementById('height-unit')?.value;

    if (!heightSlider) return;

    if (category === 'kids') {
        if (heightUnit === 'cm') {
            heightSlider.min = 60;
            heightSlider.max = 140;
        } else {
            heightSlider.min = 24;
            heightSlider.max = 55;
        }
    } else {
        if (heightUnit === 'cm') {
            heightSlider.min = 120;
            heightSlider.max = 220;
        } else {
            heightSlider.min = 50;
            heightSlider.max = 85;
        }
    }
}

function onUnitChange(field) {
    const num = document.getElementById(`${field}-num`);
    const slider = document.getElementById(`${field}-slider`);
    const unitObj = document.getElementById(`${field}-unit`);
    const genderSelect = document.getElementById('gender-type');
    if (!num || !slider || !unitObj) return;

    const unit = unitObj.value;
    let currentVal = parseFloat(num.value) || 0;
    const isKids = genderSelect?.value === 'kids';

    if (unit === 'cm') {
        currentVal = Math.round(currentVal * 2.54 * 10) / 10;
        if (field === 'height') {
            slider.min = isKids ? 60 : 120;
            slider.max = isKids ? 140 : 220;
        } else {
            slider.min = 30;
            slider.max = 150;
        }
    } else {
        currentVal = Math.round((currentVal / 2.54) * 10) / 10;
        if (field === 'height') {
            slider.min = isKids ? 24 : 50;
            slider.max = isKids ? 55 : 85;
        } else {
            slider.min = 12;
            slider.max = 60;
        }
    }

    num.value = slider.value = currentVal;
    updateBodyScale();
}

function getValueInInches(field) {
    const numEl = document.getElementById(`${field}-num`);
    const unitEl = document.getElementById(`${field}-unit`);
    if (!numEl || !unitEl) return 0;
    const numVal = parseFloat(numEl.value) || 0;
    return unitEl.value === 'cm' ? (numVal / 2.54) : numVal;
}

function selectBodyCard(type) {
    selectedBodyType = type;
    document.querySelectorAll('.body-card').forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-value') === type);
    });
    applyBodyPreset();
}

function applyBodyPreset() {
    const genderSelect = document.getElementById('gender-type');
    const category = genderSelect ? genderSelect.value : 'men';
    const preset = bodyTypePresets[category]?.[selectedBodyType];

    if (preset) {
        fields.forEach(field => {
            const unitEl = document.getElementById(`${field}-unit`);
            const numEl = document.getElementById(`${field}-num`);
            const sliderEl = document.getElementById(`${field}-slider`);

            if (unitEl && numEl && sliderEl) {
                const mult = unitEl.value === 'cm' ? 2.54 : 1;
                const val = Math.round(preset[field] * mult * 10) / 10;
                numEl.value = val;
                sliderEl.value = val;
            }
        });
    }
    updateBodyScale();
}

function onGenderChange() {
    const genderSelect = document.getElementById('gender-type');
    const bodyTypeWrapper = document.getElementById('body-type-wrapper');
    const category = genderSelect.value;

    adjustSliderRangesForCategory(category);

    if (category === 'kids') {
        if (bodyTypeWrapper) bodyTypeWrapper.style.display = 'none';
        selectedBodyType = 'standard';
    } else {
        if (bodyTypeWrapper) bodyTypeWrapper.style.display = 'block';
        selectedBodyType = 'mesomorph';
        selectBodyCard('mesomorph');
    }
    applyBodyPreset();
    loadAvatar(category);
}

// ==========================================
// 5. SCALING & FIT ANALYSIS ENGINE
// ==========================================
function updateBodyScale() {
    const hInches = getValueInInches('height');
    const cInches = getValueInInches('chest');
    const hipInches = getValueInInches('hip');

    if (humanAvatar) {
        const scaleY = hInches / 69; 
        const scaleX = cInches / 40; 
        const scaleZ = hipInches / 38; 

        humanAvatar.scale.set(scaleX, scaleY, scaleZ);

        const box = new THREE.Box3().setFromObject(humanAvatar);
        if (gridHelper && shadowFloor) {
            gridHelper.position.y = box.min.y;
            shadowFloor.position.y = box.min.y - 0.01;
        }
    }

    calculateFit(cInches, hipInches);
}

function calculateFit(chestInInches, hipInches) {
    const garmentSizeInput = document.getElementById('garment-size');
    if (!garmentSizeInput) return;

    const selectedSize = garmentSizeInput.value;
    const recSizeEl = document.getElementById('rec-size');
    const fitStatusEl = document.getElementById('fit-status');

    if (!recSizeEl || !fitStatusEl) return;

    let targetMeasurement = 0;
    let userMeasurement = 0;

    if (currentProductCategory === 'bottom') {
        userMeasurement = hipInches;

        if (hipInches < 29) recSizeEl.textContent = '28 W';
        else if (hipInches < 31) recSizeEl.textContent = '30 W';
        else if (hipInches < 33) recSizeEl.textContent = '32 W';
        else if (hipInches < 35) recSizeEl.textContent = '34 W';
        else if (hipInches < 37) recSizeEl.textContent = '36 W';
        else recSizeEl.textContent = '38 W';

        targetMeasurement = trouserSizeChart[selectedSize] || 32;
    } else {
        userMeasurement = chestInInches;

        if (chestInInches < 35) recSizeEl.textContent = 'XS';
        else if (chestInInches < 38) recSizeEl.textContent = 'S';
        else if (chestInInches < 41) recSizeEl.textContent = 'M';
        else if (chestInInches < 44) recSizeEl.textContent = 'L';
        else if (chestInInches < 47) recSizeEl.textContent = 'XL';
        else recSizeEl.textContent = 'XXL';

        targetMeasurement = shirtSizeChart[selectedSize] || 39;
    }

    const diff = userMeasurement - targetMeasurement;
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
    const garmentSizeInput = document.getElementById('garment-size');
    const selectedSize = garmentSizeInput ? garmentSizeInput.value : '';
    const recSize = document.getElementById('rec-size').textContent;
    alert(selectedSize !== recSize ?
        `Note: You selected size ${selectedSize}, recommended fit is ${recSize}. Added to cart!` :
        `Success! Size ${selectedSize} (Perfect Fit) added to cart.`);
}

const gSelect = document.getElementById('garment-size');
if (gSelect) gSelect.addEventListener('change', updateBodyScale);

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

// INITIALIZATION
loadProductFromURL();
loadAvatar('men');