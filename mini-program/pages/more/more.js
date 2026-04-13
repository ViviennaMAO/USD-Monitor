const { loadOutput } = require('../../utils/request');
const { fmt, pct, formatDate } = require('../../utils/util');

Page({
  data: {
    activeTab: 0,
    tabs: ['模型健康', 'CPCV', '因子宇宙'],
    loading: true,
    // Model Health
    oosIC: '--',
    recent60d: '--',
    icH1: '--',
    icH2: '--',
    status: '--',
    statusColor: '',
    // CPCV
    cpcvPaths: '--',
    cpcvMedian: '--',
    cpcvPValue: '--',
    cpcvPositive: '--',
    cpcvBest: '--',
    cpcvWorst: '--',
    // Factor universe
    factors: [],
    // Multiscale
    multiscale: []
  },

  onLoad() {
    this.loadTab(0);
  },

  switchTab(e) {
    const idx = e.currentTarget.dataset.idx;
    this.setData({ activeTab: idx });
    this.loadTab(idx);
  },

  async loadTab(idx) {
    this.setData({ loading: true });
    try {
      if (idx === 0) await this.loadHealth();
      else if (idx === 1) await this.loadCPCV();
      else if (idx === 2) await this.loadFactors();
    } catch (e) {
      console.error('[More] loadTab failed', e);
    }
    this.setData({ loading: false });
  },

  async loadHealth() {
    const mh = await loadOutput('model_health');
    const statusColor = mh.status === 'healthy' ? 'bull' : mh.status === 'degraded' ? 'bear' : 'neutral';
    this.setData({
      oosIC: fmt(mh.oos_ic, 4),
      recent60d: fmt(mh.recent_60d_ic, 4),
      icH1: fmt(mh.ic_first_half, 4),
      icH2: fmt(mh.ic_second_half, 4),
      status: mh.status || '--',
      statusColor
    });
  },

  async loadCPCV() {
    const cpcv = await loadOutput('cpcv_result');
    this.setData({
      cpcvPaths: cpcv.n_paths || '--',
      cpcvMedian: fmt(cpcv.median_sharpe, 3),
      cpcvPValue: fmt(cpcv.p_value, 4),
      cpcvPositive: (cpcv.positive_paths_pct || 0) + '%',
      cpcvBest: fmt(cpcv.best_sharpe, 3),
      cpcvWorst: fmt(cpcv.worst_sharpe, 3)
    });
  },

  async loadFactors() {
    const corr = await loadOutput('correlation');
    const ic = await loadOutput('ic_history');
    // Build factor_ic lookup: { F1_RateDiff: 0.18, ... }
    const icMap = {};
    if (Array.isArray(ic.factor_ic)) {
      ic.factor_ic.forEach(f => { icMap[f.factor] = f.ic; });
    }
    const factors = (corr.labels || []).map((f, i) => ({
      name: f,
      fullName: (corr.full_labels || [])[i] || f,
      icMean: icMap[f] !== undefined ? fmt(icMap[f], 4) : '--'
    }));
    this.setData({ factors });
  }
});
