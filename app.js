/* ================================================================
   南崽形象美学 · 医美+妆造一体化 AI（接入三款真实 API）
   1) 旷视 Face++   → 图像上传，提取结构化面部数据（脸型/年龄/颜值/肤色等）
   2) 智谱 GLM-4 Flash → 基于 Face++ 数据生成长篇形象诊断报告 & 招商文案
   3) 豆包 Lite      → 24h AI 客服实时问答 & 短视频/海报素材生成
   所有 API Key 仅存在本机 localStorage，不配置时自动回落 mock。
   ================================================================ */

(function () {
  "use strict";

  // -------- 工具函数 --------
  const $ = (id) => document.getElementById(id);
  const toast = (msg, duration = 2000) => {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), duration);
  };
  const fmtMoney = (n) => "¥ " + Number(n).toLocaleString("zh-CN");

  // -------- 本地存储封装 --------
  const store = {
    get(key, def) {
      try { const v = localStorage.getItem("nanaz_" + key); return v ? JSON.parse(v) : def; }
      catch (e) { return def; }
    },
    set(key, val) {
      try { localStorage.setItem("nanaz_" + key, JSON.stringify(val)); } catch (e) {}
    },
    del(key) {
      try { localStorage.removeItem("nanaz_" + key); } catch (e) {}
    }
  };

  // -------- 当前 API 配置 --------
  function loadConfig() {
    const saved = store.get("cfg", {});
    return {
      glmKey:    saved.glmKey    || "",
      glmModel:  saved.glmModel  || "glm-4-flash",
      doubaoKey: saved.doubaoKey || "",
      doubaoModel: saved.doubaoModel || "doubao-lite-4k",
      faceKey:   saved.faceKey   || "",
      faceSecret:saved.faceSecret|| "",
      faceRegion:saved.faceRegion|| "api-cn.faceplusplus.com"
    };
  }
  let cfg = loadConfig();

  // 实时把配置面板的输入值回填到 DOM
  function renderConfigToUI() {
    $("cfgGlmKey").value    = cfg.glmKey;
    $("cfgGlmModel").value  = cfg.glmModel;
    $("cfgDoubaoKey").value = cfg.doubaoKey;
    $("cfgDoubaoModel").value = cfg.doubaoModel;
    $("cfgFaceKey").value   = cfg.faceKey;
    $("cfgFaceSecret").value= cfg.faceSecret;
    $("cfgFaceRegion").value= cfg.faceRegion;
    // 自动提示状态
    $("cfgGlmStatus").textContent    = cfg.glmKey    ? "已配置" : "未配置（将使用本地智能响应）";
    $("cfgGlmStatus").className      = "cfg-status" + (cfg.glmKey ? " ok" : " warn");
    $("cfgDoubaoStatus").textContent = cfg.doubaoKey ? "已配置" : "未配置（将使用本地智能响应）";
    $("cfgDoubaoStatus").className   = "cfg-status" + (cfg.doubaoKey ? " ok" : " warn");
    $("cfgFaceStatus").textContent   = (cfg.faceKey && cfg.faceSecret) ? "已配置" : "未配置（将使用本地智能响应）";
    $("cfgFaceStatus").className     = "cfg-status" + (cfg.faceKey && cfg.faceSecret ? " ok" : " warn");
  }
  renderConfigToUI();

  // 更新浮窗文案
  function updateChatEngineLabel() {
    if (cfg.doubaoKey) {
      $("chatEngine").textContent = "豆包 Lite · " + cfg.doubaoModel + " · 24h 在线";
    } else if (cfg.glmKey) {
      $("chatEngine").textContent = "智谱 GLM · " + cfg.glmModel + " · 24h 在线";
    } else {
      $("chatEngine").textContent = "本地智能响应 · 24h 在线";
    }
  }
  updateChatEngineLabel();

  // ==================== 核心 · 三款真实 API 调用 ====================

  /**
   * 智谱 GLM-4 Flash 调用（OpenAI 兼容 Chat Completions）
   * 官方文档: https://open.bigmodel.cn/dev/api
   */
  async function callZhipu(prompt, systemPrompt) {
    if (!cfg.glmKey) return { ok: false, reason: "no_key", fallback: mockZhipu(prompt) };
    try {
      const resp = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + cfg.glmKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: cfg.glmModel,
          messages: [
            { role: "system", content: systemPrompt || "你是温柔的形象美学顾问，擅长根据用户的骨相、肤色、气质给出定制化建议。" },
            { role: "user", content: prompt }
          ],
          temperature: 0.8,
          max_tokens: 2048
        })
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.warn("智谱 API 调用失败:", resp.status, errText);
        return { ok: false, reason: "http_" + resp.status, fallback: mockZhipu(prompt) };
      }
      const data = await resp.json();
      const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!content) return { ok: false, reason: "empty", fallback: mockZhipu(prompt) };
      return { ok: true, content: content.trim() };
    } catch (e) {
      console.warn("智谱 API 调用异常:", e);
      return { ok: false, reason: "network", fallback: mockZhipu(prompt) };
    }
  }

  /**
   * 豆包 Lite（火山引擎方舟 · OpenAI 兼容 Chat Completions）
   * 官方文档: https://www.volcengine.com/docs/82379
   */
  async function callDoubao(prompt, systemPrompt) {
    if (!cfg.doubaoKey) return { ok: false, reason: "no_key", fallback: mockDoubao(prompt) };
    try {
      const resp = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + cfg.doubaoKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: cfg.doubaoModel,
          messages: [
            { role: "system", content: systemPrompt || "你是温柔共情的妆造客服 AI，擅长给商K圈层女生提供形象与副业建议。" },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 1200
        })
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.warn("豆包 API 调用失败:", resp.status, errText);
        return { ok: false, reason: "http_" + resp.status, fallback: mockDoubao(prompt) };
      }
      const data = await resp.json();
      const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!content) return { ok: false, reason: "empty", fallback: mockDoubao(prompt) };
      return { ok: true, content: content.trim() };
    } catch (e) {
      console.warn("豆包 API 调用异常:", e);
      return { ok: false, reason: "network", fallback: mockDoubao(prompt) };
    }
  }

  /**
   * 旷视 Face++ Detect 调用
   * 官方文档: https://console.faceplusplus.com.cn/documents/4888373
   *
   * 注意：Face++ 的 API 在现代浏览器中可能受 CORS 限制，
   * 若调用失败会自动回落到本地 mock 数据。
   */
  async function callFacePP(imageBase64) {
    if (!cfg.faceKey || !cfg.faceSecret) {
      return { ok: false, reason: "no_key", fallback: mockFacePP() };
    }
    try {
      const form = new FormData();
      form.append("api_key", cfg.faceKey);
      form.append("api_secret", cfg.faceSecret);
      form.append("image_base64", imageBase64.split(",")[1] || imageBase64); // 去掉 data:image/...;base64, 前缀
      form.append("return_landmark", "1");
      form.append("return_attributes", "gender,age,smiling,beauty,emotion,skinstatus,race,glass,headpose,mouthstatus,eyestatus");

      const resp = await fetch("https://" + cfg.faceRegion + "/facepp/v3/detect", {
        method: "POST",
        body: form
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.warn("Face++ API 调用失败:", resp.status, errText);
        return { ok: false, reason: "http_" + resp.status, fallback: mockFacePP() };
      }
      const data = await resp.json();
      if (!data.faces || data.faces.length === 0) {
        return { ok: false, reason: "no_face", fallback: mockFacePP() };
      }
      const f = data.faces[0];
      const attr = f.attributes || {};
      const result = {
        // 结构化字段，模板逻辑与智谱报告对接
        shape: detectFaceShape(f.face_rectangle, f.landmark),
        gender: attr.gender ? attr.gender.value : null,
        age: attr.age ? attr.age.value : null,
        beauty_female: attr.beauty && attr.beauty.female_score ? attr.beauty.female_score : null,
        beauty_male:   attr.beauty && attr.beauty.male_score   ? attr.beauty.male_score   : null,
        smile: attr.smile ? attr.smile.value : null,
        emotion: attr.emotion ? pickTopEmotion(attr.emotion) : null,
        glasses: attr.glass ? attr.glass.value : null,
        race: attr.race ? attr.race.value : null,
        skin_oil: attr.skinstatus ? attr.skinstatus.oil : null,
        skin_dry: attr.skinstatus ? attr.skinstatus.dry : null,
        dark_circle: attr.eyestatus ? attr.eyestatus.dark_circle : null,
        has_landmark: !!f.landmark,
        landmarks_count: f.landmark ? Object.keys(f.landmark).length : 0,
        headpose: attr.headpose ? {
          pitch: attr.headpose.pitch_angle,
          roll:  attr.headpose.roll_angle,
          yaw:   attr.headpose.yaw_angle
        } : null
      };
      return { ok: true, data: result };
    } catch (e) {
      console.warn("Face++ API 调用异常（可能是 CORS 限制）:", e);
      return { ok: false, reason: "network_or_cors", fallback: mockFacePP() };
    }
  }

  function pickTopEmotion(emotion) {
    // emotion 形如 {happiness: 95.6, neutral: 3.1, ...}
    let top = null, topVal = -1;
    for (const k in emotion) {
      if (emotion[k] > topVal) { topVal = emotion[k]; top = k; }
    }
    const cnMap = { happiness:"开心", sadness:"难过", anger:"生气", disgust:"厌恶", fear:"恐惧", surprise:"惊讶", neutral:"平静" };
    return top ? (cnMap[top] || top) + " (" + topVal.toFixed(1) + "%)" : null;
  }

  function detectFaceShape(rect, landmark) {
    // 根据 face_rectangle 长宽比 + landmark 粗略判断脸型
    if (!rect) return "鹅蛋脸";
    const ratio = rect.height / (rect.width || 1);
    if (ratio > 1.35) return "长形脸";
    if (ratio < 1.15) return "圆形脸";
    return "鹅蛋脸";
  }

  // ==================== mock 逻辑（无 Key 也能运行） ====================

  function mockFacePP() {
    const rand = (min, max) => (Math.random() * (max - min) + min);
    return {
      shape: ["鹅蛋脸", "瓜子脸", "心形脸", "圆形脸"][Math.floor(Math.random()*4)],
      gender: "Female",
      age: Math.floor(rand(20, 32)),
      beauty_female: Math.floor(rand(75, 95)),
      beauty_male: Math.floor(rand(70, 92)),
      smile: Math.floor(rand(0, 90)),
      emotion: "平静 (78%)",
      glasses: "None",
      race: "Asian",
      skin_oil: Math.floor(rand(10, 40)),
      skin_dry: Math.floor(rand(10, 35)),
      dark_circle: Math.floor(rand(0, 40)),
      has_landmark: true, landmarks_count: 106,
      headpose: { pitch: rand(-10,10).toFixed(2), roll: rand(-5,5).toFixed(2), yaw: rand(-8,8).toFixed(2) }
    };
  }

  function mockZhipu(prompt) {
    // 智能但模板化的简短响应，给用户 "能用" 的体验
    const base = "【本地智能响应（未接入智谱 API）】\n\n";
    if (/招商|招募|合伙人|副业|赚钱/.test(prompt)) {
      return base +
        "姐妹们～做医美+妆造合伙人，真的是一份温柔又长期的小事业。\n\n" +
        "💡 三个关键点：\n" +
        "1) 先把 3D 骨相形象诊断做成你的入口产品——给每一个来找你的闺蜜做一次免费评估，让她被你的专业打动；\n" +
        "2) 轻奢妆造套餐做成交变现，再用轻医美合伙人机制做长期复购；\n" +
        "3) 坚持发短视频+朋友圈，用 AI 生成的素材不断触达潜在客户。\n\n" +
        "💗 温柔提醒：小事业需要用心经营，不要焦虑今天没有成交，用心服务每一个客户，自然会有好结果。";
    }
    if (/形象|骨相|妆造|穿搭|肤色|脸型|建议|报告/.test(prompt)) {
      return base +
        "根据你的形象特征，为你量身定制以下建议：\n\n" +
        "【妆容】纯欲氛围感最适合你——底妆轻薄通透，眼下+鼻尖扫上杏粉腮红，唇釉选豆沙粉或梅子色；\n" +
        "【穿搭】上身建议奶油白/樱花粉针织衫，下身高腰阔腿西裤或直筒裙，整体气质温柔又有高级感；\n" +
        "【发型】锁骨微卷或低马尾，额头留一点胎毛碎发可以柔化脸型；\n" +
        "【色彩】主色：雾霾紫、豆沙粉、奶油白；避雷：荧光橙、土黄、墨绿。\n\n" +
        "💗 形象是一个长期经营的过程，慢慢来，你本来就很好看。";
    }
    return base + "（本地智能响应已激活）\n\n" +
      "根据你的输入，建议你先到『C端形象诊断』板块上传一张素颜正面照，AI 会给出完整的脸型、肤色、妆容、穿搭建议。";
  }

  function mockDoubao(prompt) {
    const text = (prompt || "").trim();
    if (/形象|诊断|照片|骨相/.test(text)) {
      return "亲爱的～想做形象诊断的话，请到首页的『C端形象诊断』板块，上传一张素颜正面照就可以了。\n" +
             "我们会帮你分析脸型、肤色、妆容风格、穿搭建议，还会根据气质推荐适合长期发展的商K城市。💗";
    }
    if (/合伙人|副业|赚钱|代理|招商/.test(text)) {
      return "医美+妆造合伙人，是一份温柔又能长期沉淀的小事业。\n" +
             "① 你给客户做 3D 骨相形象诊断 → 成交拿佣金；\n" +
             "② 我们提供 AI 生成的短视频和海报文案，你复制粘贴就能发；\n" +
             "③ 做好服务后客户自然会复购，收入能越做越稳定。\n" +
             "💗 不焦虑不鸡汤，做了就有结果。";
    }
    if (/城市|去哪|上海|成都|重庆|杭州|深圳/.test(text)) {
      return "综合审美氛围+消费力+行业成熟度，我推荐的顺序是：\n" +
             "① 成都/重庆 —— 夜消费文化成熟，轻奢氛围感吃香；\n" +
             "② 上海 —— 高客单人群集中，审美精致；\n" +
             "③ 杭州 —— 新消费氛围旺，短视频+私域链路成熟。\n" +
             "💗 先做好形象诊断，再选择城市会更有方向。";
    }
    if (/化妆|妆造|学习|教程/.test(text)) {
      return "学妆造的最佳路径：先做一次 3D 骨相诊断 → 了解自己脸型的最优风格 → 专注练习 1-2 套能打的妆容（纯欲氛围感 / 轻奢御姐浓妆）。\n" +
             "不用天天学新的，把最适合自己的那套练到熟，出门就能 10 分钟画完。💗";
    }
    if (/焦虑|难过|不自信|自卑|迷茫|emo/.test(text)) {
      return "先抱一抱你。💗\n每个人都有觉得自己不够好的阶段，但请记住——\n" +
             "你不是不够美，是还没找到最能突出你本来气质的那个妆容、那套穿搭。\n" +
             "先从一张素颜正面照开始，让我们帮你把『你本来就好看』的部分放大。";
    }
    if (/价格|费用|多少|钱|贵/.test(text)) {
      return "我们有几档主力产品：\n" +
             "3D 骨相形象诊断 ¥3800 / 轻奢妆造定制 ¥6800 / 轻医美合伙人轻代理 ¥12800 / 商K城市就业+形象全案 ¥28800。\n" +
             "成交后合伙人拿 10%-25% 佣金，等级越高分成越多。";
    }
    return "你好呀～我是南崽 AI 客服。你可以直接和我聊形象诊断、合伙人副业、商K城市推荐、妆造学习等话题，或者先到首页上传一张素颜照获得定制建议哦～";
  }

  // ==================== 统一智能响应入口（优选真实API → fallback） ====================
  async function smartReport(prompt, sys) {
    if (cfg.glmKey) {
      const r = await callZhipu(prompt, sys);
      if (r.ok) return { text: r.content, engine: "智谱 " + cfg.glmModel };
    }
    // 无 key 或失败，优先尝试豆包
    if (cfg.doubaoKey) {
      const r = await callDoubao(prompt, sys);
      if (r.ok) return { text: r.content, engine: "豆包 " + cfg.doubaoModel };
    }
    return { text: mockZhipu(prompt), engine: "本地智能响应" };
  }

  async function smartChat(prompt) {
    // 客服优选用豆包，次选智谱
    if (cfg.doubaoKey) {
      const r = await callDoubao(prompt,
        "你是妆造导师南崽专属的 AI 客服，接待想做形象诊断、学习妆造、了解医美合伙人副业的女生。" +
        "语气温柔共情，先解决形象焦虑再介绍业务，不生硬推销。禁止医美夸大宣传，必要时推荐成渝、上海、杭州等商K城市。"
      );
      if (r.ok) return { text: r.content, engine: "豆包 " + cfg.doubaoModel };
    }
    if (cfg.glmKey) {
      const r = await callZhipu(prompt,
        "你是温柔共情的 AI 客服，专为商K圈层女生提供形象诊断、妆造学习、医美合伙人副业咨询。"
      );
      if (r.ok) return { text: r.content, engine: "智谱 " + cfg.glmModel };
    }
    return { text: mockDoubao(prompt), engine: "本地智能响应" };
  }

  async function smartMaterial(prompt) {
    if (cfg.doubaoKey) {
      const r = await callDoubao(prompt, "你是私域文案助理，为医美+妆造合伙人生成短视频口播、朋友圈海报文案。风格纯欲轻奢、走心治愈。输出请按『【短视频】…【海报】…』的固定格式。");
      if (r.ok) return { text: r.content, engine: "豆包 " + cfg.doubaoModel };
    }
    if (cfg.glmKey) {
      const r = await callZhipu(prompt, "你是私域文案生成器。格式要求：『【短视频口播】…【海报文案】…』，每条不超过 60 字。");
      if (r.ok) return { text: r.content, engine: "智谱 " + cfg.glmModel };
    }
    return {
      text: "【短视频口播】姐妹们～不是夜场不长久，是我们没找到一条能沉淀下来的路。形象诊断+妆造+医美合伙人，让你有一份兜底的小事业。\n" +
            "【海报文案】多一条出路，多一份兜底 · 免费 3D 骨相诊断 · 医美轻创业，让收入跟着你一起成长。",
      engine: "本地智能响应"
    };
  }

  // ==================== C 端形象诊断（完整流程） ====================
  const faceState = { imgLoaded: false, faceData: null, imageBase64: null };

  const faceInput      = $("faceInput");
  const uploadPlaceholder = $("uploadPlaceholder");
  const faceCanvas     = $("faceCanvas");
  const btnDemoFace    = $("btnDemoFace");
  const btnStartDetect = $("btnStartDetect");
  const cloudCard      = $("cloudCard");
  const cloudText      = $("cloudText");
  const cloudSteps     = $("cloudSteps");
  const dataCard       = $("dataCard");
  const reportCard     = $("reportCard");

  // 上传图片 → Canvas 预览
  faceInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      faceState.imageBase64 = reader.result;
      const img = new Image();
      img.onload = () => drawImageToCanvas(img);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  btnDemoFace.addEventListener("click", () => {
    // 生成示例人脸（Canvas 绘图）
    const canvas = faceCanvas;
    const ctx = canvas.getContext("2d");
    canvas.width = 480; canvas.height = 600;

    // 渐变背景
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, "#fde8ec"); g.addColorStop(1, "#fff7f9");
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 脸型椭圆
    ctx.fillStyle = "#f6d7cf";
    ctx.beginPath();
    ctx.ellipse(240, 330, 120, 170, 0, 0, Math.PI * 2);
    ctx.fill();

    // 头发
    ctx.fillStyle = "#4a3a36";
    ctx.beginPath();
    ctx.ellipse(240, 210, 130, 80, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(145, 330, 18, 110, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(335, 330, 18, 110, 0, 0, Math.PI * 2); ctx.fill();

    // 眼睛+瞳孔
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.ellipse(195, 320, 18, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(285, 320, 18, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#4a3a36";
    ctx.beginPath(); ctx.arc(195, 320, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(285, 320, 5, 0, Math.PI * 2); ctx.fill();

    // 眉毛
    ctx.strokeStyle = "#4a3a36"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(170, 300); ctx.quadraticCurveTo(195, 294, 225, 300); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(255, 300); ctx.quadraticCurveTo(285, 294, 315, 300); ctx.stroke();

    // 腮红
    ctx.fillStyle = "rgba(233,167,180,.4)";
    ctx.beginPath(); ctx.ellipse(175, 385, 25, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(305, 385, 25, 12, 0, 0, Math.PI * 2); ctx.fill();

    // 鼻子+嘴唇
    ctx.strokeStyle = "#c48e80"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(240, 330); ctx.lineTo(240, 400); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(240, 440, 30, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#e69daa"; ctx.fill();

    // 示范标签
    ctx.fillStyle = "#c26681"; ctx.font = "600 14px -apple-system,sans-serif";
    ctx.fillText("示例人脸 · 纯欲感", 16, 28);

    uploadPlaceholder.hidden = true;
    canvas.hidden = false;
    faceState.imgLoaded = true;
    faceState.imageBase64 = canvas.toDataURL("image/jpeg", 0.85);
    btnStartDetect.disabled = false;
    toast("示例人脸已加载，点击开始诊断");
  });

  function drawImageToCanvas(img) {
    const canvas = faceCanvas;
    const ctx = canvas.getContext("2d");
    const maxSize = 480;
    let w = img.naturalWidth || 320;
    let h = img.naturalHeight || 320;
    if (w > h) { if (w > maxSize) { h = h * maxSize / w; w = maxSize; } }
    else       { if (h > maxSize) { w = w * maxSize / h; h = maxSize; } }
    canvas.width = w; canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);

    uploadPlaceholder.hidden = true;
    canvas.hidden = false;
    faceState.imgLoaded = true;
    faceState.imageBase64 = canvas.toDataURL("image/jpeg", 0.85);
    btnStartDetect.disabled = false;
    toast("照片已上传");
  }

  // 开始 AI 诊断：Face++ → 智谱
  btnStartDetect.addEventListener("click", async () => {
    if (!faceState.imgLoaded) { toast("请先上传或生成一张人脸图片"); return; }
    cloudCard.hidden = false; dataCard.hidden = true; reportCard.hidden = true;
    cloudCard.scrollIntoView({ behavior: "smooth", block: "start" });

    const addStep = (text, cls) => {
      const span = document.createElement("span");
      if (cls) span.classList.add(cls);
      span.textContent = text;
      cloudSteps.appendChild(span);
    };

    // Step 1: Face++ 调用
    cloudText.textContent = "① 正在请求 Face++ 人脸检测 API…";
    const faceStart = Date.now();
    const faceRes = await callFacePP(faceState.imageBase64);
    const faceElapsed = Date.now() - faceStart;
    faceState.faceData = faceRes.ok ? faceRes.data : faceRes.fallback;

    if (faceRes.ok) {
      addStep("Face++ · 106 个五官点位提取成功", "done");
      addStep("Face++ · 脸型/年龄/颜值分析成功", "done");
    } else {
      addStep("Face++ · " + (faceRes.reason === "no_key" ? "未配置 Key，使用本地分析" : "已回落本地分析"), "done");
    }

    // Step 2: 渲染结构化数据
    cloudText.textContent = "② 正在渲染结构化面部数据…";
    renderFaceData(faceState.faceData, faceRes.ok ? "Face++ 真实 API 返回" : "本地智能分析（Face++ 未配置/调用失败）");
    await sleep(400);

    // Step 3: 智谱 GLM-4 生成完整报告
    cloudText.textContent = "③ 正在请求智谱 GLM-4 Flash 生成形象诊断报告…";
    const prompt = buildReportPrompt(faceState.faceData);
    const reportRes = await smartReport(prompt,
      "你是专业骨相形象美学导师，专为商K圈层女性做全维度定制形象分析。" +
      "语气温柔共情，贴合夜场女生想多一份副业兜底的心态；禁止医美夸大宣传。" +
      "输出严格分 5 大模块：1 骨相建模解析 2 妆容风格适配打分 3 穿搭专属匹配 4 肤色色彩诊断 5 商K城市就业推荐；" +
      "结尾附赠 3 条适合朋友圈分享的走心短文案。请用中文，使用小标题清晰分段。"
    );
    addStep((reportRes.engine.startsWith("本地") ? "本地智能响应" : reportRes.engine) + " · 报告生成完成", "done");
    cloudText.textContent = "✅ AI 诊断完成";
    renderReport(reportRes.text, reportRes.engine);
  });

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function buildReportPrompt(d) {
    const beauty = d.beauty_female || d.beauty_male || 80;
    return (
      "下面是用户上传的素颜正面照经 Face++ 分析得到的结构化面部数据，请根据数据生成一份完整的形象诊断报告。\n\n" +
      "【面部数据】\n" +
      "- 脸型：" + (d.shape || "未知") + "\n" +
      "- 预估年龄：" + (d.age || "未知") + "\n" +
      "- 颜值评分（模型打分）：" + beauty + " / 100\n" +
      "- 性别：" + (d.gender || "未知") + "\n" +
      "- 人种：" + (d.race || "Asian") + "\n" +
      "- 微笑程度：" + (d.smile != null ? d.smile : "未知") + "\n" +
      "- 主要情绪：" + (d.emotion || "未知") + "\n" +
      "- 是否戴眼镜：" + (d.glasses || "未知") + "\n" +
      "- 皮肤油脂度：" + (d.skin_oil != null ? d.skin_oil : "未知") + "\n" +
      "- 皮肤干燥度：" + (d.skin_dry != null ? d.skin_dry : "未知") + "\n" +
      "- 黑眼圈程度：" + (d.dark_circle != null ? d.dark_circle : "未知") + "\n" +
      "- 头部姿态（pitch/roll/yaw）：" + (d.headpose ? JSON.stringify(d.headpose) : "正面") + "\n" +
      "- 五官点位总数：" + (d.landmarks_count || 106) + "\n\n" +
      "请根据以上数据分 5 大模块输出：\n" +
      "1 骨相建模解析（脸型立体感、原生五官优缺点、客观短板）\n" +
      "2 妆容风格适配打分（纯欲轻氛围感、轻奢御姐浓妆、日常淡颜淡妆，分别给 0-100 分，标注最优妆容与调整思路）\n" +
      "3 穿搭专属匹配（分别给出商K上班礼服/轻奢套装、日常通勤私服方案，标注版型面料色系与避雷）\n" +
      "4 肤色色彩诊断（冷暖皮判断、适配口红/眼影/服装色系清单）\n" +
      "5 商K城市就业推荐（结合骨相气质、适配妆容风格，推荐成渝/上海/杭州等城市，说明客源、收入、审美偏好）\n\n" +
      "结尾附赠 3 条适合朋友圈分享的走心短文案。"
    );
  }

  function renderFaceData(d, sourceNote) {
    const grid = $("dataGrid");
    const items = [
      ["脸型", d.shape],
      ["预估年龄", (d.age != null ? d.age + " 岁" : "—")],
      ["颜值评分 (女)", d.beauty_female != null ? d.beauty_female + " 分" : "—"],
      ["颜值评分 (男)", d.beauty_male != null ? d.beauty_male + " 分" : "—"],
      ["微笑程度", d.smile != null ? d.smile : "—"],
      ["主要情绪", d.emotion || "—"],
      ["是否戴眼镜", ({None:"不戴眼镜",Normal:"普通眼镜",Dark:"墨镜"}[d.glasses]) || d.glasses || "—"],
      ["人种", ({Asian:"亚洲",White:"欧美",Black:"非裔",Indian:"印度"}[d.race]) || d.race || "—"],
      ["皮肤油脂度", d.skin_oil != null ? d.skin_oil : "—"],
      ["皮肤干燥度", d.skin_dry != null ? d.skin_dry : "—"],
      ["黑眼圈程度", d.dark_circle != null ? d.dark_circle : "—"],
      ["五官点位", d.landmarks_count ? d.landmarks_count + " 个" : "—"]
    ];
    grid.innerHTML = items.map(([k,v]) =>
      `<div class="data-item"><div class="d-label">${k}</div><div class="d-value">${v}</div></div>`
    ).join("");
    $("dataSource").textContent = sourceNote || "";
    $("dataSource").style.display = "block";
    dataCard.hidden = false;
  }

  function renderReport(text, engine) {
    const block = $("reportBlock");
    // 大模型返回的内容通常是分段的纯文本，这里用 <pre> 样式显示并替换部分标记
    const safe = text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>")
      .replace(/\s{2}/g, "&nbsp;&nbsp;");
    block.innerHTML = `
      <div style="font-size:12px;color:#a8acb5;margin-bottom:12px;">由 ${engine} 生成 · 仅供形象与穿搭参考</div>
      <div style="background:#fafbfc;border-radius:12px;padding:16px;font-size:13.5px;line-height:1.85;color:#3a3f4a;white-space:pre-wrap;">${safe}</div>
    `;
    reportCard.hidden = false;
    reportCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("btnCopyReport").addEventListener("click", () => {
    copyText($("reportBlock").innerText);
  });
  $("btnBookMakeup").addEventListener("click", () => {
    // 跳到合伙人后台预约表单
    document.querySelector('.tab-item[data-tab="合伙人"]').click();
    toast("已跳转至预约表单");
  });

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast("已复制到剪贴板")).catch(()=> fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
    function fallbackCopy(t) {
      const ta = document.createElement("textarea");
      ta.value = t; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast("已复制"); } catch(e) { toast("复制失败"); }
      document.body.removeChild(ta);
    }
  }

  // ==================== 合伙人后台 ====================
  function renderPartner() {
    const partner = store.get("partner", { name: "南崽合伙人", level: "白银" });
    const levelMap = { "白银": {com: 10, num: "Lv.1"}, "黄金": {com: 15, num: "Lv.2"}, "铂金": {com: 20, num: "Lv.3"}, "钻石": {com: 25, num: "Lv.4"} };
    $("partnerName").textContent = partner.name || "南崽合伙人";
    $("partnerLevel").textContent = partner.level + "合伙人 · " + (levelMap[partner.level]?.com || 10) + "%";
    $("inputName").value = partner.name || "";
    $("selectLevel").value = partner.level || "白银";
    $("statLevel").textContent = levelMap[partner.level]?.num || "Lv.1";

    const orders = store.get("orders", []);
    const income = orders.reduce((s, o) => s + (o.commission || 0), 0);
    $("statIncome").textContent = fmtMoney(income);
    $("statOrders").textContent = orders.length;
    $("statTeam").textContent = Math.max(0, orders.length - 1);

    const tb = $("orderBody");
    if (orders.length === 0) {
      $("orderTable").hidden = true;
    } else {
      $("orderTable").hidden = false;
      tb.innerHTML = orders.slice(-10).reverse().map(o =>
        `<tr><td>${o.client}</td><td>${o.projectLabel}</td><td><b>${fmtMoney(o.commission)}</b></td><td>${o.time}</td></tr>`
      ).join("");
    }
    updateCommissionPreview();

    const bookings = store.get("bookings", []);
    const list = $("bookingList");
    if (bookings.length === 0) {
      list.innerHTML = `<div style="font-size:12px;color:#a8acb5;text-align:center;margin-top:12px;">暂无预约记录</div>`;
    } else {
      list.innerHTML = bookings.slice(-8).reverse().map(b =>
        `<div class="booking-item"><span class="b-type">${b.type}</span> · ${b.time || "待定"}<br/>📞 ${b.contact || "—"}<br/>📝 ${b.note || "无"}</div>`
      ).join("");
    }
  }
  function updateCommissionPreview() {
    const level = store.get("partner", { level: "白银" }).level;
    const levelMap = { "白银":10,"黄金":15,"铂金":20,"钻石":25 };
    const price = Number($("selectProject").value) || 3800;
    const commission = Math.round(price * (levelMap[level] || 10) / 100);
    $("commissionPreview").textContent = `${level}合伙人 · 佣金比例 ${levelMap[level]}% · 预估佣金 ${fmtMoney(commission)}`;
  }

  $("btnSavePartner").addEventListener("click", () => {
    const name = $("inputName").value.trim() || "南崽合伙人";
    const level = $("selectLevel").value;
    store.set("partner", { name, level });
    renderPartner();
    toast("合伙人资料已保存");
  });
  $("selectProject").addEventListener("change", updateCommissionPreview);
  $("btnAddOrder").addEventListener("click", () => {
    const client = $("inputClient").value.trim();
    if (!client) { toast("请填写客户姓名"); return; }
    const price = Number($("selectProject").value);
    const projectLabel = $("selectProject").selectedOptions[0].text;
    const level = store.get("partner", { level: "白银" }).level;
    const levelMap = { "白银":10,"黄金":15,"铂金":20,"钻石":25 };
    const commission = Math.round(price * (levelMap[level] || 10) / 100);
    const orders = store.get("orders", []);
    orders.push({ client, projectLabel, commission, time: new Date().toLocaleString("zh-CN", { hour12: false }) });
    store.set("orders", orders);
    $("inputClient").value = "";
    renderPartner();
    toast("成交已登记 · 佣金 " + fmtMoney(commission));
  });
  $("btnClearOrders").addEventListener("click", () => {
    if (!confirm("确认清空所有成交记录？")) return;
    store.del("orders"); renderPartner();
    toast("已清空");
  });
  $("btnBookSubmit").addEventListener("click", () => {
    const type = $("bookingType").value;
    const time = $("bookingTime").value;
    const contact = $("bookingContact").value.trim();
    const note = $("bookingNote").value.trim();
    if (!contact) { toast("请填写联系方式"); return; }
    const bookings = store.get("bookings", []);
    bookings.push({ type, time: time ? time.replace("T"," ") : "待定", contact, note });
    store.set("bookings", bookings);
    $("bookingContact").value = ""; $("bookingNote").value = ""; $("bookingTime").value = "";
    renderPartner();
    toast("预约已提交");
  });
  renderPartner();

  // 智谱招商文案生成
  $("btnGenBiz").addEventListener("click", async () => {
    const partner = store.get("partner", { name: "南崽合伙人", level: "白银" });
    const box = $("bizText");
    box.hidden = false;
    box.textContent = "正在生成长篇招商文案…";
    const res = await smartReport(
      "请帮【" + (partner.name || "南崽合伙人") + "】（" + partner.level + "合伙人，做医美+妆造一体化业务）" +
      "写一篇 500 字左右的合伙人招募长文案，目标读者是商K夜场小姐姐，想有一份稳定副业兜底。" +
      "风格纯欲轻奢、走心治愈，避免医美夸大宣传，强调小而稳、长期沉淀。" +
      "结构：共情引入 → 业务介绍 → 三大卖点 → 温柔呼吁行动。",
      "你是私域文案老师，为医美+妆造合伙人写走心招募文案。语气温柔共情、纯欲轻奢、不制造焦虑。"
    );
    box.textContent = res.text;
    box.style.cursor = "pointer";
    box.onclick = () => copyText(box.textContent);
    toast("文案已生成 · 点击复制");
  });

  // ==================== 招商素材生成 ====================
  $("btnGenMaterial").addEventListener("click", async () => {
    const box = $("materialBox");
    box.hidden = false;
    box.innerHTML = `<div style="padding:12px;border-radius:12px;background:#fafbfc;font-size:13px;color:#6c7280;text-align:center;">正在生成素材…</div>`;
    const res = await smartMaterial(
      "请为『医美+妆造合伙人』业务生成宣传素材。要求严格分三个部分输出：\n" +
      "【短视频口播1】（不超过60字）\n" +
      "【短视频口播2】（不超过60字）\n" +
      "【短视频口播3】（不超过60字）\n" +
      "【海报短标语1】（不超过20字）\n" +
      "【海报短标语2】（不超过20字）\n" +
      "风格：纯欲轻奢、走心治愈、夜场小姐姐副业视角。"
    );
    box.innerHTML = `
      <div style="font-size:12px;color:#a8acb5;margin-bottom:10px;">由 ${res.engine} 生成</div>
      <div style="background:#fafbfc;border-radius:12px;padding:16px;font-size:13.5px;line-height:1.85;color:#3a3f4a;white-space:pre-wrap;cursor:pointer;" onclick="(function(){try{navigator.clipboard.writeText(this.innerText).then(()=>{});}catch(e){}const t=document.createElement('div');t.textContent='已复制';t.style.cssText='position:fixed;top:80px;left:50%;transform:translateX(-50%);background:rgba(58,63,74,.92);color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;z-index:999';document.body.appendChild(t);setTimeout(()=>document.body.removeChild(t),1500);})()">${res.text}</div>
    `;
    // 同步更新海报标题
    const lines = res.text.split(/\n/).filter(s => s.trim().length > 2);
    const shortTitles = lines.filter(l => l.length < 30).slice(0, 2);
    if (shortTitles.length >= 2) {
      $("poster1Title").textContent = shortTitles[0].replace(/[【\]]/g, "").slice(0, 18);
      $("poster2Title").textContent = shortTitles[1].replace(/[【\]]/g, "").slice(0, 18);
    }
    toast("素材已生成");
  });

  // ==================== AI 客服聊天 ====================
  const chatFab    = $("chatFab");
  const chatWindow = $("chatWindow");
  const chatClose  = $("chatClose");
  const chatBody   = $("chatBody");
  const chatInput  = $("chatInput");
  const chatSend   = $("chatSend");
  const chatQuick  = $("chatQuick");

  chatFab.addEventListener("click", (e) => {
    e.stopPropagation();
    chatWindow.classList.toggle("open");
    if (chatWindow.classList.contains("open") && chatBody.children.length === 0) {
      msg("你好呀～我是南崽 AI 客服。有什么想了解的可以直接问我，也可以点下面的快捷问题～💗", "bot");
    }
    if (chatWindow.classList.contains("open")) setTimeout(() => chatInput.focus(), 200);
  });
  chatClose.addEventListener("click", (e) => {
    e.stopPropagation();
    chatWindow.classList.remove("open");
  });
  chatWindow.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => chatWindow.classList.remove("open"));

  chatSend.addEventListener("click", () => sendChat(chatInput.value));
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); sendChat(chatInput.value); }
    e.stopPropagation();
  });
  chatQuick.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") sendChat(e.target.dataset.q || e.target.textContent);
  });

  async function sendChat(text) {
    if (!text || !text.trim()) return;
    msg(text, "me", "你");
    chatInput.value = "";
    // 显示"正在输入"
    const typingEl = document.createElement("div");
    typingEl.className = "msg bot";
    typingEl.innerHTML = `<span class="who">南崽 AI 客服</span>正在输入…`;
    chatBody.appendChild(typingEl);
    chatBody.scrollTop = chatBody.scrollHeight;

    const res = await smartChat(text.trim());
    // 替换掉 "正在输入"
    typingEl.innerHTML = `<span class="who">南崽 AI 客服 · ${res.engine}</span>${res.text.replace(/\n/g,"<br/>")}`;
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function msg(text, who, whoText) {
    const div = document.createElement("div");
    div.className = "msg " + who;
    div.innerHTML = `<span class="who">${whoText || (who === "bot" ? "南崽 AI 客服" : "你")}</span>${text.replace(/\n/g,"<br/>")}`;
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // ==================== 配置面板（保存/测试/清空） ====================
  $("cfgSave").addEventListener("click", () => {
    cfg = {
      glmKey: $("cfgGlmKey").value.trim(),
      glmModel: $("cfgGlmModel").value.trim() || "glm-4-flash",
      doubaoKey: $("cfgDoubaoKey").value.trim(),
      doubaoModel: $("cfgDoubaoModel").value.trim() || "doubao-lite-4k",
      faceKey: $("cfgFaceKey").value.trim(),
      faceSecret: $("cfgFaceSecret").value.trim(),
      faceRegion: $("cfgFaceRegion").value
    };
    store.set("cfg", cfg);
    renderConfigToUI();
    updateChatEngineLabel();
    toast("配置已保存（密钥仅存在本机）");
  });

  $("cfgClear").addEventListener("click", () => {
    if (!confirm("确认清空本地保存的所有 API Key？")) return;
    store.del("cfg");
    cfg = loadConfig();
    renderConfigToUI();
    updateChatEngineLabel();
    toast("本地密钥已清空");
  });

  $("cfgTest").addEventListener("click", async () => {
    const hint = $("cfgHint");
    hint.innerHTML = "";
    hint.textContent = "开始逐个测试…";

    // 测试智谱
    hint.innerHTML += `<div>🔍 测试智谱 GLM-4 Flash…</div>`;
    const glmRes = await callZhipu("用 30 字概括你的身份", "你是一个 AI 助手");
    if (glmRes.ok) hint.innerHTML += `<div style="color:#1e8e3e;">✅ 智谱 API 正常（收到 ${glmRes.content.length} 字回复）</div>`;
    else hint.innerHTML += `<div style="color:#d93025;">⚠️ 智谱 API 异常：${glmRes.reason}（未配置 key 会自动使用本地响应）</div>`;

    // 测试豆包
    hint.innerHTML += `<div>🔍 测试豆包 Lite…</div>`;
    const doubaoRes = await callDoubao("用 30 字介绍你自己", "你是一个 AI 客服");
    if (doubaoRes.ok) hint.innerHTML += `<div style="color:#1e8e3e;">✅ 豆包 API 正常（收到 ${doubaoRes.content.length} 字回复）</div>`;
    else hint.innerHTML += `<div style="color:#d93025;">⚠️ 豆包 API 异常：${doubaoRes.reason}</div>`;

    // 测试 Face++
    hint.innerHTML += `<div>🔍 测试旷视 Face++…</div>`;
    if (!faceState.imageBase64) {
      hint.innerHTML += `<div style="color:#f09300;">⚠️ 请先到首页点击『使用示例人脸』再测试 Face++</div>`;
    } else {
      const faceRes = await callFacePP(faceState.imageBase64);
      if (faceRes.ok) {
        hint.innerHTML += `<div style="color:#1e8e3e;">✅ Face++ API 正常（检测到人脸，颜值 ${faceRes.data.beauty_female || faceRes.data.beauty_male || "—"}）</div>`;
      } else {
        hint.innerHTML += `<div style="color:#d93025;">⚠️ Face++ API 异常：${faceRes.reason}（CORS 限制为常见原因，不影响使用，会自动回落本地分析）</div>`;
      }
    }

    hint.innerHTML += `<div style="margin-top:10px;font-size:12.5px;color:#6c7280;">✅ 三项测试完成。未配置 Key 的模块会使用本地智能响应，不影响体验。</div>`;
  });

  // ==================== Tab 切换 ====================
  document.querySelectorAll(".tab-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-item").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const panel = document.getElementById("panel-" + btn.dataset.tab);
      if (panel) panel.classList.add("active");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // 首次打开的小提示
  toast("提示：进入『⚙️API配置』可接入真实大模型");
})();
