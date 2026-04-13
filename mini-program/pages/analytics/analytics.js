const { loadOutput } = require('../../utils/request');
const { fmt, pct, formatDate } = require('../../utils/util');
const chart = require('../../utils/chart');

Page({
  data: {
    activeTab: 0,
    tabs: ['SHAP', 'IC追踪', 'Regime', '相关性', '净值', '模型健康'],
    loading: true,
    chartHeight: 600,
    // SHAP
    shapBase: '--',
    shapOutput: '--',
    // IC
    icFactor: 'F1',
    icFactors: ['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10'],
    icToday: '--',
    icMa20: '--',
    icir: '--',
    // NAV
    navReturn: '--',
    navSharpe: '--',
    navDD: '--',
    // Model Health (NEW)
    healthStatus: '--',
    healthStatusClass: 'text-neutral',
    healthOosIC: '--',
    healthIcTrend: '--',
    healthIcTrendDir: '',
    healthRecentIC: '--',
    healthMulticol: '--',
    healthCircuitBreaker: '--',
    healthCircuitClass: 'text-neutral',
    cpcvPaths: '--',
    cpcvMedianSharpe: '--',
    cpcvAlphaT: '--',
    cpcvAlphaP: '--',
    cpcvPassRate: '--',
    healthIndicators: []
  },

  _chartData: null,

  onLoad() { this.loadTab(0); },

  switchTab(e) {
    const idx = parseInt(e.currentTarget.dataset.idx, 10);
    this.setData({ activeTab: idx });
    this.loadTab(idx);
  },

  async loadTab(idx) {
    this.setData({ loading: true });
    try {
      if (idx === 0) await this._loadShap();
      else if (idx === 1) await this._loadIC(this.data.icFactor);
      else if (idx === 2) await this._loadRegime();
      else if (idx === 3) await this._loadCorrelation();
      else if (idx === 4) await this._loadNav();
      else if (idx === 5) await this._loadModelHealth();
    } catch (e) {
      console.error('[Analytics] loadTab failed', e);
    }
    this.setData({ loading: false });
    // Tabs 0-4 use canvas; tab 5 is pure data
    if (idx < 5) {
      setTimeout(() => this._drawChart(), 100);
    }
  },

  // ── Data loaders ──────────────────────────────────

  async _loadShap() {
    const shap = await loadOutput('shap');
    const factors = (shap.factors || [])
      .sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value));
    this.setData({
      shapBase: fmt(shap.base_value, 3),
      shapOutput: fmt(shap.output_value, 3),
      chartHeight: Math.max(500, factors.length * 60)
    });
    this._chartData = {
      type: 'bar',
      opts: { data: factors.map(f => ({ label: f.name, value: f.shap_value })), horizontal: true }
    };
  },

  switchFactor(e) {
    const f = e.currentTarget.dataset.factor;
    this.setData({ icFactor: f, loading: true });
    this._loadIC(f).then(() => {
      this.setData({ loading: false });
      setTimeout(() => this._drawChart(), 100);
    });
  },

  async _loadIC(factor) {
    const ic = await loadOutput(`ic_tracking_${factor}`);
    const history = ic.history || [];
    this.setData({
      icToday: fmt(ic.ic_today, 4),
      icMa20: fmt(ic.ic_ma20, 4),
      icir: fmt(ic.icir, 3),
      chartHeight: 380
    });
    this._chartData = {
      type: 'line',
      opts: {
        data: history.slice(-60).map(h => ({ x: formatDate(h.date), y: h.ic_ma20 })),
        color: '#818cf8',
        fill: false,
        refLines: [{ value: 0, color: '#64748b' }]
      }
    };
  },

  async _loadRegime() {
    const data = await loadOutput('regime_ic');
    const regimes = data.regimes || data.regime_names || [];
    this.setData({ chartHeight: Math.max(500, (data.factor_names || []).length * 55) });
    this._chartData = {
      type: 'heatmap',
      opts: {
        matrix: data.matrix,
        rowLabels: data.factor_names,
        colLabels: regimes,
        minVal: -0.3,
        maxVal: 0.3
      }
    };
  },

  async _loadCorrelation() {
    const data = await loadOutput('correlation');
    this.setData({ chartHeight: Math.max(600, (data.labels || []).length * 55) });
    this._chartData = {
      type: 'heatmap',
      opts: {
        matrix: data.matrix,
        rowLabels: data.labels,
        colLabels: data.labels,
        minVal: -1,
        maxVal: 1
      }
    };
  },

  async _loadNav() {
    const nav = await loadOutput('nav_curve');
    const history = nav.history || [];
    this.setData({
      navReturn: fmt(nav.total_return, 2, true) + '%',
      navSharpe: fmt(nav.sharpe, 3),
      navDD: fmt(nav.max_drawdown * 100, 2) + '%',
      chartHeight: 400
    });
    this._chartData = {
      type: 'line',
      opts: {
        data: history.map(h => ({ x: formatDate(h.date), y: h.nav })),
        color: '#818cf8',
        fill: true,
        refLines: [{ value: 1.0, color: '#fbbf24' }]
      }
    };
  },

  // ── NEW: Model Health + CPCV ──────────────────────

  async _loadModelHealth() {
    const [mh, cpcv] = await Promise.all([
      loadOutput('model_health').catch(() => null),
      loadOutput('cpcv_results').catch(() => null)
    ]);

    const indicators = [];

    if (mh) {
      // Overall status
      const oosIC = mh.oos_ic || 0;
      const icTrend = mh.ic_trend || 0;
      const recent60 = mh.recent_60d_ic || 0;
      const multicol = mh.max_vif || 0;
      const cbState = mh.circuit_breaker_state || 'normal';

      let status, statusClass;
      if (cbState === 'liquidate' || cbState === 'pause') { status = '已停机'; statusClass = 'text-bear'; }
      else if (oosIC < 0.03 || recent60 < -0.1) { status = '警告'; statusClass = 'text-neutral'; }
      else { status = '正常'; statusClass = 'text-bull'; }

      // IC trend direction
      let icTrendDir = '';
      if (icTrend > 0.001) icTrendDir = '↑';
      else if (icTrend < -0.001) icTrendDir = '↓';
      else icTrendDir = '→';

      // Circuit breaker
      let cbText, cbClass;
      if (cbState === 'normal') { cbText = '正常运行'; cbClass = 'text-bull'; }
      else if (cbState === 'halve') { cbText = '减半仓位'; cbClass = 'text-neutral'; }
      else if (cbState === 'pause') { cbText = '暂停交易'; cbClass = 'text-bear'; }
      else if (cbState === 'liquidate') { cbText = '强制平仓'; cbClass = 'text-bear'; }
      else if (cbState === 'hibernate') { cbText = '休眠模式'; cbClass = 'text-muted'; }
      else { cbText = cbState; cbClass = 'text-neutral'; }

      // Build indicators list
      indicators.push({
        label: 'OOS IC', value: fmt(oosIC, 4),
        status: oosIC > 0.05 ? 'good' : oosIC > 0.02 ? 'warn' : 'bad'
      });
      indicators.push({
        label: 'IC 趋势', value: fmt(icTrend, 4) + ' ' + icTrendDir,
        status: icTrend > 0 ? 'good' : icTrend > -0.002 ? 'warn' : 'bad'
      });
      indicators.push({
        label: '近60天IC', value: fmt(recent60, 4),
        status: recent60 > 0 ? 'good' : recent60 > -0.1 ? 'warn' : 'bad'
      });
      indicators.push({
        label: '最大VIF', value: fmt(multicol, 1),
        status: multicol < 5 ? 'good' : multicol < 10 ? 'warn' : 'bad'
      });

      this.setData({
        healthStatus: status,
        healthStatusClass: statusClass,
        healthOosIC: fmt(oosIC, 4),
        healthIcTrend: fmt(icTrend, 4),
        healthIcTrendDir: icTrendDir,
        healthRecentIC: fmt(recent60, 4),
        healthMulticol: fmt(multicol, 1),
        healthCircuitBreaker: cbText,
        healthCircuitClass: cbClass
      });
    } else {
      // Fallback
      indicators.push({ label: 'OOS IC', value: '--', status: 'warn' });
      indicators.push({ label: 'IC 趋势', value: '--', status: 'warn' });
      indicators.push({ label: '近60天IC', value: '--', status: 'warn' });
      indicators.push({ label: '最大VIF', value: '--', status: 'warn' });

      this.setData({
        healthStatus: '无数据',
        healthStatusClass: 'text-muted',
        healthCircuitBreaker: '--',
        healthCircuitClass: 'text-muted'
      });
    }

    if (cpcv) {
      const paths = cpcv.n_paths || 15;
      const medianSharpe = cpcv.median_sharpe || 0;
      const alphaT = cpcv.alpha_tstat || 0;
      const alphaP = cpcv.alpha_pvalue || 1;
      const passRate = cpcv.pass_rate || 0;

      indicators.push({
        label: 'CPCV Sharpe', value: fmt(medianSharpe, 3),
        status: medianSharpe > 0.5 ? 'good' : medianSharpe > 0 ? 'warn' : 'bad'
      });
      indicators.push({
        label: 'Alpha t-stat', value: fmt(alphaT, 2),
        status: alphaT > 2 ? 'good' : alphaT > 1 ? 'warn' : 'bad'
      });

      this.setData({
        cpcvPaths: paths + ' paths',
        cpcvMedianSharpe: fmt(medianSharpe, 3),
        cpcvAlphaT: fmt(alphaT, 2),
        cpcvAlphaP: fmt(alphaP, 4),
        cpcvPassRate: fmt(passRate * 100, 1) + '%'
      });
    } else {
      this.setData({
        cpcvPaths: '--', cpcvMedianSharpe: '--',
        cpcvAlphaT: '--', cpcvAlphaP: '--', cpcvPassRate: '--'
      });
    }

    this.setData({ healthIndicators: indicators });
  },

  // ── Single canvas drawer ──────────────────────────

  _drawChart() {
    if (!this._chartData) return;

    const query = wx.createSelectorQuery().in(this);
    query.select('#mainChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;
        const w = res[0].width;
        const h = res[0].height;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);

        // Clear entire canvas
        ctx.clearRect(0, 0, w, h);

        const { type, opts } = this._chartData;
        if (type === 'line') chart.drawLineChart(ctx, w, h, opts);
        else if (type === 'bar') chart.drawBarChart(ctx, w, h, opts);
        else if (type === 'heatmap') chart.drawHeatmap(ctx, w, h, opts);
      });
  }
});
