import * as THREE from 'three';
import { config } from './config.js';

export function createTraversalPlane(volumeData, width, height) {
  const { texture } = volumeData;

  const planeGeom = new THREE.PlaneGeometry(width, height);
  const uniforms = {
    uVolume: { value: texture },
    uCurrentT: { value: 0.0 },
    uOpacity: { value: config.currentOpacity }
  };

  const vertexShader = /* glsl */ `
    out vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    precision highp float;
    precision highp sampler3D;

    uniform sampler3D uVolume;
    uniform float uCurrentT;
    uniform float uOpacity;

    in vec2 vUv;
    out vec4 fragColor;

    void main() {
      vec4 col = texture(uVolume, vec3(vUv.x, 1.0 - vUv.y, uCurrentT));
      fragColor = vec4(col.rgb, uOpacity);
    }
  `;

  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader,
    uniforms,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true
  });

  const mesh = new THREE.Mesh(planeGeom, material);
  mesh.renderOrder = 5;

  // Luminous white border
  const edgesGeom = new THREE.EdgesGeometry(planeGeom);
  const borderMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: config.traversalEdgeOpacity,
    depthTest: true
  });
  const border = new THREE.LineSegments(edgesGeom, borderMat);
  mesh.add(border);

  function setHovered(isHovered) {
    borderMat.opacity = isHovered ? config.hoverEdgeOpacity : config.traversalEdgeOpacity;
  }

  function setCurrentT(t) {
    uniforms.uCurrentT.value = t;
  }

  function setPositionZ(z) {
    mesh.position.z = z;
  }

  return {
    mesh,
    border,
    setHovered,
    setCurrentT,
    setPositionZ
  };
}
