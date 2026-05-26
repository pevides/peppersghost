import * as THREE from 'three';
import { AnaglyphEffect } from 'three/addons/effects/AnaglyphEffect.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

//////////////////////
/* GLOBAL VARIABLES */
//////////////////////
let scene;
let camera;
let renderer;
let anaglyphEffect;
let modelRoot;
let currentMesh;
let ambientLight;
let directionalLight;
let pointLight;
let spotLight;
let tesseractNormalMap;

const state = {
    modelIndex: 0,
    materialIndex: 2,
    lights: {
        directional: true,
        point: true,
        spot: false
    },
    anaglyph: false
};

const COLORS = {
    BLACK: 0x000000
};

const MODEL_LIBRARY = [
    {
        label: 'Tesseracto',
        createObject3D: () => createTesseract()
    },
    {
        label: 'Gato',
        createObject3D: () => createCatModel()
    },
    {
        label: 'Cubo',
        createObject3D: () => new THREE.Mesh(new THREE.BoxGeometry(7.2, 7.2, 7.2), createMaterial())
    }
];

const MATERIAL_LIBRARY = [
    {
        label: 'Basic',
        createMaterial: () => new THREE.MeshBasicMaterial({ color: 0xf4f4f0 })
    },
    {
        label: 'Phong',
        createMaterial: () => new THREE.MeshPhongMaterial({
            color: 0x7fd3ff,
            specular: 0xffffff,
            shininess: 85
        })
    },
    {
        label: 'Standard',
        createMaterial: () => new THREE.MeshStandardMaterial({
            color: 0xd8b46a,
            metalness: 0.22,
            roughness: 0.38
        })
    },
    {
        label: 'Metal',
        createMaterial: () => new THREE.MeshPhysicalMaterial({
            color: 0xc9d2e3,
            metalness: 1,
            roughness: 0.16,
            clearcoat: 0.6,
            clearcoatRoughness: 0.2
        })
    }
];

/////////////////////
/* CREATE SCENE(S) */
/////////////////////
function createScene() {
    'use strict';
    scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.BLACK);

    modelRoot = new THREE.Group();
    scene.add(modelRoot);

    ambientLight = new THREE.AmbientLight(0xffffff, 0.32);
    scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(6, 10, 8);
    scene.add(directionalLight);

    pointLight = new THREE.PointLight(0xffc96d, 45, 60, 2);
    pointLight.position.set(-8, 5, 9);
    scene.add(pointLight);

    spotLight = new THREE.SpotLight(0x88b8ff, 120, 80, Math.PI / 5, 0.45, 1.2);
    spotLight.position.set(0, 12, 12);
    spotLight.target.position.set(0, 0, 0);
    scene.add(spotLight);
    scene.add(spotLight.target);

    refreshLightStates();
    loadModel(state.modelIndex);
}

//////////////////////
/* CREATE CAMERA(S) */
//////////////////////
function createCamera() {
    'use strict';
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 16);
    camera.lookAt(0, 0, 0);
}

////////////////////////
/* CREATE OBJECT3D(S) */
////////////////////////
function createMaterial() {
    return MATERIAL_LIBRARY[state.materialIndex].createMaterial();
}

function createGeometryForPyramid() {
    return new THREE.ConeGeometry(4.5, 9, 4);
}

function createGeometryForCube() {
    return new THREE.BoxGeometry(7.2, 7.2, 7.2);
}

function createConcentricNormalMap() {
    if (tesseractNormalMap) {
        return tesseractNormalMap;
    }

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    const imageData = context.createImageData(size, size);
    const data = imageData.data;
    const center = size * 0.5;
    const frequency = 18;
    const strength = 7.5;
    const epsilon = 1;

    function sampleHeight(x, y) {
        const dx = (x - center) / center;
        const dy = (y - center) / center;
        const radius = Math.sqrt(dx * dx + dy * dy);
        return Math.sin(radius * frequency) * 0.5 + Math.cos(radius * frequency * 0.5) * 0.5;
    }

    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            const heightLeft = sampleHeight(Math.max(x - epsilon, 0), y);
            const heightRight = sampleHeight(Math.min(x + epsilon, size - 1), y);
            const heightUp = sampleHeight(x, Math.max(y - epsilon, 0));
            const heightDown = sampleHeight(x, Math.min(y + epsilon, size - 1));

            const dx = (heightRight - heightLeft) * strength;
            const dy = (heightDown - heightUp) * strength;
            const nx = -dx;
            const ny = -dy;
            const nz = 1.0;
            const length = Math.sqrt(nx * nx + ny * ny + nz * nz);

            const offset = (y * size + x) * 4;
            data[offset] = ((nx / length) * 0.5 + 0.5) * 255;
            data[offset + 1] = ((ny / length) * 0.5 + 0.5) * 255;
            data[offset + 2] = ((nz / length) * 0.5 + 0.5) * 255;
            data[offset + 3] = 255;
        }
    }

    context.putImageData(imageData, 0, 0);
    tesseractNormalMap = new THREE.CanvasTexture(canvas);
    tesseractNormalMap.colorSpace = THREE.SRGBColorSpace;
    tesseractNormalMap.wrapS = THREE.RepeatWrapping;
    tesseractNormalMap.wrapT = THREE.RepeatWrapping;

    return tesseractNormalMap;
}

