import './styles.css';
import * as THREE from 'three';
import { createScene } from './scene.js';
import { createCamera, fitCamera } from './camera.js';
import { extractVolume } from './extractVolume.js';
import { createTimeCubes } from './timeCubes.js';
import { setupInteraction } from './interaction.js';

async function init() {
  const loadingEl = document.getElementById('loading');
  const aboutBtn = document.getElementById('about-btn');
  const aboutClose = document.getElementById('about-close');
  const aboutModal = document.getElementById('about-modal');

  // Setup About Modal toggle
  if (aboutBtn && aboutModal && aboutClose) {
    aboutBtn.addEventListener('click', () => {
      aboutModal.classList.remove('hidden');
    });
    aboutClose.addEventListener('click', () => {
      aboutModal.classList.add('hidden');
    });
    aboutModal.addEventListener('click', (e) => {
      if (e.target === aboutModal) {
        aboutModal.classList.add('hidden');
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !aboutModal.classList.contains('hidden')) {
        aboutModal.classList.add('hidden');
      }
    });
  }

  const { scene, renderer } = createScene();
  const { camera, controls, update: updateCamera } = createCamera(renderer);
  const clock = new THREE.Clock();

  // WebGL context handling (loss and restore)
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    console.warn('WebGL context lost. Pausing render loop.');
  }, false);

  renderer.domElement.addEventListener('webglcontextrestored', () => {
    console.info('WebGL context restored. Reinitializing scene.');
    window.location.reload();
  }, false);

  try {
    const volumeData = await extractVolume();
    const timeCubes = createTimeCubes(volumeData);
    scene.add(timeCubes.group);

    fitCamera(camera, controls, timeCubes.width, timeCubes.height);
    setupInteraction({ renderer, camera, controls, timeCubes });

    // Hide loading screen after volume is ready
    if (loadingEl) {
      loadingEl.classList.add('hidden');
    }

    // Main render loop
    function animate() {
      requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      updateCamera(elapsedTime);
      timeCubes.update(camera, elapsedTime);
      renderer.render(scene, camera);
    }
    animate();
  } catch (error) {
    console.error('TIME CUBES initialization error:', error);
    if (loadingEl) {
      loadingEl.textContent = 'ERROR LOADING TIME CUBES';
    }
  }
}

init();
