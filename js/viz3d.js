/* ═══════════════════════════════════════════════
   js/viz3d.js  —  Three.js 3D声音地形
   依赖: Three.js r128
   实现: 手动 orbit 控制 (无需 OrbitControls.js)
═══════════════════════════════════════════════ */

window.SonicViz = (function () {
  'use strict';

  /* ── Grid resolution ──────────────────────────── */
  const GRID_W = 64;
  const GRID_H = 64;

  /* ── Sound source positions (normalized 0–1) ──── */
  const SOURCES = {
    morning: [
      { x: 0.45, y: 0.35, spl: 65.2, r: 0.22 }, // 图书馆广场
      { x: 0.35, y: 0.52, spl: 72.5, r: 0.20 }, // 主教学楼前
      { x: 0.30, y: 0.65, spl: 48.4, r: 0.18 }, // 湖边小径
      { x: 0.50, y: 0.18, spl: 78.2, r: 0.25 }, // 北门入口
      { x: 0.60, y: 0.75, spl: 55.4, r: 0.20 }, // 田径场
    ],
    evening: [
      { x: 0.45, y: 0.35, spl: 69.3, r: 0.24 },
      { x: 0.35, y: 0.52, spl: 76.4, r: 0.22 },
      { x: 0.30, y: 0.65, spl: 53.2, r: 0.18 },
      { x: 0.50, y: 0.18, spl: 81.4, r: 0.28 },
      { x: 0.60, y: 0.75, spl: 62.0, r: 0.22 },
    ]
  };

  /* ── Track contribution weights ───────────────── */
  const trackWeights = { bio: 1.0, human: 1.0, mech: 1.0 };
  // bio: natural/bird sounds (quiet zones)
  // human: speech/footsteps (library, teaching)
  // mech: traffic/machines (north gate)

  const TRACK_MASKS = {
    // per source index: [bio, human, mech] contribution fraction
    bio:   [0.30, 0.10, 0.60, 0.05, 0.40],
    human: [0.55, 0.70, 0.30, 0.15, 0.45],
    mech:  [0.15, 0.20, 0.10, 0.80, 0.15],
  };

  let currentTimeKey = 'morning';
  let currentPlace = 'A'; // ✅ 新增：保存当前地点

  /* ── Three.js objects ─────────────────────────── */
  let renderer, scene, camera, terrain, animId;
  let frameCount = 0, lastFpsTime = 0;
  let raycaster, mouse;

  /* ── Orbit state ──────────────────────────────── */
  const orbit = { theta: 0.4, phi: Math.PI / 3.8, radius: 75 };
  let isDragging = false, prevMouse = { x: 0, y: 0 };
  let targetOrbit = { theta: 0.4, phi: Math.PI / 3.8 };

  /* ── Heightmap generation ──────────────────────── */
  function generateHeightmap(timeKey) {
    const sources = SOURCES[timeKey] || SOURCES.morning;
    const heights = new Float32Array(GRID_W * GRID_H);

    for (let row = 0; row < GRID_H; row++) {
      for (let col = 0; col < GRID_W; col++) {
        const nx = col / (GRID_W - 1);
        const ny = row / (GRID_H - 1);

        let totalEnergy = 0;
        sources.forEach((src, idx) => {
          const dx = nx - src.x;
          const dy = ny - src.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Gaussian falloff weighted by track opacities
          const trackContrib =
            trackWeights.bio   * TRACK_MASKS.bio[idx]   +
            trackWeights.human * TRACK_MASKS.human[idx] +
            trackWeights.mech  * TRACK_MASKS.mech[idx];

          // SPL to linear energy, distance attenuation
          const energy = Math.pow(10, src.spl / 20) *
            Math.exp(-dist * dist / (2 * src.r * src.r)) *
            trackContrib;
          totalEnergy += energy;
        });

        // Convert back to dB-like scale for height
        const splApprox = totalEnergy > 0
          ? 20 * Math.log10(totalEnergy + 1)
          : 35;

        // Normalize 35–85 dB → 0–12 height units
        heights[row * GRID_W + col] = Math.max(0,
          (Math.min(splApprox, 85) - 35) / 50 * 12
        );
      }
    }
    return heights;
  }

  /* ── SPL value → color ────────────────────────── */
  function splToColor(h) {
    // h: 0–12 (normalized height)
    const t = h / 12;
    if (t < 0.2)  return new THREE.Color(0x1a0533);  // < 45dB
    if (t < 0.4)  return new THREE.Color(0x0d3b8a);  // 45–55
    if (t < 0.6)  return new THREE.Color(0x0891b2);  // 55–65
    if (t < 0.75) return new THREE.Color(0x16a34a);  // 65–70
    if (t < 0.88) return new THREE.Color(0xca8a04);  // 70–75
    return new THREE.Color(0xdc2626);                 // > 75
  }

  /* ── build terrain geometry ────────────────────── */
  function buildTerrain(timeKey) {
    if (terrain) {
      scene.remove(terrain);
      terrain.geometry.dispose();
      terrain.material.dispose();
      terrain = null;
    }

    const heights = generateHeightmap(timeKey);

    const geo = new THREE.PlaneGeometry(60, 60, GRID_W - 1, GRID_H - 1);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = [];

    for (let i = 0; i < pos.count; i++) {
      const col = i % GRID_W;
      const row = Math.floor(i / GRID_W);
      const h = heights[row * GRID_W + col] || 0;
      pos.setY(i, h);
      const c = splToColor(h);
      colors.push(c.r, c.g, c.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: 30,
      specular: new THREE.Color(0x222244),
      side: THREE.DoubleSide,
      wireframe: false,
    });

    terrain = new THREE.Mesh(geo, mat);
    scene.add(terrain);

    // Wireframe overlay
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      opacity: 0.04,
      transparent: true,
      wireframe: true,
    });
    const wire = new THREE.Mesh(geo.clone(), wireMat);
    wire.position.y = 0.05;
    terrain.userData.wire = wire;
    scene.add(wire);
  }

  /* ── update camera from orbit state ───────────── */
  function updateCamera() {
    const x = orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta);
    const y = orbit.radius * Math.cos(orbit.phi);
    const z = orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta);
    camera.position.set(x, y, z);
    camera.lookAt(0, 2, 0);
  }

  /* ── mouse / touch handlers ────────────────────── */
  function onMouseDown(e) {
    isDragging = true;
    prevMouse = { x: e.clientX, y: e.clientY };
  }
  function onMouseMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - prevMouse.x;
    const dy = e.clientY - prevMouse.y;
    targetOrbit.theta -= dx * 0.008;
    targetOrbit.phi    = Math.max(0.25, Math.min(Math.PI / 2.1,
      targetOrbit.phi - dy * 0.008));
    prevMouse = { x: e.clientX, y: e.clientY };
  }
  function onMouseUp() { isDragging = false; }
  function onWheel(e) {
    orbit.radius = Math.max(30, Math.min(130, orbit.radius + e.deltaY * 0.05));
  }

  function onTouchStart(e) {
    if (e.touches.length === 1) {
      isDragging = true;
      prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }
  function onTouchMove(e) {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - prevMouse.x;
    const dy = e.touches[0].clientY - prevMouse.y;
    targetOrbit.theta -= dx * 0.008;
    targetOrbit.phi    = Math.max(0.25, Math.min(Math.PI / 2.1,
      targetOrbit.phi - dy * 0.008));
    prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  /* ── render loop ───────────────────────────────── */
  function animate(ts) {
    animId = requestAnimationFrame(animate);

    // smooth orbit
    orbit.theta += (targetOrbit.theta - orbit.theta) * 0.08;
    orbit.phi   += (targetOrbit.phi   - orbit.phi)   * 0.08;
    updateCamera();

    // gentle terrain float
    if (terrain) {
      terrain.position.y = Math.sin(ts * 0.0005) * 0.3;
      if (terrain.userData.wire)
        terrain.userData.wire.position.y = terrain.position.y + 0.05;
    }

    renderer.render(scene, camera);

    // FPS counter
    frameCount++;
    if (ts - lastFpsTime > 1000) {
      const fpsel = document.getElementById('terrain-fps');
      if (fpsel) fpsel.textContent = frameCount;
      frameCount = 0;
      lastFpsTime = ts;
    }
  }

  /* ── Click interaction ──────────────────────────── */
  function playSoundType(soundType) {
    if (!window.soundManager) {
      console.warn('Sound manager not available');
      return;
    }

    // 声音类型配置 - 包含真实音频文件和合成器参数
    const soundConfig = {
      biological: {
        frequency: 880,
        type: 'triangle',
        color: [0.2, 1.0, 0.4],
        description: '生物声 - 鸟鸣、虫鸣、自然风声',
        audioFiles: [
          'forest-morning.mp3',
          'forest-noon.mp3',
          'forest-night.mp3'
        ]
      },
      human: {
        frequency: 440,
        type: 'sine',
        color: [1.0, 0.8, 0.2],
        description: '人声 - 交谈、脚步、图书馆活动',
        audioFiles: [
          'pond-morning.mp3',
          'pond-noon.mp3',
          'pond-night.mp3'
        ]
      },
      mechanical: {
        frequency: 220,
        type: 'square',
        color: [0.2, 0.8, 1.0],
        description: '机械声 - 交通、建筑、设备运行',
        audioFiles: [
          'piano-morning.mp3',
          'piano-noon.mp3',
          'piano-night.mp3'
        ]
      }
    };

    const config = soundConfig[soundType];
    if (!config) {
      console.error(`Unknown sound type: ${soundType}`);
      return;
    }

    // 优先播放真实音频文件
    if (window.soundManager.playLocationSound) {
      // 尝试根据当前时间选择对应的音频文件
      const timeSuffix = currentTimeKey === 'morning' ? 'morning' : currentTimeKey === 'evening' ? 'night' : 'noon';
      const audioFile = config.audioFiles.find(file => file.includes(timeSuffix));

      if (audioFile) {
        try {
          window.soundManager.playLocationSound(soundType, currentTimeKey, audioFile);
          console.log(`Playing ${soundType} sound: ${audioFile}`);
        } catch (error) {
          console.warn(`Failed to play audio file, falling back to synthesizer: ${error.message}`);
          playSynthesizedSound(config);
        }
      } else {
        playSynthesizedSound(config);
      }
    } else {
      // 回退到合成器播放
      playSynthesizedSound(config);
    }

    // 触发视觉反馈
    triggerSoundVisualization(soundType, config.color);

    // 显示声音类型描述
    showSoundDescription(config.description);
  }

  function playSynthesizedSound(config) {
    // 创建合成器声音作为回退
    const audioCtx = window.soundManager.audioContext;
    if (!audioCtx) {
      console.error('Audio context not available');
      return;
    }

    try {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = config.type;
      oscillator.frequency.setValueAtTime(config.frequency, audioCtx.currentTime);

      // 更自然的包络
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 0.3);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 3);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 3);

      console.log(`Playing synthesized ${config.type} sound at ${config.frequency}Hz`);
    } catch (error) {
      console.error(`Failed to create synthesized sound: ${error.message}`);
    }
  }

  function showSoundDescription(description) {
    // 创建或更新声音描述显示
    let descElement = document.getElementById('sound-description');
    if (!descElement) {
      descElement = document.createElement('div');
      descElement.id = 'sound-description';
      descElement.style.cssText = `
        position: absolute;
        bottom: 20px;
        left: 20px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        font-size: 14px;
        max-width: 300px;
        display: none;
        z-index: 1000;
      `;
      document.body.appendChild(descElement);
    }

    descElement.textContent = description;
    descElement.style.display = 'block';

    // 3秒后淡出
    setTimeout(() => {
      descElement.style.transition = 'opacity 1s';
      descElement.style.opacity = '0';
      setTimeout(() => {
        descElement.style.display = 'none';
        descElement.style.opacity = '1';
      }, 1000);
    }, 3000);
  }

  function triggerSoundVisualization(soundType, color) {
    // Add pulsing sphere at terrain center
    const geometry = new THREE.SphereGeometry(1, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setRGB(color[0], color[1], color[2]),
      transparent: true,
      opacity: 0.8
    });

    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(0, 5, 0); // Above terrain

    scene.add(sphere);

    // Animate sphere
    const animateSphere = () => {
      sphere.scale.x += 0.05;
      sphere.scale.y += 0.05;
      sphere.scale.z += 0.05;
      sphere.material.opacity -= 0.02;

      if (sphere.material.opacity > 0) {
        requestAnimationFrame(animateSphere);
      } else {
        scene.remove(sphere);
        geometry.dispose();
        material.dispose();
      }
    };

    animateSphere();
  }

  function triggerParticlesAt(point) {
    // Trigger particle system if available
    if (window.particleSystem) {
      window.particleSystem.createParticlesAt(point.x, point.z, 20);
    }
  }

  function onClick(e) {
    if (!terrain || !camera || !scene) return;

    // 初始化raycaster和mouse if not already done
    if (!raycaster) raycaster = new THREE.Raycaster();
    if (!mouse) mouse = new THREE.Vector2();

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObject(terrain);
    if (intersects.length > 0) {
      const point = intersects[0].point;
      const height = intersects[0].point.y;

      // 根据高度播放不同类型的声音
      if (height < 2) {
        playSoundType('biological');
      } else if (height < 6) {
        playSoundType('human');
      } else {
        playSoundType('mechanical');
      }

      // 触发粒子效果
      triggerParticlesAt(point);

      // 发送点击事件
      const event = new CustomEvent('terrainClick', {
        detail: {
          position: { x: point.x, y: point.y, z: point.z },
          height: height,
          soundType: height < 2 ? 'biological' : height < 6 ? 'human' : 'mechanical'
        }
      });
      document.dispatchEvent(event);
    }
  }

  /* ── resize handler ────────────────────────────── */
  function onResize() {
    if (!renderer) return;
    const wrap = document.querySelector('.terrain-canvas-wrap');
    if (!wrap) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight || 520;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* ── init ──────────────────────────────────────── */
  function init() {
    const canvas = document.getElementById('terrain-canvas');
    if (!canvas || typeof THREE === 'undefined') {
      console.error('Terrain initialization failed: canvas or THREE not available');
      if (canvas) {
        canvas.innerHTML = '<div style="padding:20px;color:#E8A030;">3D地形加载失败：请检查Three.js库是否正确加载</div>';
      }

      // 发送错误事件
      const event = new CustomEvent('terrainError', {
        detail: {
          error: 'Three.js library not available',
          timestamp: new Date().toISOString()
        }
      });
      document.dispatchEvent(event);
      return;
    }

    // 调试日志：记录初始化开始
    console.log('Initializing 3D terrain...');
    console.log(`Canvas dimensions: ${canvas.clientWidth}x${canvas.clientHeight}`);
    console.log(`THREE.js version: ${THREE.REVISION}`);

    // 检查WebGL支持
    if (!window.WebGLRenderingContext) {
      console.error('WebGL not supported in this browser');
      canvas.innerHTML = '<div style="padding:20px;color:#E8A030;">您的浏览器不支持WebGL，无法显示3D地形</div>';
      return;
    }

    // Initialize raycaster and mouse for interaction
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    const wrap = document.querySelector('.terrain-canvas-wrap');
    const W = wrap ? wrap.clientWidth  : 800;
    const H = wrap ? wrap.clientHeight : 520;

    /* Renderer */
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x070709, 1);
    renderer.shadowMap.enabled = false;

    /* Scene */
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070709, 0.012);

    /* Camera */
    camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 500);
    updateCamera();

    /* Lights */
    const ambient = new THREE.AmbientLight(0x334466, 0.8);
    scene.add(ambient);

    const dir1 = new THREE.DirectionalLight(0xE8A030, 1.2);
    dir1.position.set(30, 50, 20);
    scene.add(dir1);

    const dir2 = new THREE.DirectionalLight(0x00C8E8, 0.6);
    dir2.position.set(-30, 30, -20);
    scene.add(dir2);

    /* Grid helper */
    const grid = new THREE.GridHelper(60, 20, 0x1a1a3a, 0x0f0f22);
    grid.position.y = -0.1;
    scene.add(grid);

    /* Terrain */
    buildTerrain(currentTimeKey);

    /* Axis labels using sprites */
    addLabel('N  北门', 0, 1, -32, 0xE85060);
    addLabel('湖边  S', 0, 1,  28, 0x7EC864);
    addLabel('W  教学', -32, 1, 0, 0x00C8E8);
    addLabel('图书馆  E', 30, 1, 0, 0xE8A030);

    /* Event listeners */
    canvas.addEventListener('mousedown',  onMouseDown);
    canvas.addEventListener('mousemove',  onMouseMove);
    canvas.addEventListener('mouseup',    onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('wheel',      onWheel, { passive: true });
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: true });
    canvas.addEventListener('touchend',   () => { isDragging = false; });
    window.addEventListener('resize', onResize, { passive: true });

    // Click event listener
    canvas.addEventListener('click', onClick, { passive: true });

    // ✅========== 在这里绑定 UI 交互：早晨/傍晚 + 地点 + 滑块 ==========
    bindUIControls();

    /* Start render loop */
    animate(0);
  }

  /* ── canvas text sprite ────────────────────────── */
  function addLabel(text, x, y, z, color) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.font = '500 22px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.7 });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(10, 2.5, 1);
    sprite.position.set(x, y, z);
    scene.add(sprite);
  }

  // ======================================================
  // ✅ 新增：绑定面板交互（完全不影响你原有代码）
  // ======================================================
  function bindUIControls() {
    // 时段按钮
    document.querySelectorAll('#terrain-time-btns .ttbtn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#terrain-time-btns .ttbtn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTimeKey = btn.dataset.time;
        buildTerrain(currentTimeKey);
        updateParticle();
      });
    });

    // 地点按钮
    document.querySelectorAll('#terrain-place-btns .place-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#terrain-place-btns .place-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPlace = btn.dataset.place;
        updateParticle();
      });
    });

    // 三个滑块
    document.getElementById('tr-bio').addEventListener('input', (e) => {
      trackWeights.bio = e.target.value / 100;
      buildTerrain(currentTimeKey);
      updateParticle();
    });
    document.getElementById('tr-human').addEventListener('input', (e) => {
      trackWeights.human = e.target.value / 100;
      buildTerrain(currentTimeKey);
      updateParticle();
    });
    document.getElementById('tr-mech').addEventListener('input', (e) => {
      trackWeights.mech = e.target.value / 100;
      buildTerrain(currentTimeKey);
      updateParticle();
    });
  }

  // ======================================================
  // ✅ 新增：更新粒子颜色强度
  // ======================================================
  function updateParticle() {
    if (!window.particleSystem) return;
    const colorMap = {
      A: { morning: [1.0, 0.8, 0.2], evening: [1.0, 0.4, 0.1] },
      B: { morning: [0.2, 0.8, 1.0], evening: [0.1, 0.5, 1.0] },
      C: { morning: [0.2, 1.0, 0.4], evening: [0.1, 0.7, 0.3] },
    };
    const color = colorMap[currentPlace]?.[currentTimeKey] || [1,0.8,0.2];
    const intensity = (trackWeights.bio + trackWeights.human + trackWeights.mech) / 3;
    window.particleSystem.soundData.color = color;
    window.particleSystem.soundData.intensity = intensity;
    window.particleSystem.updateParticlesForLocation(currentPlace, currentTimeKey);
  }

  /* ── Public API ────────────────────────────────── */
  function setTime(time) {
    if (!['morning', 'evening'].includes(time)) return;
    currentTimeKey = time;
    if (scene) buildTerrain(time);
  }

  function setTrackOpacity(key, val) {
    if (!(key in trackWeights)) return;
    trackWeights[key] = Math.max(0, Math.min(1, val));
    if (scene) buildTerrain(currentTimeKey);
  }

  /* ── Init on window load (Three.js is large) ───── */
  if (typeof THREE !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  } else {
    window.addEventListener('load', init);
  }

  return { setTime, setTrackOpacity };
})();