function createQuadGeometry(points) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        points[0][0], points[0][1], points[0][2],
        points[1][0], points[1][1], points[1][2],
        points[2][0], points[2][1], points[2][2],
        points[3][0], points[3][1], points[3][2]
    ]), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
        0, 0,
        1, 0,
        1, 1,
        0, 1
    ]), 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();
    return geometry;
}

function createCubeShell(size, material, partName) {
    const group = new THREE.Group();
    group.userData.part = partName;

    const h = size * 0.5;
    const vertices = {
        ppp: [h, h, h],
        ppm: [h, h, -h],
        pmp: [h, -h, h],
        pmm: [h, -h, -h],
        mpp: [-h, h, h],
        mpm: [-h, h, -h],
        mmp: [-h, -h, h],
        mmm: [-h, -h, -h]
    };

    const faces = [
        [vertices.mpp, vertices.ppp, vertices.pmp, vertices.mmp],
        [vertices.mpm, vertices.ppm, vertices.ppp, vertices.mpp],
        [vertices.mmm, vertices.mmp, vertices.pmp, vertices.pmm],
        [vertices.ppm, vertices.pmm, vertices.mmm, vertices.mpm],
        [vertices.mpm, vertices.mpp, vertices.mmp, vertices.mmm],
        [vertices.ppp, vertices.ppm, vertices.pmm, vertices.pmp]
    ];

    faces.forEach((facePoints, index) => {
        const faceGeometry = createQuadGeometry(facePoints);
        const faceMesh = new THREE.Mesh(faceGeometry, material);
        faceMesh.name = `${partName}-face-${index}`;
        faceMesh.userData.part = partName;
        group.add(faceMesh);
    });

    return group;
}

function createTesseractFaceMaterial(partName) {
    const palette = [
        { color: 0x88d8ff, emissive: 0x061018, roughness: 0.42, metalness: 0.06 },
        { color: 0xffc77a, emissive: 0x120b04, roughness: 0.36, metalness: 0.12 },
        { color: 0xc4c8ff, emissive: 0x0b0c16, roughness: 0.25, metalness: 0.18 },
        { color: 0xe4e4e4, emissive: 0x101010, roughness: 0.2, metalness: 0.22 }
    ];
    const preset = palette[state.materialIndex] || palette[2];
    const opacityByPart = {
        outer: 0.38,
        inner: 0.24,
        bridge: 0.16
    };

    return new THREE.MeshStandardMaterial({
        color: preset.color,
        emissive: preset.emissive,
        roughness: preset.roughness,
        metalness: preset.metalness,
        transparent: true,
        opacity: opacityByPart[partName] || 0.2,
        side: THREE.DoubleSide,
        normalMap: createConcentricNormalMap(),
        normalScale: new THREE.Vector2(0.9, 0.9)
    });
}

function createTesseractMaterials() {
    return {
        outer: createTesseractFaceMaterial('outer'),
        inner: createTesseractFaceMaterial('inner'),
        bridge: createTesseractFaceMaterial('bridge'),
        line: new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.35
        })
    };
}

