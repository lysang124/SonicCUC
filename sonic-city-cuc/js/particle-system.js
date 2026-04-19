/**
 * 粒子系统 - 声景可视化
 * 基于WebGL的粒子效果，响应声音数据变化
 */

class ParticleSystem {
  constructor() {
    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.particles = [];
    this.maxParticles = 5000;
    this.soundData = {
      intensity: 0.5,
      color: [1.0, 0.8, 0.2], // 默认为橙色
      location: 'A'
    };
    this.time = 0;
    this.isInit = false;
  }

  /**
   * 初始化粒子系统
   */
  init() {
    this.canvas = document.getElementById('particle-canvas');
    if (!this.canvas) return false;

    // 获取WebGL上下文
    this.gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false
    });

    if (!this.gl) {
      console.warn('WebGL not supported');
      return false;
    }

    // 设置画布大小
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // 创建着色器程序
    if (!this.createShaderProgram()) {
      return false;
    }

    // 创建粒子缓冲区
    this.createParticleBuffers();

    this.isInit = true;
    this.start();

    return true;
  }

  /**
   * 调整画布大小
   */
  resize() {
    if (!this.canvas) return;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';

    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * 创建着色器程序
   */
  createShaderProgram() {
    const vertexShader = this.loadShader(this.gl.VERTEX_SHADER, `
      attribute vec2 position;
      attribute vec2 velocity;
      attribute float life;

      uniform float time;
      uniform vec2 resolution;
      uniform vec2 mouse;
      uniform float soundIntensity;
      uniform vec3 soundColor;

      varying vec2 vPosition;
      varying float vLife;

      void main() {
        vec2 pos = position;
        vec2 vel = velocity;

        // 声音影响粒子
        float soundForce = soundIntensity * 0.05;
        vec2 toMouse = normalize(mouse - pos);
        vel += toMouse * soundForce;

        // 更新位置
        pos += vel;

        // 边界检测
        if (length(pos) > 1.5) {
          pos *= 0.95;
          vel *= 0.8;
        }

        vPosition = pos;
        vLife = life - 0.002;

        gl_Position = vec4(pos, 0.0, 1.0);
        gl_PointSize = 2.0 + soundIntensity * 4.0;
      }
    `);

    const fragmentShader = this.loadShader(this.gl.FRAGMENT_SHADER, `
      precision mediump float;

      uniform vec3 soundColor;
      uniform float soundIntensity;

      varying vec2 vPosition;
      varying float vLife;

      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);

        if (dist > 0.5) discard;

        // 基础颜色
        vec3 baseColor = soundColor;

        // 发光效果
        float glow = smoothstep(0.5, 0.0, dist);
        vec3 finalColor = baseColor * (1.0 + glow * 2.0);

        // 透明度
        float alpha = soundIntensity * 0.5 * vLife;

        gl_FragColor = vec4(finalColor, alpha);
      }
    `);

    if (!vertexShader || !fragmentShader) {
      return false;
    }

    this.program = this.gl.createProgram();
    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);

    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      console.error('Shader program link error:', this.gl.getProgramInfoLog(this.program));
      return false;
    }

    return true;
  }

  /**
   * 创建着色器
   */
  loadShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * 创建粒子缓冲区
   */
  createParticleBuffers() {
    // 初始化粒子数据
    const positions = new Float32Array(this.maxParticles * 2);
    const velocities = new Float32Array(this.maxParticles * 2);
    const lives = new Float32Array(this.maxParticles);

    for (let i = 0; i < this.maxParticles; i++) {
      // 随机位置
      positions[i * 2] = (Math.random() - 0.5) * 2.0;
      positions[i * 2 + 1] = (Math.random() - 0.5) * 2.0;

      // 随机速度
      velocities[i * 2] = (Math.random() - 0.5) * 0.02;
      velocities[i * 2 + 1] = (Math.random() - 0.5) * 0.02;

      // 生命周期
      lives[i] = Math.random();
    }

    // 创建缓冲区
    this.positionBuffer = this.gl.createBuffer();
    this.velocityBuffer = this.gl.createBuffer();
    this.lifeBuffer = this.gl.createBuffer();

    // 设置缓冲区数据
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.DYNAMIC_DRAW);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.velocityBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, velocities, this.gl.DYNAMIC_DRAW);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.lifeBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, lives, this.gl.DYNAMIC_DRAW);
  }

  /**
   * 更新声音数据
   */
  updateSoundData(locationId, time) {
    // 根据地点和时间设置声音参数
    const soundConfig = {
      'A': { morning: [0.6, [1.0, 0.8, 0.2]], evening: [0.8, [1.0, 0.6, 0.2]] },
      'B': { morning: [0.8, [0.2, 0.8, 1.0]], evening: [0.9, [0.1, 0.6, 1.0]] },
      'C': { morning: [0.3, [0.2, 1.0, 0.4]], evening: [0.4, [0.1, 0.8, 0.3]] },
      'D': { morning: [0.9, [1.0, 0.2, 0.2]], evening: [1.0, [1.0, 0.1, 0.1]] },
      'E': { morning: [0.5, [0.8, 0.6, 1.0]], evening: [0.7, [0.6, 0.4, 1.0]] }
    };

    const config = soundConfig[locationId] || soundConfig['A'];
    const timeConfig = config[time] || config['morning'];

    this.soundData.intensity = timeConfig[0];
    this.soundData.color = timeConfig[1];
    this.soundData.location = locationId;
  }

  /**
   * 开始粒子系统
   */
  start() {
    if (!this.isInit) return;

    // 鼠标位置
    this.mousePosition = [0.0, 0.0];

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePosition = [
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      ];
    });

    // 开始动画循环
    this.animate();
  }

  /**
   * 动画循环
   */
  animate() {
    if (!this.isInit) return;

    this.time += 0.016; // 假设60fps

    // 清除画布
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // 使用着色器程序
    this.gl.useProgram(this.program);

    // 设置uniform变量
    const resolutionLoc = this.gl.getUniformLocation(this.program, 'resolution');
    this.gl.uniform2f(resolutionLoc, this.canvas.width, this.canvas.height);

    const timeLoc = this.gl.getUniformLocation(this.program, 'time');
    this.gl.uniform1f(timeLoc, this.time);

    const mouseLoc = this.gl.getUniformLocation(this.program, 'mouse');
    this.gl.uniform2fv(mouseLoc, this.mousePosition);

    const intensityLoc = this.gl.getUniformLocation(this.program, 'soundIntensity');
    this.gl.uniform1f(intensityLoc, this.soundData.intensity);

    const colorLoc = this.gl.getUniformLocation(this.program, 'soundColor');
    this.gl.uniform3fv(colorLoc, this.soundData.color);

    // 启用顶点属性
    const positionLoc = this.gl.getAttribLocation(this.program, 'position');
    this.gl.enableVertexAttribArray(positionLoc);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.vertexAttribPointer(positionLoc, 2, this.gl.FLOAT, false, 0, 0);

    const velocityLoc = this.gl.getAttribLocation(this.program, 'velocity');
    this.gl.enableVertexAttribArray(velocityLoc);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.velocityBuffer);
    this.gl.vertexAttribPointer(velocityLoc, 2, this.gl.FLOAT, false, 0, 0);

    const lifeLoc = this.gl.getAttribLocation(this.program, 'life');
    this.gl.enableVertexAttribArray(lifeLoc);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.lifeBuffer);
    this.gl.vertexAttribPointer(lifeLoc, 1, this.gl.FLOAT, false, 0, 0);

    // 启用混合
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    // 绘制粒子
    this.gl.drawArrays(this.gl.POINTS, 0, this.maxParticles);

    // 请求下一帧
    requestAnimationFrame(() => this.animate());
  }

  /**
   * 更新粒子位置（响应地图点击）
   */
  updateParticlesForLocation(locationId, time) {
    this.updateSoundData(locationId, time);

    // 根据声音强度重新生成粒子位置
    if (!this.particles.length) return;

    const intensity = this.soundData.intensity;
    const positions = new Float32Array(this.maxParticles * 2);

    // 基于地点和时间重新分布粒子
    for (let i = 0; i < this.maxParticles; i++) {
      // 根据声音强度调整粒子分布
      const angle = (i / this.maxParticles) * Math.PI * 2;
      const radius = intensity * (0.5 + Math.random() * 0.5);

      positions[i * 2] = Math.cos(angle) * radius * (0.5 + Math.random() * 0.5);
      positions[i * 2 + 1] = Math.sin(angle) * radius * (0.5 + Math.random() * 0.5);
    }

    // 更新缓冲区
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.DYNAMIC_DRAW);
  }
}

// 导出粒子系统
window.ParticleSystem = ParticleSystem;