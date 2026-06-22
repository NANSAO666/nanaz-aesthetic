/**
 * 数据库模块 - sql.js实现（纯JS SQLite）
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

let db = null;
let SQL = null;

/**
 * 初始化数据库
 */
async function init(dbPath) {
  // 初始化sql.js
  SQL = await initSqlJs();
  
  // 确保数据库目录存在
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // 加载或创建数据库
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  // 创建所有表
  createTables();
  
  // 保存数据库
  saveDatabase(dbPath);
  
  console.log('数据库初始化完成');
  return db;
}

/**
 * 创建所有表
 */
function createTables() {
  // 用户表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      nickname TEXT,
      card_key TEXT,
      card_expire_time TEXT,
      total_reports INTEGER DEFAULT 0,
      today_reports INTEGER DEFAULT 0,
      last_report_date TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 卡密表
  db.run(`
    CREATE TABLE IF NOT EXISTS card_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_code TEXT UNIQUE NOT NULL,
      card_type TEXT NOT NULL,
      duration_days INTEGER NOT NULL,
      price REAL,
      status TEXT DEFAULT 'unsold',
      sold_to_user TEXT,
      sold_by_partner TEXT,
      sold_time TEXT,
      activate_time TEXT,
      expire_time TEXT,
      commission REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // API调用日志表
  db.run(`
    CREATE TABLE IF NOT EXISTS api_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      request_type TEXT NOT NULL,
      api_provider TEXT NOT NULL,
      api_endpoint TEXT,
      request_data TEXT,
      response_data TEXT,
      tokens_used INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      status TEXT DEFAULT 'success',
      error_message TEXT,
      ip_address TEXT,
      user_agent TEXT,
      response_time_ms INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 人脸数据表
  db.run(`
    CREATE TABLE IF NOT EXISTS face_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      face_hash TEXT NOT NULL,
      original_image TEXT,
      blurred_image TEXT,
      facepp_data TEXT,
      report_generated INTEGER DEFAULT 0,
      report_content TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expire_at TEXT
    )
  `);

  // 分销合伙人表
  db.run(`
    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_code TEXT UNIQUE NOT NULL,
      partner_name TEXT,
      partner_level TEXT DEFAULT 'silver',
      commission_rate REAL DEFAULT 10,
      total_sales INTEGER DEFAULT 0,
      total_commission REAL DEFAULT 0,
      parent_partner_id INTEGER,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 分销订单表
  db.run(`
    CREATE TABLE IF NOT EXISTS partner_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER,
      user_id INTEGER,
      card_key_id INTEGER,
      order_amount REAL,
      commission REAL,
      status TEXT DEFAULT 'completed',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // API配置表
  db.run(`
    CREATE TABLE IF NOT EXISTS api_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_provider TEXT UNIQUE NOT NULL,
      api_key TEXT,
      api_secret TEXT,
      model_name TEXT,
      endpoint TEXT,
      is_enabled INTEGER DEFAULT 1,
      daily_limit INTEGER DEFAULT 1000,
      used_today INTEGER DEFAULT 0,
      last_reset_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 风控关键词表
  db.run(`
    CREATE TABLE IF NOT EXISTS forbidden_keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT UNIQUE NOT NULL,
      category TEXT,
      severity TEXT DEFAULT 'medium',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * 保存数据库到文件
 */
function saveDatabase(dbPath) {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

/**
 * 获取数据库实例
 */
function getDb() {
  if (!db) {
    throw new Error('数据库未初始化');
  }
  return db;
}

/**
 * 执行查询并返回所有结果
 */
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();
  return results;
}

/**
 * 执行查询并返回单个结果
 */
function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * 执行SQL语句
 */
function run(sql, params = []) {
  db.run(sql, params);
  return { changes: db.getRowsModified() };
}

/**
 * 记录API调用日志
 */
function logApiCall(logData) {
  const sql = `
    INSERT INTO api_logs (
      user_id, request_type, api_provider, api_endpoint,
      request_data, response_data, tokens_used, cost,
      status, error_message, ip_address, user_agent, response_time_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  run(sql, [
    logData.userId,
    logData.requestType,
    logData.apiProvider,
    logData.apiEndpoint,
    logData.requestData,
    logData.responseData,
    logData.tokensUsed || 0,
    logData.cost || 0,
    logData.status || 'success',
    logData.errorMessage,
    logData.ipAddress,
    logData.userAgent,
    logData.responseTimeMs
  ]);
}

/**
 * 检查用户今日报告次数
 */
function checkUserDailyLimit(userId, maxPerDay) {
  const user = queryOne('SELECT today_reports, last_report_date FROM users WHERE id = ?', [userId]);
  
  if (!user) return { allowed: false, reason: '用户不存在' };
  
  const today = new Date().toISOString().split('T')[0];
  if (user.last_report_date !== today) {
    run('UPDATE users SET today_reports = 0, last_report_date = ? WHERE id = ?', [today, userId]);
    return { allowed: true, count: 0 };
  }
  
  if (user.today_reports >= maxPerDay) {
    return { allowed: false, reason: '今日报告次数已达上限', count: user.today_reports };
  }
  
  return { allowed: true, count: user.today_reports };
}

/**
 * 增加用户今日报告次数
 */
function incrementUserReportCount(userId) {
  const today = new Date().toISOString().split('T')[0];
  run(`
    UPDATE users 
    SET today_reports = today_reports + 1,
        total_reports = total_reports + 1,
        last_report_date = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [today, userId]);
}

/**
 * 清理过期人脸数据
 */
function cleanupExpiredFaceData(days) {
  const expireDate = new Date();
  expireDate.setDate(expireDate.getDate() - days);
  const expireStr = expireDate.toISOString();
  
  run('DELETE FROM face_data WHERE expire_at < ?', [expireStr]);
}

module.exports = {
  init,
  getDb,
  saveDatabase,
  queryAll,
  queryOne,
  run,
  logApiCall,
  checkUserDailyLimit,
  incrementUserReportCount,
  cleanupExpiredFaceData
};