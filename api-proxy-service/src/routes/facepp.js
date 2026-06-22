/**
 * Face++ API路由
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const database = require('../database/db');

/**
 * 人脸检测接口
 * POST /api/facepp/detect
 */
router.post('/detect', async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.id;
  
  try {
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({
        error: '缺少图片数据',
        code: 'MISSING_IMAGE'
      });
    }
    
    // 生成人脸哈希
    const faceHash = crypto.createHash('sha256').update(imageBase64).digest('hex');
    
    // 检查缓存
    const cachedFace = database.queryOne(`
      SELECT facepp_data, report_generated 
      FROM face_data 
      WHERE face_hash = ? AND expire_at > datetime('now')
    `, [faceHash]);
    
    if (cachedFace) {
      const faceppData = JSON.parse(cachedFace.facepp_data);
      
      database.logApiCall({
        userId,
        requestType: 'face_detect',
        apiProvider: 'facepp',
        apiEndpoint: '/detect',
        status: 'success',
        errorMessage: 'cached',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        responseTimeMs: Date.now() - startTime
      });
      
      return res.json({
        ok: true,
        data: faceppData,
        cached: true
      });
    }
    
    // 调用Face++ API（或使用mock）
    const apiKey = process.env.FACEPP_API_KEY;
    
    if (!apiKey) {
      const mockData = generateMockFaceData();
      
      const expireDays = parseInt(process.env.FACE_DATA_EXPIRE_DAYS) || 7;
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + expireDays);
      
      database.run(`
        INSERT INTO face_data (
          user_id, face_hash, blurred_image, facepp_data, expire_at
        ) VALUES (?, ?, ?, ?, ?)
      `, [userId, faceHash, '', JSON.stringify(mockData), expireDate.toISOString()]);
      
      return res.json({
        ok: true,
        data: mockData,
        mock: true
      });
    }
    
    // 调用真实API
    const formData = new URLSearchParams();
    formData.append('api_key', apiKey);
    formData.append('api_secret', process.env.FACEPP_API_SECRET);
    formData.append('image_base64', imageBase64.split(',')[1] || imageBase64);
    formData.append('return_landmark', '1');
    formData.append('return_attributes', 'gender,age,smiling,beauty,emotion,skinstatus,race,glass,headpose');
    
    const response = await axios.post(
      `https://${process.env.FACEPP_REGION || 'api-cn.faceplusplus.com'}/facepp/v3/detect`,
      formData.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000
      }
    );
    
    const faceppResult = response.data;
    
    if (!faceppResult.faces || faceppResult.faces.length === 0) {
      return res.json({
        ok: false,
        reason: 'no_face',
        message: '未检测到人脸'
      });
    }
    
    const face = faceppResult.faces[0];
    const attr = face.attributes || {};
    
    const processedData = {
      shape: detectFaceShape(face.face_rectangle, face.landmark),
      gender: attr.gender?.value || null,
      age: attr.age?.value || null,
      beauty_female: attr.beauty?.female_score || null,
      beauty_male: attr.beauty?.male_score || null,
      smile: attr.smile?.value || null,
      emotion: pickTopEmotion(attr.emotion),
      glasses: attr.glass?.value || null,
      race: attr.race?.value || null,
      skin_oil: attr.skinstatus?.oil || null,
      skin_dry: attr.skinstatus?.dry || null,
      dark_circle: attr.eyestatus?.dark_circle || null,
      has_landmark: !!face.landmark,
      landmarks_count: face.landmark ? Object.keys(face.landmark).length : 0
    };
    
    // 保存到数据库
    const expireDays = parseInt(process.env.FACE_DATA_EXPIRE_DAYS) || 7;
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + expireDays);
    
    database.run(`
      INSERT INTO face_data (
        user_id, face_hash, blurred_image, facepp_data, expire_at
      ) VALUES (?, ?, ?, ?, ?)
    `, [userId, faceHash, '', JSON.stringify(processedData), expireDate.toISOString()]);
    
    // 增加用户报告次数
    if (userId) database.incrementUserReportCount(userId);
    
    // 记录日志
    database.logApiCall({
      userId,
      requestType: 'face_detect',
      apiProvider: 'facepp',
      apiEndpoint: '/detect',
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      responseTimeMs: Date.now() - startTime
    });
    
    res.json({
      ok: true,
      data: processedData,
      cached: false
    });
    
  } catch (error) {
    console.error('Face++ API调用失败:', error.message);
    
    const mockData = generateMockFaceData();
    res.json({
      ok: true,
      data: mockData,
      mock: true,
      error: error.message
    });
  }
});

function detectFaceShape(rect, landmark) {
  if (!rect) return '鹅蛋脸';
  const ratio = rect.height / (rect.width || 1);
  if (ratio > 1.35) return '长形脸';
  if (ratio < 1.15) return '圆形脸';
  return '鹅蛋脸';
}

function pickTopEmotion(emotion) {
  if (!emotion) return null;
  let top = null, topVal = -1;
  for (const k in emotion) {
    if (emotion[k] > topVal) {
      topVal = emotion[k];
      top = k;
    }
  }
  const cnMap = {
    happiness: '开心', sadness: '难过', anger: '生气',
    disgust: '厌恶', fear: '恐惧', surprise: '惊讶', neutral: '平静'
  };
  return top ? (cnMap[top] || top) + ' (' + topVal.toFixed(1) + '%)' : null;
}

function generateMockFaceData() {
  const rand = (min, max) => Math.floor(Math.random() * (max - min) + min);
  return {
    shape: ['鹅蛋脸', '瓜子脸', '心形脸', '圆形脸'][Math.floor(Math.random() * 4)],
    gender: 'Female',
    age: rand(20, 32),
    beauty_female: rand(75, 95),
    beauty_male: rand(70, 92),
    smile: rand(0, 90),
    emotion: '平静 (78%)',
    glasses: 'None',
    race: 'Asian',
    skin_oil: rand(10, 40),
    skin_dry: rand(10, 35),
    dark_circle: rand(0, 40),
    has_landmark: true,
    landmarks_count: 106
  };
}

module.exports = router;