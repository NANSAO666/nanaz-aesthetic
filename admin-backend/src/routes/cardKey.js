/**
 * 卡密管理路由
 */

const express = require('express');
const router = express.Router();
const database = require('../database/db');
const { v4: uuidv4 } = require('uuid');

/**
 * 批量生成卡密
 * POST /admin/card-keys/generate
 */
router.post('/generate', (req, res) => {
  const { count, duration_days, card_type, price } = req.body;
  
  if (!count || count > 1000) {
    return res.status(400).json({ error: '生成数量必须在1-1000之间' });
  }
  
  const cardKeys = [];
  
  for (let i = 0; i < count; i++) {
    const code = 'NANA-' + uuidv4().split('-').slice(0, 3).join('-').toUpperCase();
    
    database.run(`
      INSERT INTO card_keys (card_code, card_type, duration_days, price, status)
      VALUES (?, ?, ?, ?, 'unsold')
    `, [code, card_type || 'standard', duration_days || 30, price || 0]);
    
    cardKeys.push({
      code,
      card_type: card_type || 'standard',
      duration_days: duration_days || 30,
      price: price || 0
    });
  }
  
  res.json({
    success: true,
    message: `成功生成${count}张卡密`,
    cardKeys
  });
});

/**
 * 获取卡密列表
 * GET /admin/card-keys
 */
router.get('/', (req, res) => {
  const { status, limit = 100, offset = 0 } = req.query;
  
  let sql = 'SELECT * FROM card_keys WHERE 1=1';
  const params = [];
  
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  const cards = database.queryAll(sql, params);
  const total = database.queryOne('SELECT COUNT(*) as count FROM card_keys').count;
  
  res.json({ success: true, cards, total });
});

/**
 * 查询卡密详情
 * GET /admin/card-keys/:code
 */
router.get('/:code', (req, res) => {
  const { code } = req.params;
  
  const card = database.queryOne('SELECT * FROM card_keys WHERE card_code = ?', [code]);
  
  if (!card) {
    return res.status(404).json({ error: '卡密不存在' });
  }
  
  res.json({ success: true, card });
});

/**
 * 封禁卡密
 * POST /admin/card-keys/ban/:code
 */
router.post('/ban/:code', (req, res) => {
  const { code } = req.params;
  
  const result = database.run(`
    UPDATE card_keys 
    SET status = 'banned', updated_at = CURRENT_TIMESTAMP 
    WHERE card_code = ?
  `, [code]);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: '卡密不存在' });
  }
  
  res.json({ success: true, message: '卡密已封禁' });
});

/**
 * 批量封禁卡密
 * POST /admin/card-keys/ban-batch
 */
router.post('/ban-batch', (req, res) => {
  const { codes } = req.body;
  
  if (!codes || !Array.isArray(codes)) {
    return res.status(400).json({ error: '请提供卡密列表' });
  }
  
  codes.forEach(code => {
    database.run(`
      UPDATE card_keys 
      SET status = 'banned', updated_at = CURRENT_TIMESTAMP 
      WHERE card_code = ?
    `, [code]);
  });
  
  res.json({ success: true, message: `已封禁${codes.length}张卡密` });
});

/**
 * 分配卡密给合伙人
 * POST /admin/card-keys/assign
 */
router.post('/assign', (req, res) => {
  const { codes, partner_code } = req.body;
  
  if (!codes || !partner_code) {
    return res.status(400).json({ error: '请提供卡密和合伙人编号' });
  }
  
  // 检查合伙人是否存在
  const partner = database.queryOne('SELECT * FROM partners WHERE partner_code = ?', [partner_code]);
  if (!partner) {
    return res.status(404).json({ error: '合伙人不存在' });
  }
  
  // 分配卡密
  let assignedCount = 0;
  codes.forEach(code => {
    const result = database.run(`
      UPDATE card_keys 
      SET sold_by_partner = ?, status = 'assigned', updated_at = CURRENT_TIMESTAMP 
      WHERE card_code = ? AND status = 'unsold'
    `, [partner_code, code]);
    if (result.changes > 0) assignedCount++;
  });
  
  res.json({
    success: true,
    message: `已分配${assignedCount}张卡密给合伙人${partner_code}`
  });
});

/**
 * 导出卡密（CSV格式）
 * GET /admin/card-keys/export
 */
router.get('/export', (req, res) => {
  const { status } = req.query;
  
  let sql = 'SELECT card_code, card_type, duration_days, price, status, created_at FROM card_keys WHERE 1=1';
  const params = [];
  
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  const cards = database.queryAll(sql, params);
  
  // CSV格式导出
  const csv = '卡密编号,类型,天数,价格,状态,创建时间\n' +
    cards.map(c => `${c.card_code},${c.card_type},${c.duration_days},${c.price},${c.status},${c.created_at}`).join('\n');
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=card_keys.csv');
  res.send(csv);
});

module.exports = router;