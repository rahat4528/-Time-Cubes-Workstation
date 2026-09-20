// Fragment shader for Instanced Cubelets with Prismatic Holographic Shading
precision highp float;
precision highp sampler3D;

uniform sampler3D uVolume;
uniform float uTime;
uniform float uCurrentT;
uniform float uPastOpacity;
uniform float uPastMinOpacity;
uniform float uPastFalloff;
uniform float uPastBlur;
uniform float uPastBlurMax;
uniform float uPastEdgeBlur;
uniform float uFutureDensity;
uniform float uFrameCount;
uniform float uCubeCountX;
uniform float uCubeCountY;
uniform float uCubeCountZ;
uniform vec3 uCameraPos;

in vec3 vWorldPos;
in vec3 vNormal;
in vec3 vFaceNormal;
in vec2 vFaceUv;
in vec3 vNormPos;
in vec3 vLocalPos;

out vec4 fragColor;

// Prismatic holographic spectrum function
vec3 holographicSpectral(float t) {
  vec3 a = vec3(0.55, 0.55, 0.55);
  vec3 b = vec3(0.45, 0.45, 0.45);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.00, 0.33, 0.67);
  return clamp(a + b * cos(6.28318 * (c * t + d)), 0.0, 1.0);
}

void main() {
  // 1. Calculate video UV coordinates across cubelet face
  vec2 videoUv = vNormPos.xy;
  float sampleT = vNormPos.z;

  if (vFaceNormal.z > 0.5) {
    // Front face: reconstructs the 2D video frame across cubelets
    videoUv += (vFaceUv - vec2(0.5)) * vec2(1.0 / uCubeCountX, 1.0 / uCubeCountY);
  } else if (vFaceNormal.z < -0.5) {
    // Back face
    videoUv += (vec2(1.0 - vFaceUv.x, vFaceUv.y) - vec2(0.5)) * vec2(1.0 / uCubeCountX, 1.0 / uCubeCountY);
  } else if (abs(vFaceNormal.y) > 0.5) {
    // Top / Bottom faces: shows time-smeared temporal depth
    videoUv.x += (vFaceUv.x - 0.5) / uCubeCountX;
    sampleT += (vFaceUv.y - 0.5) / uCubeCountZ;
  } else {
    // Left / Right faces: shows time-smeared temporal depth
    videoUv.y += (vFaceUv.y - 0.5) / uCubeCountY;
    sampleT += (vFaceUv.x - 0.5) / uCubeCountZ;
  }

  videoUv = clamp(videoUv, 0.0, 1.0);
  sampleT = clamp(sampleT, 0.0, 1.0);

  // 2. Temporal classification: PAST, PRESENT, FUTURE
  float dt = sampleT - uCurrentT;
  float sliceWidth = 0.015;

  // Bevel & Rubik's edge calculation on cubelet face
  float edgeDist = min(min(vFaceUv.x, 1.0 - vFaceUv.x), min(vFaceUv.y, 1.0 - vFaceUv.y));
  float bevelFactor = smoothstep(0.0, 0.07, edgeDist);
  float rimHighlight = (1.0 - smoothstep(0.01, 0.045, edgeDist));

  // Prismatic holographic shimmer calculation
  vec3 viewDir = normalize(uCameraPos - vWorldPos);
  float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.5);
  float holoPhase = fresnel * 1.8 + uTime * 0.15 + (vWorldPos.x + vWorldPos.y) * 0.4;
  vec3 holoColor = holographicSpectral(holoPhase);

  // Directional lighting with Gunmetal ambient
  vec3 lightDir = normalize(vec3(0.5, 0.8, 0.9));
  float diffuse = max(dot(vNormal, lightDir), 0.0) * 0.4 + 0.6;
  vec3 halfVec = normalize(lightDir + viewDir);
  float spec = pow(max(dot(vNormal, halfVec), 0.0), 32.0) * 0.25;

  vec4 finalColor = vec4(0.0);

  if (abs(dt) <= sliceWidth) {
    // ==========================================
    // PRESENT: sharp, dominant, crisp cut with luminous holographic edge
    // ==========================================
    vec4 col = texture(uVolume, vec3(videoUv.x, 1.0 - videoUv.y, sampleT));
    col.rgb = mix(vec3(0.04, 0.06, 0.09), col.rgb, bevelFactor);
    col.rgb = col.rgb * diffuse + vec3(spec);
    
    // Prismatic holographic edge highlight on present slice
    if (edgeDist < 0.05) {
      col.rgb = mix(col.rgb, holoColor * 1.4, rimHighlight * 0.7);
    }
    finalColor = vec4(col.rgb, 0.96);

  } else if (dt > sliceWidth) {
    // ==========================================
    // FUTURE: dense, solid, sharp block with Gunmetal sides
    // ==========================================
    vec4 col = texture(uVolume, vec3(videoUv.x, 1.0 - videoUv.y, sampleT));
    
    // Gunmetal tint on side faces for gallery installation look
    if (vFaceNormal.z <= 0.5) {
      col.rgb = mix(vec3(0.09, 0.12, 0.17), col.rgb, 0.65);
    }
    col.rgb = mix(vec3(0.03, 0.04, 0.06), col.rgb, bevelFactor);
    col.rgb = col.rgb * diffuse + vec3(spec * 0.4);

    // Subtle holographic rim reflection on cubelet edges
    col.rgb += holoColor * rimHighlight * 0.28;

    finalColor = vec4(col.rgb, uFutureDensity * 2.0);

  } else {
    // ==========================================
    // PAST: ethereal ghost trail with soft holographic dispersion
    // ==========================================
    float frameDist = abs(dt);
    float weight = exp(-frameDist * uPastFalloff * uFrameCount);

    // Past-only edge feather (UV space of volume)
    float globalEdge = min(min(videoUv.x, 1.0 - videoUv.x), min(videoUv.y, 1.0 - videoUv.y));
    float edgeFade = smoothstep(0.0, 0.10, globalEdge);

    float alpha = mix(uPastMinOpacity, uPastOpacity, weight) * edgeFade;
    float blur = mix(uPastBlur, uPastBlurMax, 1.0 - weight) + (1.0 - edgeFade) * uPastEdgeBlur;

    // Multi-tap blur kernel
    vec4 col = vec4(0.0);
    col += texture(uVolume, vec3(videoUv.x, 1.0 - videoUv.y, sampleT)) * 0.28;
    col += texture(uVolume, vec3(videoUv.x + blur, 1.0 - videoUv.y, sampleT)) * 0.12;
    col += texture(uVolume, vec3(videoUv.x - blur, 1.0 - videoUv.y, sampleT)) * 0.12;
    col += texture(uVolume, vec3(videoUv.x, 1.0 - videoUv.y + blur, sampleT)) * 0.12;
    col += texture(uVolume, vec3(videoUv.x, 1.0 - videoUv.y - blur, sampleT)) * 0.12;
    col += texture(uVolume, vec3(videoUv.x + blur * 0.707, 1.0 - videoUv.y + blur * 0.707, sampleT)) * 0.06;
    col += texture(uVolume, vec3(videoUv.x - blur * 0.707, 1.0 - videoUv.y + blur * 0.707, sampleT)) * 0.06;
    col += texture(uVolume, vec3(videoUv.x + blur * 0.707, 1.0 - videoUv.y - blur * 0.707, sampleT)) * 0.06;
    col += texture(uVolume, vec3(videoUv.x - blur * 0.707, 1.0 - videoUv.y - blur * 0.707, sampleT)) * 0.06;

    // Softened memory appearance with faint prismatic afterimage
    float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
    col.rgb = mix(vec3(lum) * vec3(0.85, 0.9, 1.0), col.rgb, 0.72);
    col.rgb = mix(vec3(0.02, 0.03, 0.05), col.rgb, bevelFactor);
    col.rgb += holoColor * (1.0 - weight) * 0.12 * rimHighlight;

    finalColor = vec4(col.rgb, max(alpha, uPastMinOpacity));
  }

  fragColor = finalColor;
}
