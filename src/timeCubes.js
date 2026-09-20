import * as THREE from 'three';
import { config } from './config.js';
import { createCubelets } from './cubelets.js';
import { createTraversalPlane } from './traversalPlane.js';

export function createTimeCubes(volumeData) {
  const { videoAspect } = volumeData;
  const height = 1.0;
  const width = videoAspect * height;
  const depth = config.volumeDepth;
  const frontZ = depth / 2;
  const backZ = -depth / 2;

  const timeCubesGroup = new THREE.Group();

  function frameToZ(i) {
    return THREE.MathUtils.lerp(frontZ, backZ, i / (config.frameCount - 1));
  }

  function zToT(z) {
    return THREE.MathUtils.clamp((frontZ - z) / (frontZ - backZ), 0.0, 1.0);
  }

  // 1. Instanced Cubelets (Voxel Rubik's Sculpture)
  const cubelets = createCubelets(volumeData, width, height, depth);
  timeCubesGroup.add(cubelets.mesh);

  // 2. Traversal Plane (Sharp Present Slice)
  const traversalPlane = createTraversalPlane(volumeData, width, height);
  traversalPlane.setPositionZ(frontZ);
  timeCubesGroup.add(traversalPlane.mesh);

  // 3. VolumeEdges (Subtle white outer frame wireframe)
  const boxEdgesGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth));
  const boxEdgesMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: config.edgeOpacity
  });
  const volumeEdges = new THREE.LineSegments(boxEdgesGeom, boxEdgesMat);
  timeCubesGroup.add(volumeEdges);

  // Temporal State
  let currentFrame = 0;
  let targetZ = frontZ;
  let currentZ = frontZ;

  function setCurrentFrame(frameIndex, immediate = false) {
    currentFrame = THREE.MathUtils.clamp(frameIndex, 0, config.frameCount - 1);
    targetZ = frameToZ(currentFrame);
    if (immediate) {
      currentZ = targetZ;
      traversalPlane.setPositionZ(currentZ);
      const t = zToT(currentZ);
      traversalPlane.setCurrentT(t);
    }
  }

  function setTraversalProgress(t, immediate = false) {
    const frame = Math.round(t * (config.frameCount - 1));
    setCurrentFrame(frame, immediate);
  }

  function update(camera, time = 0) {
    if (Math.abs(currentZ - targetZ) > 0.0001) {
      currentZ = THREE.MathUtils.lerp(currentZ, targetZ, config.traversalLerp);
      traversalPlane.setPositionZ(currentZ);
      const t = zToT(currentZ);
      traversalPlane.setCurrentT(t);
    }

    const t = zToT(currentZ);
    cubelets.update(camera, t, time);
  }

  return {
    group: timeCubesGroup,
    cubelets,
    traversalPlane,
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
    update
  };
}
