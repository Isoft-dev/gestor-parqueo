import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend
);

const numberFormatter = new Intl.NumberFormat('es-GT');
const currencyFormatter = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const REPORT_PALETTE = {
  blue: '#2563eb',
  blueSoft: '#60a5fa',
  cyan: '#0891b2',
  teal: '#0f766e',
  green: '#16a34a',
  amber: '#d97706',
  orange: '#ea580c',
  violet: '#7c3aed',
  slate: '#475569',
  rose: '#e11d48',
};

export function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

export function createVerticalGradient(chart, fromColor, toColor) {
  const { ctx, chartArea } = chart;
  if (!chartArea) return toColor;
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, fromColor);
  gradient.addColorStop(1, toColor);
  return gradient;
}

export function createHorizontalGradient(chart, fromColor, toColor) {
  const { ctx, chartArea } = chart;
  if (!chartArea) return toColor;
  const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
  gradient.addColorStop(0, fromColor);
  gradient.addColorStop(1, toColor);
  return gradient;
}

export function createCenterTextPlugin(lines) {
  const entries = (Array.isArray(lines) ? lines : []).filter(Boolean);
  const key = entries.map((item) => item.text).join('-').replace(/[^a-z0-9_-]+/gi, '');

  return {
    id: `report-center-text-${key || 'default'}`,
    afterDraw(chart) {
      if (!entries.length) return;
      const meta = chart.getDatasetMeta(0);
      const firstArc = meta?.data?.[0];
      if (!firstArc) return;

      const { ctx } = chart;
      const props = typeof firstArc.getProps === 'function'
        ? firstArc.getProps(['x', 'y'], true)
        : { x: firstArc.x, y: firstArc.y };
      const { x, y } = props;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const totalHeight = entries.length * 18;
      let cursorY = y - totalHeight / 2 + 6;

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      entries.forEach((line, index) => {
        ctx.font = line.font || (index === 0 ? '700 18px system-ui' : '600 11px system-ui');
        ctx.fillStyle = line.color || (index === 0 ? '#0f172a' : '#64748b');
        ctx.fillText(line.text, x, cursorY);
        cursorY += 18;
      });

      ctx.restore();
    },
  };
}

export function buildCartesianOptions({
  indexAxis = 'x',
  stacked = false,
  onClick,
  numericFormatter = formatNumber,
  showLegend = true,
  legendPosition = 'bottom',
  maxTicksLimit = 8,
} = {}) {
  const numericAxis = indexAxis === 'y' ? 'x' : 'y';
  const categoryAxis = indexAxis === 'y' ? 'y' : 'x';

  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis,
    animation: {
      duration: 450,
      easing: 'easeOutQuart',
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    onClick,
    plugins: {
      legend: {
        display: showLegend,
        position: legendPosition,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 18,
          color: '#334155',
          font: {
            size: 12,
            weight: '600',
          },
        },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        borderColor: '#1e293b',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
        displayColors: true,
        callbacks: {
          label(context) {
            const label = context.dataset.label ? `${context.dataset.label}: ` : '';
            return `${label}${numericFormatter(context.raw)}`;
          },
        },
      },
    },
    scales: {
      [categoryAxis]: {
        stacked,
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          color: '#64748b',
          font: {
            size: 11,
            weight: '600',
          },
          autoSkip: true,
          maxTicksLimit,
        },
      },
      [numericAxis]: {
        stacked,
        beginAtZero: true,
        grid: {
          color: 'rgba(148, 163, 184, 0.18)',
          drawBorder: false,
        },
        ticks: {
          color: '#64748b',
          font: {
            size: 11,
            weight: '600',
          },
          callback(value) {
            return numericFormatter(value);
          },
        },
      },
    },
  };
}

export function buildDoughnutOptions({
  onClick,
  valueFormatter = formatNumber,
  showLegend = false,
  cutout = '70%',
} = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout,
    animation: {
      duration: 420,
      easing: 'easeOutQuart',
    },
    onClick,
    plugins: {
      legend: {
        display: showLegend,
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        borderColor: '#1e293b',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
        callbacks: {
          label(context) {
            const data = context.dataset.data || [];
            const total = data.reduce((sum, item) => sum + Number(item || 0), 0);
            const value = Number(context.raw || 0);
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            return `${context.label}: ${valueFormatter(value)} (${pct}%)`;
          },
        },
      },
    },
  };
}

export function buildLegendItems(labels, values, colors, formatter = formatNumber) {
  return (labels || []).map((label, index) => ({
    label,
    value: formatter(values?.[index] ?? 0),
    color: colors?.[index] || REPORT_PALETTE.slate,
  }));
}
