import JSZip from 'jszip';
import type { StoredScene } from './sceneStorage';
import { advancePhysics, createCollisionSystem, createTriggerSystem, getPhysicsBounds } from '../systems/PhysicsEngine';
import { advanceCharacterControllers, createPlayerCamera } from '../systems/CharacterControllerSystem';
import { createSceneAI } from '../systems/SceneAI';
import { createPathFollowers } from '../systems/PathFollowers';
import { createObjectScripts } from '../systems/ObjectScripts';
import { createWebLayer } from '../systems/WebLayer';
import { createModelAnimations } from '../systems/ModelAnimations';
import { createPropertyAnimations } from '../systems/PropertyAnimations';
import { createTimeline } from '../systems/Timeline';
import { createTimelineMedia } from '../systems/TimelineMedia';
import jquerySource from 'jquery/dist/jquery.min.js?raw';

export type ExportFormat = 'html' | 'react' | 'wordpress';

export const exportScene = async (snapshot: StoredScene, format: ExportFormat = 'html') => {
  const zip = new JSZip();
  const sceneZip = format === 'html' ? zip : zip.folder(format === 'react' ? 'public/scene' : 'three-scene-export/scene');
  if (!sceneZip) throw new Error('Could not create the export folder.');
  const projectData = {
    version: "1.0",
    lastModified: new Date().toISOString(),
    ...snapshot
  };
  const scenes = [
    { id: projectData.activeSceneId!, objects: projectData.objects, sceneOptions: projectData.sceneOptions },
    ...(projectData.otherScenes ?? [])
  ];
  for (const scene of scenes) {
    if (scene.objects.some(obj => obj.type === 'model' && !obj.properties.modelData)) {
      throw new Error(`${scene.sceneOptions.name}: a model is missing its original GLB data. Please import it again.`);
    }
    if (scene.sceneOptions.activeCameraId && !scene.objects.some(obj => obj.id === scene.sceneOptions.activeCameraId && obj.type === 'camera')) {
      throw new Error(`${scene.sceneOptions.name}: selected play camera is unavailable; choose another camera.`);
    }
  }
  const pages = Object.fromEntries(scenes.map((scene, index) => [scene.id, index === 0 ? 'index.html' : `scene-${index}.html`]));
  sceneZip.file('scene.json', JSON.stringify(projectData, null, 2));
  if (scenes.some(scene => scene.sceneOptions.enableJQuery)) sceneZip.file('jquery.min.js', jquerySource);
  if (scenes.some(scene => scene.objects.some(obj => obj.properties.web?.kind === 'lottie' && obj.properties.web.lottieData))) {
    const { default: lottieSource } = await import('lottie-web/build/player/lottie.min.js?raw');
    sceneZip.file('lottie.min.js', lottieSource);
  }

  for (const [index, entry] of scenes.entries()) {
  const sceneOptions = entry.sceneOptions;
  const sceneObjects = entry.objects;
  const sceneData = { version: projectData.version, lastModified: projectData.lastModified, objects: entry.objects, sceneOptions };
  const hasLottie = sceneObjects.some(obj => obj.properties.web?.kind === 'lottie' && obj.properties.web.lottieData);
  const scriptName = index === 0 ? 'scene.js' : `scene-${index}.js`;

  const title = (sceneOptions.name || 'Game Scene').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character] || character));
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }

    #canvas {
      display: block;
      width: 100%;
      height: 100%;
    }

    #stats {
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      padding: 10px 15px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      z-index: 100;
    }

    #controls {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      padding: 15px 20px;
      border-radius: 8px;
      text-align: center;
      z-index: 100;
    }

    #controls p {
      margin: 5px 0;
      font-size: 13px;
    }

    #enable-sound {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 101;
      padding: 10px;
      cursor: pointer;
    }

    #load-error {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #991b1b;
      color: white;
      padding: 16px;
      z-index: 102;
    }

    @media (max-width: 768px) {
      #controls {
        font-size: 11px;
        padding: 10px 15px;
        bottom: 10px;
      }

      #controls p {
        margin: 3px 0;
      }
    }
  </style>
