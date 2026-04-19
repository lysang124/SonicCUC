#version 300 es
precision mediump float;

uniform vec3 soundColor;
uniform float soundIntensity;
uniform float time;

in vec2 v_position;
in float v_life;

out vec4 fragColor;

void main() {
    // 基于声音强度和颜色计算粒子颜色
    vec3 baseColor = soundColor;
    float alpha = soundIntensity * 0.6 * v_life;

    // 添加发光效果
    float glow = smoothstep(0.5, 0.0, length(gl_PointCoord - vec2(0.5)));
    vec3 finalColor = baseColor * (1.0 + glow * 2.0);

    fragColor = vec4(finalColor, alpha);
}