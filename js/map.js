/* ═══════════════════════════════════════════════
   js/map.js  —  Leaflet 声景地图
   中国传媒大学 · 朝阳校区 (北京)
   依赖: Leaflet 1.9.x
═══════════════════════════════════════════════ */

window.SonicMap = (function () {
  'use strict';

  /* ── 地图中心 (中国传媒大学朝阳校区) ────────── */
  const MAP_CENTER = [39.9120, 116.5500];
  const MAP_ZOOM   = 17;

  /* ── 采样地点 (你给的经纬度 100% 准确) ─────── */
  const LOCATIONS = [
    {
      id: 'A',
      name: '钢琴湖',
      coords: [39.9129035, 116.5511438],
      color: '#E8A030',
      soundType: '自然声景优势：水声、鸟鸣占主导，偶有风声叶响，主观舒适度最高。',
      data: {
        morning: { spl: 62.0, loudness: 15.2, roughness: 0.65, fluctuation: 0.48 },
        noon:    { spl: 64.5, loudness: 18.1, roughness: 0.78, fluctuation: 0.61 },
        evening: { spl: 66.8, loudness: 21.3, roughness: 0.92, fluctuation: 0.79 },
      }
    },
    {
      id: 'B',
      name: '古树保护区',
      coords: [39.9123089, 116.5495894],
      color: '#00C8E8',
      soundType: '过渡声景：自然环境为主，偶有人类活动声，声场层次丰富。',
      data: {
        morning: { spl: 58.2, loudness: 12.4, roughness: 0.52, fluctuation: 0.38 },
        noon:    { spl: 63.1, loudness: 16.8, roughness: 0.71, fluctuation: 0.58 },
        evening: { spl: 65.4, loudness: 19.2, roughness: 0.85, fluctuation: 0.72 },
      }
    },
    {
      id: 'C',
      name: '一教池塘',
      coords: [39.9108898, 116.5495715],
      color: '#7EC864',
      soundType: '人类活动声景：交谈声、脚步声为主，伴随自然水声。',
      data: {
        morning: { spl: 68.5, loudness: 22.1, roughness: 1.12, fluctuation: 0.88 },
        noon:    { spl: 72.3, loudness: 26.8, roughness: 1.35, fluctuation: 1.12 },
        evening: { spl: 71.2, loudness: 24.5, roughness: 1.28, fluctuation: 1.04 },
      }
    }
  ];

  /* ── 状态管理 ─────────────────────────────── */
  let map = null;
  let currentTime = 'morning';
  let markers = {};
  let heatLayer = null;
  let activeMarker = null;

  /* ── 数值归一化（进度条用） ────────────────── */
  const SPL_MIN = 40, SPL_MAX = 85;
  const LOUD_MAX = 55, ROUGH_MAX = 3, FLUCT_MAX = 2.2;
  function norm(val, min, max) {
    return Math.min(Math.max((val - min) / (max - min), 0), 1);
  }

  /* ── 创建地图标记点 ───────────────────────── */
  function createMarker(loc) {
    const icon = L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="sonic-marker" style="background:${loc.color}; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:bold;">${loc.id}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker(loc.coords, { icon })
      .addTo(map);

    marker.on('click', () => {
      showInfo(loc);
      highlightMarker(loc.id);
      activeMarker = loc.id;

      // ==============================================
      // 🔥 关键：点击地图 → 同步切换三维地形的声音
      // ==============================================
      if (window.audioManager) {
        window.audioManager.currentPlace = loc.id;
        window.audioManager.playCurrent();
      }

      // 同步更新地形面板按钮
      syncTerrainPlaceBtn(loc.id);

      const event = new CustomEvent('mapLocationChange', {
        detail: {
          locationId: loc.id,
          time: currentTime,
          locationName: loc.name,
          soundType: loc.soundType
        }
      });
      document.dispatchEvent(event);
    });

    return marker;
  }

  // ==============================================
  // 🔥 同步：点击地图 → 选中地形对应点位按钮
  // ==============================================
  function syncTerrainPlaceBtn(id) {
    try {
      document.querySelectorAll('.place-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.place === id) {
          btn.classList.add('active');
        }
      });
    } catch (e) {}
  }

  /* ── 高亮当前选中的点 ─────────────────────── */
  function highlightMarker(id) {
    Object.entries(markers).forEach(([key, m]) => {
      const el = m.getElement();
      if (!el) return;
      const inner = el.querySelector('.sonic-marker');
      if (!inner) return;

      if (key === id) {
        inner.style.transform = 'scale(1.3)';
        inner.style.boxShadow = `0 0 18px ${LOCATIONS.find(l => l.id === key)?.color || '#fff'}`;
      } else {
        inner.style.transform = 'scale(1)';
        inner.style.boxShadow = 'none';
      }
    });
  }

  /* ── 显示右侧信息面板 ─────────────────────── */
  function showInfo(loc) {
    const d = loc.data[currentTime];
    const panel = document.getElementById('map-info-panel');
    if (!panel) return;

    panel.querySelector('.info-placeholder').style.display = 'none';
    const content = panel.querySelector('.info-content');
    content.style.display = 'block';

    document.getElementById('info-name').textContent = loc.name;
    document.getElementById('info-code').textContent = `采样点 ${loc.id} · ${timeLabel(currentTime)}`;

    document.getElementById('ip-spl').textContent   = `${d.spl.toFixed(1)} dB(A)`;
    document.getElementById('ip-loud').textContent  = `${d.loudness.toFixed(1)} sone`;
    document.getElementById('ip-rough').textContent = `${d.roughness.toFixed(2)} asper`;
    document.getElementById('ip-fluct').textContent = `${d.fluctuation.toFixed(2)} vacil`;

    animBar('ib-spl',   norm(d.spl, SPL_MIN, SPL_MAX));
    animBar('ib-loud',  norm(d.loudness, 0, LOUD_MAX));
    animBar('ib-rough', norm(d.roughness, 0, ROUGH_MAX));
    animBar('ib-fluct', norm(d.fluctuation, 0, FLUCT_MAX));

    document.getElementById('info-soundtype').textContent = loc.soundType;
  }

  /* ── 进度条动画 ───────────────────────────── */
  function animBar(id, fraction) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.width = '0%';
    requestAnimationFrame(() => {
      el.style.transition = 'width 0.5s ease';
      el.style.width = `${(fraction * 100).toFixed(1)}%`;
    });
  }

  /* ── 时间文字 ─────────────────────────────── */
  function timeLabel(time) {
    return {
      morning: '早晨 07–09h',
      noon: '正午 12–14h',
      evening: '傍晚 17–19h'
    }[time] || time;
  }

  /* ── 更新热力图 ──────────────────────────── */
  function updateHeatLayer() {
    if (!map) return;
    if (heatLayer) map.removeLayer(heatLayer);

    const points = LOCATIONS.map(loc => {
      const spl = loc.data[currentTime].spl;
      const intensity = norm(spl, SPL_MIN, SPL_MAX);
      return [loc.coords[0], loc.coords[1], intensity];
    });

    if (L.heatLayer) {
      heatLayer = L.heatLayer(points, {
        radius: 50,
        blur: 35,
        gradient: {
          0.3: '#0d3b8a',
          0.5: '#0891b2',
          0.7: '#16a34a',
          0.85: '#ca8a04',
          1.0: '#dc2626'
        }
      }).addTo(map);
    }
  }

  /* ── 切换时段 ────────────────────────────── */
  function setTime(time) {
    if (!['morning', 'noon', 'evening'].includes(time)) return;
    currentTime = time;
    updateHeatLayer();

    if (activeMarker) {
      const loc = LOCATIONS.find(l => l.id === activeMarker);
      if (loc) showInfo(loc);
    }
  }

  /* ── 初始化时段按钮 ──────────────────────── */
  function initTimeBtns() {
    document.querySelectorAll('#time-btns .tbtn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#time-btns .tbtn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setTime(btn.dataset.time);
      });
    });
  }

  /* ── 初始化地图 ─────────────────────────── */
  function initMap() {
    const container = document.getElementById('map-container');
    if (!container || typeof L === 'undefined') return;

    try {
      map = L.map('map-container', {
        center: MAP_CENTER,
        zoom: MAP_ZOOM,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
      }).addTo(map);

      LOCATIONS.forEach(loc => {
        markers[loc.id] = createMarker(loc);
      });

      updateHeatLayer();
      initTimeBtns();

      setTimeout(() => {
        if (LOCATIONS[0]) {
          activeMarker = LOCATIONS[0].id;
          showInfo(LOCATIONS[0]);
          highlightMarker(LOCATIONS[0].id);
        }
      }, 600);

    } catch (e) {
      console.error('地图初始化失败', e);
      container.innerHTML = `<div style="padding:30px; color:#fff;">地图加载失败，请刷新</div>`;
    }
  }

  /* ── 启动 ────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMap);
  } else {
    initMap();
  }

  return {
    setTime,
    getLocations: () => LOCATIONS
  };
})();