/**
 * Formatting utilities for USD Monitor miniprogram
 */

function formatNumber(n, decimals) {
  if (n == null || isNaN(n)) return '--'
  decimals = decimals != null ? decimals : 2
  return Number(n).toFixed(decimals)
}

function formatPercent(n, decimals) {
  if (n == null || isNaN(n)) return '--'
  decimals = decimals != null ? decimals : 2
  var prefix = n > 0 ? '+' : ''
  return prefix + Number(n).toFixed(decimals) + '%'
}

function formatChange(n, decimals) {
  if (n == null || isNaN(n)) return '--'
  decimals = decimals != null ? decimals : 2
  var prefix = n > 0 ? '+' : ''
  return prefix + Number(n).toFixed(decimals)
}

function getSignalClass(signal) {
  if (!signal) return 'badge-neutral'
  var s = signal.toUpperCase()
  if (s === 'BULLISH') return 'badge-bullish'
  if (s === 'BEARISH') return 'badge-bearish'
  return 'badge-neutral'
}

function getSignalText(signal) {
  if (!signal) return '中性'
  var s = signal.toUpperCase()
  if (s === 'BULLISH') return '看多'
  if (s === 'BEARISH') return '看空'
  return '中性'
}

function getAlertClass(level) {
  if (!level) return 'badge-calm'
  if (level === 'alert') return 'badge-alert'
  if (level === 'warning') return 'badge-warning'
  if (level === 'watch') return 'badge-watch'
  return 'badge-calm'
}

function getAlertText(level) {
  if (!level) return '平静'
  if (level === 'alert') return '警报'
  if (level === 'warning') return '预警'
  if (level === 'watch') return '关注'
  return '平静'
}

function getDirectionClass(dir) {
  if (!dir) return 'dir-neutral'
  if (dir === 'push') return 'dir-push'
  if (dir === 'latent_push') return 'dir-latent'
  if (dir === 'suppress') return 'dir-suppress'
  return 'dir-neutral'
}

function getDirectionIcon(dir) {
  if (dir === 'push') return '▲'
  if (dir === 'latent_push') return '△'
  if (dir === 'suppress') return '▽'
  return '○'
}

function getScoreClass(score) {
  if (score == null) return 'score-mid'
  if (score >= 65) return 'score-high'
  if (score >= 35) return 'score-mid'
  return 'score-low'
}

function getScoreColor(score) {
  if (score == null) return '#F59E0B'
  if (score >= 65) return '#22C55E'
  if (score >= 35) return '#F59E0B'
  return '#EF4444'
}

module.exports = {
  formatNumber,
  formatPercent,
  formatChange,
  getSignalClass,
  getSignalText,
  getAlertClass,
  getAlertText,
  getDirectionClass,
  getDirectionIcon,
  getScoreClass,
  getScoreColor
}
