import * as THREE from 'three';
import { config } from './config.js';

export async function extractVolume() {
  // 7.1 Preferred load path: Pre-pack frames with ffmpeg, then fetch them
  try {
    const res = await fetch('/assets/volume.json');
    if (res.ok) {
      const meta = await res.json();
      const rgbaRes = await fetch(meta.url || '/assets/volume.rgba');
      if (rgbaRes.ok) {
        const buffer = await rgbaRes.arrayBuffer();
        const data = new Uint8Array(buffer);
        const texture = create3DTexture(data, meta.width, meta.height, meta.depth);
        return {
          texture,
          width: meta.width,
          height: meta.height,
          depth: meta.depth,
          videoAspect: meta.width / meta.height
        };
      }
    }
  } catch (err) {
    console.warn('Preferred packed volume load failed, falling back to video extraction:', err);
  }

  // 7.2 Fallback: Seek through <video>, detect black letterbox rows, crop, scale to 512, sample 96 frames
  return await extractFromVideoFallback();
}

function create3DTexture(data, width, height, depth) {
  const texture = new THREE.Data3DTexture(data, width, height, depth);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.unpackAlignment = 1;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

async function extractFromVideoFallback() {
  const video = document.getElementById('source-video') || document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = '/assets/intersection.mp4';

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = (e) => reject(new Error('Failed to load fallback video: ' + e.message));
  });

  const origWidth = video.videoWidth;
  const origHeight = video.videoHeight;
  const duration = video.duration || 1.0;
  const frameCount = config.frameCount;
  const targetWidth = config.maxTexWidth;

  // Step 1: Detect letterbox rows on initial frame
  await seekVideo(video, 0.05);

  const scanCanvas = document.createElement('canvas');
  scanCanvas.width = origWidth;
  scanCanvas.height = origHeight;
  const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
  scanCtx.drawImage(video, 0, 0, origWidth, origHeight);

  const scanImg = scanCtx.getImageData(0, 0, origWidth, origHeight).data;
  let topBlack = 0;
  let bottomBlack = 0;

  for (let y = 0; y < Math.floor(origHeight * 0.4); y++) {
    let rowSum = 0;
    const offset = y * origWidth * 4;
    for (let x = 0; x < origWidth; x += 4) {
      const idx = offset + x * 4;
      rowSum += scanImg[idx] + scanImg[idx + 1] + scanImg[idx + 2];
    }
    const avg = rowSum / ((origWidth / 4) * 3);
    if (avg < 12) {
      topBlack = y + 1;
    } else {
      break;
    }
  }

  for (let y = origHeight - 1; y > Math.ceil(origHeight * 0.6); y--) {
    let rowSum = 0;
    const offset = y * origWidth * 4;
    for (let x = 0; x < origWidth; x += 4) {
      const idx = offset + x * 4;
      rowSum += scanImg[idx] + scanImg[idx + 1] + scanImg[idx + 2];
    }
    const avg = rowSum / ((origWidth / 4) * 3);
    if (avg < 12) {
      bottomBlack = origHeight - y;
    } else {
      break;
    }
  }

  let cropY = topBlack;
  let cropHeight = origHeight - topBlack - bottomBlack;
  if (cropHeight < 50) {
    cropY = 0;
    cropHeight = origHeight;
  }

  let targetHeight = Math.round((targetWidth / origWidth) * cropHeight);
  if (targetHeight % 2 !== 0) targetHeight += 1;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const totalBytes = targetWidth * targetHeight * frameCount * 4;
  const data = new Uint8Array(totalBytes);

  for (let i = 0; i < frameCount; i++) {
    const t = (i / (frameCount - 1)) * (duration - 0.05);
    await seekVideo(video, Math.max(0, t));
    ctx.drawImage(video, 0, cropY, origWidth, cropHeight, 0, 0, targetWidth, targetHeight);
    const frameData = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
    data.set(frameData, i * targetWidth * targetHeight * 4);
  }

  const texture = create3DTexture(data, targetWidth, targetHeight, frameCount);
  return {
    texture,
    width: targetWidth,
    height: targetHeight,
    depth: frameCount,
    videoAspect: targetWidth / targetHeight
  };
}

function seekVideo(video, time) {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
    setTimeout(resolve, 500); // Fallback timeout if seeked doesn't fire
  });
}
