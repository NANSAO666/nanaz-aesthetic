/**
 * API配置路由 - 管理三大API接口
 */

const express = require('express');
const router = express.Router();
const database = require('../database/db');

/**
 * 获取所有API配置
 * GET /admin/api-config
 */
router.get('/', (req, res) => {
  const configs = database.queryAll('SELECT * FROM api_config');
  
  // 如果没有配置，初始化默认配置
  if (configs.length === 0) {
    const defaultConfigs = [
      { provider: 'facepp', endpoint: 'api-cn.faceplusplus.com' },
      { provider: 'zhipu', endpoint: 'https://open.bigmodel.cn/api/paas/v4' },
      { provider: 'doubao', endpoint: 'https://ark.cn-beijing.volces.com/api/v3' }
    ];
    
    defaultConfigs.forEach(cfg => {
      database.run(`
        INSERT INTO api_config (api_provider, endpoint, daily_limit)
        VALUES (?, ?, 1000)
      `, [cfg.provider, cfg.endpoint]);
    });
    
    configs = database.queryAll('SELECT * FROM api_config');
  }
  
  res.json({ success: true, configs });
});

/**
 * 更新API配置
 * PUT /admin/api-config/:provider
 */
router.put('/:provider', (req, res) => {
  const { provider } = req.params;
  const { api_key, api_secret, model_name, endpoint, is_enabled, daily_limit } = req.body;
  
  const result = database.run(`
    UPDATE api_config 
    SET api_key = ?, api_secret = ?, model_name = ?, endpoint = ?, 
        is_enabled = ?, daily_limit = ?, updated_at = CURRENT_TIMESTAMP
    WHERE api_provider = ?
  `, [api_key, api_secret, model_name, endpoint, is_enabled ? 1 : 0, daily_limit, provider]);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: '配置不存在' });
  }
  
  res.json({ success: true, message: '配置已更新' });
});

/**
 * 重置今日使用量
 * POST /admin/api-config/reset/:provider
 */
router.post('/reset/:provider', (req, res) => {
  const { provider } = req.params;
  const today = new Date().toISOString().split('T')[0];
  
  database.run(`
    UPDATE api_config 
    SET used_today = 0, last_reset_date = ? 
    WHERE api_provider = ?
  `, [today, provider]);
  
  res.json({ success: true, message: '使用量已重置' });
});

/**
 * 获取API调用日志
 * GET /admin/api-config/logs
 */
router.get('/logs', (req, res) => {
  const { provider, startDate, endDate, limit = 100 } = req.query;
  
  let sql = 'SELECT * FROM api_logs WHERE 1=1';
  const params = [];
  
  if (provider) {
    sql += ' AND api_provider = ?';
    params.push(provider);
  }
  
  if (startDate) {
    sql += ' AND created_at >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    sql += ' AND created_at <= ?';
    params.push(endDate);
  }
  
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  const logs = database.queryAll(sql, params);
  
  res.json({ success: true, logs });
});

module.exports = router;