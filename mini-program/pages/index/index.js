const { loadOutput } = require('../../utils/request');
const { fmt, pct, scoreZone, formatDate } = require('../../utils/util');
const chart = require('../../utils/chart');

Page({
  data: {
    loading: true,
    date: '--',
    gammaScore: 0,
    gammaZone: {},
    mlPred: '--',
    mlSignal: '',
    action: '--',
    source: '--',
    conflict: '--',
    regime: '--',
    confidence: '--',
    positionSize: '--',
    // Components
    rf: '--', piRisk: '--', cy: '--', sigAlert: '--',
    dxy: '--', dxyChg: '--',
    // 24H Catalysts
    catalysts: [],
    // Benefit / Avoid
    benefitAssets: [],
    avoidAssets: []
  },

  _navData: null,

  onLoad() { this.fetchData(); },
  onPullDownRefresh() { this.fetchData().then(() => wx.stopPullDownRefresh()); },

  async fetchData() {
    this.setData({ loading: true });
    try {
      const [unified, nav, cal] = await Promise.all([
        loadOutput('unified_signal'),
        loadOutput('nav_curve'),
        loadOutput('calibration').catch(() => null)
      ]);

      const score = unified.gamma_score || 50;
      const zone = scoreZone(score);

      // Component scores
      let rf = '--', piRisk = '--', cy = '--', sigAlert = '--';
      if (cal && cal.component_ics) {
        rf = fmt(cal.component_ics.rf * 100, 0);
        piRisk = fmt(cal.component_ics.pi_risk * 100, 0);
        cy = fmt(cal.component_ics.cy * 100, 0);
        sigAlert = fmt(cal.component_ics.sigma * 100, 0);
      }

      // Confidence & position size from signal
      const confScore = unified.conflict_score || 0;
      let confidence, positionSize;
      if (confScore < 0.2) { confidence = '高确信'; positionSize = '1.0x'; }
      else if (confScore < 0.5) { confidence = '中确信'; positionSize = '0.5x'; }
      else { confidence = '低确信'; positionSize = '0.25x'; }

      // Build catalysts from regime + model context
      const catalysts = this._buildCatalysts(unified);
      const { benefitAssets, avoidAssets } = this._buildAssetView(unified);

      this.setData({
        loading: false,
        date: formatDate(unified.date),
        gammaScore: score,
        gammaZone: zone,
        mlPred: pct(unified.ml_prediction, 2, true),
        mlSignal: unified.ml_signal || '',
        action: unified.action || '--',
        source: unified.signal_source || '--',
        conflict: fmt(unified.conflict_score, 2),
        regime: unified.regime_detail ? unified.regime_detail.regime : (unified.regime_state || '--'),
        confidence, positionSize,
        rf, piRisk, cy, sigAlert,
        dxy: fmt(unified.dxy_price, 2),
        dxyChg: '--',
        catalysts, benefitAssets, avoidAssets
      });

      // Store nav data for chart
      if (nav && nav.history) {
        this._navData = nav.history.slice(-30).map(h => ({ x: formatDate(h.date), y: h.nav }));
        setTimeout(() => this._drawChart(), 150);
      }
    } catch (e) {
      console.error('[Index] fetchData failed', e);
      this.setData({ loading: false });
    }
  },

  _buildCatalysts(unified) {
    // Generate contextual catalysts from regime + signal state
    const catalysts = [];
    const regime = unified.regime_detail ? unified.regime_detail.regime : '';

    if (regime.includes('加息') || regime.includes('hiking')) {
      catalysts.push({ time: '关注', event: 'FOMC 利率决议', impact: 'high', direction: '偏鹰则利多' });
    }
    catalysts.push({ time: '日内', event: '美联储官员讲话', impact: 'mid', direction: '关注措辞' });
    catalysts.push({ time: '本周', event: 'CPI / PPI 数据', impact: 'high', direction: '超预期利多USD' });
    catalysts.push({ time: '本周', event: '初请失业金', impact: 'mid', direction: '就业强利多' });
    catalysts.push({ time: '全天', event: '地缘局势变化', impact: 'high', direction: '不确定' });
    return catalysts;
  },

  _buildAssetView(unified) {
    const action = (unified.action || '').toUpperCase();
    const isLong = action === 'LONG';

    const benefitAssets = isLong
      ? [
        { name: '美元指数', ticker: 'DX-Y.NYB', reason: '直接受益' },
        { name: '美国短债', ticker: 'SHY', reason: '利差支撑' },
        { name: '必需消费品', ticker: 'XLP', reason: '防御属性' }
      ] : [
        { name: '黄金', ticker: 'GLD', reason: '美元走弱受益' },
        { name: '新兴市场', ticker: 'EEM', reason: '美元压力缓解' },
        { name: '大宗商品', ticker: 'DBC', reason: '反向定价' }
      ];

    const avoidAssets = isLong
      ? [
        { name: '黄金', ticker: 'GLD', reason: '美元走强压制' },
        { name: '新兴市场货币', ticker: 'EEM', reason: '资金回流美国' },
        { name: '高收益债', ticker: 'HYG', reason: '信用利差扩' }
      ] : [
        { name: '美元多头', ticker: 'UUP', reason: '方向相反' },
        { name: '美国银行股', ticker: 'KBE', reason: '曲线平坦化' },
        { name: '能源股', ticker: 'XLE', reason: '需求预期下行' }
      ];

    return { benefitAssets, avoidAssets };
  },

  _drawChart() {
    if (!this._navData) return;
    const query = wx.createSelectorQuery().in(this);
    query.select('#navChart').fields({ node: true, size: true }).exec(res => {
      if (!res || !res[0]) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      const w = res[0].width, h = res[0].height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);
      chart.drawLineChart(ctx, w, h, {
        data: this._navData, color: '#818cf8', fill: true,
        refLines: [{ value: 1.0, color: '#fbbf24' }]
      });
    });
  }
});
