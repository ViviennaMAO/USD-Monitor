/**
 * Canvas 图表绘制工具
 * SuperBox 无 DOM，所有图表用 canvas 2D 绘制
 */

const COLORS = {
  bull: '#34d399',
  bear: '#f87171',
  neutral: '#fbbf24',
  accent: '#38bdf8',
  line: '#818cf8',
  grid: 'rgba(51, 65, 85, 0.3)',
  text: '#94a3b8',
  bg: '#0a0e1a'
};

/**
 * 绘制径向仪表盘 (Score Gauge)
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - canvas width px
 * @param {number} h - canvas height px
 * @param {number} score - 0-100
 * @param {string} label - center label
 */
const drawGauge = (ctx, w, h, score, label) => {
  const cx = w / 2;
  const cy = h * 0.55;
  const r = Math.min(w, h) * 0.38;
  const lw = r * 0.15;
  const startAngle = Math.PI * 0.75;
  const endAngle = Math.PI * 2.25;
  const totalArc = endAngle - startAngle;

  // Background arc
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle, false);
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Color gradient arc
  const scoreAngle = startAngle + (score / 100) * totalArc;
  const gradient = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  gradient.addColorStop(0, COLORS.bear);
  gradient.addColorStop(0.4, COLORS.neutral);
  gradient.addColorStop(1, COLORS.bull);

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, scoreAngle, false);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Needle tick
  const nx = cx + r * Math.cos(scoreAngle);
  const ny = cy + r * Math.sin(scoreAngle);
  ctx.beginPath();
  ctx.arc(nx, ny, lw * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Score number
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${r * 0.55}px -apple-system`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(Math.round(score), cx, cy - r * 0.05);

  // Label
  ctx.fillStyle = COLORS.text;
  ctx.font = `${r * 0.2}px -apple-system`;
  ctx.fillText(label || 'γ Score', cx, cy + r * 0.35);

  // Zone labels
  ctx.font = `${r * 0.15}px -apple-system`;
  ctx.fillStyle = COLORS.bear;
  const lx = cx + (r + lw) * Math.cos(startAngle);
  const ly = cy + (r + lw) * Math.sin(startAngle);
  ctx.fillText('0', lx + 8, ly + 4);

  ctx.fillStyle = COLORS.bull;
  const rx = cx + (r + lw) * Math.cos(endAngle);
  const ry = cy + (r + lw) * Math.sin(endAngle);
  ctx.fillText('100', rx - 8, ry + 4);
};

/**
 * 绘制折线图
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - width
 * @param {number} h - height
 * @param {Object} opts
 * @param {Array<{x:string, y:number}>} opts.data
 * @param {string} opts.color
 * @param {boolean} opts.fill - 是否填充面积
 * @param {boolean} opts.showGrid
 * @param {boolean} opts.showLabels
 * @param {Array<{value:number, color:string}>} opts.refLines - 参考线
 */
const drawLineChart = (ctx, w, h, opts) => {
  const { data, color = COLORS.accent, fill = false, showGrid = true, showLabels = true, refLines = [] } = opts;
  if (!data || data.length < 2) return;

  const pad = { top: 20, right: 16, bottom: showLabels ? 36 : 16, left: showLabels ? 50 : 16 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const ys = data.map(d => d.y);
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const yRange = yMax - yMin;
  yMin -= yRange * 0.05;
  yMax += yRange * 0.05;

  const toX = (i) => pad.left + (i / (data.length - 1)) * cw;
  const toY = (v) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * ch;

  // Grid lines
  if (showGrid) {
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const gy = pad.top + (i / 4) * ch;
      ctx.beginPath();
      ctx.moveTo(pad.left, gy);
      ctx.lineTo(w - pad.right, gy);
      ctx.stroke();
    }
  }

  // Reference lines
  refLines.forEach(ref => {
    if (ref.value >= yMin && ref.value <= yMax) {
      const ry = toY(ref.value);
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = ref.color || COLORS.neutral;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, ry);
      ctx.lineTo(w - pad.right, ry);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });

  // Fill area
  if (fill) {
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(data[0].y));
    data.forEach((d, i) => ctx.lineTo(toX(i), toY(d.y)));
    ctx.lineTo(toX(data.length - 1), pad.top + ch);
    ctx.lineTo(toX(0), pad.top + ch);
    ctx.closePath();
    const grd = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
    grd.addColorStop(0, color.replace(')', ', 0.25)').replace('rgb', 'rgba'));
    grd.addColorStop(1, 'rgba(10, 14, 26, 0)');
    ctx.fillStyle = grd;
    ctx.fill();
  }

  // Line
  ctx.beginPath();
  ctx.moveTo(toX(0), toY(data[0].y));
  data.forEach((d, i) => ctx.lineTo(toX(i), toY(d.y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // X labels (every ~5 ticks)
  if (showLabels) {
    ctx.fillStyle = COLORS.text;
    ctx.font = '10px -apple-system';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(data.length / 5));
    for (let i = 0; i < data.length; i += step) {
      ctx.fillText(data[i].x || '', toX(i), h - 8);
    }
    // Y labels
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const val = yMax - (i / 4) * (yMax - yMin);
      ctx.fillText(val.toFixed(1), pad.left - 6, pad.top + (i / 4) * ch + 4);
    }
  }
};

/**
 * 绘制柱状图 (SHAP waterfall)
 */
const drawBarChart = (ctx, w, h, opts) => {
  const { data, horizontal = true } = opts;
  if (!data || !data.length) return;

  const pad = { top: 16, right: 16, bottom: 20, left: horizontal ? 120 : 40 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const vals = data.map(d => d.value);
  const absMax = Math.max(...vals.map(Math.abs), 0.01);

  if (horizontal) {
    const barH = Math.min(ch / data.length * 0.7, 24);
    const gap = ch / data.length;

    data.forEach((d, i) => {
      const cy = pad.top + i * gap + gap / 2;
      const barW = (d.value / absMax) * (cw / 2);
      const x0 = pad.left + cw / 2;

      ctx.fillStyle = d.value >= 0 ? COLORS.bull : COLORS.bear;
      ctx.fillRect(
        d.value >= 0 ? x0 : x0 + barW,
        cy - barH / 2,
        Math.abs(barW),
        barH
      );

      // Label
      ctx.fillStyle = COLORS.text;
      ctx.font = '10px -apple-system';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.label || '', pad.left - 6, cy);

      // Value
      ctx.textAlign = d.value >= 0 ? 'left' : 'right';
      ctx.fillStyle = d.value >= 0 ? COLORS.bull : COLORS.bear;
      const vx = d.value >= 0 ? x0 + barW + 6 : x0 + barW - 6;
      ctx.fillText(d.value.toFixed(3), vx, cy);
    });

    // Center line
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left + cw / 2, pad.top);
    ctx.lineTo(pad.left + cw / 2, h - pad.bottom);
    ctx.stroke();
  }
};

/**
 * 绘制热力图 (regime IC / correlation)
 */
const drawHeatmap = (ctx, w, h, opts) => {
  const { matrix, rowLabels, colLabels, minVal = -1, maxVal = 1 } = opts;
  if (!matrix || !matrix.length) return;

  const rows = matrix.length;
  const cols = matrix[0].length;
  const pad = { top: 40, right: 16, bottom: 16, left: 80 };
  const cellW = (w - pad.left - pad.right) / cols;
  const cellH = (h - pad.top - pad.bottom) / rows;

  // Cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = matrix[r][c];
      const t = (v - minVal) / (maxVal - minVal); // 0..1
      const red = Math.round(248 * (1 - t) + 52 * t);
      const green = Math.round(113 * (1 - t) + 211 * t);
      const blue = Math.round(113 * (1 - t) + 153 * t);
      ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;

      const x = pad.left + c * cellW;
      const y = pad.top + r * cellH;
      ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);

      // Value text
      ctx.fillStyle = Math.abs(v) > 0.5 ? '#ffffff' : '#cbd5e1';
      ctx.font = '10px -apple-system';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(v.toFixed(2), x + cellW / 2, y + cellH / 2);
    }
  }

  // Row labels
  ctx.fillStyle = COLORS.text;
  ctx.font = '10px -apple-system';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  if (rowLabels) {
    rowLabels.forEach((l, i) => {
      ctx.fillText(l, pad.left - 6, pad.top + i * cellH + cellH / 2);
    });
  }

  // Col labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  if (colLabels) {
    colLabels.forEach((l, i) => {
      ctx.fillText(l, pad.left + i * cellW + cellW / 2, pad.top - 6);
    });
  }
};

module.exports = { COLORS, drawGauge, drawLineChart, drawBarChart, drawHeatmap };
