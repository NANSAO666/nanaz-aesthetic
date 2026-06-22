/**
 * 用户管理路由
 */

const express = require('express');
const router = express.Router();
const database = require('../database/db');

/**
 * 获取用户列表
 * GET /admin/users
 */
router.get('/', (req, res) => {
  const { status, limit = 100, offset = 0 } = req.query;
  
  let sql = 'SELECT * FROM users WHERE 1=1';
  const params = [];
  
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  const users = database.queryAll(sql, params);
  const total = database.queryOne('SELECT COUNT(*) as count FROM users').count;
  
  res.json({ success: true, users, total });
});

/**
 * 获取用户详情
 * GET /admin/users/:id
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  const user = database.queryOne('SELECT * FROM users WHERE id = ?', [id]);
  
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  // 获取用户的API调用记录
  const apiLogs = database.queryAll(`
    SELECT * FROM api_logs 
    WHERE user_id = ? 
    ORDER BY created_at DESC LIMIT 20
  `, [id]);
  
  // 获取用户的人脸数据记录
  const faceData = database.queryAll(`
    SELECT id, face_hash, created_at, expire_at, report_generated 
    FROM face_data 
    WHERE user_id = ? 
    ORDER BY created_at DESC LIMIT 10
  `, [id]);
  
  res.json({
    success: true,
    user,
    apiLogs,
    faceData
  });
});

/**
 * 封禁用户
 * POST /admin/users/ban/:id
 */
router.post('/ban/:id', (req, res) => {
  const { id } = req.params;
  
  const result = database.run(`
    UPDATE users 
    SET status = 'banned', updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `, [id]);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  res.json({ success: true, message: '用户已封禁' });
});

/**
 * 延长用户卡密有效期
 * POST /admin/users/extend/:id
 */
router.post('/extend/:id', (req, res) => {
  const { id } = req.params;
  const { days } = req.body;
  
  if (!days || days < 1) {
    return res.status(400).json({ error: '请输入有效天数' });
  }
  
  const user = database.queryOne('SELECT card_expire_time FROM users WHERE id = ?', [id]);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  // 计算新的过期时间
  const currentExpire = user.card_expire_time ? new Date(user.card_expire_time) : new Date();
  const newExpire = new Date(currentExpire.getTime() + days * 24 * 60 * 60 * 1000);
  
  database.run(`
    UPDATE users 
    SET card_expire_time = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `, [newExpire.toISOString(), id]);
  
  res.json({
    success: true,
    message: `已延长${days}天`,
    newExpireTime: newExpire.toISOString()
  });
});

/**
 * 获取用户上传照片日志（脱敏）
 * GET /admin/users/:id/photos
 */
router.get('/:id/photos', (req, res) => {
  const { id } = req.params;
  
  const photos = database.queryAll(`
    SELECT 
      id, face_hash, created_at, expire_at, report_generated
    FROM face_data 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `, [id]);
  
  res.json({ success: true, photos });
});

module.exports = router;