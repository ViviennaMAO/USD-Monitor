const chart = require('../../utils/chart');

Component({
  properties: {
    /** line | bar | heatmap */
    type: { type: String, value: 'line' },
    /** JSON-serialized opts (data, color, fill, refLines, matrix, etc.) */
    opts: { type: String, value: '{}' },
    /** canvas height in rpx */
    height: { type: Number, value: 400 }
  },

  observers: {
    'opts, type': function () {
      this.draw();
    }
  },

  lifetimes: {
    ready() {
      this.draw();
    }
  },

  methods: {
    draw() {
      let parsedOpts;
      try {
        parsedOpts = JSON.parse(this.properties.opts);
      } catch (e) {
        return;
      }

      const query = this.createSelectorQuery();
      query.select('#chartCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0]) return;
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getSystemInfoSync().pixelRatio;
          const w = res[0].width;
          const h = res[0].height;
          canvas.width = w * dpr;
          canvas.height = h * dpr;
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, w, h);

          const t = this.properties.type;
          if (t === 'line') chart.drawLineChart(ctx, w, h, parsedOpts);
          else if (t === 'bar') chart.drawBarChart(ctx, w, h, parsedOpts);
          else if (t === 'heatmap') chart.drawHeatmap(ctx, w, h, parsedOpts);
        });
    }
  }
});
