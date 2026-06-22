/**
 * 分销合伙人管理路由
 */

const express = require('express');
const router = express.Router();
const database = require('../database/db');
const { v4: uuidv4 } = require('uuid');

/**
 * 获取合伙人列表
 * GET /admin/partners
 */
router.get('/', (req, res) => {
  const { status, level, limit = 100 } = req.query;
  
  let sql = 'SELECT * FROM partners WHERE 1=1';
  const params = [];
  
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  
  if (level) {
    sql += ' AND partner_level = ?';
    params.push(level);
  }
  
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  const partners = database.queryAll(sql, params);
  
  res.json({ success: true, partners });
});

/**
 * 创建合伙人
 * POST /admin/partners
 */
router.post('/', (req, res) => {
  const { name, level, commission_rate, parent_partner_code } = req.body;
  
  const partnerCode = 'P-' + uuidv4().split('-')[0].toUpperCase();
  
  // 查找上级合伙人
  let parentId = null;
  if (parent_partner_code) {
    const parent = database.queryOne('SELECT id FROM partners WHERE partner_code = ?', [parent_partner_code]);
    if (parent) parentId = parent.id;
  }
  
  database.run(`
    INSERT INTO partners (
      partner_code, partner_name, partner_level, commission_rate, parent_partner_id
    ) VALUES (?, ?, ?, ?, ?)
  `, [partnerCode, name, level || 'silver', commission_rate || 10, parentId]);
  
  res.json({
    success: true,
    message: '合伙人已创建',
    partnerCode
  });
});

/**
 * 更新合伙人信息
 * PUT /admin/partners/:code
 */
router.put('/:code', (req, res) => {
  const { code } = req.params;
  const { name, level, commission_rate, status } = req.body;
  
  const result = database.run(`
    UPDATE partners 
    SET partner_name = ?, partner_level = ?, commission_rate = ?, 
        status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE partner_code = ?
  `, [name, level, commission_rate, status, code]);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: '合伙人不存在' });
  }
  
  res.json({ success: true, message: '合伙人信息已更新' });
});

/**
 * 获取合伙人分销订单
 * GET /admin/partners/:code/orders
 */
router.get('/:code/orders', (req, res) => {
  const { code } = req.params;
  
  const partner = database.queryOne('SELECT id FROM partners WHERE partner_code = ?', [code]);
  if (!partner) {
    return res.status(404).json({ error: '合伙人不存在' });
  }
  
  const orders = database.queryAll(`
    SELECT * FROM partner_orders 
    WHERE partner_id = ? 
    ORDER BY created_at DESC
  `, [partner.id]);
  
  res.json({ success: true, orders });
});

/**
 * 获取合伙人佣金统计
 * GET /admin/partners/:code/commission
 */
router.get('/:code/commission', (req, res) => {
  const { code } = req.params;
  
  const partner = database.queryOne('SELECT * FROM partners WHERE partner_code = ?', [code]);
  if (!partner) {
    return res.status(404).json({ error: '合伙人不存在' });
  }
  
  // 本月佣金
  const monthCommission = database.queryOne(`
    SELECT SUM(commission) as total 
    FROM partner_orders 
    WHERE partner_id = ? AND created_at >= date('now', 'start of month')
  `, [partner.id]);
  
  // 总佣金
  const totalCommission = database.queryOne(`
    SELECT SUM(commission) as total 
    FROM partner_orders 
    WHERE partner_id = ?
  `, [partner.id]);
  
  // 本月订单数
  const monthOrders = database.queryOne(`
    SELECT COUNT(*) as count 
    FROM partner_orders 
    WHERE partner_id = ? AND created_at >= date('now', 'start of month')
  `, [partner.id]);
  
  res.json({
    success: true,
    partner,
    stats: {
      monthCommission: monthCommission.total || 0,
      totalCommission: totalCommission.total || 0,
      monthOrders: monthOrders.count || 0,
      totalOrders: partner.total_sales || 0
    }
  });
});

module.exports = router;