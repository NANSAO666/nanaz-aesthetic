/**
 * 统计数据路由
 */

const express = require('express');
const router = express.Router();
const database = require('../database/db');

/**
 * 获取API调用统计
 * GET /api/stats/api-usage
 */
router.get('/api-usage', (req, res) => {
  try {
    const todayStats = database.queryAll(`
      SELECT 
        api_provider,
        COUNT(*) as total_calls,
        SUM(tokens_used) as total_tokens,
        SUM(cost) as total_cost,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
      FROM api_logs
      WHERE created_at >= date('now')
      GROUP BY api_provider
    `);
    
    const weeklyStats = database.queryAll(`
      SELECT 
        date(created_at) as date,
        api_provider,
        COUNT(*) as total_calls
      FROM api_logs
      WHERE created_at >= date('now', '-7 days')
      GROUP BY date(created_at), api_provider
      ORDER BY date DESC
    `);
    
    res.json({
      ok: true,
      today: todayStats,
      weekly: weeklyStats
    });
    
  } catch (error) {
    res.status(500).json({
      error: '获取统计数据失败',
      code: 'STATS_ERROR'
    });
  }
});

/**
 * 获取用户统计
 * GET /api/stats/users
 */
router.get('/users', (req, res) => {
  try {
    const totalUsers = database.queryOne('SELECT COUNT(*) as count FROM users');
    const activeUsers = database.queryOne(`
      SELECT COUNT(DISTINCT user_id) as count 
      FROM api_logs 
      WHERE created_at >= date('now')
    `);
    const newUsers = database.queryOne(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE created_at >= date('now')
    `);
    
    res.json({
      ok: true,
      totalUsers: totalUsers.count,
      activeUsers: activeUsers.count,
      newUsers: newUsers.count
    });
    
  } catch (error) {
    res.status(500).json({
      error: '获取用户统计失败',
      code: 'STATS_ERROR'
    });
  }
});

module.exports = router;