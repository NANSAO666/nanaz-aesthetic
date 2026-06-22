/**
 * 豆包 Lite API路由
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const database = require('../database/db');

/**
 * AI客服聊天
 * POST /api/doubao/chat
 */
router.post('/chat', async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.id;
  
  try {
    const { message, context } = req.body;
    
    if (!message) {
      return res.status(400).json({
        error: '缺少消息内容',
        code: 'MISSING_MESSAGE'
      });
    }
    
    const apiKey = process.env.DOUBAO_API_KEY;
    
    if (!apiKey) {
      return res.json({
        ok: true,
        content: generateMockChatResponse(message),
        mock: true,
        engine: '本地智能响应'
      });
    }
    
    const response = await axios.post(
      `${process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'}/chat/completions`,
      {
        model: process.env.DOUBAO_MODEL || 'doubao-lite-4k',
        messages: [
          {
            role: 'system',
            content: '你是妆造导师南崽专属的AI客服，接待想做形象诊断、学习妆造、了解医美合伙人副业的女生。语气温柔共情，先解决形象焦虑再介绍业务，不生硬推销。禁止医美夸大宣传，必要时推荐成渝、上海、杭州等商K城市。'
          },
          ...(context || []),
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 1200
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    const content = response.data.choices?.[0]?.message?.content;
    
    database.logApiCall({
      userId,
      requestType: 'chat',
      apiProvider: 'doubao',
      apiEndpoint: '/chat/completions',
      tokensUsed: response.data.usage?.total_tokens || 0,
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      responseTimeMs: Date.now() - startTime
    });
    
    res.json({
      ok: true,
      content: content,
      engine: `豆包 ${process.env.DOUBAO_MODEL || 'doubao-lite-4k'}`,
      tokens: response.data.usage?.total_tokens || 0
    });
    
  } catch (error) {
    console.error('豆包API调用失败:', error.message);
    
    res.json({
      ok: true,
      content: generateMockChatResponse(req.body.message),
      mock: true,
      engine: '本地智能响应'
    });
  }
});

/**
 * 生成宣传素材
 * POST /api/doubao/material
 */
router.post('/material', async (req, res) => {
  try {
    const apiKey = process.env.DOUBAO_API_KEY;
    
    const prompt = `请为『医美+妆造合伙人』业务生成宣传素材。要求严格分三个部分输出：
【短视频口播1】（不超过60字）
【短视频口播2】（不超过60字）
【短视频口播3】（不超过60字）
【海报短标语1】（不超过20字）
【海报短标语2】（不超过20字）
风格：纯欲轻奢、走心治愈、夜场小姐姐副业视角。`;
    
    if (!apiKey) {
      return res.json({
        ok: true,
        content: generateMockMaterial(),
        mock: true
      });
    }
    
    const response = await axios.post(
      `${process.env.DOUBAO_BASE_URL}/chat/completions`,
      {
        model: process.env.DOUBAO_MODEL,
        messages: [
          { role: 'system', content: '你是私域文案助理，为医美+妆造合伙人生成短视频口播、朋友圈海报文案。风格纯欲轻奢、走心治愈。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    res.json({
      ok: true,
      content: response.data.choices?.[0]?.message?.content,
      engine: `豆包 ${process.env.DOUBAO_MODEL}`
    });
    
  } catch (error) {
    res.json({
      ok: true,
      content: generateMockMaterial(),
      mock: true
    });
  }
});

function generateMockChatResponse(message) {
  const text = (message || '').trim();
  
  if (/形象|诊断|照片|骨相/.test(text)) {
    return '亲爱的～想做形象诊断的话，请到首页上传一张素颜正面照就可以了。我们会帮你分析脸型、肤色、妆容风格、穿搭建议，还会根据气质推荐适合长期发展的商K城市。💗';
  }
  
  if (/合伙人|副业|赚钱|代理|招商/.test(text)) {
    return '医美+妆造合伙人，是一份温柔又能长期沉淀的小事业。\n① 你给客户做3D骨相形象诊断 → 成交拿佣金；\n② 我们提供AI生成的短视频和海报文案，你复制粘贴就能发；\n③ 做好服务后客户自然会复购，收入能越做越稳定。\n💗 不焦虑不鸡汤，做了就有结果。';
  }
  
  if (/城市|去哪|上海|成都|重庆|杭州|深圳/.test(text)) {
    return '综合审美氛围+消费力+行业成熟度，我推荐的顺序是：\n① 成都/重庆 —— 夜消费文化成熟，轻奢氛围感吃香；\n② 上海 —— 高客单人群集中，审美精致；\n③ 杭州 —— 新消费氛围旺，短视频+私域链路成熟。\n💗 先做好形象诊断，再选择城市会更有方向。';
  }
  
  if (/化妆|妆造|学习|教程/.test(text)) {
    return '学妆造的最佳路径：先做一次3D骨相诊断 → 了解自己脸型的最优风格 → 专注练习1-2套能打的妆容（纯欲氛围感 / 轻奢御姐浓妆）。不用天天学新的，把最适合自己的那套练到熟，出门就能10分钟画完。💗';
  }
  
  if (/焦虑|难过|不自信|自卑|迷茫|emo/.test(text)) {
    return '先抱一抱你。💗\n每个人都有觉得自己不够好的阶段，但请记住——\n你不是不够美，是还没找到最能突出你本来气质的那个妆容、那套穿搭。\n先从一张素颜正面照开始，让我们帮你把『你本来就好看』的部分放大。';
  }
  
  if (/价格|费用|多少|钱|贵/.test(text)) {
    return '我们有几档主力产品：\n3D骨相形象诊断 ¥3800 / 轻奢妆造定制 ¥6800 / 轻医美合伙人轻代理 ¥12800 / 商K城市就业+形象全案 ¥28800。\n成交后合伙人拿10%-25%佣金，等级越高分成越多。';
  }
  
  return '你好呀～我是南崽AI客服。你可以直接和我聊形象诊断、合伙人副业、商K城市推荐、妆造学习等话题，或者先到首页上传一张素颜照获得定制建议哦～';
}

function generateMockMaterial() {
  return `【短视频口播1】姐妹们～不是夜场不长久，是我们没找到一条能沉淀下来的路。形象诊断+妆造+医美合伙人，让你有一份兜底的小事业。

【短视频口播2】多一条出路，多一份兜底。免费3D骨相诊断，看看你适合什么妆容风格、什么城市更适合你长期发展。

【短视频口播3】医美合伙人不是微商，是真正能帮别人变美又能赚钱的小事业。温柔经营，长期沉淀。

【海报短标语1】多一条出路，多一份兜底

【海报短标语2】免费3D骨相诊断 · 医美轻创业`;
}

module.exports = router;