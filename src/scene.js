import * as THREE from 'three';

export function createScene() {
  const scene = new THREE.Scene();
  // Midnight Navy palette: #070a14
  scene.background = new THREE.Color(0x070a14);
  scene.fog = new THREE.FogExp2(0x070a14, 0.08);

  const getPixelRatio = () => {
    return Math.min(window.devicePixelRatio, window.innerWidth < 768 ? 1.5 : 2);
  };

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setClearColor(0x070a14, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(getPixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);

  document.body.appendChild(renderer.domElement);

  window.addEventListener('resize', () => {
    renderer.setPixelRatio(getPixelRatio());
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, renderer };
}
