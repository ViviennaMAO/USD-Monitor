/**
 * API utility for USD Monitor miniprogram.
 * All data fetched from Vercel-deployed Next.js backend.
 */
const app = getApp()

function request(path) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: app.globalData.apiBase + path,
      method: 'GET',
      dataType: 'json',
      timeout: 15000,
      success(res) {
        if (res.statusCode === 200) {
          resolve(res.data)
        } else {
          reject(new Error('HTTP ' + res.statusCode))
        }
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

function fetchScore() {
  return request('/score')
}

function fetchDxy() {
  return request('/dxy')
}

function fetchComponents() {
  return request('/components')
}

function fetchVolAlert() {
  return request('/vol-alert')
}

function fetchYield() {
  return request('/yield')
}

function fetchHedge() {
  return request('/hedge')
}

function fetchFxPairs() {
  return request('/fx-pairs')
}

function fetchHistory() {
  return request('/history')
}

function fetchIcTracking(factor) {
  return request('/ic-tracking?factor=' + (factor || 'F5'))
}

function fetchShap() {
  return request('/shap')
}

function fetchRegimeIc() {
  return request('/regime-ic')
}

function fetchCorrelation() {
  return request('/correlation')
}

function fetchNav() {
  return request('/nav')
}

module.exports = {
  request,
  fetchScore,
  fetchDxy,
  fetchComponents,
  fetchVolAlert,
  fetchYield,
  fetchHedge,
  fetchFxPairs,
  fetchHistory,
  fetchIcTracking,
  fetchShap,
  fetchRegimeIc,
  fetchCorrelation,
  fetchNav
}
