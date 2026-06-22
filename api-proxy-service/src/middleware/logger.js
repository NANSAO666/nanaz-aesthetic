/**
 * 日志中间件 - 记录所有API请求
 */

/**
 * 请求日志中间件
 */
function loggerMiddleware(logger) {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // 记录请求信息
    const requestLog = {
      method: req.method,
      path: req.path,
      ip: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    };
    
    logger.info('API请求', requestLog);
    
    // 监听响应完成事件
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      
      const responseLog = {
        ...requestLog,
        statusCode: res.statusCode,
        responseTime: responseTime + 'ms'
      };
      
      if (res.statusCode >= 400) {
        logger.warn('API响应(错误)', responseLog);
      } else {
        logger.info('API响应', responseLog);
      }
    });
    
    next();
  };
}

module.exports = loggerMiddleware;