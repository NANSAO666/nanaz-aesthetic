# 南崽形象美学 · 5大系统完整拆分架构

## 📋 项目概述

本项目是一个完整的AI形象诊断工具商业级系统，支持卡密售卖模式，包含5大独立模块：

1. **C端用户前端系统** - 对外商用，客户付费使用
2. **管理总后台系统** - 运营端，核心管控API、卡密、用户
3. **API中转调度服务系统** - 中间层，密钥保护、接口调度
4. **卡密分销合伙人系统** - 渠道代理、佣金分润
5. **数据存储&隐私合规系统** - 合规存储、日志留存

## 🏗️ 系统架构

```
/workspace/
├── api-proxy-service/          # API中转调度服务（端口3001）
│   ├── src/
│   │   ├── server.js           # 主服务入口
│   │   ├── routes/             # API路由
│   │   │   ├── facepp.js       # Face++人脸检测
│   │   │   ├── zhipu.js        # 智谱GLM-4报告生成
│   │   │   ├── doubao.js       # 豆包Lite客服聊天
│   │   │   ├── health.js       # 健康检查
│   │   │   └── stats.js        # 统计数据
│   │   ├── middleware/         # 中间件
│   │   │   ├── auth.js         # JWT认证
│   │   │   ├── rateLimit.js    # 限流控制
│   │   │   └── logger.js       # 日志记录
│   │   └── database/
│   │       └── db.js           # SQLite数据库
│   ├── data/                   # 数据存储目录
│   ├── logs/                   # 日志目录
│   ├── package.json
│   └── .env.example            # 配置模板
│
├── admin-backend/              # 管理总后台（端口3002）
│   ├── src/
│   │   ├── server.js           # 后台服务入口
│   │   ├── routes/             # 管理路由
│   │   │   ├── auth.js         # 管理员登录
│   │   │   ├── apiConfig.js    # API配置管理
│   │   │   ├── cardKey.js      # 卡密管理
│   │   │   ├── user.js         # 用户管理
│   │   │   ├── partner.js      # 合伙人管理
│   │   │   ├── stats.js        # 数据统计
│   │   │   └── forbidden.js    # 风控关键词
│   │   └── database/
│   │       └── db.js           # 数据库模块
│   ├── package.json
│   └── .env.example
│
├── admin-frontend/             # 管理后台前端
│   └── index.html              # 管理后台界面
│
├── index.html                  # C端用户前端（原有）
├── app.js                      # C端用户脚本（原有）
├── style.css                   # C端样式（原有）
│
└── start.sh                    # 启动脚本
```

## 🚀 快速启动

### 1. 安装依赖

```bash
# API中转服务
cd api-proxy-service
npm install

# 管理后台
cd admin-backend
npm install
```

### 2. 配置环境变量

```bash
# 复制配置模板
cp api-proxy-service/.env.example api-proxy-service/.env
cp admin-backend/.env.example admin-backend/.env

# 编辑配置文件，填入真实API密钥
# api-proxy-service/.env 中配置：
# - FACEPP_API_KEY
# - FACEPP_API_SECRET
# - ZHIPU_API_KEY
# - DOUBAO_API_KEY
```

### 3. 启动服务

```bash
# 使用启动脚本（推荐）
chmod +x start.sh
./start.sh

# 或手动启动
cd api-proxy-service && npm start &
cd admin-backend && npm start &
```

### 4. 访问系统

- **管理后台**: http://localhost:3002
- **API服务健康检查**: http://localhost:3001/health
- **C端用户前端**: 打开 `/workspace/index.html`

**默认管理员账号**: `admin` / `admin123`

## 🔧 系统功能详解

### 1. API中转调度服务系统（核心中间层）

**核心功能**：
- ✅ 密钥保护：所有API密钥存储在服务端，前端无法获取
- ✅ 接口调度：统一调度Face++、智谱、豆包三大API
- ✅ 限流控制：单用户每日最大报告次数限制
- ✅ 缓存机制：相同人脸不重复调用API
- ✅ 故障切换：API调用失败自动回落本地mock
- ✅ 日志记录：所有调用记录留存3年以上

**API接口**：
```
POST /api/facepp/detect    - 人脸检测
POST /api/zhipu/report     - 生成形象诊断报告
POST /api/zhipu/biz        - 生成招商文案
POST /api/doubao/chat      - AI客服聊天
POST /api/doubao/material  - 生成宣传素材
GET  /health               - 健康检查
GET  /api/stats/*          - 统计数据
```

### 2. 管理总后台系统

