/**
 * 管理总后台系统
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

// 导入路由
const authRoutes = require('./routes/auth');
const apiConfigRoutes = require('./routes/apiConfig');
const cardKeyRoutes = require('./routes/cardKey');
const userRoutes = require('./routes/user');
const partnerRoutes = require('./routes/partner');
const statsRoutes = require('./routes/stats');
const forbiddenRoutes = require('./routes/forbidden');

// 导入数据库
const database = require('./database/db');

// 初始化Express
const app = express();

// 中间件
app.use(helmet());
app.use(cors());
app.use(express.json());

// 静态文件（管理后台前端）
app.use(express.static(path.join(__dirname, '../../admin-frontend')));

// 路由
app.use('/admin/auth', authRoutes);
app.use('/admin/api-config', authenticateAdmin, apiConfigRoutes);
app.use('/admin/card-keys', authenticateAdmin, cardKeyRoutes);
app.use('/admin/users', authenticateAdmin, userRoutes);
app.use('/admin/partners', authenticateAdmin, partnerRoutes);
app.use('/admin/stats', authenticateAdmin, statsRoutes);
app.use('/admin/forbidden', authenticateAdmin, forbiddenRoutes);

// 管理员认证中间件
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: '未登录' });
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期' });
  }
}

// ========== 启动服务（异步初始化数据库） ==========
async function startServer() {
  try {
    // 初始化数据库
    const dbPath = process.env.DATABASE_PATH || '../api-proxy-service/data/nanaz.db';
    const dbFullPath = path.resolve(dbPath);
    await database.init(dbFullPath);
    
    // 创建默认管理员账号
    database.createDefaultAdmin();
    
    // 启动服务
    const PORT = process.env.PORT || 3002;
    app.listen(PORT, () => {
      console.log(`管理后台已启动，端口: ${PORT}`);
      console.log(`访问地址: http://localhost:${PORT}`);
      console.log(`默认管理员账号: admin / admin123`);
    });
    
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;