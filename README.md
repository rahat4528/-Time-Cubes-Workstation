# TIME CUBES

A fullscreen WebGL interactive artwork combining the visual language of a Rubik's Cube, a 3D voxel/cube grid, and a temporal video volume.

## Concept

In traditional video players, video exists as a 2D plane progressing through time. **TIME CUBES** transforms video footage into a physical-looking 3D sculpture composed of thousands of individually instanced, beveled miniature cubes (cubelets).

- **X axis** = Video Width
- **Y axis** = Video Height
- **Z axis** = TIME (Frame 0 at the front, last frame at the back)

The user interacts directly with the 3D sculpture by grabbing a luminous 3D traversal plane and dragging it through time along the Z axis.

- **PAST**: Ghost trail / temporal afterimage with exponential distance falloff, spatial blur, and 10% rim feathering. Always remains at least 4% visible.
- **PRESENT**: Sharp, high-contrast, dominant current frame slice with a luminous white outline.
- **FUTURE**: Dense, solid, sharp block with dark sides and physical cubelet separation.

## Stack

- **Vite** 6
- **Vanilla JavaScript** (ES Modules)
- **Three.js** r180+
- **WebGL2** & **GLSL 3.0** (`Data3DTexture`, `InstancedMesh`)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/) in your browser.

### Interactions

1. **Scrub Time**: Hover over the white-bordered slice until the cursor changes to `grab`. Drag along the cube to scrub through time (`grabbing` cursor). OrbitControls are disabled during drag.
2. **Camera Orbit**: Left-click and drag anywhere outside the traversal plane to orbit the camera in 3D around the sculpture.
3. **Subtle Rubik Layer Twist**: Right-click any cubelet to trigger a subtle, reversible Rubik layer rotation that gently springs back without disturbing the temporal axis.
4. **Debug Jump**: Append `?slice=0.5` to the URL to jump directly to 50% time depth on load.
