import * as THREE from 'three';
import { config } from './config.js';

export function setupInteraction({ renderer, camera, controls, timeCubes }) {
  const domElement = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const worldHitPoint = new THREE.Vector3();
  const planeNormal = new THREE.Vector3();
  const dragPlane = new THREE.Plane();

  let isDragging = false;
  let isHovered = false;

  function updatePointer(e) {
    const rect = domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onPointerMove(e) {
    updatePointer(e);
    raycaster.setFromCamera(pointer, camera);

    if (isDragging) {
      if (raycaster.ray.intersectPlane(dragPlane, worldHitPoint)) {
        const localPoint = worldHitPoint.clone();
        timeCubes.group.worldToLocal(localPoint);

        const t = THREE.MathUtils.clamp(
          (timeCubes.frontZ - localPoint.z) / (timeCubes.frontZ - timeCubes.backZ),
          0.0,
          1.0
        );
        const frameIndex = Math.round(t * (config.frameCount - 1));
        timeCubes.setCurrentFrame(frameIndex, true);
      }
      return;
    }

    // Hover test against TraversalPlane
    const intersects = raycaster.intersectObject(timeCubes.traversalPlane.mesh, false);
    if (intersects.length > 0) {
      if (!isHovered) {
        isHovered = true;
        domElement.style.cursor = 'grab';
        timeCubes.traversalPlane.setHovered(true);
      }
    } else {
      if (isHovered) {
        isHovered = false;
        domElement.style.cursor = 'default';
        timeCubes.traversalPlane.setHovered(false);
      }
    }
  }

  function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') {
      // Secondary Rubik layer twist on right-click
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(timeCubes.cubelets.mesh, false);
      if (hits.length > 0) {
        const localPoint = hits[0].point.clone();
        timeCubes.group.worldToLocal(localPoint);
        const normZ = THREE.MathUtils.clamp(
          (timeCubes.frontZ - localPoint.z) / (timeCubes.frontZ - timeCubes.backZ),
          0.0,
          1.0
        );
        timeCubes.cubelets.triggerTwist(normZ);
      }
      return;
    }

    updatePointer(e);
    raycaster.setFromCamera(pointer, camera);

    const intersects = raycaster.intersectObject(timeCubes.traversalPlane.mesh, false);
    if (intersects.length > 0) {
      isDragging = true;
      domElement.style.cursor = 'grabbing';
      controls.enabled = false;

      const hitPoint = intersects[0].point;
      // Camera-facing drag plane through hit point
      camera.getWorldDirection(planeNormal).negate();
      dragPlane.setFromNormalAndCoplanarPoint(planeNormal, hitPoint);

      if (domElement.setPointerCapture) {
        try {
          domElement.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
      e.preventDefault();
    }
  }

  function onPointerUp(e) {
    if (isDragging) {
      isDragging = false;
      controls.enabled = true;

      if (domElement.releasePointerCapture) {
        try {
          domElement.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }

      // Restore hover cursor
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObject(timeCubes.traversalPlane.mesh, false);
      if (intersects.length > 0) {
        domElement.style.cursor = 'grab';
        isHovered = true;
        timeCubes.traversalPlane.setHovered(true);
      } else {
        domElement.style.cursor = 'default';
        isHovered = false;
        timeCubes.traversalPlane.setHovered(false);
      }
    }
  }

  // Prevent context menu on right click to allow subtle Rubik twist
  domElement.addEventListener('contextmenu', (e) => e.preventDefault());

  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointerup', onPointerUp);
  domElement.addEventListener('pointercancel', onPointerUp);

  // Debug URL: ?slice=0.5 jumps to 50% on load.
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('slice')) {
    const slice = parseFloat(urlParams.get('slice'));
    if (!isNaN(slice)) {
      timeCubes.setTraversalProgress(slice, true);
    }
  }

  return {
    isDragging: () => isDragging
  };
}
