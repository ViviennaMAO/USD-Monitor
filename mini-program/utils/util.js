/**
 * USD Monitor 工具函数
 */

/** 数字格式化 (保留小数 + 符号) */
const fmt = (v, decimals = 2, sign = false) => {
  if (v === null || v === undefined || isNaN(v)) return '--';
  const s = Number(v).toFixed(decimals);
  return sign && v > 0 ? '+' + s : s;
};

/** 百分比格式化 */
const pct = (v, decimals = 2, sign = true) => {
  if (v === null || v === undefined || isNaN(v)) return '--';
  return fmt(v, decimals, sign) + '%';
};

/** 信号方向颜色 class */
const signalColor = (direction) => {
  if (!direction) return 'text-muted';
  const d = direction.toUpperCase();
  if (d === 'LONG' || d === 'BUY' || d === 'BULLISH') return 'text-bull';
  if (d === 'SHORT' || d === 'SELL' || d === 'BEARISH') return 'text-bear';
  return 'text-neutral';
};

/** 信号方向中文 */
const signalLabel = (direction) => {
  if (!direction) return '--';
  const d = direction.toUpperCase();
  if (d === 'LONG' || d === 'BUY') return '看多';
  if (d === 'SHORT' || d === 'SELL') return '看空';
  return '中性';
};

/** 日期格式化 */
const formatDate = (dateStr) => {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}-${day}`;
};

/** 分数 → 颜色区间 (0-100) */
const scoreZone = (score) => {
  if (score >= 65) return { zone: 'bull', color: '#34d399', label: '偏多' };
  if (score >= 35) return { zone: 'neutral', color: '#fbbf24', label: '中性' };
  return { zone: 'bear', color: '#f87171', label: '偏空' };
};

/** regime 标签 */
const regimeLabel = (regime) => {
  const map = { 'hiking': '加息期', 'cutting': '降息期', 'volatile': '震荡期', 'stable': '稳定期' };
  return map[regime] || regime || '--';
};

module.exports = { fmt, pct, signalColor, signalLabel, formatDate, scoreZone, regimeLabel };