**核心模块**：

#### ① API接口管控
- 多接口密钥配置（Face++、智谱、豆包）
- 接口额度监控（每日调用次数、剩余Token）
- 接口开关（一键关闭/启用）
- 限流设置（单用户每日最大次数）
- 调用日志查询

#### ② 卡密生成&管控
- 批量生成卡密（自定义时长、价格）
- 卡密状态查询（未售出/已激活/已过期/封禁）
- 批量封禁失效卡密
- 卡密分销记录
- 导出Excel

#### ③ 用户管理
- 用户列表（绑定卡密、到期时间）
- 单用户限制（延长时长、封禁账号）
- 用户上传照片日志（脱敏存储）

#### ④ 内容风控
- AI生成报告关键词过滤
- 违规关键词管理

#### ⑤ 数据统计
- 日活、付费订单、卡密销量
- API消耗、合伙人分销收益
- 趋势图表

### 3. 卡密分销合伙人系统

**核心功能**：
- 合伙人专属低价拿货渠道
- 分销链接/专属推广码
- 佣金自动统计（10%-25%分成）
- 合伙人下级管理
- 代理价格分级设置

**合伙人等级**：
- 白银合伙人：10% 佣金
- 黄金合伙人：15% 佣金
- 铂金合伙人：20% 佣金
- 钻石合伙人：25% 佣金 + 团队分红

### 4. 数据存储&隐私合规系统

**数据分类存储**：
- 用户基础数据：手机号、登录记录、卡密有效期
- API调用日志：强制留存3年以上
- 人脸影像数据：自动脱敏存储，7天自动删除
- 分表存储：原始人脸、商用报告、支付订单分开存储

**隐私合规**：
- 人脸数据自动打码脱敏
- 设置自动过期删除（7/30天）
- 不保留原始清晰人脸
- 符合《个人信息保护法》要求

## 📊 数据库设计

系统使用SQLite数据库，包含以下表：

| 表名 | 说明 | 主要字段 |
|------|------|----------|
| users | 用户表 | id, phone, card_key, card_expire_time, total_reports |
| card_keys | 卡密表 | card_code, duration_days, price, status, sold_by_partner |
| api_logs | API日志表 | user_id, api_provider, request_type, tokens_used, created_at |
| face_data | 人脸数据表 | face_hash, blurred_image, facepp_data, expire_at |
| partners | 合伙人表 | partner_code, partner_level, commission_rate, total_commission |
| partner_orders | 分销订单表 | partner_id, order_amount, commission |
| api_config | API配置表 | api_provider, api_key, is_enabled, daily_limit |
| forbidden_keywords | 风控关键词表 | keyword, category, severity |
| admins | 管理员表 | username, password_hash, role |

## 🔐 安全机制

1. **密钥保护**
   - API密钥仅存储在服务端
   - 前端通过JWT认证访问API
   - 密钥不暴露给任何客户端

2. **限流控制**
   - 全局每分钟100次请求限制
   - 单用户每日10次报告生成限制
   - API接口每日调用限额

3. **认证机制**
   - JWT Token认证（24小时有效期）
   - 管理员独立认证系统
   - 卡密激活校验

4. **数据安全**
   - 人脸数据自动脱敏
   - 密码bcrypt加密
   - 数据库WAL模式

## 📈 扩展功能（可选）

以下功能可按需添加：

1. **支付对接系统**
   - 企业微信/支付宝商户
   - 自助在线购买卡密
   - 自动发放激活码

2. **客服工单系统**
   - 客户报错在线提交
   - 接口异常工单处理

3. **静态网页托管**
   - GitHub Pages部署
   - 产品介绍落地页

## 🛠️ 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite (better-sqlite3)
- **认证**: JWT
- **加密**: bcryptjs
- **API调用**: Axios
- **日志**: Winston
- **缓存**: node-cache
- **限流**: express-rate-limit

## 📝 更新日志

### v1.0.0 (2024-01-20)
- ✅ 完成5大系统拆分架构
- ✅ API中转调度服务核心功能
- ✅ 管理总后台完整功能
- ✅ 卡密分销合伙人系统
- ✅ 数据隐私合规机制
- ✅ SQLite数据库设计
- ✅ JWT认证机制
- ✅ 限流控制机制
- ✅ 日志记录系统

## 📞 技术支持

如有问题，请查看：
1. 各模块的 `.env.example` 配置说明
2. 数据库初始化日志
3. API服务健康检查接口

---

**南崽形象美学 · 医美+妆造一体化AI诊断系统**