/**
 * 认证路由 - 管理员登录
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const database = require('../database/db');

/**
 * 管理员登录
 * POST /admin/auth/login
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '请输入账号和密码' });
  }
  
  const result = database.verifyAdminLogin(username, password);
  
  if (!result.success) {
    return res.status(401).json({ error: result.error });
  }
  
  // 生成JWT token
  const token = jwt.sign(
    {
      id: result.admin.id,
      username: result.admin.username,
      role: result.admin.role
    },
    process.env.ADMIN_JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  res.json({
    success: true,
    token,
    admin: {
      id: result.admin.id,
      username: result.admin.username,
      role: result.admin.role
    }
  });
});

/**
 * 修改密码
 * POST /admin/auth/change-password
 */
router.post('/change-password', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: '未登录' });
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    const { oldPassword, newPassword } = req.body;
    
    // 验证旧密码
    const result = database.verifyAdminLogin(decoded.username, oldPassword);
    if (!result.success) {
      return res.status(400).json({ error: '旧密码错误' });
    }
    
    // 更新密码
    const bcrypt = require('bcryptjs');
    const passwordHash = bcrypt.hashSync(newPassword, 10);
    const db = database.getDb();
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(passwordHash, decoded.id);
    
    res.json({ success: true, message: '密码已更新' });
  } catch (err) {
    res.status(401).json({ error: '登录已过期' });
  }
});

module.exports = router;