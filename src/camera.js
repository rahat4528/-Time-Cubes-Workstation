import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { config } from './config.js';

export function createCamera(renderer) {
  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(config.cameraFov, aspect, 0.1, 100);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.autoRotate = false;
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.8;
  controls.maxDistance = 6.5;
  controls.target.set(0, 0, 0);

  let lastUserInteractionTime = performance.now();
  let isUserInteracting = false;

  const onUserActive = () => {
    lastUserInteractionTime = performance.now();
  };

  controls.addEventListener('start', () => {
    isUserInteracting = true;
    onUserActive();
  });
  controls.addEventListener('end', () => {
    isUserInteracting = false;
    onUserActive();
  });

  renderer.domElement.addEventListener('pointerdown', onUserActive);
  renderer.domElement.addEventListener('wheel', onUserActive, { passive: true });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  function update(time = 0) {
    // Hybrid Mode: Autonomous ambient slow drift when idle (> 1.5s)
    const now = performance.now();
    if (!isUserInteracting && (now - lastUserInteractionTime > 1500)) {
      // Gentle ambient orbital drift
      const driftSpeed = 0.0012;
      const x = camera.position.x;
      const z = camera.position.z;
      const cos = Math.cos(driftSpeed);
      const sin = Math.sin(driftSpeed);
      camera.position.x = x * cos - z * sin;
      camera.position.z = x * sin + z * cos;
      camera.position.y += Math.sin(time * 0.4) * 0.0008;
      camera.lookAt(0, 0, 0);
    }
    controls.update();
  }

  return { camera, controls, update, notifyInteraction: onUserActive };
}

export function fitCamera(camera, controls, width, height) {
  const maxDim = Math.max(width, height);
  const fovRad = (config.cameraFov * Math.PI) / 180;
  const dist = ((maxDim / 2) / Math.tan(fovRad / 2)) * config.fitPadding;

  camera.position.set(dist * 0.48, dist * 0.36, dist * 0.92);
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
  controls.update();
}
