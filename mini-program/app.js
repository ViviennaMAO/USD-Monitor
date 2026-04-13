App({
  globalData: {
    // API base — local dev server (node server/app.js)
    baseUrl: 'http://localhost:3900',
    // Cached data
    inference: null,
    unified: null,
    shap: null,
    nav: null,
    // System
    systemInfo: null,
    statusBarHeight: 0,
    navBarHeight: 0
  },

  onLaunch() {
    this.initSystemInfo();
    this.preloadData();
  },

  initSystemInfo() {
    try {
      const sys = wx.getSystemInfoSync();
      const menu = wx.getMenuButtonBoundingClientRect();
      this.globalData.systemInfo = sys;
      this.globalData.statusBarHeight = sys.statusBarHeight;
      this.globalData.navBarHeight = (menu.top - sys.statusBarHeight) * 2 + menu.height;
    } catch (e) {
      console.error('[App] initSystemInfo failed', e);
    }
  },

  preloadData() {
    const endpoints = ['inference_summary', 'unified_signal', 'shap', 'nav_curve'];
    endpoints.forEach(name => {
      wx.request({
        url: `${this.globalData.baseUrl}/output/${name}.json`,
        success: res => {
          if (res.statusCode === 200) {
            const key = name.replace('_summary', '').replace('_curve', '').replace('_signal', '');
            this.globalData[key] = res.data;
          }
        }
      });
    });
  }
});
