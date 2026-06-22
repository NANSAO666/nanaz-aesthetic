/**
 * 管理后台数据库模块 - sql.js实现
 */

const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

let db = null;
let dbPath = null;

/**
 * 初始化数据库
 */
async function init(dbPathParam) {
  const SQL = await initSqlJs();
  dbPath = dbPathParam;
  
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
  
  // 创建管理员表
  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login TEXT
    )
  `);
  
  saveDatabase();
  console.log('管理后台数据库初始化完成');
  return db;
}

/**
 * 保存数据库
 */
function saveDatabase() {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
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
 * 执行查询返回所有结果
 */
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/**
 * 执行查询返回单个结果
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
  saveDatabase();
  return { changes: db.getRowsModified() };
}

/**
 * 创建默认管理员账号
 */
function createDefaultAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  
  const existing = queryOne('SELECT id FROM admins WHERE username = ?', [username]);
  
  if (!existing) {
    const passwordHash = bcrypt.hashSync(password, 10);
    run(`
      INSERT INTO admins (username, password_hash, role)
      VALUES (?, ?, 'super_admin')
    `, [username, passwordHash]);
    
    console.log(`默认管理员账号已创建: ${username}`);
  }
}

/**
 * 验证管理员登录
 */
function verifyAdminLogin(username, password) {
  const admin = queryOne('SELECT * FROM admins WHERE username = ?', [username]);
  
  if (!admin) {
    return { success: false, error: '账号不存在' };
  }
  
  const valid = bcrypt.compareSync(password, admin.password_hash);
  
  if (!valid) {
    return { success: false, error: '密码错误' };
  }
  
  // 更新最后登录时间
  run('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);
  
  return { success: true, admin };
}

module.exports = {
  init,
  getDb,
  saveDatabase,
  queryAll,
  queryOne,
  run,
  createDefaultAdmin,
  verifyAdminLogin
};