function createTesseract() {
    const tesseract = new THREE.Group();
    tesseract.userData.modelType = 'tesseract';

    const materials = createTesseractMaterials();
    tesseract.userData.tesseractMaterials = materials;

    const outerShell = createCubeShell(7.8, materials.outer, 'outer');
    const innerShell = createCubeShell(4.2, materials.inner, 'inner');

    tesseract.add(outerShell);
    tesseract.add(innerShell);

    const outerHalf = 7.8 * 0.5;
    const innerHalf = 4.2 * 0.5;
    const vertexPairs = [
        [[ outerHalf,  outerHalf,  outerHalf ], [ innerHalf,  innerHalf,  innerHalf ]],
        [[ outerHalf,  outerHalf, -outerHalf ], [ innerHalf,  innerHalf, -innerHalf ]],
        [[ outerHalf, -outerHalf,  outerHalf ], [ innerHalf, -innerHalf,  innerHalf ]],
        [[ outerHalf, -outerHalf, -outerHalf ], [ innerHalf, -innerHalf, -innerHalf ]],
        [[-outerHalf,  outerHalf,  outerHalf ], [-innerHalf,  innerHalf,  innerHalf ]],
        [[-outerHalf,  outerHalf, -outerHalf ], [-innerHalf,  innerHalf, -innerHalf ]],
        [[-outerHalf, -outerHalf,  outerHalf ], [-innerHalf, -innerHalf,  innerHalf ]],
        [[-outerHalf, -outerHalf, -outerHalf ], [-innerHalf, -innerHalf, -innerHalf ]]
    ];

    const bridgeGeometry = new THREE.BufferGeometry();
    const bridgePositions = new Float32Array(vertexPairs.length * 2 * 3);

    vertexPairs.forEach((pair, index) => {
        const outerPoint = pair[0];
        const innerPoint = pair[1];
        const offset = index * 6;
        bridgePositions[offset] = outerPoint[0];
        bridgePositions[offset + 1] = outerPoint[1];
        bridgePositions[offset + 2] = outerPoint[2];
        bridgePositions[offset + 3] = innerPoint[0];
        bridgePositions[offset + 4] = innerPoint[1];
        bridgePositions[offset + 5] = innerPoint[2];
    });

    bridgeGeometry.setAttribute('position', new THREE.BufferAttribute(bridgePositions, 3));
    const bridgeLines = new THREE.LineSegments(bridgeGeometry, materials.line);
    bridgeLines.userData.part = 'bridge';
    tesseract.add(bridgeLines);

    return tesseract;
}

function createCatModel() {
    const catGroup = new THREE.Group();
    catGroup.userData.modelType = 'cat';
    catGroup.userData.rotationAxis = 'y';

    const loader = new OBJLoader();
    const whiteMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.65,
        metalness: 0.02
    });

    loader.load(
        'js/cat.obj',
        (object) => {
            if (currentMesh !== catGroup) {
                return;
            }

            object.traverse((child) => {
                if (child.isMesh) {
                    child.material = whiteMaterial;
                    child.castShadow = false;
                    child.receiveShadow = false;
                }
            });

            const box = new THREE.Box3().setFromObject(object);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const largestDimension = Math.max(size.x, size.y, size.z);
            const scale = 8 / largestDimension;

            object.position.sub(center);
            object.scale.setScalar(scale);

            catGroup.add(object);
        },
        undefined,
        () => {
            console.error('Failed to load cat.obj');
        }
    );

    return catGroup;
}

function updateTesseractMaterials(object3D) {
    const previousMaterials = object3D.userData.tesseractMaterials;
    const nextMaterials = createTesseractMaterials();

    object3D.traverse((child) => {
        if (!child.isMesh) {
            return;
        }

        if (child.userData.part === 'outer') {
            child.material = nextMaterials.outer;
        } else if (child.userData.part === 'inner') {
            child.material = nextMaterials.inner;
        }
    });

    if (previousMaterials) {
        previousMaterials.outer.dispose();
        previousMaterials.inner.dispose();
        previousMaterials.bridge.dispose();
        previousMaterials.line.dispose();
    }

    object3D.userData.tesseractMaterials = nextMaterials;
}

function disposeCurrentMesh() {
    if (!currentMesh) {
        return;
    }

    modelRoot.remove(currentMesh);

    const materials = new Set();
    currentMesh.traverse((child) => {
        if (child.geometry) {
            child.geometry.dispose();
        }

        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach((material) => materials.add(material));
            } else {
                materials.add(child.material);
            }
        }
    });

    materials.forEach((material) => material.dispose());

    currentMesh = null;
}

function loadModel(index) {
    const modelInfo = MODEL_LIBRARY[index];

    disposeCurrentMesh();

    currentMesh = modelInfo.createObject3D();
    modelRoot.add(currentMesh);

    state.modelIndex = index;
    updateHUDButtons();
}