</head>
<body>
  <div id="stats">
    <div>FPS: <span id="fps">0</span></div>
    <div>Objects: <span id="objects">${sceneObjects.length}</span></div>
  </div>

  <div id="controls">
    <p><strong>Controls:</strong></p>
    <p>WASD/Arrows: Move | Space: Jump</p>
  </div>
  <button id="enable-sound" hidden>Enable sound</button>
  <div id="load-error" role="alert" hidden></div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
  ${sceneOptions.enableJQuery ? '<script src="jquery.min.js"></script>' : ''}
  ${hasLottie ? '<script src="lottie.min.js"></script>' : ''}
  <script src="${scriptName}"></script>
</body>
</html>`;

  sceneZip.file(pages[entry.id], htmlContent);

  const sceneCode = `
// Game Scene - Auto-generated
const sceneData = ${JSON.stringify(sceneData, null, 2)};
const scenePages = ${JSON.stringify(pages)};
const sceneReferences = ${JSON.stringify(scenes.map(scene => ({ id: scene.id, name: scene.sceneOptions.name })))};
let sceneActive = true;
function openScene(id) {
  if (!sceneActive) return;
  if (!Object.prototype.hasOwnProperty.call(scenePages, id)) {
    const error = document.getElementById('load-error');
    error.textContent = 'Target scene no longer exists';
    error.hidden = false;
    return;
  }
  window.location.href = scenePages[id];
}

let scene, camera, renderer, clock;
let sceneObjects = [];
let keys = {};
let objectScripts;
let modelAnimations;
let propertyAnimations;
let timeline;
let triggerSystem;
let collisionSystem;
let playerCamera;
let pathFollowers;
const createObjectScripts = ${createObjectScripts.toString()};
const createSceneAI = ${createSceneAI.toString()};
const createPathFollowers = ${createPathFollowers.toString()};
const createModelAnimations = ${createModelAnimations.toString()};
const createPropertyAnimations = ${createPropertyAnimations.toString()};
const createTimeline = ${createTimeline.toString()};
const createTimelineMedia = ${createTimelineMedia.toString()};
const createWebLayer = ${createWebLayer.toString()};
const getPhysicsBounds = ${getPhysicsBounds.toString()};
const advancePhysicsImpl = ${advancePhysics.toString()};
const advancePhysics = (objects, delta, gravity, three, onCollision) =>
  advancePhysicsImpl(objects, delta, gravity, three, getPhysicsBounds, onCollision);
const createTriggerSystem = ${createTriggerSystem.toString()};
const createCollisionSystem = ${createCollisionSystem.toString()};
const advanceCharacterControllers = ${advanceCharacterControllers.toString()};
const createPlayerCamera = ${createPlayerCamera.toString()};
const input = { isKeyPressed: key => !!keys[key.toLowerCase()] };

