/**
 * 限流中间件 - 用户级别限流
 * 防止单个用户恶意刷接口消耗费用
 */

const database = require('../database/db');

/**
 * 用户每日报告次数限流
 */
function rateLimitMiddleware(req, res, next) {
  // 只对生成报告的接口进行限流
  const reportEndpoints = [
    '/api/facepp/detect',
    '/api/zhipu/report',
    '/api/doubao/chat'
  ];
  
  if (!reportEndpoints.some(ep => req.path.startsWith(ep))) {
    return next();
  }
  
  // 如果没有用户信息，跳过限流（健康检查等接口）
  if (!req.user) {
    return next();
  }
  
  const userId = req.user.id;
  const maxPerDay = parseInt(process.env.RATE_LIMIT_PER_USER_PER_DAY) || 10;
  
  // 检查用户今日报告次数
  const result = database.checkUserDailyLimit(userId, maxPerDay);
  
  if (!result.allowed) {
    return res.status(429).json({
      error: result.reason || '今日报告次数已达上限',
      code: 'DAILY_LIMIT_EXCEEDED',
      currentCount: result.count,
      maxPerDay: maxPerDay,
      resetTime: new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
    });
  }
  
  // 附加限流信息到请求对象
  req.rateLimit = {
    currentCount: result.count,
    maxPerDay: maxPerDay,
    remaining: maxPerDay - result.count
  };
  
  next();
}

/**
 * API接口级别限流（管理后台控制）
 */
function apiLimitMiddleware(req, res, next) {
  const database = require('../database/db');
  const db = database.getDb();
  
  // 获取API提供商名称
  const apiProvider = req.path.split('/')[2]; // /api/facepp/... -> facepp
  
  // 查询API配置
  const sql = `SELECT * FROM api_config WHERE api_provider = ?`;
  const config = db.prepare(sql).get(apiProvider);
  
  if (!config) {
    // 如果没有配置，使用默认值
    return next();
  }
  
  // 检查是否启用
  if (!config.is_enabled) {
    return res.status(503).json({
      error: '该API接口已关闭',
      code: 'API_DISABLED',
      provider: apiProvider
    });
  }
  
  // 检查每日限额
  const today = new Date().toISOString().split('T')[0];
  if (config.last_reset_date !== today) {
    // 重置今日计数
    db.prepare(`
      UPDATE api_config 
      SET used_today = 0, last_reset_date = ? 
      WHERE api_provider = ?
    `).run(today, apiProvider);
  } else if (config.used_today >= config.daily_limit) {
    return res.status(429).json({
      error: 'API接口今日调用次数已达上限',
      code: 'API_LIMIT_EXCEEDED',
      provider: apiProvider,
      usedToday: config.used_today,
      dailyLimit: config.daily_limit
    });
  }
  
  // 增加调用计数
  db.prepare(`
    UPDATE api_config 
    SET used_today = used_today + 1, updated_at = CURRENT_TIMESTAMP 
    WHERE api_provider = ?
  `).run(apiProvider);
  
  next();
}

module.exports = rateLimitMiddleware;
module.exports.apiLimitMiddleware = apiLimitMiddleware;