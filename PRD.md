# PRD: Spatial Video Time Cube

**Product:** A fullscreen Three.js artwork that treats a 2D video as a 3D volume, where **time is depth**.

**Audience:** Engineers and AI coding agents recreating this exact experience.

**Stack:** Vite, vanilla JavaScript, Three.js r180, WebGL2 `Data3DTexture`, GLSL 3.0.

This document is the source of truth. Recreate the product described here. Do not invent a six-sided video-textured box, HTML timeline, autoplay, or auto-rotating camera.

---

## 1. One-sentence pitch

A black fullscreen WebGL scene in which a video becomes a rectangular solid. Dragging a sharp slice through that solid scrubs time: the present is a clear frame, the past is a never-vanishing blur trail, and the future is a dense video block.

---

## 2. What this is not

| Do not build | Why |
| --- | --- |
| The same MP4 mapped onto all six faces of a cube | That is a texture wallpaper, not a time volume |
| Autoplaying video while the camera orbits | Time is user-controlled, not playback |
| An HTML `<input type="range">` | The 3D slice **is** the slider |
| Orthographic camera | Perspective is required |
| Visible website chrome (nav, buttons, HUD, text besides loading) | Experimental art piece |

---

## 3. Core metaphor

```
X  =  video width
Y  =  video height
Z  =  time
```

Frame 0 sits at the **front** of the cube (toward the camera). The last frame sits at the **back**.

The user drags a **traversal plane** along Z. That plane is the present.

```
FRONT (+Z, toward camera)                         BACK (−Z)
Frame 0 ────────────────────────────────────────── last frame

Slider at 0%
┌─────────────────────────────────────────────────┐
│ ████████  SOLID FUTURE (entire cube)  ████████  │
│ Front face = sharp current frame                │
└─────────────────────────────────────────────────┘

Slider at 50%
┌──────────────────┬──────────────────────────────┐
│  PAST BLUR TRAIL │  SHARP CURRENT  │ SOLID FUTURE│
│  already viewed  │  slice / present│  not yet    │
└──────────────────┴──────────────────────────────┘

Slider at 100%
┌─────────────────────────────────────────────────┐
│  PAST BLUR TRAIL (still visible, ≥ 4%)          │
│  Current frame on the back face                 │
└─────────────────────────────────────────────────┘
```

**Past** = frames the slider has already passed (in front of the slice, toward the camera).  
**Present** = the traversal plane.  
**Future** = frames still behind the slice (a solid block).

---

## 4. Visual states (must match)

### 4.1 Slider at 0% (start)

- The cube is a **solid video volume**.
- The front face is a **sharp, readable** video frame.
- The top and right faces show **time-smeared perspectives** of the same footage (slit-scan / volume sides), not a duplicate of the front image.
- Thin gray-white wireframe around the box.
- Pure black background.

### 4.2 Slider at 50%

- A sharp current frame sits **inside** the cube, not on the front wall.
- **Behind the slice** (future): a dense solid of remaining frames, with smeared top/side perspectives.
- **In front of the slice** (past): a see-through **blur trail**. You can still see the current frame through it.
- Current frame stays readable. It must not be buried under dozens of opaque sheets.

### 4.3 Slider at 100% (end)

- Current frame is on the **back** of the cube.
- The front of the cube is **not empty**. Every past frame remains on screen.
- Farthest past frames stay at least **4% visible**.
- Blur increases with distance from the slice, then **caps** (does not dissolve to nothing).

---

## 5. Interaction

### 5.1 Drag the present

There is **no HTML slider**.

1. Hover the current-frame plane: cursor `grab`, white border brightens.
2. Pointer down on that plane: cursor `grabbing`, orbit controls disable.
3. Drag: a camera-facing drag plane converts the pointer ray into the volume’s **local Z**.
4. Local Z maps to frame index. The current frame updates **immediately** (no lag while dragging).
5. Pointer up / cancel: orbit re-enables. Optional short lerp only when not dragging.

Use **Pointer Events** (mouse and touch). `touch-action: none` on the canvas.

### 5.2 Orbit

`OrbitControls` with:

- `autoRotate = false`
- `enablePan = false`
- `enableDamping = true`, damping `0.08`
- `minDistance = 0.8`, `maxDistance = 8`

Orbit and time are independent. Dragging the slice must not move the camera.

### 5.3 Optional debug URL

`?slice=0.5` jumps to 50% on load. Not shown in the UI.

---

## 6. Scene architecture

```
Scene  (background #000000)
│
├── TemporalVolume
│   ├── FrameVolume          raymarched unit box, scaled to (width, height, depth)
│   ├── TraversalPlane       sharp current video slice + white EdgesGeometry
│   └── VolumeEdges          box outline, white, opacity 0.22
│
└── PerspectiveCamera        FOV 28, lookAt(0,0,0)
```

### 6.1 Size

```
height = 1
width  = videoAspect * height
depth  = 1.15
frontZ = +depth / 2
backZ  = −depth / 2
```

```
frameToZ(i) = lerp(frontZ, backZ, i / (frameCount − 1))
```

