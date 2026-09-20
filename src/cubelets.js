import * as THREE from 'three';
import { config } from './config.js';
import cubeVertShader from './shaders/cube.vert.glsl?raw';
import cubeFragShader from './shaders/cube.frag.glsl?raw';

export function createCubelets(volumeData, width, height, depth) {
  const { texture } = volumeData;
  const countX = config.cubeCountX;
  const countY = config.cubeCountY;
  const countZ = config.cubeCountZ;
  const totalCount = countX * countY * countZ;

  const cellW = width / countX;
  const cellH = height / countY;
  const cellD = depth / countZ;

  const cubeW = cellW * (1.0 - config.cubeGap);
  const cubeH = cellH * (1.0 - config.cubeGap);
  const cubeD = cellD * (1.0 - config.cubeGap);

  // 1. Create base BoxGeometry with explicit face attributes for Rubik's bevels
  const baseGeom = new THREE.BoxGeometry(1, 1, 1);
  const posAttr = baseGeom.getAttribute('position');
  const normalAttr = baseGeom.getAttribute('normal');
  const vertexCount = posAttr.count;

  const faceNormals = new Float32Array(vertexCount * 3);
  const faceUvs = new Float32Array(vertexCount * 2);

  // BoxGeometry standard order: +X, -X, +Y, -Y, +Z, -Z (4 vertices each)
  for (let face = 0; face < 6; face++) {
    const fnX = normalAttr.getX(face * 4);
    const fnY = normalAttr.getY(face * 4);
    const fnZ = normalAttr.getZ(face * 4);

    for (let v = 0; v < 4; v++) {
      const idx = face * 4 + v;
      faceNormals[idx * 3] = fnX;
      faceNormals[idx * 3 + 1] = fnY;
      faceNormals[idx * 3 + 2] = fnZ;

      // UV coordinates for the face corners
      const u = (v === 1 || v === 3) ? 1.0 : 0.0;
      const valY = (v === 2 || v === 3) ? 1.0 : 0.0;
      faceUvs[idx * 2] = u;
      faceUvs[idx * 2 + 1] = valY;
    }
  }

  baseGeom.setAttribute('aFaceNormal', new THREE.BufferAttribute(faceNormals, 3));
  baseGeom.setAttribute('aFaceUv', new THREE.BufferAttribute(faceUvs, 2));

  // 2. Setup InstancedMesh
  const uniforms = {
    uVolume: { value: texture },
    uTime: { value: 0.0 },
    uCurrentT: { value: 0.0 },
    uPastOpacity: { value: config.pastOpacity },
    uPastMinOpacity: { value: config.pastMinOpacity },
    uPastFalloff: { value: config.pastFalloff },
    uPastBlur: { value: config.pastBlur },
    uPastBlurMax: { value: config.pastBlurMax },
    uPastEdgeBlur: { value: config.pastEdgeBlur },
    uFutureDensity: { value: config.futureDensity },
    uFrameCount: { value: config.frameCount },
    uCubeCountX: { value: countX },
    uCubeCountY: { value: countY },
    uCubeCountZ: { value: countZ },
    uCameraPos: { value: new THREE.Vector3() },
    uTwistAngle: { value: 0.0 },
    uTwistLayer: { value: 0.5 }
  };

  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: cubeVertShader,
    fragmentShader: cubeFragShader,
    uniforms,
    transparent: true,
    depthWrite: true,
    depthTest: true
  });

  const instancedMesh = new THREE.InstancedMesh(baseGeom, material, totalCount);
  instancedMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

  const normPositions = new Float32Array(totalCount * 3);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(cubeW, cubeH, cubeD);
  const rotation = new THREE.Quaternion();

  let idx = 0;
  for (let iz = 0; iz < countZ; iz++) {
    // Frame 0 at front (+depth/2), last frame at back (-depth/2)
    const z = depth / 2 - (iz + 0.5) * cellD;
    const normT = (iz + 0.5) / countZ;

    for (let iy = 0; iy < countY; iy++) {
      const y = -height / 2 + (iy + 0.5) * cellH;
      const normV = (iy + 0.5) / countY;

      for (let ix = 0; ix < countX; ix++) {
        const x = -width / 2 + (ix + 0.5) * cellW;
        const normU = (ix + 0.5) / countX;

        position.set(x, y, z);
        matrix.compose(position, rotation, scale);
        instancedMesh.setMatrixAt(idx, matrix);

        normPositions[idx * 3] = normU;
        normPositions[idx * 3 + 1] = normV;
        normPositions[idx * 3 + 2] = normT;

        idx++;
      }
    }
  }

  instancedMesh.instanceMatrix.needsUpdate = true;
  baseGeom.setAttribute('aNormPos', new THREE.InstancedBufferAttribute(normPositions, 3));

  // Subtle reversible layer twist interaction
  let twistAngle = 0;
  let targetTwistAngle = 0;

  function triggerTwist(normZ) {
    uniforms.uTwistLayer.value = normZ;
    targetTwistAngle = 0.26; // ~15 degrees
  }

  function update(camera, currentT, time = 0) {
    uniforms.uCurrentT.value = currentT;
    uniforms.uTime.value = time;
    if (camera) {
      uniforms.uCameraPos.value.copy(camera.position);
    }

    // Reversible Rubik twist ease back to 0
    if (Math.abs(targetTwistAngle) > 0.001) {
      targetTwistAngle *= 0.92;
      if (Math.abs(targetTwistAngle) < 0.002) targetTwistAngle = 0;
    }
    twistAngle = THREE.MathUtils.lerp(twistAngle, targetTwistAngle, 0.15);
    uniforms.uTwistAngle.value = twistAngle;
  }

  return {
    mesh: instancedMesh,
    uniforms,
    triggerTwist,
    update
  };
}
