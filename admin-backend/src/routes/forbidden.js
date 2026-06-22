/**
 * 风控关键词管理路由
 */

const express = require('express');
const router = express.Router();
const database = require('../database/db');

/**
 * 获取所有违规关键词
 * GET /admin/forbidden
 */
router.get('/', (req, res) => {
  const keywords = database.queryAll('SELECT * FROM forbidden_keywords ORDER BY created_at DESC');
  
  res.json({ success: true, keywords });
});

/**
 * 添加违规关键词
 * POST /admin/forbidden
 */
router.post('/', (req, res) => {
  const { keyword, category, severity } = req.body;
  
  if (!keyword) {
    return res.status(400).json({ error: '请输入关键词' });
  }
  
  try {
    database.run(`
      INSERT INTO forbidden_keywords (keyword, category, severity)
      VALUES (?, ?, ?)
    `, [keyword, category || 'general', severity || 'medium']);
    
    res.json({ success: true, message: '关键词已添加' });
  } catch (err) {
    res.status(400).json({ error: '关键词已存在' });
  }
});

/**
 * 批量添加关键词
 * POST /admin/forbidden/batch
 */
router.post('/batch', (req, res) => {
  const { keywords, category, severity } = req.body;
  
  if (!keywords || !Array.isArray(keywords)) {
    return res.status(400).json({ error: '请提供关键词列表' });
  }
  
  let addedCount = 0;
  keywords.forEach(kw => {
    try {
      database.run(`
        INSERT INTO forbidden_keywords (keyword, category, severity)
        VALUES (?, ?, ?)
      `, [kw, category || 'general', severity || 'medium']);
      addedCount++;
    } catch (e) {}
  });
  
  res.json({
    success: true,
    message: `成功添加${addedCount}个关键词`
  });
});

/**
 * 删除关键词
 * DELETE /admin/forbidden/:id
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  const result = database.run('DELETE FROM forbidden_keywords WHERE id = ?', [id]);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: '关键词不存在' });
  }
  
  res.json({ success: true, message: '关键词已删除' });
});

/**
 * 测试关键词过滤
 * POST /admin/forbidden/test
 */
router.post('/test', (req, res) => {
  const { text } = req.body;
  
  const keywords = database.queryAll('SELECT keyword FROM forbidden_keywords');
  
  let filtered = text;
  const matched = [];
  
  keywords.forEach(k => {
    if (text.includes(k.keyword)) {
      matched.push(k.keyword);
      filtered = filtered.replace(new RegExp(k.keyword, 'gi'), '***');
    }
  });
  
  res.json({
    success: true,
    original: text,
    filtered,
    matchedKeywords: matched
  });
});

module.exports = router;