Frame 0 → front. Last frame → back.

### 6.2 Camera fit

Fit using `max(width, height)` (not depth) so the **front face is large and readable**.

```
dist = (maxDim / 2) / tan(fov/2) * 1.05
camera.position.set(dist * 0.48, dist * 0.36, dist * 0.92)
camera.lookAt(0, 0, 0)
```

This is a 3/4 view: front + top + one side, like the reference reels.

---

## 7. Video as a 3D texture

One `HTMLVideoElement` (hidden, muted, **not** autoplay). One `THREE.Data3DTexture`.

### 7.1 Preferred load path

Pre-pack frames with ffmpeg, then fetch them:

```
public/assets/volume.json
public/assets/volume.rgba      // gitignored, raw RGBA
public/assets/intersection.mp4 // gitignored source clip
```

`volume.json`:

```json
{ "width": 512, "height": 214, "depth": 96, "url": "/assets/volume.rgba" }
```

Pack command (crop letterbox first; example crop for a 1920×1080 letterboxed clip is `1920:800:0:140`):

```bash
ffmpeg -y -i public/assets/intersection.mp4 \
  -vf "crop=W:H:X:Y,scale=512:214:flags=lanczos,fps=96/DURATION" \
  -frames:v 96 -pix_fmt rgba -f rawvideo public/assets/volume.rgba
```

Texture settings:

- `RGBAFormat`, `UnsignedByteType`
- `LinearFilter` min/mag
- `ClampToEdge` on S, T, R
- `unpackAlignment = 1`
- `generateMipmaps = false`
- `colorSpace = NoColorSpace`

### 7.2 Fallback

If the packed volume is missing, seek through the `<video>`, detect black letterbox rows, crop, scale to width 512 (even height), sample 96 frames into the same 3D texture.

The video must never play as a timeline. Seeking is only for extraction.

---

## 8. Rendering model

Two materials. This split is mandatory.

### 8.1 Future + past: raymarched box

- Geometry: `BoxGeometry(1,1,1)` scaled to `(width, height, depth)`
- `ShaderMaterial`, `glslVersion: THREE.GLSL3`
- `side: THREE.BackSide`, `transparent: true`, `depthWrite: false`
- `renderOrder: 1`
- 128 raymarch steps, front-to-back alpha compositing
- Time sample: `sampleT = 1.0 - uvw.z` so **front of the box is t = 0**
- Y flip: `texture(uVolume, vec3(uv.x, 1.0 - uv.y, t))`

Per-sample classification (`dt = sampleT - uCurrentT`, slice width `0.012`):

| Region | Condition | Look |
| --- | --- | --- |
| **Past** | `dt < −sliceWidth` | Blur trail. Opacity lerps from `pastOpacity` (near) to `pastMinOpacity` **0.04** (far). Never below 4%. Blur lerps from `0.002` to `0.018`. |
| **Present** | `\|dt\| ≤ sliceWidth` | Skip in the volume shader. The traversal plane draws this. |
| **Future** | `dt > sliceWidth` | Solid block. Constant density `0.42` per step. Sharp. **No** edge fade. |

Past-only edge feather (UV space of each slice):

```
edge = min(uv.x, 1−uv.x, uv.y, 1−uv.y)
edgeFade = smoothstep(0.0, 0.10, edge)
```

- Border: **0%** visible  
- 10% inward: full past opacity for that sample  
- Extra blur on the rim: `(1.0 - edgeFade) * 0.035`

This feather applies **only to past / already-viewed samples**. Future stays hard-edged so the two sides of the cut read differently.

### 8.2 Present: traversal plane

- `PlaneGeometry(width, height)` at `z = frameToZ(currentFrame)`
- Separate shader sampling **only** `uCurrentT`
- Opacity `0.96`, **no blur**, `depthWrite: true`, `DoubleSide`
- `renderOrder: 5` so it stays readable through the past trail
- White `EdgesGeometry` border, opacity `0.45` (hover `0.80`)
- This mesh is the raycast target and the 3D slider

While dragging, set `traversalPlane.position.z` to the target immediately. When idle, lerp with factor `0.12`.

---

## 9. Page chrome

- Full viewport, `overflow: hidden`, background `#000000`
- Hidden 1×1 source `<video>`: `muted playsinline preload="auto"` — **no autoplay, no loop required**
- Centered `LOADING` text: 11px, letter-spacing `0.42em`, color `rgba(255,255,255,0.28)`
- Hide loading with class `hidden` (opacity 0 + visibility hidden) after the volume is ready
- No range input, no labels, no buttons

Renderer:

```
antialias: true
clear color: #000000
outputColorSpace: SRGBColorSpace
pixel ratio: min(devicePixelRatio, 2)  // 1.5 on viewports < 768px
```

---

## 10. File map

