#!/bin/bash

# 南崽形象美学 - 5大系统启动脚本

echo "======================================"
echo "南崽形象美学 · 5大系统启动"
echo "======================================"

# 创建必要的目录
mkdir -p api-proxy-service/data
mkdir -p api-proxy-service/logs

# 1. 启动API中转调度服务
echo ""
echo "① 启动API中转调度服务（端口3001）..."
cd api-proxy-service
if [ ! -d "node_modules" ]; then
  echo "   正在安装依赖..."
  npm install
fi
npm start &
API_PID=$!
cd ..

# 2. 启动管理后台服务
echo ""
echo "② 启动管理总后台系统（端口3002）..."
cd admin-backend
if [ ! -d "node_modules" ]; then
  echo "   正在安装依赖..."
  npm install
fi
npm start &
ADMIN_PID=$!
cd ..

# 等待服务启动
sleep 3

echo ""
echo "======================================"
echo "✅ 所有服务已启动"
echo "======================================"
echo ""
echo "API中转调度服务: http://localhost:3001"
echo "管理总后台:      http://localhost:3002"
echo ""
echo "默认管理员账号: admin / admin123"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 等待用户中断
trap "echo ''; echo '正在停止服务...'; kill $API_PID $ADMIN_PID; echo '服务已停止'; exit 0" INT

# 保持脚本运行
wait