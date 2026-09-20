import * as THREE from 'three';
import { config } from './config.js';
import volumeVertShader from './shaders/volume.vert.glsl?raw';
import volumeFragShader from './shaders/volume.frag.glsl?raw';

export function createVideoVolume(volumeData) {
  const { texture, videoAspect } = volumeData;
  const height = 1.0;
  const width = videoAspect * height;
  const depth = config.volumeDepth;
  const frontZ = depth / 2;
  const backZ = -depth / 2;

  const temporalVolume = new THREE.Group();

  function frameToZ(i) {
    return THREE.MathUtils.lerp(frontZ, backZ, i / (config.frameCount - 1));
  }

  function zToT(z) {
    return THREE.MathUtils.clamp((frontZ - z) / (frontZ - backZ), 0.0, 1.0);
  }

  // 1. FrameVolume (Raymarched unit box scaled to width, height, depth)
  const boxGeom = new THREE.BoxGeometry(1, 1, 1);
  const volumeUniforms = {
    uVolume: { value: texture },
    uCurrentT: { value: 0.0 },
    uPastOpacity: { value: config.pastOpacity },
    uPastMinOpacity: { value: config.pastMinOpacity },
    uPastFalloff: { value: config.pastFalloff },
    uPastBlur: { value: config.pastBlur },
    uPastBlurMax: { value: config.pastBlurMax },
    uPastEdgeBlur: { value: config.pastEdgeBlur },
    uFutureDensity: { value: config.futureDensity },
    uSliceWidth: { value: 0.012 }
  };

  const volumeMaterial = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: volumeVertShader,
    fragmentShader: volumeFragShader,
    uniforms: volumeUniforms,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false
  });

  const frameVolume = new THREE.Mesh(boxGeom, volumeMaterial);
  frameVolume.scale.set(width, height, depth);
  frameVolume.renderOrder = 1;
  temporalVolume.add(frameVolume);

  // 2. TraversalPlane (Sharp current video slice + white EdgesGeometry)
  const planeGeom = new THREE.PlaneGeometry(width, height);
  const planeUniforms = {
    uVolume: { value: texture },
    uCurrentT: { value: 0.0 },
    uOpacity: { value: config.currentOpacity }
  };

  const planeVertexShader = /* glsl */ `
    out vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const planeFragmentShader = /* glsl */ `
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

  const planeMaterial = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: planeVertexShader,
    fragmentShader: planeFragmentShader,
    uniforms: planeUniforms,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true
  });

  const traversalPlane = new THREE.Mesh(planeGeom, planeMaterial);
  traversalPlane.position.z = frontZ;
  traversalPlane.renderOrder = 5;

  const planeEdgesGeom = new THREE.EdgesGeometry(planeGeom);
  const planeBorderMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: config.traversalEdgeOpacity,
    depthTest: true
  });
  const traversalBorder = new THREE.LineSegments(planeEdgesGeom, planeBorderMat);
  traversalPlane.add(traversalBorder);
  temporalVolume.add(traversalPlane);

  // 3. VolumeEdges (Box outline, white, opacity 0.22)
  const boxEdgesGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth));
  const boxEdgesMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: config.edgeOpacity
  });
  const volumeEdges = new THREE.LineSegments(boxEdgesGeom, boxEdgesMat);
  temporalVolume.add(volumeEdges);

  // State management
  let currentFrame = 0;
  let targetZ = frontZ;
  let currentZ = frontZ;

  function setCurrentFrame(frameIndex, immediate = false) {
    currentFrame = THREE.MathUtils.clamp(frameIndex, 0, config.frameCount - 1);
    targetZ = frameToZ(currentFrame);
    if (immediate) {
      currentZ = targetZ;
      traversalPlane.position.z = currentZ;
      const t = zToT(currentZ);
      volumeUniforms.uCurrentT.value = t;
      planeUniforms.uCurrentT.value = t;
    }
  }

  function setTraversalProgress(t, immediate = false) {
    const frame = Math.round(t * (config.frameCount - 1));
    setCurrentFrame(frame, immediate);
  }

  function update() {
    if (Math.abs(currentZ - targetZ) > 0.0001) {
      currentZ = THREE.MathUtils.lerp(currentZ, targetZ, config.traversalLerp);
      traversalPlane.position.z = currentZ;
      const t = zToT(currentZ);
      volumeUniforms.uCurrentT.value = t;
      planeUniforms.uCurrentT.value = t;
    }
  }

  function setHovered(isHovered) {
    planeBorderMat.opacity = isHovered ? config.hoverEdgeOpacity : config.traversalEdgeOpacity;
  }

  return {
    temporalVolume,
    frameVolume,
    traversalPlane,
    traversalBorder,
    volumeEdges,
    width,
    height,
    depth,
    frontZ,
    backZ,
    frameToZ,
    zToT,
    setCurrentFrame,
    setTraversalProgress,
    getCurrentFrame: () => currentFrame,
    getCurrentZ: () => currentZ,
    setHovered,
    update
  };
}