// Initialize scene
async function init() {
  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(sceneData.sceneOptions.backgroundColor || '#1a1a2e');

  if (sceneData.sceneOptions.fogEnabled) {
    scene.fog = new THREE.FogExp2(
      new THREE.Color(sceneData.sceneOptions.fogColor || '#cccccc'),
      sceneData.sceneOptions.fogDensity ?? 0.1
    );
  }

  // Camera setup
  camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = sceneData.sceneOptions.shadowsEnabled !== false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, sceneData.sceneOptions.ambientLightIntensity ?? 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(10, 10, 5);
  directionalLight.castShadow = sceneData.sceneOptions.shadowsEnabled !== false;
  scene.add(directionalLight);

  clock = new THREE.Clock();

  // Load scene objects
  await loadSceneObjects();
  if (sceneData.sceneOptions.activeCameraId) {
    const source = sceneObjects.find(obj => obj.id === sceneData.sceneOptions.activeCameraId && obj.object.isPerspectiveCamera);
    if (!source) throw new Error('Selected play camera is unavailable');
    camera.position.copy(source.object.position);
    camera.quaternion.copy(source.object.quaternion);
    camera.fov = source.object.fov;
    camera.near = source.object.near;
    camera.far = source.object.far;
    camera.zoom = source.object.zoom;
    camera.updateProjectionMatrix();
  }
  playerCamera = createPlayerCamera(sceneObjects, camera, renderer.domElement, THREE, message => {
    console.error('Player camera error:', message);
    const error = document.getElementById('load-error');
    error.textContent = message;
    error.hidden = false;
  });
  if (sceneObjects.some(obj => (obj.properties.script && obj.properties.script.trim()) || (obj.properties.web && obj.properties.web.script && obj.properties.web.script.trim())) &&
      !window.confirm('This scene contains JavaScript with full browser access. Run only trusted code. Continue?')) {
    throw new Error('Script execution was cancelled');
  }
  objectScripts = createObjectScripts(sceneObjects, scene, camera, THREE, message => {
    console.error('Object script error:', message);
    const error = document.getElementById('load-error');
    error.textContent = 'Script error: ' + message;
    error.hidden = false;
  }, openScene, sceneReferences, sceneData.sceneOptions.ai ? createSceneAI(sceneData.sceneOptions.ai) : null);
  objectScripts.start();
  pathFollowers = createPathFollowers(sceneObjects, sceneData.sceneOptions.ai, sceneData.sceneOptions.timeline,
    createSceneAI, message => {
      console.error('AI navigation error:', message);
      const error = document.getElementById('load-error');
      error.textContent = message;
      error.hidden = false;
    }, THREE, getPhysicsBounds, message => {
      const error = document.getElementById('load-error');
      if (error.textContent === message) { error.textContent = ''; error.hidden = true; }
    });
  triggerSystem = createTriggerSystem(sceneObjects, THREE,
    (id, method, other) => objectScripts.trigger(id, method, other), getPhysicsBounds);
  collisionSystem = createCollisionSystem((id, method, other) => objectScripts.trigger(id, method, other));
  modelAnimations = createModelAnimations(sceneObjects, THREE, message => {
    console.error('Model animation error:', message);
    const error = document.getElementById('load-error');
    error.textContent = 'Animation error: ' + message;
    error.hidden = false;
  }, openScene, (sceneData.sceneOptions.timeline?.clips || []).map(clip => clip.targetId));
  propertyAnimations = createPropertyAnimations(sceneObjects, message => {
    console.error('Animation error:', message);
    const error = document.getElementById('load-error');
    error.textContent = 'Animation error: ' + message;
    error.hidden = false;
  }, window, openScene);
  const cleanupWeb = createWebLayer(document.body, sceneObjects, {
    editing: false, width: '100%', scene, camera, three: THREE, lottie: typeof lottie === 'undefined' ? undefined : lottie,
    onPlayClip: (id, clipIndex) => modelAnimations.play(id, clipIndex),
    timelineSounds: sceneData.sceneOptions.timeline?.sounds,
    onSceneChange: openScene, scenes: sceneReferences,
    onError: message => {
      console.error('Web component error:', message);
      const error = document.getElementById('load-error');
      error.textContent = 'Web error: ' + message;
      error.hidden = false;
    }
  });
  if (sceneData.sceneOptions.timeline) {
    timeline = createTimeline(sceneData.sceneOptions.timeline, sceneObjects, sceneData.sceneOptions.activeCameraId, camera, document.body, message => {
      console.error('Timeline error:', message);
      const error = document.getElementById('load-error');
      error.textContent = 'Timeline error: ' + message;
      error.hidden = false;
    }, THREE, createTimelineMedia);
  }
  if (sceneObjects.some(obj => obj.properties.web) &&
      !sceneObjects.some(obj => obj.properties.characterController && obj.properties.characterController.enabled)) {
    document.getElementById('stats').hidden = true;
    document.getElementById('controls').hidden = true;
  }
  renderer.domElement.addEventListener('click', event => {
    const rect = renderer.domElement.getBoundingClientRect();
    const point = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(point, camera);
    const hit = raycaster.intersectObjects(sceneObjects.map(obj => obj.object), true)[0];
    if (!hit) return;
    let target = hit.object;
    while (target.parent && !sceneObjects.some(obj => obj.object === target)) target = target.parent;
    const item = sceneObjects.find(obj => obj.object === target);
    if (item) objectScripts.click(item.id);
  });
  window.addEventListener('pagehide', () => { sceneActive = false; playerCamera?.stop(); timeline?.stop(); cleanupWeb(); objectScripts.stop(); modelAnimations.stop(); propertyAnimations.stop(); });

  const sounds = sceneObjects.flatMap(obj => (obj.properties.sounds || [])
    .filter(sound => sound.autoPlay && !(sceneData.sceneOptions.timeline?.sounds || [])
      .some(segment => segment.targetId === obj.id && segment.soundId === sound.id))
    .map(sound => {
      const audio = new Audio(sound.url);
      audio.volume = sound.volume;
      audio.loop = sound.loop;
      return audio;
    }));
  const soundButton = document.getElementById('enable-sound');
  async function playSounds() {
    const results = await Promise.allSettled(sounds.map(sound => sound.play()));
    const failed = results.some(result => result.status === 'rejected');
    soundButton.hidden = !failed;
    if (failed) console.error('Some scene sounds could not be played', results);
  }
  soundButton.addEventListener('click', playSounds);
  if (sounds.length) await playSounds();

  // Input handling
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof Element && e.target.closest('.engine-web-root button, .engine-web-root input, .engine-web-root textarea, .engine-web-root select, .engine-web-root a')) return;
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
    keys[e.key.toLowerCase()] = true;
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });
  window.addEventListener('blur', () => { keys = {}; });

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  // Start animation loop
  animate();
}

