import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '..', 'public', 'assets');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

const targetFile = path.join(assetsDir, 'intersection.mp4');

async function downloadVideo() {
  const url = 'https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/person-bicycle-car-detection.mp4';
  console.log('Downloading intersection.mp4...');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(targetFile, Buffer.from(arrayBuffer));
  console.log(`Saved intersection.mp4 (${(arrayBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB)`);
}

downloadVideo().catch(err => {
  console.error('Download error:', err);
  process.exit(1);
});
