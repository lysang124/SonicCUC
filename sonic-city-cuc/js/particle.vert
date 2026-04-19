#version 300 es
precision highp float;

uniform float time;
uniform vec2 resolution;
uniform vec2 mouse;
uniform float soundIntensity;
uniform vec3 soundColor;

layout(location=0) in vec2 position;
layout(location=1) in vec2 velocity;
layout(location=2) in float life;

out vec2 v_position;
out vec2 v_velocity;
out float v_life;

void main() {
    vec2 pos = position;
    vec2 vel = velocity;

    // 声音影响粒子运动
    float soundForce = soundIntensity * 0.1;
    vec2 soundDirection = normalize(mouse - pos);
    vel += soundDirection * soundForce;

    // 更新位置
    pos += vel;

    // 边界检测
    if (length(pos) > 1.5) {
        pos *= 0.95;
        vel *= 0.8;
    }

    v_position = pos;
    v_velocity = vel * 0.99; // 阻尼
    v_life = life - 0.001;

    gl_Position = vec4(pos, 0.0, 1.0);
    gl_PointSize = 3.0 + soundIntensity * 5.0;
}