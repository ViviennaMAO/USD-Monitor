const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    loading: true,
    activeTab: 0,
    tabs: ['SHAP归因', 'IC追踪', 'Regime', '相关性', 'NAV回测'],
    shap: null,
    shapFactors: [],
    ic: null,
    icFactorIdx: 0,
    icFactors: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9'],
    icFactorNames: ['RR', '利差残差', 'OVX', 'VVIX/VIX', 'VIX/VXN', 'VXHYG', 'GVZ', 'RR共振', '滞胀'],
    regime: null,
    correlation: null,
    nav: null,
    navStats: []
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
        var shap = await api.fetchShap()
        var shapFactors = []
        if (shap && shap.factors) {
          var maxAbs = 0
          shap.factors.forEach(function(f) {
            if (Math.abs(f.shap_value) > maxAbs) maxAbs = Math.abs(f.shap_value)
          })
          shapFactors = shap.factors.map(function(f) {
            return {
              name: f.name,
              value: util.formatChange(f.shap_value, 3),
              factorValue: f.factor_value != null ? util.formatNumber(f.factor_value) : '--',
              barWidth: Math.abs(f.shap_value) / (maxAbs || 1) * 100,
              isPositive: f.shap_value >= 0,
              barColor: f.shap_value >= 0 ? '#22C55E' : '#EF4444'
            }
          }).sort(function(a, b) {
            return Math.abs(parseFloat(b.value)) - Math.abs(parseFloat(a.value))
          })
        }
        this.setData({ shap, shapFactors, loading: false })

      } else if (idx === 1) {
        var factor = this.data.icFactors[this.data.icFactorIdx]
        var ic = await api.fetchIcTracking(factor)
        this.setData({ ic, loading: false })
        if (ic && ic.history) {
          setTimeout(() => this.drawIcChart(ic), 100)
        }

      } else if (idx === 2) {
        var regime = await api.fetchRegimeIc()
        this.setData({ regime, loading: false })

      } else if (idx === 3) {
        var correlation = await api.fetchCorrelation()
        this.setData({ correlation, loading: false })

      } else if (idx === 4) {
        var nav = await api.fetchNav()
        var navStats = []
        if (nav) {
          navStats = [
            { label: '总收益率', value: util.formatPercent(nav.total_return), cls: nav.total_return >= 0 ? 'text-green' : 'text-red' },
            { label: 'Sharpe Ratio', value: util.formatNumber(nav.sharpe), cls: nav.sharpe >= 1 ? 'text-green' : 'text-amber' },
            { label: '最大回撤', value: util.formatPercent(nav.max_drawdown), cls: 'text-red' },
            { label: '胜率', value: util.formatPercent(nav.win_rate), cls: nav.win_rate >= 50 ? 'text-green' : 'text-red' }
          ]
        }
        this.setData({ nav, navStats, loading: false })
        if (nav && nav.history) {
          setTimeout(() => this.drawNavChart(nav), 100)
        }
      }
    } catch (err) {
      console.error('Analytics load error:', err)
      this.setData({ loading: false })
      wx.showToast({ title: '数据加载失败', icon: 'none' })
    }
  },

  switchIcFactor(e) {
    var idx = parseInt(e.currentTarget.dataset.idx)
    this.setData({ icFactorIdx: idx })
    this.loadTab(1)
  },

  drawIcChart(ic) {
    var query = wx.createSelectorQuery()
    query.select('#icCanvas')
      .fields({ node: true, size: true })
      .exec(function(res) {
        if (!res || !res[0]) return
        var canvas = res[0].node
        var ctx = canvas.getContext('2d')
        var dpr = wx.getWindowInfo().pixelRatio
        var width = res[0].width
        var height = res[0].height

        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, width, height)

        var data = ic.history
        if (!data || data.length === 0) return

        var padding = { top: 10, right: 10, bottom: 20, left: 40 }
        var chartW = width - padding.left - padding.right
        var chartH = height - padding.top - padding.bottom

        // Find min/max
        var minIC = Infinity, maxIC = -Infinity
        data.forEach(function(d) {
          if (d.ic < minIC) minIC = d.ic
          if (d.ic > maxIC) maxIC = d.ic
          if (d.ic_ma20 != null) {
            if (d.ic_ma20 < minIC) minIC = d.ic_ma20
            if (d.ic_ma20 > maxIC) maxIC = d.ic_ma20
          }
        })
        var range = maxIC - minIC || 1
        minIC -= range * 0.1
        maxIC += range * 0.1
        range = maxIC - minIC

        // Zero line
        var zeroY = padding.top + chartH * (1 - (0 - minIC) / range)
        ctx.beginPath()
        ctx.moveTo(padding.left, zeroY)
        ctx.lineTo(width - padding.right, zeroY)
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'
        ctx.lineWidth = 1
        ctx.stroke()

        // IC bars
        var barW = Math.max(1, chartW / data.length - 1)
        data.forEach(function(d, i) {
          var x = padding.left + (i / data.length) * chartW
          var y = padding.top + chartH * (1 - (d.ic - minIC) / range)
          ctx.fillStyle = d.ic >= 0 ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'
          ctx.fillRect(x, Math.min(y, zeroY), barW, Math.abs(y - zeroY))
        })

        // MA20 line
        ctx.beginPath()
        var started = false
        data.forEach(function(d, i) {
          if (d.ic_ma20 == null) return
          var x = padding.left + (i / data.length) * chartW + barW / 2
          var y = padding.top + chartH * (1 - (d.ic_ma20 - minIC) / range)
          if (!started) { ctx.moveTo(x, y); started = true }
          else ctx.lineTo(x, y)
        })
        ctx.strokeStyle = '#FBBF24'
        ctx.lineWidth = 2
        ctx.stroke()

        // Y-axis labels
        ctx.fillStyle = '#6B7280'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(maxIC.toFixed(2), padding.left - 4, padding.top + 10)
        ctx.fillText(minIC.toFixed(2), padding.left - 4, height - padding.bottom)
        ctx.fillText('0', padding.left - 4, zeroY + 4)
      })
  },

  drawNavChart(nav) {
    var query = wx.createSelectorQuery()
    query.select('#navCanvas')
      .fields({ node: true, size: true })
      .exec(function(res) {
        if (!res || !res[0]) return
        var canvas = res[0].node
        var ctx = canvas.getContext('2d')
        var dpr = wx.getWindowInfo().pixelRatio
        var width = res[0].width
        var height = res[0].height

        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, width, height)

        var data = nav.history
        if (!data || data.length === 0) return

        var padding = { top: 10, right: 10, bottom: 20, left: 40 }
        var chartW = width - padding.left - padding.right
        var chartH = height - padding.top - padding.bottom

        var minV = Infinity, maxV = -Infinity
        data.forEach(function(d) {
          if (d.nav < minV) minV = d.nav
          if (d.nav > maxV) maxV = d.nav
          if (d.dxy_norm != null) {
            if (d.dxy_norm < minV) minV = d.dxy_norm
            if (d.dxy_norm > maxV) maxV = d.dxy_norm
          }
        })
        var range = maxV - minV || 1
        minV -= range * 0.05
        maxV += range * 0.05
        range = maxV - minV

        // NAV line
        ctx.beginPath()
        data.forEach(function(d, i) {
          var x = padding.left + (i / (data.length - 1)) * chartW
          var y = padding.top + chartH * (1 - (d.nav - minV) / range)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.strokeStyle = '#22C55E'
        ctx.lineWidth = 2
        ctx.stroke()

        // DXY norm line
        ctx.beginPath()
        data.forEach(function(d, i) {
          if (d.dxy_norm == null) return
          var x = padding.left + (i / (data.length - 1)) * chartW
          var y = padding.top + chartH * (1 - (d.dxy_norm - minV) / range)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.strokeStyle = 'rgba(107,114,128,0.5)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.stroke()
        ctx.setLineDash([])

        // Y-axis labels
        ctx.fillStyle = '#6B7280'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(maxV.toFixed(2), padding.left - 4, padding.top + 10)
        ctx.fillText(minV.toFixed(2), padding.left - 4, height - padding.bottom)

        // Legend
        ctx.fillStyle = '#22C55E'
        ctx.fillRect(padding.left, height - 12, 16, 3)
        ctx.fillStyle = '#9CA3AF'
        ctx.font = '9px sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText('NAV', padding.left + 20, height - 8)

        ctx.fillStyle = 'rgba(107,114,128,0.5)'
        ctx.fillRect(padding.left + 60, height - 12, 16, 3)
        ctx.fillStyle = '#9CA3AF'
        ctx.fillText('DXY', padding.left + 80, height - 8)
      })
  }
})