function changeModel(index) {
    if (state.modelIndex === index) {
        return;
    }

    loadModel(index);
}

function changeMaterial(index) {
    state.materialIndex = index;

    if (currentMesh?.userData?.modelType === 'tesseract') {
        updateTesseractMaterials(currentMesh);
    } else if (currentMesh) {
        const nextMaterial = createMaterial();
        currentMesh.material.dispose();
        currentMesh.material = nextMaterial;
    }

    updateHUDButtons();
}

function toggleLight(type) {
    state.lights[type] = !state.lights[type];
    refreshLightStates();
    updateHUDButtons();
}

function toggleAnaglyph() {
    state.anaglyph = !state.anaglyph;
    updateHUDButtons();
}

function refreshLightStates() {
    directionalLight.visible = state.lights.directional;
    pointLight.visible = state.lights.point;
    spotLight.visible = state.lights.spot;
}

function updateHUDButtons() {
    const modelButtons = document.querySelectorAll('[data-model]');
    const materialButtons = document.querySelectorAll('[data-material]');
    const lightButtons = document.querySelectorAll('[data-light]');
    const anaglyphButton = document.getElementById('anaglyphBtn');

    modelButtons.forEach((button) => {
        button.classList.toggle('active', Number(button.dataset.model) === state.modelIndex);
    });

    materialButtons.forEach((button) => {
        button.classList.toggle('active', Number(button.dataset.material) === state.materialIndex);
    });

    lightButtons.forEach((button) => {
        button.classList.toggle('active', Boolean(state.lights[button.dataset.light]));
    });

    anaglyphButton.classList.toggle('active', state.anaglyph);
}

//////////////////////
/* CHECK COLLISIONS */
//////////////////////
function checkCollisions() {
    'use strict';
}

///////////////////////
/* HANDLE COLLISIONS */
///////////////////////
function handleCollisions() {
    'use strict';
}

////////////
/* UPDATE */
////////////
function update() {
    'use strict';
    if (currentMesh) {
        if (currentMesh.userData.modelType === 'tesseract') {
            currentMesh.rotation.y += 0.01;
            currentMesh.rotation.x += 0.004;
            const pulse = 1 + Math.sin(performance.now() * 0.003) * 0.12;
            currentMesh.scale.setScalar(pulse);
        } else if (currentMesh.userData.modelType === 'cat') {
            currentMesh.rotation.y += 0.012;
        } else {
            currentMesh.rotation.y += 0.01;
            currentMesh.rotation.x += 0.004;
        }
    }
}

/////////////
/* DISPLAY */
/////////////
function render() {
    'use strict';
    if (state.anaglyph) {
        anaglyphEffect.render(scene, camera);
        return;
    }

    renderer.render(scene, camera);
}

////////////////////////////////
/* INITIALIZE ANIMATION CYCLE */
////////////////////////////////
function setupHUD() {
    document.querySelectorAll('[data-model]').forEach((button) => {
        button.addEventListener('click', () => changeModel(Number(button.dataset.model)));
    });

    document.querySelectorAll('[data-material]').forEach((button) => {
        button.addEventListener('click', () => changeMaterial(Number(button.dataset.material)));
    });

    document.querySelectorAll('[data-light]').forEach((button) => {
        button.addEventListener('click', () => toggleLight(button.dataset.light));
    });

    document.getElementById('anaglyphBtn').addEventListener('click', toggleAnaglyph);

    updateHUDButtons();
}

function init() {
    'use strict';
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(COLORS.BLACK, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    document.body.appendChild(renderer.domElement);

    anaglyphEffect = new AnaglyphEffect(renderer);
    anaglyphEffect.setSize(window.innerWidth, window.innerHeight);

    createScene();
    createCamera();
    setupHUD();

    window.addEventListener('resize', onResize);
}

/////////////////////
/* ANIMATION CYCLE */
/////////////////////
function animate() {
    'use strict';
    requestAnimationFrame(animate);
    update();
    render();
}

////////////////////////////
/* RESIZE WINDOW CALLBACK */
////////////////////////////
function onResize() {
    'use strict';
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    anaglyphEffect.setSize(window.innerWidth, window.innerHeight);
}

///////////////////////
/* KEY DOWN CALLBACK */
///////////////////////
function onKeyDown(e) {
    'use strict';
}

///////////////////////
/* KEY UP CALLBACK */
///////////////////////
function onKeyUp(e) {
    'use strict';
}

init();
animate();