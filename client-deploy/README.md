# 客户端 Vercel 部署包

## 部署方法（1分钟）

1. 打开 https://vercel.com/new
2. 把整个 `client-deploy` 文件夹拖进去
3. 点击 Deploy
4. 获得公网链接（例如 `https://your-app.vercel.app`）

## 文件说明

- `index.html` - 客户端主页面
- `app.js` - 客户端脚本（集成AI诊断逻辑）
- `style.css` - 样式
- `vercel.json` - Vercel配置

## 特点

- ✅ 单文件部署，无需后端
- ✅ 智能 fallback 机制（API失败时使用本地智能分析）
- ✅ 隐私授权弹窗、卡密激活、报告展示
- ✅ 移动端H5适配

## 调试模式

无后端API时自动使用本地智能分析引擎，可完整体验流程。
