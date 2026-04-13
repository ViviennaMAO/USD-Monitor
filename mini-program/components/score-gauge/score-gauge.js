const { drawGauge } = require('../../utils/chart');

Component({
  properties: {
    score: { type: Number, value: 50 },
    label: { type: String, value: 'γ Score' }
  },

  observers: {
    'score': function () {
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
      const query = this.createSelectorQuery();
      query.select('#gaugeCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0]) return;
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getSystemInfoSync().pixelRatio;
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, res[0].width, res[0].height);
          drawGauge(ctx, res[0].width, res[0].height, this.properties.score, this.properties.label);
        });
    }
  }
});
