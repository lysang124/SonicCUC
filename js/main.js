/* ═══════════════════════════════════════════════
   js/main.js  —  ScrollTrigger + Cover + Comms
═══════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── 1. Nav scroll effect ───────────────────── */
  const nav = document.getElementById('site-nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });

  /* ── 2. Cover wave canvas ───────────────────── */
  const coverWaveCanvas = document.getElementById('cover-wave');
  if (coverWaveCanvas) {
    const ctx = coverWaveCanvas.getContext('2d');
    let W, H, animId;
    const waves = [
      { amp: 28, freq: 0.008, speed: 0.018, phase: 0,   color: 'rgba(232,160,48,' },
      { amp: 18, freq: 0.014, speed: 0.026, phase: 1.2, color: 'rgba(0,200,232,' },
      { amp: 12, freq: 0.022, speed: 0.012, phase: 2.4, color: 'rgba(176,122,232,' },
    ];
    let t = 0;

    function resize() {
      W = coverWaveCanvas.width  = coverWaveCanvas.offsetWidth;
      H = coverWaveCanvas.height = coverWaveCanvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    function drawWave(wave, tOffset, alpha) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const y = H / 2
          + Math.sin(x * wave.freq + tOffset + wave.phase) * wave.amp
          + Math.sin(x * wave.freq * 0.6 + tOffset * 1.3 + wave.phase) * (wave.amp * 0.4);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = wave.color + alpha + ')';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    function render() {
      ctx.clearRect(0, 0, W, H);
      t += 1;
      // draw multiple offset copies for depth
      waves.forEach((w, i) => {
        for (let copy = 0; copy < 4; copy++) {
          const alpha = (0.8 - copy * 0.18) * 0.6;
          drawWave(w, t * w.speed, alpha);
          // shift Y slightly per copy
          ctx.save();
          ctx.translate(0, copy * 18 - 27);
          drawWave(w, t * w.speed + copy * 0.5, alpha * 0.5);
          ctx.restore();
        }
      });
      animId = requestAnimationFrame(render);
    }
    render();
  }

  /* ── 3. Counter animation ───────────────────── */
  function animateCount(el, target, duration = 1200, suffix = '') {
    const start = performance.now();
    function update(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.floor(eased * target) + suffix;
      if (p < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  /* ── 4. GSAP ScrollTrigger setup ───────────────── */
  function initGSAP() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      // Fallback: reveal everything if GSAP not loaded
      document.querySelectorAll('.fade-up, .method-card, .cover-eyebrow, .cover-title .line, .cover-subtitle, .cover-meta, .scroll-hint')
        .forEach(el => { el.style.opacity = '1'; el.style.transform = 'none'; });
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    /* Cover entrance sequence */
    const tl = gsap.timeline({ delay: 0.3 });
    tl.to('.cover-eyebrow', { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' })
      .to('.cover-title .line', {
        opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: 'power4.out'
      }, '-=0.3')
      .to('.cover-subtitle', { opacity: 1, duration: 0.6, ease: 'power2.out' }, '-=0.3')
      .to('.cover-meta', { opacity: 1, duration: 0.6, ease: 'power2.out' }, '-=0.2')
      .to('.scroll-hint', { opacity: 1, duration: 0.5 }, '-=0.1');

    /* Counter animation after cover fade-in */
    tl.add(() => {
      animateCount(document.getElementById('cnt-locations'), 3,  900);
      animateCount(document.getElementById('cnt-minutes'),   10, 1200);
      animateCount(document.getElementById('cnt-params'),    4,  800);
    }, '-=0.2');

    /* Section headers */
    gsap.utils.toArray('.section-tag, .section-title, .section-desc').forEach(el => {
      gsap.from(el, {
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' },
        opacity: 0, y: 24, duration: 0.75, ease: 'power3.out'
      });
    });

    /* Method cards stagger */
    gsap.from('.method-card', {
      scrollTrigger: {
        trigger: '.method-grid',
        start: 'top 80%',
        toggleActions: 'play none none none'
      },
      opacity: 0, y: 48, duration: 0.75, stagger: 0.15, ease: 'power3.out',
      onComplete: () => {
        document.querySelectorAll('.method-card').forEach(c => {
          c.style.opacity = '1';
          c.style.transform = 'none';
        });
      }
    });

    /* Quote block */
    gsap.from('.quote-block', {
      scrollTrigger: { trigger: '.quote-block', start: 'top 85%' },
      opacity: 0, x: -32, duration: 0.8, ease: 'power3.out'
    });

    /* Loc strip items */
    gsap.from('.loc-item', {
      scrollTrigger: { trigger: '.loc-strip', start: 'top 80%' },
      opacity: 0, x: 30, duration: 0.6, stagger: 0.1, ease: 'power2.out'
    });

    /* Chart section */
    gsap.from('.chart-wrapper', {
      scrollTrigger: { trigger: '#charts', start: 'top 70%' },
      opacity: 0, y: 32, duration: 0.8, ease: 'power3.out'
    });

    /* Terrain section */
    gsap.from('.terrain-canvas-wrap', {
      scrollTrigger: { trigger: '#terrain', start: 'top 70%' },
      opacity: 0, scale: 0.97, duration: 0.9, ease: 'power3.out'
    });

    /* Outro */
    gsap.from('.outro-title, .outro-body, .outro-credits', {
      scrollTrigger: { trigger: '#outro', start: 'top 70%' },
      opacity: 0, y: 24, duration: 0.8, stagger: 0.15, ease: 'power3.out'
    });
  }

  /* ── 5. Particle System ──────────────────────── */
 // let particleSystem = ...

  function initParticleSystem() {
    try {
      particleSystem = new ParticleSystem();
      const initialized = particleSystem.init();

      if (!initialized) {
        console.warn('Particle system initialization failed');
        particleSystem = null;
      }

      // 监听地图事件
      document.addEventListener('mapLocationChange', (e) => {
        if (particleSystem && e.detail) {
          particleSystem.updateParticlesForLocation(e.detail.locationId, e.detail.time);
        }
      });

    } catch (error) {
      console.error('Failed to initialize particle system:', error);
      particleSystem = null;
    }
  }

  /* ── 6. Module communication interface ─────── */
  window.SonicBridge = {
    setChartParam(param) {
      if (window.SonicCharts) window.SonicCharts.setParam(param);
    },
    setMapTime(time) {
      if (window.SonicMap) window.SonicMap.setTime(time);
    },
    setTerrainTime(time) {
      if (window.SonicViz) window.SonicViz.setTime(time);
    },
    setTrackOpacity(key, val) {
      if (window.SonicViz) window.SonicViz.setTrackOpacity(key, val);
    }
  };

  /* ── 5.5 Particle System ──────────────────────── */
  let particleSystem = null;

  function initParticleSystem() {
    try {
      particleSystem = new ParticleSystem();
      const initialized = particleSystem.init();

      if (!initialized) {
        console.warn('Particle system initialization failed');
        particleSystem = null;
      }

      // 监听地图事件
      document.addEventListener('mapLocationChange', (e) => {
        if (particleSystem && e.detail) {
          particleSystem.updateParticlesForLocation(e.detail.locationId, e.detail.time);
        }
      });

    } catch (error) {
      console.error('Failed to initialize particle system:', error);
      particleSystem = null;
    }
  }

  /* ── 6. Wire up terrain track sliders ──────── */
  function initTrackSliders() {
    ['bio', 'human', 'mech'].forEach(key => {
      const slider = document.getElementById(`tr-${key}`);
      if (!slider) return;
      slider.addEventListener('input', () => {
        window.SonicBridge.setTrackOpacity(key, slider.value / 100);
      });
    });
  }

  /* ── 7. Wire terrain time buttons ──────────── */
  function initTerrainTimeBtns() {
    document.querySelectorAll('.ttbtn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ttbtn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        window.SonicBridge.setTerrainTime(btn.dataset.time);
      });
    });
  }

  /* ── 9. Sound System ──────────────────────── */
  let soundManager = null;

  class SoundManager {
    constructor() {
      this.audioContext = null;
      this.sounds = {};
      this.isMuted = false;
      this.volume = 0.5;
      this.currentLocation = null;
      this.currentTime = 'morning';
    }

    init() {
      try {
        // 创建音频上下文
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // 定义声音类型
        this.soundTypes = {
          human: { frequency: 440, type: 'sine', color: [1.0, 0.8, 0.2] },
          nature: { frequency: 880, type: 'triangle', color: [0.2, 1.0, 0.4] },
          mechanical: { frequency: 220, type: 'square', color: [0.2, 0.8, 1.0] },
          warning: { frequency: 660, type: 'sawtooth', color: [1.0, 0.2, 0.2] }
        };

        return true;
      } catch (error) {
        console.warn('Sound system initialization failed:', error);
        return false;
      }
    }

    playLocationSound(locationId, time) {
      if (this.isMuted || !this.audioContext) return;

      this.currentLocation = locationId;
      this.currentTime = time;

      // 停止之前的音效
      this.stopSounds();

      // 根据地点和时间确定主要声音类型
      const soundType = this.getSoundTypeForLocation(locationId, time);

      // 创建音效
      this.createSound(soundType);
    }

    getSoundTypeForLocation(locationId, time) {
      const soundMap = {
        'A': { morning: 'nature', evening: 'human' },
        'B': { morning: 'mechanical', evening: 'mechanical' },
        'C': { morning: 'nature', evening: 'nature' },
        'D': { morning: 'warning', evening: 'warning' },
        'E': { morning: 'human', evening: 'mechanical' }
      };
      return soundMap[locationId]?.[time] || 'human';
    }

    createSound(soundType) {
      if (!this.soundTypes[soundType]) return;

      const config = this.soundTypes[soundType];
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      const filterNode = this.audioContext.createBiquadFilter();

      // 配置振荡器
      oscillator.type = config.type;
      oscillator.frequency.setValueAtTime(config.frequency, this.audioContext.currentTime);

      // 配置滤波器
      filterNode.type = 'lowpass';
      filterNode.frequency.value = 2000;

      // 配置增益
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, this.audioContext.currentTime + 0.5);

      // 连接节点
      oscillator.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // 开始播放
      oscillator.start();

      // 存储音效引用
      this.sounds.current = { oscillator, gainNode, filterNode };

      // 设置淡出
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 3);
      oscillator.stop(this.audioContext.currentTime + 3);
    }

    stopSounds() {
      if (this.sounds.current) {
        try {
          this.sounds.current.oscillator.stop();
          this.sounds.current.gainNode.disconnect();
          this.sounds.current.filterNode.disconnect();
        } catch (e) {
          console.warn('Error stopping sound:', e);
        }
        this.sounds.current = null;
      }
    }

    setVolume(volume) {
      this.volume = Math.max(0, Math.min(1, volume));
      if (this.sounds.current) {
        this.sounds.current.gainNode.gain.setValueAtTime(this.volume * 0.3, this.audioContext.currentTime);
      }
    }

    toggleMute() {
      this.isMuted = !this.isMuted;
      if (this.isMuted) {
        this.stopSounds();
      }
      return this.isMuted;
    }
  }

  function initSoundManager() {
    try {
      soundManager = new SoundManager();
      const initialized = soundManager.init();

      if (!initialized) {
        console.warn('Sound manager initialization failed');
        soundManager = null;
      }
    } catch (error) {
      console.error('Failed to initialize sound manager:', error);
      soundManager = null;
    }
  }

  /* ── 10. Init ───────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    initGSAP();
    initTrackSliders();
    initTerrainTimeBtns();
    initParticleSystem();
    initSoundManager();
  });

  // GSAP may not be loaded yet on DOMContentLoaded if using CDN; 
  // retry after window load
  window.addEventListener('load', () => {
    if (typeof gsap !== 'undefined') {
      // re-check if ScrollTriggers need initialization
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
    }
  });
  // ==============================================
// 🔥 声景音频播放器（内置在 map.js 中，保证运行）
// ==============================================
window.audioManager = {
  enabled: true,
  currentPlace: 'A',
  currentTime: 'morning',
  audios: {},

  loadAudios() {
    const places = ['A','B','C'];
    const times = ['morning','evening'];
    const types = ['bio','human','mech'];
    for(let p of places){
      for(let t of times){
        for(let ty of types){
          let key = `${p}-${t}-${ty}`;
          let a = new Audio(`assets/audio/${key}.mp3`);
          a.loop = true;
          a.volume = 1.0;
          this.audios[key] = a;
        }
      }
    }
  },

  stopAll() {
    for(let k in this.audios){
      this.audios[k].pause();
      this.audios[k].currentTime = 0;
    }
  },

  playCurrent() {
    if(!this.enabled) return;
    this.stopAll();
    ['bio','human','mech'].forEach(ty => {
      let key = `${this.currentPlace}-${this.currentTime}-${ty}`;
      if(this.audios[key]){
        this.audios[key].play().catch(err=>console.log('音频需用户交互后播放',err));
      }
    });
    this.syncVolumes();
  },

  syncVolumes() {
    let vBio = document.getElementById('tr-bio') ? document.getElementById('tr-bio').value/100 : 1;
    let vHum = document.getElementById('tr-human') ? document.getElementById('tr-human').value/100 : 1;
    let vMec = document.getElementById('tr-mech') ? document.getElementById('tr-mech').value/100 : 1;

    let kBio = `${this.currentPlace}-${this.currentTime}-bio`;
    let kHum = `${this.currentPlace}-${this.currentTime}-human`;
    let kMec = `${this.currentPlace}-${this.currentTime}-mech`;

    if(this.audios[kBio]) this.audios[kBio].volume = vBio;
    if(this.audios[kHum]) this.audios[kHum].volume = vHum;
    if(this.audios[kMec]) this.audios[kMec].volume = vMec;
  }
};

  // 页面加载 → 自动启动音频
  window.addEventListener('DOMContentLoaded',()=>{
     window.audioManager.loadAudios();

  // 监听地形时段按钮
  document.querySelectorAll('#terrain-time-btns .ttbtn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      window.audioManager.currentTime = btn.dataset.time;
      window.audioManager.playCurrent();
    });
  });

  // 监听地形地点按钮
  document.querySelectorAll('#terrain-place-btns .place-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      window.audioManager.currentPlace = btn.dataset.place;
      window.audioManager.playCurrent();
    });
  });

  // 滑块音量
  let sliders = ['tr-bio','tr-human','tr-mech'];
  sliders.forEach(id=>{
    let el = document.getElementById(id);
    if(el) el.addEventListener('input',()=>window.audioManager.syncVolumes());
  });
  });
})();
