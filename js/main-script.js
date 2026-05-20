import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import * as Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

//////////////////////
/* GLOBAL VARIABLES */
//////////////////////
var whiteMaterial;
var geometry;
var scene;
var camera;
var renderer;
var currentObject;
var objectType = 0; // 0: sphere, 1: pyramid, 2: cube
const COLORS = {
    BLACK: 0x000000,
    WHITE: 0xffffff
};

/////////////////////
/* CREATE SCENE(S) */
/////////////////////
function createScene(){
    'use strict';
    scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.BLACK);
    createSphere();

}

//////////////////////
/* CREATE CAMERA(S) */
//////////////////////
function createCamera(){
    'use strict';
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 15;
    camera.lookAt(scene.position);
}


/////////////////////
/* CREATE LIGHT(S) */
/////////////////////

////////////////////////
/* CREATE OBJECT3D(S) */
////////////////////////
function createSphere(){
    'use strict';
    whiteMaterial = new THREE.MeshBasicMaterial({color: 0xffffff}); 
    geometry = new THREE.SphereGeometry( 5, 32, 32 );
    currentObject = new THREE.Mesh( geometry, whiteMaterial );
    scene.add(currentObject);
}

function createPyramid(){
    'use strict';
    whiteMaterial = new THREE.MeshBasicMaterial({color: 0xffffff});
    geometry = new THREE.ConeGeometry( 5, 10, 4 );
    currentObject = new THREE.Mesh( geometry, whiteMaterial );
    scene.add(currentObject);
}

function createCube(){
    'use strict';
    whiteMaterial = new THREE.MeshBasicMaterial({color: 0xffffff});
    geometry = new THREE.BoxGeometry( 8, 8, 8 );
    currentObject = new THREE.Mesh( geometry, whiteMaterial );
    scene.add(currentObject);
}

function changeObject(type){
    'use strict';
    if(currentObject) {
        scene.remove(currentObject);
    }
    objectType = type;
    
    if(objectType === 0) {
        createSphere();
    } else if(objectType === 1) {
        createPyramid();
    } else if(objectType === 2) {
        createCube();
    }
    
    updateHUDButtons();
}

function updateHUDButtons(){
    'use strict';
    const sphereBtn = document.getElementById('sphereBtn');
    const pyramidBtn = document.getElementById('pyramidBtn');
    const cubeBtn = document.getElementById('cubeBtn');
    
    sphereBtn.classList.remove('active');
    pyramidBtn.classList.remove('active');
    cubeBtn.classList.remove('active');
    
    if(objectType === 0) {
        sphereBtn.classList.add('active');
    } else if(objectType === 1) {
        pyramidBtn.classList.add('active');
    } else if(objectType === 2) {
        cubeBtn.classList.add('active');
    }
}

//////////////////////
/* CHECK COLLISIONS */
//////////////////////
function checkCollisions(){
    'use strict';

}

///////////////////////
/* HANDLE COLLISIONS */
///////////////////////
function handleCollisions(){
    'use strict';

}

////////////
/* UPDATE */
////////////
function update(){
    'use strict';

}

/////////////
/* DISPLAY */
/////////////
function render() {
    'use strict';
    renderer.render(scene, camera);
}

////////////////////////////////
/* INITIALIZE ANIMATION CYCLE */
////////////////////////////////
function setupHUD(){
    'use strict';
    const sphereBtn = document.getElementById('sphereBtn');
    const pyramidBtn = document.getElementById('pyramidBtn');
    const cubeBtn = document.getElementById('cubeBtn');
    
    sphereBtn.addEventListener('click', () => changeObject(0));
    pyramidBtn.addEventListener('click', () => changeObject(1));
    cubeBtn.addEventListener('click', () => changeObject(2));
    
    updateHUDButtons();
}

function init() {
    'use strict';
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    createScene();
    createCamera();
    setupHUD();

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
function onKeyUp(e){
    'use strict';
}

init();
animate();