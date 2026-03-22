const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    loading: true,
    activeTab: 0,
    tabs: ['汇率', '收益率', '对冲', '信号历史'],
    // FX data
    fxPairs: [],
    // Yield decomp
    yieldData: null,
    yieldBars: [],
    // Hedge
    hedge: null,
    hedgeGrid: [],
    // Signal history
    history: []
  },

  onLoad() {
    this.loadTab(0)
  },

  onPullDownRefresh() {
    this.loadTab(this.data.activeTab).then(() => wx.stopPullDownRefresh())
  },

  switchTab(e) {
    var idx = parseInt(e.currentTarget.dataset.idx)
    this.setData({ activeTab: idx })
    this.loadTab(idx)
  },

  async loadTab(idx) {
    this.setData({ loading: true })
    try {
      if (idx === 0) {
        var fx = await api.fetchFxPairs()
        var fxPairs = []
        if (fx && fx.pairs) {
          fxPairs = fx.pairs.map(function(p) {
            return {
              symbol: p.symbol || p.label,
              label: p.label,
              price: util.formatNumber(p.price, 4),
              change: util.formatPercent(p.change_pct),
              changeClass: p.change_pct >= 0 ? 'text-green' : 'text-red',
              signal: p.signal,
              signalClass: util.getSignalClass(p.signal),
              signalText: util.getSignalText(p.signal)
            }
          })
        }
        this.setData({ fxPairs, loading: false })

      } else if (idx === 1) {
        var yieldData = await api.fetchYield()
        var yieldBars = []
        if (yieldData) {
          var total = Math.abs(yieldData.real_rate || 0) + Math.abs(yieldData.bei_10y || 0) + Math.abs(yieldData.term_premium || 0)
          if (total > 0) {
            yieldBars = [
              { label: '实际利率', value: util.formatNumber(yieldData.real_rate) + '%', pct: Math.abs(yieldData.real_rate) / total * 100, color: '#22C55E' },
              { label: '通胀预期 (BEI)', value: util.formatNumber(yieldData.bei_10y) + '%', pct: Math.abs(yieldData.bei_10y) / total * 100, color: '#F59E0B' },
              { label: '期限溢价', value: util.formatNumber(yieldData.term_premium) + 'bps', pct: Math.abs(yieldData.term_premium) / total * 100, color: '#EF4444' }
            ]
          }
        }
        this.setData({ yieldData, yieldBars, loading: false })

      } else if (idx === 2) {
        var hedge = await api.fetchHedge()
        var hedgeGrid = []
        if (hedge) {
          hedgeGrid = [
            { label: 'CIP 基差', value: hedge.cip_basis || '--' },
            { label: '资管 EUR 多头', value: hedge.eur_long || '--' },
            { label: '资管 JPY 多头', value: hedge.jpy_long || '--' },
            { label: 'DXY-利率背离', value: hedge.dxy_rate_divergence || '--' },
            { label: 'SOFR', value: hedge.sofr || '--' },
            { label: 'ESTR', value: hedge.estr || '--' }
          ]
        }
        this.setData({ hedge, hedgeGrid, loading: false })

      } else if (idx === 3) {
        var history = await api.fetchHistory()
        var formatted = []
        if (Array.isArray(history)) {
          formatted = history.map(function(h) {
            return {
              date: h.date,
              signal: h.signal,
              signalClass: util.getSignalClass(h.signal),
              signalText: util.getSignalText(h.signal),
              score: util.formatNumber(h.score, 0),
              scoreClass: util.getScoreClass(h.score),
              change: h.change || '↔',
              changeClass: h.change === '↑' ? 'text-green' : h.change === '↓' ? 'text-red' : 'text-muted',
              note: h.note || ''
            }
          })
        }
        this.setData({ history: formatted, loading: false })
      }
    } catch (err) {
      console.error('Market load error:', err)
      this.setData({ loading: false })
      wx.showToast({ title: '数据加载失败', icon: 'none' })
    }
  }
})
