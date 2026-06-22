/**
 * 健康检查路由
 */

const express = require('express');
const router = express.Router();

/**
 * 健康检查
 * GET /health
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'API中转调度服务',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * API状态检查
 * GET /health/apis
 */
router.get('/apis', (req, res) => {
  const apis = {
    facepp: {
      configured: !!process.env.FACEPP_API_KEY,
      region: process.env.FACEPP_REGION || 'api-cn.faceplusplus.com'
    },
    zhipu: {
      configured: !!process.env.ZHIPU_API_KEY,
      model: process.env.ZHIPU_MODEL || 'glm-4-flash'
    },
    doubao: {
      configured: !!process.env.DOUBAO_API_KEY,
      model: process.env.DOUBAO_MODEL || 'doubao-lite-4k'
    }
  };
  
  res.json({
    status: 'ok',
    apis: apis
  });
});

module.exports = router;