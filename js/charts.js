/* ═══════════════════════════════════════════════
   js/charts.js  —  时变参数折线图
   依赖: Chart.js 4.x
═══════════════════════════════════════════════ */

window.SonicCharts = (function () {
  'use strict';

  /* ── DATA ─────────────────────────────────────
     时间轴: 07:00 — 22:00 (每小时, 16个点)
     五处采样地点:
       A: 图书馆广场   B: 主教学楼前
       C: 湖边小径     D: 北门入口    E: 田径场
  ─────────────────────────────────────────────── */
  const TIMES = ['07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22'];

  const DATA = {
    spl: {
      unit: 'dB(A)',
      min: 35, max: 85,
      datasets: {
        A: [52, 65, 68, 63, 61, 66, 63, 60, 62, 64, 69, 67, 60, 56, 54, 51],
        B: [58, 72, 75, 70, 68, 74, 71, 68, 70, 72, 76, 74, 67, 62, 58, 54],
        C: [42, 48, 50, 47, 46, 51, 48, 45, 47, 48, 53, 50, 45, 42, 41, 40],
        D: [62, 78, 80, 76, 73, 78, 75, 72, 74, 76, 81, 79, 72, 68, 64, 60],
        E: [46, 55, 60, 57, 54, 58, 56, 53, 55, 57, 62, 60, 54, 49, 47, 44],
      }
    },
    loudness: {
      unit: 'sone',
      min: 0, max: 55,
      datasets: {
        A: [6,  18, 22, 17, 15, 20, 17, 14, 16, 18, 24, 21, 15, 11, 9,  7],
        B: [10, 28, 34, 27, 24, 31, 27, 23, 26, 29, 36, 32, 24, 18, 13, 10],
        C: [3,  7,  9,  7,  6,  9,  7,  6,  7,  8,  11, 9,  6,  4,  3,  3],
        D: [14, 38, 44, 38, 34, 41, 36, 32, 35, 39, 46, 42, 33, 26, 19, 14],
        E: [5,  13, 18, 15, 12, 16, 14, 11, 13, 15, 20, 17, 12, 8,  6,  4],
      }
    },
    roughness: {
      unit: 'asper',
      min: 0, max: 3,
      datasets: {
        A: [0.3, 0.9, 1.1, 0.9, 0.8, 1.0, 0.9, 0.8, 0.9, 1.0, 1.2, 1.0, 0.8, 0.6, 0.5, 0.4],
        B: [0.5, 1.4, 1.7, 1.4, 1.2, 1.5, 1.3, 1.1, 1.3, 1.4, 1.8, 1.6, 1.2, 0.9, 0.7, 0.5],
        C: [0.1, 0.3, 0.4, 0.3, 0.3, 0.4, 0.3, 0.2, 0.3, 0.3, 0.5, 0.4, 0.3, 0.2, 0.2, 0.1],
        D: [0.7, 1.9, 2.3, 1.9, 1.7, 2.1, 1.8, 1.6, 1.8, 2.0, 2.5, 2.2, 1.7, 1.3, 1.0, 0.8],
        E: [0.2, 0.7, 1.0, 0.8, 0.7, 0.9, 0.8, 0.6, 0.7, 0.8, 1.1, 0.9, 0.7, 0.5, 0.4, 0.3],
      }
    },
    fluctuation: {
      unit: 'vacil',
      min: 0, max: 2.2,
      datasets: {
        A: [0.2, 0.7, 0.9, 0.7, 0.6, 0.8, 0.7, 0.6, 0.7, 0.8, 1.0, 0.8, 0.6, 0.5, 0.4, 0.3],
        B: [0.4, 1.1, 1.4, 1.1, 1.0, 1.2, 1.1, 0.9, 1.0, 1.1, 1.5, 1.3, 0.9, 0.7, 0.6, 0.4],
        C: [0.1, 0.2, 0.3, 0.2, 0.2, 0.3, 0.2, 0.2, 0.2, 0.2, 0.4, 0.3, 0.2, 0.1, 0.1, 0.1],
        D: [0.5, 1.5, 1.9, 1.5, 1.3, 1.7, 1.5, 1.2, 1.4, 1.5, 2.0, 1.8, 1.4, 1.1, 0.8, 0.6],
        E: [0.2, 0.5, 0.8, 0.6, 0.5, 0.7, 0.6, 0.5, 0.6, 0.6, 0.9, 0.7, 0.5, 0.4, 0.3, 0.2],
      }
    }
  };

  const COLORS = {
    A: { line: '#E8A030', bg: 'rgba(232,160,48,0.08)' },
    B: { line: '#00C8E8', bg: 'rgba(0,200,232,0.08)' },
    C: { line: '#7EC864', bg: 'rgba(126,200,100,0.08)' },
    D: { line: '#E85060', bg: 'rgba(232,80,96,0.08)' },
    E: { line: '#B07AE8', bg: 'rgba(176,122,232,0.08)' },
  };

  const LOC_NAMES = {
    A: '图书馆广场', B: '主教学楼前', C: '湖边小径',
    D: '北门入口',   E: '田径场'
  };

  let chart = null;
  let currentParam = 'spl';
  const hiddenSets = new Set();

  /* ── build datasets for Chart.js ─────────────── */
  function buildDatasets(param) {
    const pdata = DATA[param];
    return Object.entries(pdata.datasets).map(([key, values]) => ({
      label: `${key} ${LOC_NAMES[key]}`,
      data: values,
      borderColor: COLORS[key].line,
      backgroundColor: COLORS[key].bg,
      borderWidth: 1.8,
      pointRadius: 2.5,
      pointHoverRadius: 5,
      pointBackgroundColor: COLORS[key].line,
      tension: 0.38,
      fill: false,
      hidden: hiddenSets.has(key),
    }));
  }

  /* ── Chart.js global defaults ─────────────────── */
  function setChartDefaults() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = '#7A7A90';
    Chart.defaults.font.family = "'Space Mono', monospace";
    Chart.defaults.font.size = 10;
    Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
  }

  /* ── build/update chart ───────────────────────── */
  function initChart() {
    const canvas = document.getElementById('main-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    setChartDefaults();
    const pdata = DATA[currentParam];

    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: TIMES.map(h => `${h}:00`),
        datasets: buildDatasets(currentParam),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: 'easeInOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },  // use our custom legend
          tooltip: {
            backgroundColor: 'rgba(14,14,22,0.95)',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            titleColor: '#E8E3D8',
            bodyColor: '#7A7A90',
            padding: 14,
            callbacks: {
              title: (items) => `${items[0].label}`,
              label: (item) => {
                const key = item.dataset.label.split(' ')[0];
                return `  ${key} ${LOC_NAMES[key]}: ${item.parsed.y} ${pdata.unit}`;
              }
            }
          },
          // annotation for time bands (drawn via plugin below)
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)', drawTicks: false },
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8,
              color: '#7A7A90',
            },
            border: { color: 'rgba(255,255,255,0.08)' }
          },
          y: {
            min: pdata.min,
            max: pdata.max,
            grid: { color: 'rgba(255,255,255,0.05)', drawTicks: false },
            ticks: { color: '#7A7A90' },
            border: { color: 'rgba(255,255,255,0.08)' },
            title: {
              display: true,
              text: `${currentParam.toUpperCase()} (${pdata.unit})`,
              color: '#E8A030',
              font: { family: "'Space Mono', monospace", size: 10 }
            }
          }
        }
      }
    });
  }

  /* ── update param ─────────────────────────────── */
  function setParam(param) {
    if (!DATA[param] || !chart) return;
    currentParam = param;
    const pdata = DATA[param];
    chart.data.datasets = buildDatasets(param);
    chart.options.scales.y.min = pdata.min;
    chart.options.scales.y.max = pdata.max;
    chart.options.scales.y.title.text = `${param.toUpperCase()} (${pdata.unit})`;
    chart.update('active');
  }

  /* ── tab buttons ──────────────────────────────── */
  function initTabs() {
    document.querySelectorAll('.ptab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const param = btn.dataset.param;
        setParam(param);
        // sync to 3D viz via bridge
        if (window.SonicBridge) window.SonicBridge.setChartParam(param);
      });
    });
  }

  /* ── legend toggle ────────────────────────────── */
  function initLegend() {
    document.querySelectorAll('.legend-item').forEach(item => {
      item.addEventListener('click', () => {
        const loc = item.dataset.loc;
        if (hiddenSets.has(loc)) {
          hiddenSets.delete(loc);
          item.style.opacity = '1';
        } else {
          hiddenSets.add(loc);
          item.style.opacity = '0.35';
        }
        if (chart) {
          chart.data.datasets = buildDatasets(currentParam);
          chart.update('active');
        }
      });
    });
  }

  /* ── public API ───────────────────────────────── */
  function init() {
    initChart();
    initTabs();
    initLegend();
  }

  // Wait for Chart.js to be available
  if (typeof Chart !== 'undefined') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    window.addEventListener('load', init);
  }

  return { setParam, getData: () => DATA, getColors: () => COLORS };
})();
