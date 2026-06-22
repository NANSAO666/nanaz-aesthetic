/**
 * 数据统计路由
 */

const express = require('express');
const router = express.Router();
const database = require('../database/db');

/**
 * 获取概览统计
 * GET /admin/stats/overview
 */
router.get('/overview', (req, res) => {
  // 今日数据
  const todayStats = {
    newUsers: database.queryOne(`SELECT COUNT(*) as count FROM users WHERE created_at >= date('now')`).count,
    activeUsers: database.queryOne(`SELECT COUNT(DISTINCT user_id) as count FROM api_logs WHERE created_at >= date('now')`).count,
    newReports: database.queryOne(`SELECT COUNT(*) as count FROM api_logs WHERE request_type = 'face_detect' AND created_at >= date('now')`).count,
    soldCards: database.queryOne(`SELECT COUNT(*) as count FROM card_keys WHERE sold_time >= date('now')`).count
  };
  
  // 总数据
  const totalStats = {
    users: database.queryOne('SELECT COUNT(*) as count FROM users').count,
    cards: database.queryOne('SELECT COUNT(*) as count FROM card_keys').count,
    activeCards: database.queryOne(`SELECT COUNT(*) as count FROM card_keys WHERE status = 'active'`).count,
    partners: database.queryOne('SELECT COUNT(*) as count FROM partners').count
  };
  
  // API调用统计
  const apiStats = database.queryAll(`
    SELECT 
      api_provider,
      COUNT(*) as total_calls,
      SUM(tokens_used) as total_tokens,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
    FROM api_logs
    WHERE created_at >= date('now')
    GROUP BY api_provider
  `);
  
  res.json({
    success: true,
    today: todayStats,
    total: totalStats,
    apiStats
  });
});

/**
 * 获取趋势数据（最近7天）
 * GET /admin/stats/trend
 */
router.get('/trend', (req, res) => {
  // 用户增长趋势
  const userTrend = database.queryAll(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM users
    WHERE created_at >= date('now', '-7 days')
    GROUP BY date(created_at)
    ORDER BY date
  `);
  
  // API调用趋势
  const apiTrend = database.queryAll(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM api_logs
    WHERE created_at >= date('now', '-7 days')
    GROUP BY date(created_at)
    ORDER BY date
  `);
  
  // 卡密销售趋势
  const cardTrend = database.queryAll(`
    SELECT date(sold_time) as date, COUNT(*) as count
    FROM card_keys
    WHERE sold_time >= date('now', '-7 days')
    GROUP BY date(sold_time)
    ORDER BY date
  `);
  
  res.json({
    success: true,
    userTrend,
    apiTrend,
    cardTrend
  });
});

/**
 * 获取收入统计
 * GET /admin/stats/revenue
 */
router.get('/revenue', (req, res) => {
  // 卡密销售金额
  const cardRevenue = database.queryOne(`
    SELECT SUM(price) as total
    FROM card_keys
    WHERE status IN ('active', 'expired')
  `);
  
  // 合伙人佣金
  const partnerCommission = database.queryOne(`
    SELECT SUM(commission) as total
    FROM partner_orders
  `);
  
  res.json({
    success: true,
    cardRevenue: cardRevenue.total || 0,
    partnerCommission: partnerCommission.total || 0
  });
});

/**
 * 获取API消耗详情
 * GET /admin/stats/api-cost
 */
router.get('/api-cost', (req, res) => {
  const costDetails = database.queryAll(`
    SELECT 
      api_provider,
      COUNT(*) as calls,
      SUM(tokens_used) as tokens,
      SUM(cost) as estimated_cost
    FROM api_logs
    WHERE created_at >= date('now', '-30 days')
    GROUP BY api_provider
  `);
  
  res.json({ success: true, costDetails });
});

module.exports = router;