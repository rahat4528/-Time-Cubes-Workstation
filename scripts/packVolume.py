import os
import json
import cv2
import numpy as np

assets_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets')
os.makedirs(assets_dir, exist_ok=True)

video_path = os.path.join(assets_dir, 'intersection.mp4')
rgba_path = os.path.join(assets_dir, 'volume.rgba')
json_path = os.path.join(assets_dir, 'volume.json')

target_w = 512
target_h = 214
target_frames = 96

cap = cv2.VideoCapture(video_path)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

print(f"Packing {video_path}: {orig_w}x{orig_h}, {total_frames} total frames -> {target_w}x{target_h}x{target_frames} RGBA")

# Calculate crop height to match 512x214 aspect ratio (2.39:1 widescreen)
crop_h = int(orig_w * target_h / target_w)
if crop_h > orig_h:
    crop_h = orig_h
    crop_w = int(orig_h * target_w / target_h)
    crop_x = (orig_w - crop_w) // 2
    crop_y = 0
else:
    crop_w = orig_w
    crop_x = 0
    crop_y = (orig_h - crop_h) // 2

# Sample 96 frames evenly
indices = np.linspace(0, total_frames - 1, target_frames, dtype=int)
packed_bytes = bytearray()

for idx in indices:
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
    ret, frame = cap.read()
    if not ret:
        print(f"Warning: frame {idx} could not be read")
        frame = np.zeros((orig_h, orig_w, 3), dtype=np.uint8)
    
    # Crop
    cropped = frame[crop_y:crop_y+crop_h, crop_x:crop_x+crop_w]
    # Resize with Lanczos interpolation
    resized = cv2.resize(cropped, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)
    # Convert BGR to RGBA
    rgba = cv2.cvtColor(resized, cv2.COLOR_BGR2RGBA)
    packed_bytes.extend(rgba.tobytes())

cap.release()

with open(rgba_path, 'wb') as f:
    f.write(packed_bytes)

meta = {
    "width": target_w,
    "height": target_h,
    "depth": target_frames,
    "url": "/assets/volume.rgba"
}

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(meta, f, indent=2)

print(f"Successfully generated {rgba_path} ({len(packed_bytes)} bytes) and {json_path}")
