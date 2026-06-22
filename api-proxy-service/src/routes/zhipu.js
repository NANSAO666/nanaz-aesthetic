/**
 * 智谱 GLM-4 Flash API路由
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const database = require('../database/db');

/**
 * 生成形象诊断报告
 * POST /api/zhipu/report
 */
router.post('/report', async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.id;
  
  try {
    const { faceData, height, weight, additionalInfo } = req.body;
    
    if (!faceData) {
      return res.status(400).json({
        error: '缺少人脸数据',
        code: 'MISSING_FACE_DATA'
      });
    }
    
    const prompt = buildReportPrompt(faceData, height, weight, additionalInfo);
    
    const apiKey = process.env.ZHIPU_API_KEY;
    
    if (!apiKey) {
      const mockReport = generateMockReport(faceData);
      return res.json({
        ok: true,
        content: mockReport,
        mock: true,
        engine: '本地智能响应'
      });
    }
    
    const response = await axios.post(
      `${process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'}/chat/completions`,
      {
        model: process.env.ZHIPU_MODEL || 'glm-4-flash',
        messages: [
          {
            role: 'system',
            content: '你是专业骨相形象美学导师，专为商K圈层女性做全维度定制形象分析。语气温柔共情，贴合夜场女生想多一份副业兜底的心态；禁止医美夸大宣传。输出严格分5大模块：1骨相建模解析 2妆容风格适配打分 3穿搭专属匹配 4肤色色彩诊断 5商K城市就业推荐；结尾附赠3条适合朋友圈分享的走心短文案。请用中文，使用小标题清晰分段。'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 2048
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );
    
    const content = response.data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('智谱API返回空内容');
    }
    
    // 风控检查
    const filteredContent = filterForbiddenKeywords(content);
    
    // 记录日志
    database.logApiCall({
      userId,
      requestType: 'generate_report',
      apiProvider: 'zhipu',
      apiEndpoint: '/chat/completions',
      tokensUsed: response.data.usage?.total_tokens || 0,
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      responseTimeMs: Date.now() - startTime
    });
    
    res.json({
      ok: true,
      content: filteredContent,
      engine: `智谱 ${process.env.ZHIPU_MODEL || 'glm-4-flash'}`,
      tokens: response.data.usage?.total_tokens || 0
    });
    
  } catch (error) {
    console.error('智谱API调用失败:', error.message);
    
    const mockReport = generateMockReport(req.body.faceData);
    res.json({
      ok: true,
      content: mockReport,
      mock: true,
      engine: '本地智能响应'
    });
  }
});

/**
 * 生成招商文案
 * POST /api/zhipu/biz
 */
router.post('/biz', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { partnerName, partnerLevel } = req.body;
    
    const prompt = `请帮【${partnerName || '南崽合伙人'}】（${partnerLevel || '白银'}合伙人，做医美+妆造一体化业务）写一篇500字左右的合伙人招募长文案，目标读者是商K夜场小姐姐，想有一份稳定副业兜底。风格纯欲轻奢、走心治愈，避免医美夸大宣传，强调小而稳、长期沉淀。结构：共情引入 → 业务介绍 → 三大卖点 → 温柔呼吁行动。`;
    
    const apiKey = process.env.ZHIPU_API_KEY;
    
    if (!apiKey) {
      return res.json({
        ok: true,
        content: generateMockBizText(),
        mock: true
      });
    }
    
    const response = await axios.post(
      `${process.env.ZHIPU_BASE_URL}/chat/completions`,
      {
        model: process.env.ZHIPU_MODEL,
        messages: [
          { role: 'system', content: '你是私域文案老师，为医美+妆造合伙人写走心招募文案。语气温柔共情、纯欲轻奢、不制造焦虑。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 1024
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );
    
    res.json({
      ok: true,
      content: response.data.choices?.[0]?.message?.content,
      engine: `智谱 ${process.env.ZHIPU_MODEL}`
    });
    
  } catch (error) {
    res.json({
      ok: true,
      content: generateMockBizText(),
      mock: true
    });
  }
});

function buildReportPrompt(faceData, height, weight, additionalInfo) {
  const beauty = faceData.beauty_female || faceData.beauty_male || 80;
  
  let prompt = `下面是用户上传的素颜正面照经Face++分析得到的结构化面部数据，请根据数据生成一份完整的形象诊断报告。\n\n【面部数据】\n`;
  
  prompt += `- 脸型：${faceData.shape || '未知'}\n`;
  prompt += `- 预估年龄：${faceData.age || '未知'}\n`;
  prompt += `- 颜值评分（模型打分）：${beauty} / 100\n`;
  prompt += `- 性别：${faceData.gender || '未知'}\n`;
  prompt += `- 人种：${faceData.race || 'Asian'}\n`;
  prompt += `- 微笑程度：${faceData.smile != null ? faceData.smile : '未知'}\n`;
  prompt += `- 主要情绪：${faceData.emotion || '未知'}\n`;
  prompt += `- 是否戴眼镜：${faceData.glasses || '未知'}\n`;
  prompt += `- 皮肤油脂度：${faceData.skin_oil != null ? faceData.skin_oil : '未知'}\n`;
  prompt += `- 皮肤干燥度：${faceData.skin_dry != null ? faceData.skin_dry : '未知'}\n`;
  prompt += `- 黑眼圈程度：${faceData.dark_circle != null ? faceData.dark_circle : '未知'}\n`;
  
  if (height && weight) {
    prompt += `\n【身材数据】\n身高：${height} cm\n体重：${weight} kg\n`;
  }
  
  if (additionalInfo) {
    prompt += `\n【补充信息】\n${additionalInfo}\n`;
  }
  
  prompt += `\n请分5大模块输出：1骨相建模解析 2妆容风格适配打分 3穿搭专属匹配 4肤色色彩诊断 5商K城市就业推荐。结尾附赠3条适合朋友圈分享的走心短文案。`;
  
  return prompt;
}

function filterForbiddenKeywords(content) {
  const keywords = database.queryAll('SELECT keyword FROM forbidden_keywords');
  
  let filtered = content;
  keywords.forEach(k => {
    filtered = filtered.replace(new RegExp(k.keyword, 'gi'), '***');
  });
  
  return filtered;
}

function generateMockReport(faceData) {
  return `【本地智能响应（未接入智谱API）】

根据你的形象特征，为你量身定制以下建议：

【妆容】纯欲氛围感最适合你——底妆轻薄通透，眼下+鼻尖扫上杏粉腮红，唇釉选豆沙粉或梅子色；

【穿搭】上身建议奶油白/樱花粉针织衫，下身高腰阔腿西裤或直筒裙，整体气质温柔又有高级感；

【发型】锁骨微卷或低马尾，额头留一点胎毛碎发可以柔化脸型；

【色彩】主色：雾霾紫、豆沙粉、奶油白；避雷：荧光橙、土黄、墨绿。

💗 形象是一个长期经营的过程，慢慢来，你本来就很好看。`;
}

function generateMockBizText() {
  return `姐妹们～做医美+妆造合伙人，真的是一份温柔又长期的小事业。

💡 三个关键点：
1) 先把3D骨相形象诊断做成你的入口产品——给每一个来找你的闺蜜做一次免费评估，让她被你的专业打动；
2) 轻奢妆造套餐做成交变现，再用轻医美合伙人机制做长期复购；
3) 坚持发短视频+朋友圈，用AI生成的素材不断触达潜在客户。

💗 温柔提醒：小事业需要用心经营，不要焦虑今天没有成交，用心服务每一个客户，自然会有好结果。`;
}

module.exports = router;