async function loadSceneObjects() {
  for (const objData of sceneData.objects) {
    let object = null;

    switch (objData.type) {
      case 'imagePlane':
        object = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false }));
        break;
      case 'imageSprite': {
        if (!objData.properties.map) throw new Error('Sprite is missing image data: ' + objData.name);
        const texture = await new THREE.TextureLoader().loadAsync(objData.properties.map);
        texture.encoding = THREE.sRGBEncoding;
        object = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
        break;
      }
      case 'audioSource':
      case 'web':
        object = new THREE.Object3D();
        break;
      case 'model': {
        if (!objData.properties.modelData) throw new Error('Model is missing GLB data: ' + objData.name);
        const gltf = await new THREE.GLTFLoader().loadAsync(objData.properties.modelData);
        const model = gltf.scene;
        const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
        model.position.sub(center);
        model.traverse(child => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        object = new THREE.Group();
        object.add(model);
        object.animations = gltf.animations;
        break;
      }
      case 'box':
      case '3d':
        object = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshStandardMaterial({ color: objData.properties.color || 0x808080 })
        );
        break;

      case 'sphere':
        object = new THREE.Mesh(
          new THREE.SphereGeometry(0.5, 32, 32),
          new THREE.MeshStandardMaterial({ color: objData.properties.color || 0x808080 })
        );
        break;

      case 'cylinder':
        object = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
          new THREE.MeshStandardMaterial({ color: objData.properties.color || 0x808080 })
        );
        break;

      case 'cone':
        object = new THREE.Mesh(
          new THREE.ConeGeometry(0.5, 1, 32),
          new THREE.MeshStandardMaterial({ color: objData.properties.color || 0x808080 })
        );
        break;

      case 'ground':
        object = new THREE.Mesh(
          new THREE.PlaneGeometry(10, 10),
          new THREE.MeshStandardMaterial({ color: objData.properties.color || 0x808080, side: THREE.DoubleSide })
        );
        object.rotation.x = -Math.PI / 2;
        break;

      case 'pointLight':
        object = new THREE.PointLight(
          objData.properties.color ?? 0xffffff,
          objData.properties.intensity ?? 1,
          objData.properties.distance ?? 0,
          objData.properties.decay ?? 2
        );
        break;

      case 'spotLight':
        object = new THREE.SpotLight(
          objData.properties.color ?? 0xffffff,
          objData.properties.intensity ?? 1,
          objData.properties.distance ?? 0,
          objData.properties.angle != null ? objData.properties.angle * Math.PI / 180 : Math.PI / 3,
          objData.properties.penumbra ?? 0,
          objData.properties.decay ?? 2
        );
        break;

      case 'camera':
        object = new THREE.PerspectiveCamera(
          objData.properties.fov ?? 75,
          window.innerWidth / window.innerHeight,
          objData.properties.near ?? 0.1,
          objData.properties.far ?? 1000
        );
        break;
      default:
        throw new Error('Unsupported scene object type: ' + objData.type);
    }

    if (object) {
      object.name = objData.name;
      object.userData.className = objData.properties.className || '';
      object.userData.tags = objData.properties.tags || [];
      // Apply properties
      if (objData.properties.position) {
        object.position.fromArray(objData.properties.position);
      }
      if (objData.properties.rotation) {
        object.rotation.set(
          objData.properties.rotation[0] * Math.PI / 180,
          objData.properties.rotation[1] * Math.PI / 180,
          objData.properties.rotation[2] * Math.PI / 180
        );
      }
      if (objData.properties.scale) {
        object.scale.fromArray(objData.properties.scale);
      }

      object.castShadow = objData.properties.castShadow !== false;
      object.receiveShadow = objData.properties.receiveShadow === true;
      object.visible = objData.properties.visible !== false;

      const textures = {};
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) {
        if (objData.properties[key]) {
          const texture = await new THREE.TextureLoader().loadAsync(objData.properties[key]);
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          if (key === 'map') texture.encoding = THREE.sRGBEncoding;
          textures[key] = texture;
        }
      }
      object.traverse(child => {
        if (!child.isMesh) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        const updated = materials.map(material => {
          const type = objData.properties.materialType;
          if (type) {
            const options = { color: material.color, opacity: material.opacity, transparent: material.transparent, side: material.side, map: material.map, depthWrite: material.depthWrite };
            const constructors = { standard: THREE.MeshStandardMaterial, basic: THREE.MeshBasicMaterial, phong: THREE.MeshPhongMaterial, lambert: THREE.MeshLambertMaterial };
            material = new constructors[type](options);
          }
          if (objData.properties.color !== undefined && material.color) material.color.set(objData.properties.color);
          if (objData.properties.metalness !== undefined && 'metalness' in material) material.metalness = objData.properties.metalness;
          if (objData.properties.roughness !== undefined && 'roughness' in material) material.roughness = objData.properties.roughness;
          if (objData.properties.opacity !== undefined) {
            material.opacity = objData.properties.opacity;
            material.transparent = material.opacity < 1 || objData.type === 'imagePlane';
            if (objData.type === 'imagePlane') material.depthWrite = false;
          }
          for (const key of Object.keys(textures)) if (key in material) material[key] = textures[key];
          material.needsUpdate = true;
          return material;
        });
        child.material = Array.isArray(child.material) ? updated : updated[0];
      });

      scene.add(object);
      sceneObjects.push({ ...objData, object });
    }
  }
}

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  objectScripts.update(delta);
  modelAnimations.update(delta);

  pathFollowers.update(delta);
  collisionSystem.begin();
  advancePhysics(sceneObjects, Math.min(delta, 0.05), sceneData.sceneOptions.gravity, THREE, (a, b) => collisionSystem.contact(a, b));
  collisionSystem.end();
  triggerSystem.update();
  advanceCharacterControllers(sceneObjects, input, THREE, camera);
  propertyAnimations.update(delta);
  timeline?.update(delta);
  playerCamera?.update();

  renderer.render(scene, camera);

  // Update FPS
  document.getElementById('fps').textContent = Math.round(1 / delta);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Start the application
