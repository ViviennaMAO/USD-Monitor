App({
  onLaunch() {
    console.log('USD Monitor Mini Program launched')
  },
  globalData: {
    apiBase: 'https://usd-monitor.vercel.app/api',
    score: null,
    dxy: null
  }
})
