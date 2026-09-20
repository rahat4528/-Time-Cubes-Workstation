precision highp float;
precision highp sampler3D;

uniform sampler3D uVolume;
uniform float uCurrentT;
uniform float uPastOpacity;
uniform float uPastMinOpacity;
uniform float uPastFalloff;
uniform float uPastBlur;
uniform float uPastBlurMax;
uniform float uPastEdgeBlur;
uniform float uFutureDensity;
uniform float uSliceWidth;

in vec3 vLocalPos;
in vec3 vLocalCamPos;
out vec4 fragColor;

void main() {
  vec3 rayDir = normalize(vLocalPos - vLocalCamPos);
  
  // Intersect ray with unit box [-0.5, 0.5]^3
  vec3 invDir = 1.0 / (rayDir + vec3(1e-7));
  vec3 t0 = (vec3(-0.5) - vLocalCamPos) * invDir;
  vec3 t1 = (vec3(0.5) - vLocalCamPos) * invDir;
  vec3 tmin = min(t0, t1);
  vec3 tmax = max(t0, t1);
  
  float tNear = max(max(tmin.x, tmin.y), tmin.z);
  float tFar = min(min(tmax.x, tmax.y), tmax.z);
  
  tNear = max(tNear, 0.0);
  
  if (tFar <= tNear) {
    discard;
  }
  
  float dist = tFar - tNear;
  float stepSize = dist / 128.0;
  
  vec4 accum = vec4(0.0);
  
  for (int i = 0; i < 128; i++) {
    float t = tNear + (float(i) + 0.5) * stepSize;
    vec3 p = vLocalCamPos + rayDir * t;
    vec3 uvw = p + 0.5;
    
    // Time sample: sampleT = 1.0 - uvw.z so front of box (+Z) is t = 0
    float sampleT = clamp(1.0 - uvw.z, 0.0, 1.0);
    float dt = sampleT - uCurrentT;
    
    if (abs(dt) <= uSliceWidth) {
      // Present: skip in the volume shader. The traversal plane draws this.
      continue;
    }
    
    if (dt > uSliceWidth) {
      // Future: solid block. Constant density 0.42 per step. Sharp. No edge fade.
      vec4 col = texture(uVolume, vec3(uvw.x, 1.0 - uvw.y, sampleT));
      float stepAlpha = uFutureDensity;
      
      accum.rgb += (1.0 - accum.a) * col.rgb * stepAlpha;
      accum.a += (1.0 - accum.a) * stepAlpha;
    } else {
      // Past: dt < -uSliceWidth
      float frameDist = abs(dt);
      float weight = exp(-frameDist * uPastFalloff * 96.0);
      
      // Past-only edge feather (UV space of each slice)
      float edge = min(min(uvw.x, 1.0 - uvw.x), min(uvw.y, 1.0 - uvw.y));
      float edgeFade = smoothstep(0.0, 0.10, edge);
      
      float alpha = mix(uPastMinOpacity, uPastOpacity, weight) * edgeFade;
      float blur = mix(uPastBlur, uPastBlurMax, 1.0 - weight) + (1.0 - edgeFade) * uPastEdgeBlur;
      
      vec4 col = vec4(0.0);
      col += texture(uVolume, vec3(uvw.x, 1.0 - uvw.y, sampleT)) * 0.28;
      col += texture(uVolume, vec3(uvw.x + blur, 1.0 - uvw.y, sampleT)) * 0.12;
      col += texture(uVolume, vec3(uvw.x - blur, 1.0 - uvw.y, sampleT)) * 0.12;
      col += texture(uVolume, vec3(uvw.x, 1.0 - uvw.y + blur, sampleT)) * 0.12;
      col += texture(uVolume, vec3(uvw.x, 1.0 - uvw.y - blur, sampleT)) * 0.12;
      col += texture(uVolume, vec3(uvw.x + blur * 0.707, 1.0 - uvw.y + blur * 0.707, sampleT)) * 0.06;
      col += texture(uVolume, vec3(uvw.x - blur * 0.707, 1.0 - uvw.y + blur * 0.707, sampleT)) * 0.06;
      col += texture(uVolume, vec3(uvw.x + blur * 0.707, 1.0 - uvw.y - blur * 0.707, sampleT)) * 0.06;
      col += texture(uVolume, vec3(uvw.x - blur * 0.707, 1.0 - uvw.y - blur * 0.707, sampleT)) * 0.06;
      
      float stepAlpha = alpha * 0.35;
      accum.rgb += (1.0 - accum.a) * col.rgb * stepAlpha;
      accum.a += (1.0 - accum.a) * stepAlpha;
    }
    
    if (accum.a >= 0.98) {
      break;
    }
  }
  
  fragColor = accum;
}
