/**
 * USD Monitor 网络请求封装
 * 从 pipeline/output/*.json 获取数据
 */
const app = getApp();

const request = (options) => {
  const { url, method = 'GET', data = {}, showLoading = false } = options;
  const fullUrl = url.startsWith('http') ? url : app.globalData.baseUrl + url;

  return new Promise((resolve, reject) => {
    if (showLoading) {
      wx.showLoading({ title: '加载中...', mask: true });
    }
    wx.request({
      url: fullUrl,
      method,
      data,
      header: { 'Content-Type': 'application/json' },
      timeout: 30000,
      success(res) {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          wx.showToast({ title: '请求失败', icon: 'none' });
          reject({ code: res.statusCode, message: '请求失败' });
        }
      },
      fail(err) {
        wx.showToast({ title: '网络异常', icon: 'none' });
        reject({ code: -1, message: err.errMsg || '网络异常' });
      },
      complete() {
        if (showLoading) wx.hideLoading();
      }
    });
  });
};

/**
 * 加载 pipeline JSON 输出文件
 * @param {string} name - 文件名 (不含 .json)
 */
const loadOutput = (name) => {
  return request({ url: `/output/${name}.json` });
};

module.exports = { request, loadOutput };
