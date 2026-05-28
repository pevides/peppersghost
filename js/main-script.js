import * as THREE from 'three';
import { AnaglyphEffect } from 'three/addons/effects/AnaglyphEffect.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';


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
let tesseractNormalMap;
let artemisParts = [];
let catParts = [];

const artemisMeshMaps = new Map();

const state = {
    modelIndex: 0,
    shadingMode: 'lambert',
    lightingEnabled: true,
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
        label: 'Tesseract',
        createObject3D: () => createTesseract()
    },
    {
        label: 'Gato',
        createObject3D: () => createCatModel()
    },
    {
        label: 'NASA Artemis',
        createObject3D: () => createNASAArtemisModel()
    }
];

const MATERIAL_LIBRARY = [
    {
        label: 'Lambert',
        createMaterial: () => new THREE.MeshLambertMaterial({ color: 0xffffff })
    },
    {
        label: 'Phong',
        createMaterial: () => new THREE.MeshPhongMaterial({
            color: 0xffffff,
            specular: 0x888888,
            shininess: 85
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

    ambientLight = new THREE.AmbientLight(0xffffff, 0.18);
    scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(8, 10, 6);
    scene.add(directionalLight);

    refreshLightStates();
    loadModel(state.modelIndex);
}

//////////////////////
/* CREATE CAMERA(S) */
//////////////////////
function createCamera() {
    'use strict';
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 24);
    camera.lookAt(0, 0, 0);
}

////////////////////////
/* CREATE OBJECT3D(S) */
////////////////////////
function createMaterial() {
    return MATERIAL_LIBRARY[state.shadingMode === 'phong' ? 1 : 0].createMaterial();
}

function createModelLights(baseSize) {
    const lightGroup = new THREE.Group();

    const pointLightA = new THREE.PointLight(0xfff1db, 1.3, baseSize * 5.5, 2);
    pointLightA.position.set(baseSize * 1.2, baseSize * 0.9, baseSize * 1.1);
    lightGroup.add(pointLightA);

    const pointLightB = new THREE.PointLight(0xe8f0ff, 0.95, baseSize * 5.5, 2);
    pointLightB.position.set(-baseSize * 1.1, baseSize * 0.8, -baseSize * 1.2);
    lightGroup.add(pointLightB);

    const spotLightA = new THREE.SpotLight(0xffffff, 2, baseSize * 7.5, Math.PI / 6, 0.42, 1.1);
    spotLightA.position.set(0, baseSize * 2.2, baseSize * 1.8);
    spotLightA.target.position.set(0, 0, 0);
    lightGroup.add(spotLightA);
    lightGroup.add(spotLightA.target);

    const spotLightB = new THREE.SpotLight(0xfff1c9, 1.6, baseSize * 7.5, Math.PI / 6, 0.42, 1.1);
    spotLightB.position.set(baseSize * 1.8, baseSize * 1.6, -baseSize * 1.6);
    spotLightB.target.position.set(0, 0, 0);
    lightGroup.add(spotLightB);
    lightGroup.add(spotLightB.target);

    lightGroup.userData.lightTypes = {
        point: [pointLightA, pointLightB],
        spot: [spotLightA, spotLightB]
    };

    return lightGroup;
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
    const opacityByPart = {
        outer: 0.38,
        inner: 0.24,
        bridge: 0.16
    };

    const MaterialClass = state.shadingMode === 'phong' ? THREE.MeshPhongMaterial : THREE.MeshLambertMaterial;

    const materialConfig = {
        color: 0xffffff,
        transparent: true,
        opacity: opacityByPart[partName] || 0.2,
        side: THREE.DoubleSide,
        normalMap: createConcentricNormalMap(),
        normalScale: new THREE.Vector2(0.9, 0.9)
    };

    if (state.shadingMode === 'phong') {
        materialConfig.specular = 0x666666;
        materialConfig.shininess = 60;
    }

    return new MaterialClass(materialConfig);
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
    tesseract.add(createModelLights(4.0));

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
    catGroup.add(createModelLights(3.6));

    const loader = new OBJLoader();

    loader.load(
        'models/cat.obj',
        (object) => {
            if (currentMesh !== catGroup) {
                return;
            }

            catParts = [];
            object.traverse((child) => {
                if (child.isMesh) {
                    catParts.push(child);
                    child.material = createMaterial();
                    child.castShadow = false;
                    child.receiveShadow = false;
                }
            });

            const box = new THREE.Box3().setFromObject(object);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const largestDimension = Math.max(size.x, size.y, size.z);
            const scale = 8 / largestDimension;

            object.position.copy(center).multiplyScalar(-scale);
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

function configTex(tex) {
    if (!tex) return;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
}

function createNASAArtemisModel() {
    const artemisGroup = new THREE.Group();
    artemisGroup.userData.modelType = 'artemis';
    artemisGroup.add(createModelLights(3.6));

    const gltfLoader = new GLTFLoader();

    gltfLoader.load(
        'models/Artemis/Artemis.gltf',
        (gltf) => {
            if (currentMesh !== artemisGroup) {
                return;
            }

            const model = gltf.scene;
            gltf.textures && gltf.textures.forEach((tex) => configTex(tex));

            if (gltf.parser && gltf.parser.json && gltf.parser.json.images) {
                model.traverse((child) => {
                    if (!child.isMesh || !child.material) return;
                    const mat = child.material;
                    [mat.map, mat.normalMap, mat.metalnessMap, mat.roughnessMap,
                     mat.emissiveMap, mat.aoMap, mat.lightMap].forEach(configTex);
                });
            }

            artemisParts = [];
            artemisMeshMaps.clear();

            model.traverse((child) => {
                if (!child.isMesh) return;
                artemisParts.push(child);
                const gltfMat = child.material;
                artemisMeshMaps.set(child.uuid, {
                    map:          gltfMat.map   || null,
                    metalnessMap: gltfMat.metalnessMap || null,
                    roughnessMap: gltfMat.roughnessMap || null,
                    color:        gltfMat.color ? gltfMat.color.clone() : null
                });

                const newMat = createMaterial();
                const maps = artemisMeshMaps.get(child.uuid);
                newMat.map = maps.map;
                if (newMat.metalnessMap !== undefined) {
                    newMat.metalnessMap = maps.metalnessMap;
                    newMat.roughnessMap = maps.roughnessMap;
                }
                if (!newMat.map && maps.color) {
                    newMat.color.copy(maps.color);
                }
                newMat.needsUpdate = true;
                child.material = newMat;
            });

            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const largestDimension = Math.max(size.x, size.y, size.z);
            const scale = 14 / largestDimension;

            model.position.copy(center).multiplyScalar(-scale);
            model.scale.setScalar(scale);

            artemisGroup.add(model);
        },
        undefined,
        () => {
            console.error('Failed to load Artemis model');
        }
    );

    return artemisGroup;
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

function updateGroupMaterials(object3D) {
    const modelType = object3D.userData.modelType;

    if (modelType === 'artemis') {
        artemisParts.forEach((child) => {
            if (child.material) {
                child.material.dispose();
            }

            const newMaterial = createMaterial();
            const maps = artemisMeshMaps.get(child.uuid);

            if (maps) {
                newMaterial.map = maps.map;
                if (newMaterial.metalnessMap !== undefined) {
                    newMaterial.metalnessMap = maps.metalnessMap;
                    newMaterial.roughnessMap = maps.roughnessMap;
                }
                if (!newMaterial.map && maps.color) {
                    newMaterial.color.copy(maps.color);
                }
            }

            newMaterial.needsUpdate = true;
            child.material = newMaterial;
        });
    } else if (modelType === 'cat') {
        catParts.forEach((child) => {
            if (child.material) {
                child.material.dispose();
            }
            child.material = createMaterial();
        });
    }
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

    refreshLightStates();

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
    state.shadingMode = index;

    if (currentMesh?.userData?.modelType === 'tesseract') {
        updateTesseractMaterials(currentMesh);
    } else if (currentMesh) {
        updateGroupMaterials(currentMesh);
    }

    updateHUDButtons();
}

function toggleLighting() {
    state.lightingEnabled = !state.lightingEnabled;
    refreshLightStates();
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
    const lightingEnabled = state.lightingEnabled;
    ambientLight.visible = lightingEnabled;
    directionalLight.visible = lightingEnabled && state.lights.directional;

    if (!currentMesh) {
        return;
    }

    currentMesh.traverse((child) => {
        if (child.isPointLight) {
            child.visible = lightingEnabled && state.lights.point;
        } else if (child.isSpotLight) {
            child.visible = lightingEnabled && state.lights.spot;
        }
    });
}

function updateHUDButtons() {
    const modelButtons = document.querySelectorAll('[data-model]');
    const materialButtons = document.querySelectorAll('[data-shading]');
    const lightButtons = document.querySelectorAll('[data-light]');
    const anaglyphButton = document.getElementById('anaglyphBtn');
    const lightingButton = document.getElementById('lightingBtn');

    modelButtons.forEach((button) => {
        button.classList.toggle('active', Number(button.dataset.model) === state.modelIndex);
    });

    materialButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.shading === state.shadingMode);
    });

    lightButtons.forEach((button) => {
        button.classList.toggle('active', Boolean(state.lights[button.dataset.light]));
    });

    lightingButton.classList.toggle('active', state.lightingEnabled);
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
            currentMesh.rotation.y += 0.007;
        } else if (currentMesh.userData.modelType === 'artemis') {
            currentMesh.rotation.y += 0.01;
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
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            changeModel(Number(button.dataset.model));
        });
    });

    document.querySelectorAll('[data-shading]').forEach((button) => {
        button.addEventListener('click', () => changeMaterial(button.dataset.shading));
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            changeMaterial(button.dataset.shading);
        });
    });

    document.querySelectorAll('[data-light]').forEach((button) => {
        button.addEventListener('click', () => toggleLight(button.dataset.light));
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            toggleLight(button.dataset.light);
        });
    });

    document.getElementById('lightingBtn').addEventListener('click', toggleLighting);
    document.getElementById('lightingBtn').addEventListener('touchend', (e) => {
        e.preventDefault();
        toggleLighting();
    });

    document.getElementById('anaglyphBtn').addEventListener('click', toggleAnaglyph);
    document.getElementById('anaglyphBtn').addEventListener('touchend', (e) => {
        e.preventDefault();
        toggleAnaglyph();
    });

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
    anaglyphEffect.eyeSeparation = 0.064;
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

const firstTouch = () => {
    const doc = document.documentElement;
    
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (doc.requestFullscreen) {
            doc.requestFullscreen().catch(err => console.log(err));
        } else if (doc.webkitRequestFullscreen) {
            doc.webkitRequestFullscreen();
        }
    }
    
    window.removeEventListener('click', firstTouch);
    window.removeEventListener('touchend', firstTouch);
};

// Listens for the first touch
window.addEventListener('click', firstTouch);
window.addEventListener('touchend', firstTouch);