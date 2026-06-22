/**
 * 认证中间件 - JWT验证
 * 验证前端请求的合法性，防止未授权访问
 */

const jwt = require('jsonwebtoken');

/**
 * JWT认证中间件
 */
function authMiddleware(req, res, next) {
  // 从请求头获取token
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      error: '缺少认证信息',
      code: 'MISSING_AUTH'
    });
  }
  
  // 验证Bearer token格式
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      error: '认证格式错误',
      code: 'INVALID_AUTH_FORMAT'
    });
  }
  
  const token = parts[1];
  
  try {
    // 验证JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 将用户信息附加到请求对象
    req.user = {
      id: decoded.userId,
      phone: decoded.phone,
      cardKey: decoded.cardKey,
      cardExpireTime: decoded.cardExpireTime,
      partnerCode: decoded.partnerCode
    };
    
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: '认证已过期，请重新登录',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: '认证无效',
        code: 'INVALID_TOKEN'
      });
    }
    
    return res.status(500).json({
      error: '认证验证失败',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * 生成JWT token
 */
function generateToken(user) {
  const payload = {
    userId: user.id,
    phone: user.phone,
    cardKey: user.card_key,
    cardExpireTime: user.card_expire_time,
    partnerCode: user.partner_code,
    createdAt: Date.now()
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '24h' // 24小时有效期
  });
}

/**
 * 验证卡密是否有效
 */
function verifyCardKey(cardKey) {
  const database = require('../database/db');
  const db = database.getDb();
  
  const sql = `
    SELECT * FROM card_keys 
    WHERE card_code = ? AND status = 'active'
  `;
  const card = db.prepare(sql).get(cardKey);
  
  if (!card) {
    return { valid: false, reason: '卡密不存在或已失效' };
  }
  
  // 检查是否过期
  if (card.expire_time && new Date(card.expire_time) < new Date()) {
    return { valid: false, reason: '卡密已过期' };
  }
  
  return { valid: true, card };
}

/**
 * 检查用户是否有有效卡密
 */
function checkUserCard(user) {
  if (!user.cardKey) {
    return { valid: false, reason: '未激活卡密' };
  }
  
  if (!user.cardExpireTime || new Date(user.cardExpireTime) < new Date()) {
    return { valid: false, reason: '卡密已过期' };
  }
  
  return { valid: true };
}

module.exports = authMiddleware;
module.exports.generateToken = generateToken;
module.exports.verifyCardKey = verifyCardKey;
module.exports.checkUserCard = checkUserCard;