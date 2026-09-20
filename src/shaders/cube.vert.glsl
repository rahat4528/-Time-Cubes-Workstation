// Vertex shader for Instanced Cubelets with temporal breathing
precision highp float;

in vec3 aNormPos;    // Normalized (u, v, t) in [0, 1]^3
in vec3 aFaceNormal; // Face normal: (0,0,1) front, (0,0,-1) back, etc.
in vec2 aFaceUv;     // UV across the face [0, 1]

uniform float uTime;
uniform float uCurrentT;
uniform float uTwistAngle;
uniform float uTwistLayer;

out vec3 vWorldPos;
out vec3 vNormal;
out vec3 vFaceNormal;
out vec2 vFaceUv;
out vec3 vNormPos;
out vec3 vLocalPos;

void main() {
  vFaceNormal = aFaceNormal;
  vFaceUv = aFaceUv;
  vNormPos = aNormPos;
  vLocalPos = position;

  vec3 pos = position;

  // Organic time-based micro wave breathing tied to elapsed time
  float wave = sin(uTime * 1.6 + aNormPos.x * 3.5 + aNormPos.z * 5.0) * 0.007;
  pos.z += wave;

  // Subtle reversible Rubik layer rotation
  if (abs(aNormPos.z - uTwistLayer) < 0.04) {
    float c = cos(uTwistAngle);
    float s = sin(uTwistAngle);
    pos.xy = mat2(c, -s, s, c) * pos.xy;
  }

  // Transform through instance matrix
  vec4 worldPos = modelMatrix * instanceMatrix * vec4(pos, 1.0);
  vWorldPos = worldPos.xyz;

  // Transform normal
  mat3 normalMat = mat3(modelMatrix * instanceMatrix);
  vNormal = normalize(normalMat * normal);

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
