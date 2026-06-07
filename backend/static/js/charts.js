/* ===================== MENU ADMIN — CHARTS.JS ===================== */

const APP_COLORS = {
  orange: '#E8591C',
  green: '#38A169',
  amber: '#F5A623',
  blue: '#3B82F6',
  red: '#EF4444',
  purple: '#8B5CF6',
  cyan: '#06B6D4',
  pink: '#EC4899',
  orangeDim: 'rgba(232, 89, 28, 0.15)',
  greenDim: 'rgba(56, 161, 105, 0.15)',
  amberDim: 'rgba(245, 166, 35, 0.15)',
  blueDim: 'rgba(59, 130, 246, 0.15)',
  redDim: 'rgba(239, 68, 68, 0.15)',
};

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 1000, easing: 'easeInOutCubic' },
  plugins: {
    legend: {
      labels: { color: '#9CA3AF', font: { size: 11, family: 'Inter' }, boxWidth: 12, padding: 16 }
    },
    tooltip: {
      backgroundColor: 'rgba(17, 17, 24, 0.95)',
      borderColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      titleColor: '#F9FAFB',
      bodyColor: '#9CA3AF',
      padding: 12,
      cornerRadius: 8,
      titleFont: { size: 12, weight: '600', family: 'Inter' },
      bodyFont: { size: 11, family: 'Inter' },
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      ticks: { color: '#9CA3AF', font: { size: 10, family: 'Inter' } },
      border: { display: false },
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      ticks: { color: '#9CA3AF', font: { size: 10, family: 'Inter' } },
      border: { display: false },
    }
  }
};

function makeGradient(ctx, color, alpha1 = 0.3, alpha2 = 0) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0,2), 16);
  const g = parseInt(hex.slice(2,4), 16);
  const b = parseInt(hex.slice(4,6), 16);
  gradient.addColorStop(0, `rgba(${r},${g},${b},${alpha1})`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},${alpha2})`);
  return gradient;
}

// Line chart with gradient fill
function createLineChart(canvasId, labels, datasets) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const processedDatasets = datasets.map((ds, i) => {
    const color = ds.color || Object.values(APP_COLORS).filter(v => !v.includes('Dim'))[i] || APP_COLORS.green;
    return {
      label: ds.label,
      data: ds.data,
      borderColor: color,
      backgroundColor: makeGradient(ctx, color, 0.25, 0),
      borderWidth: 2,
      fill: ds.fill !== false,
      tension: 0.4,
      pointBackgroundColor: color,
      pointBorderColor: 'var(--bg-primary)',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
    };
  });

  return new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: processedDatasets },
    options: { ...CHART_DEFAULTS },
  });
}

// Bar chart
function createBarChart(canvasId, labels, datasets, stacked = false) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const colors = [APP_COLORS.green, APP_COLORS.amber, APP_COLORS.blue, APP_COLORS.red, APP_COLORS.purple];
  const processedDatasets = datasets.map((ds, i) => ({
    label: ds.label,
    data: ds.data,
    backgroundColor: ds.color || colors[i % colors.length],
    borderRadius: stacked ? 0 : 6,
    borderSkipped: false,
    stack: stacked ? 'stack' : undefined,
  }));

  const options = { ...CHART_DEFAULTS };
  if (stacked) {
    options.scales = {
      ...options.scales,
      x: { ...options.scales.x, stacked: true },
      y: { ...options.scales.y, stacked: true },
    };
  }

  return new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: processedDatasets },
    options,
  });
}

// Doughnut chart
function createDoughnutChart(canvasId, labels, data, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const defaultColors = [APP_COLORS.amber, APP_COLORS.green, APP_COLORS.blue, APP_COLORS.purple, APP_COLORS.red, APP_COLORS.cyan, '#94a3b8', '#64748b'];

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors || defaultColors.slice(0, labels.length),
        borderColor: 'var(--bg-secondary)',
        borderWidth: 3,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeInOutCubic' },
      cutout: '70%',
      plugins: {
        legend: CHART_DEFAULTS.plugins.legend,
        tooltip: CHART_DEFAULTS.plugins.tooltip,
      }
    }
  });
}

// Radar chart
function createRadarChart(canvasId, labels, datasets) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  return new Chart(ctx, {
    type: 'radar',
    data: {
      labels,
      datasets: datasets.map((ds, i) => {
        const color = ds.color || [APP_COLORS.green, APP_COLORS.blue, APP_COLORS.amber][i];
        return {
          label: ds.label,
          data: ds.data,
          borderColor: color,
          backgroundColor: color.replace('#', 'rgba(').replace(')', ',0.15)').replace('rgba(', 'rgba(') || 'rgba(16,185,129,0.15)',
          pointBackgroundColor: color,
          pointRadius: 4,
          borderWidth: 2,
        };
      })
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900 },
      scales: {
        r: {
          grid: { color: 'rgba(255,255,255,0.06)' },
          angleLines: { color: 'rgba(255,255,255,0.06)' },
          pointLabels: { color: '#9CA3AF', font: { size: 10, family: 'Inter' } },
          ticks: { color: '#9CA3AF', backdropColor: 'transparent', font: { size: 9 } },
          suggestedMin: 0, suggestedMax: 5,
        }
      },
      plugins: { legend: CHART_DEFAULTS.plugins.legend, tooltip: CHART_DEFAULTS.plugins.tooltip }
    }
  });
}

// Polar Area chart
function createPolarChart(canvasId, labels, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const colors = [APP_COLORS.green, APP_COLORS.amber, APP_COLORS.blue, APP_COLORS.red, APP_COLORS.purple, APP_COLORS.cyan];

  return new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, labels.length).map(c => c + '99'),
        borderColor: colors.slice(0, labels.length),
        borderWidth: 1.5,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 900 },
      scales: {
        r: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#9CA3AF', backdropColor: 'transparent', font: { size: 9 } },
        }
      },
      plugins: { legend: CHART_DEFAULTS.plugins.legend, tooltip: CHART_DEFAULTS.plugins.tooltip }
    }
  });
}

// Bubble chart
function createBubbleChart(canvasId, datasets) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  return new Chart(ctx, {
    type: 'bubble',
    data: {
      datasets: datasets.map((ds, i) => ({
        label: ds.label,
        data: ds.data,
        backgroundColor: (ds.color || APP_COLORS.green) + '80',
        borderColor: ds.color || APP_COLORS.green,
        borderWidth: 1.5,
      }))
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: { legend: CHART_DEFAULTS.plugins.legend, tooltip: CHART_DEFAULTS.plugins.tooltip }
    }
  });
}

// Scatter chart
function createScatterChart(canvasId, datasets) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const colors = [APP_COLORS.green, APP_COLORS.amber, APP_COLORS.blue];

  return new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: datasets.map((ds, i) => ({
        label: ds.label,
        data: ds.data,
        backgroundColor: (colors[i] || APP_COLORS.green) + 'aa',
        pointRadius: 5,
        pointHoverRadius: 7,
      }))
    },
    options: { ...CHART_DEFAULTS }
  });
}

window.MENU = { createLineChart, createBarChart, createDoughnutChart, createRadarChart, createPolarChart, createBubbleChart, createScatterChart, APP_COLORS };