init().catch(error => {
  console.error('Failed to start game:', error);
  const message = document.getElementById('load-error');
  message.textContent = 'Could not load the game: ' + error.message;
  message.hidden = false;
});
`;

  sceneZip.file(scriptName, sceneCode);
  }

  if (format === 'react') {
    zip.file('package.json', JSON.stringify({
      name: 'three-scene-export', private: true, version: '1.0.0', type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
      devDependencies: { vite: '^5.4.2' }
    }, null, 2));
    zip.file('index.html', '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Scene</title></head><body style="margin:0"><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>');
    zip.file('src/main.jsx', `import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return <iframe title="3D scene" src={import.meta.env.BASE_URL + 'scene/index.html'} style={{display:'block',width:'100%',height:'100vh',border:0}} allow="fullscreen; autoplay" />;
}

createRoot(document.getElementById('root')).render(<App />);
`);
    zip.file('README.txt', 'Run npm install, then npm run dev. The generated scene runs in an iframe from public/scene. Three.js and GLTFLoader require network access.');
  } else if (format === 'wordpress') {
    zip.file('three-scene-export/three-scene-export.php', `<?php
/*
Plugin Name: Three Scene Export
Description: Displays the exported scene using the [three_scene] shortcode.
Version: 1.0.0
*/
if (!defined('ABSPATH')) exit;
add_shortcode('three_scene', function () {
    $url = plugins_url('scene/index.html', __FILE__);
    return '<iframe title="3D scene" src="' . esc_url($url) . '" style="display:block;width:100%;height:100vh;border:0" allow="fullscreen; autoplay"></iframe>';
});
`);
    zip.file('three-scene-export/README.txt', 'Install and activate this ZIP as a WordPress plugin, then add [three_scene] to a page. The scene runs in an iframe. Three.js and GLTFLoader require network access.');
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = (projectData.sceneOptions.name || 'scene') + (format === 'html' ? '-export.zip' : `-${format}.zip`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