```
project/
├── index.html
├── package.json              # "type": "module", three ^0.180, vite ^6
├── vite.config.js            # port 5173, host: true
├── PRD.md
├── public/assets/
│   ├── intersection.mp4      # user-supplied source (gitignored)
│   ├── volume.rgba           # packed frames (gitignored)
│   └── volume.json
└── src/
    ├── main.js               # bootstrap, resize, render loop
    ├── config.js             # all tunables listed below
    ├── scene.js              # renderer + scene
    ├── camera.js             # perspective + OrbitControls + fit
    ├── extractVolume.js      # packed RGBA load, video fallback
    ├── videoVolume.js        # raymarch + slice + edges
    ├── interaction.js        # pointer drag → local Z → frame
    └── styles.css
```

---

## 11. Exact tunables (`src/config.js`)

```js
{
  maxTexWidth: 512,
  frameCount: 96,
  volumeDepth: 1.15,
  edgeOpacity: 0.22,
  cameraFov: 28,
  fitPadding: 1.05,

  currentOpacity: 0.96,
  pastOpacity: 0.22,
  pastMinOpacity: 0.04,
  pastFalloff: 0.09,
  pastBlur: 0.002,
  pastBlurMax: 0.018,
  pastEdgeBlur: 0.035,
  futureDensity: 0.42,
  currentEdgeOpacity: 0.4,
  traversalLerp: 0.12,
  hoverEdgeOpacity: 0.8,
  traversalEdgeOpacity: 0.45,
}
```

Past weight in the shader:

```
weight = exp(−frameDist * pastFalloff * 96)
alpha  = mix(pastMinOpacity, pastOpacity, weight) * edgeFade
blur   = mix(pastBlur, pastBlurMax, 1 − weight) + (1 − edgeFade) * pastEdgeBlur
```

---

## 12. Drag math

```
pointer NDC → raycaster.setFromCamera
on down: intersect TraversalPlane
         dragPlane = camera-facing plane through hit point
         OrbitControls.enabled = false

on move: ray ∩ dragPlane → world point
         volume.worldToLocal(point)
         t = clamp((frontZ − local.z) / (frontZ − backZ), 0, 1)
         currentFrame = round(t * (frameCount − 1))
         setCurrentFrame(currentFrame, immediate = true)

on up:   OrbitControls.enabled = true
```

---

## 13. Definition of done

The recreation is complete only if all of the following are true:

1. Black fullscreen canvas, no website UI, no HTML slider.
2. A rectangular volume of the source video appears, letterbox bars cropped.
3. At 0%, the front face is a sharp frame; top/side faces look like a solid time block.
4. Dragging the bordered slice moves it through the cube and scrubs frames immediately.
5. The current slice stays **clear** at 10%, 50%, and 100% — not buried by stacked sheets.
6. Past (already viewed) is a blur trail with feathered edges (0% at the border → interior by 10% UV).
7. Past frames **never vanish**; farthest past ≥ **4%** visible, blur capped.
8. Future is a **sharp solid** block, visually different from the past trail.
9. Camera orbit works when not dragging; it does not auto-rotate or auto-play the video.
10. `npm run dev` serves the piece at `http://localhost:5173/`.

---

## 14. Agent prompt

Copy everything in the block below into a new chat with a coding agent.

```text
Recreate this exact product from the PRD in this repo (PRD.md). Do not improvise a different effect.

Build a Vite + vanilla JS + Three.js r180 fullscreen WebGL artwork on a pure black page. There is no HTML range slider, no autoplay, no auto-rotating camera, and no website chrome.

Treat the source MP4 as a 3D texture: X = width, Y = height, Z = time. Pack ~96 letterbox-cropped frames into a Data3DTexture (prefer a prebuilt public/assets/volume.rgba + volume.json; fallback to seeking the hidden <video>).

The cube is a cut through that volume:
- Frame 0 is the FRONT (+Z). The last frame is the BACK (−Z).
- A traversal plane is the current moment. It shows the current frame sharply (opacity 0.96, no blur, depthWrite true) with a white edge. The user grabs this plane and drags it through the cube. Pointer ray → camera-facing drag plane → volume local Z → frame index. Update immediately while dragging. Disable OrbitControls during the drag.
- PAST (already in front of the slice): raymarched blur trail. Opacity falls off with temporal distance but NEVER below 4%. Blur increases with distance then caps. On past samples only, feather UV edges: 0% opacity at the frame border, full past opacity at 10% inward, plus extra edge blur. Future must NOT get this feather.
- FUTURE (behind the slice): raymarched SOLID video block, density ~0.42 per step, sharp edges, time-smeared top/side faces.
- Skip a thin current band in the volume shader so the traversal plane owns the present.

Camera: perspective FOV 28, 3/4 view fitted to the front face (see PRD camera formula). OrbitControls, no autoRotate, no pan. Black clear color. Loading text then fade out.

Use the exact CONFIG values and file layout in PRD.md. Verify in the browser at 0%, 50%, and 100%: current frame stays readable, past trail remains at 100%, future looks like a solid block, no HTML slider.
```

---

## 15. Run

```bash
npm install
# place intersection.mp4 (and optionally volume.rgba) in public/assets/
npm run dev
```

Open `http://localhost:5173/`. Grab the white-framed slice and pull it through the cube.
