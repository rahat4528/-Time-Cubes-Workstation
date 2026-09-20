precision highp float;

out vec3 vLocalPos;
out vec3 vLocalCamPos;

void main() {
  vLocalPos = position;
  vLocalCamPos = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
