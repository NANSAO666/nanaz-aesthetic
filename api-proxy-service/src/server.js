/**
 * API中转调度服务系统
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const NodeCache = require('node-cache');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

// 导入路由模块
const faceppRoutes = require('./routes/facepp');
const zhipuRoutes = require('./routes/zhipu');
const doubaoRoutes = require('./routes/doubao');
const healthRoutes = require('./routes/health');
const statsRoutes = require('./routes/stats');

// 导入中间件
const authMiddleware = require('./middleware/auth');
const rateLimitMiddleware = require('./middleware/rateLimit');
const loggerMiddleware = require('./middleware/logger');

// 导入数据库模块
const database = require('./database/db');

// 初始化Express应用
const app = express();

// ========== 日志配置 ==========
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: process.env.LOG_FILE || './logs/api-proxy.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// ========== 缓存配置 ==========
const reportCache = new NodeCache({
  stdTTL: parseInt(process.env.CACHE_DURATION_SECONDS) || 3600,
  checkperiod: 600,
  useClones: false
});

// ========== 中间件配置 ==========
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 全局限流
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_GLOBAL_PER_MINUTE) || 100,
  message: { error: '请求过于频繁，请稍后再试', code: 'RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(globalLimiter);

// 自定义中间件
app.use(loggerMiddleware(logger));
app.use(rateLimitMiddleware);

// ========== 路由配置 ==========
app.use('/health', healthRoutes);
app.use('/api/facepp', authMiddleware, faceppRoutes);
app.use('/api/zhipu', authMiddleware, zhipuRoutes);
app.use('/api/doubao', authMiddleware, doubaoRoutes);
app.use('/api/stats', authMiddleware, statsRoutes);

// ========== 错误处理 ==========
app.use((err, req, res, next) => {
  logger.error('服务器错误:', err);
  res.status(err.status || 500).json({
    error: err.message || '服务器内部错误',
    code: err.code || 'INTERNAL_ERROR'
  });
});

// ========== 启动服务（异步初始化数据库） ==========
async function startServer() {
  try {
    // 初始化数据库
    const dbPath = process.env.DATABASE_PATH || './data/nanaz.db';
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    await database.init(dbPath);
    
    // 启动服务
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      logger.info(`API中转调度服务已启动，端口: ${PORT}`);
      logger.info(`环境: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`缓存时长: ${process.env.CACHE_DURATION_SECONDS || 3600}秒`);
    });
    
    // 定时清理过期人脸数据
    setInterval(() => {
      const expireDays = parseInt(process.env.FACE_DATA_EXPIRE_DAYS) || 7;
      database.cleanupExpiredFaceData(expireDays);
      logger.info(`已清理${expireDays}天前的人脸数据`);
    }, 24 * 60 * 60 * 1000);
    
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;