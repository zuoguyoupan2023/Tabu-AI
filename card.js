// ========== TabU AI 卡片渲染服务（CardRenderer） ==========
// 把文本渲染成一张"优雅卡片"（圆角 / 标题 / 排版），导出 PNG dataURL。
// 这是底层共享服务：阶段二会被收进 capabilities 注册表，阶段三红层卡片面板直接复用。
// 渲染模型与 sidepanel.html 的 .elegant-card 预览保持一致（所见即所得）：
//   卡片自带内容边距 basePad；"文本框边距"在正文外再包一层；"文本框位置"水平平移正文。
const CardRenderer = (function () {
  'use strict';

  const DEFAULT_FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';

  // 按字符测量宽度换行（中英文混排通用；\n 强制换行）
  function wrapText(ctx, text, maxWidth) {
    const lines = [];
    const paragraphs = String(text || '').split('\n');
    for (const para of paragraphs) {
      if (!para) { lines.push(''); continue; }
      let line = '';
      for (const ch of para) {
        const test = line + ch;
        if (line && ctx.measureText(test).width > maxWidth) {
          lines.push(line);
          line = ch;
        } else {
          line = test;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  function roundedRectPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  /**
   * 渲染卡片，返回 { canvas, dataURL, width, height }
   * options:
   *   width     卡片宽度（逻辑像素）
   *   bgColor   卡片背景色
   *   textColor 文本颜色
   *   radius    卡片圆角
   *   padding   文本框边距（正文内容相对卡片内边距再外扩一层）
   *   pos       文本框水平位置偏移（负左正右）
   *   fontFamily 正文字体
   *   title     卡片标题
   *   titleFontFamily 标题字体（底部居右、小字号，默认芫荽 Iansui）
   */
  function render(text, options = {}) {
    const {
      width = 800,
      ratio = '16:9',
      bgColor = '#f6f5f2',      // 默认浅白（非纯白）
      textColor = '#1a1a1a',    // 默认深黑（非纯黑）
      radius = 8,
      padding = 18,
      pos = 0,          // 兼容旧参数：未传 posX 时当作 posX
      posX,
      posY = 0,
      fontSize = 60,    // 正文字号（逻辑像素）
      fontFamily,
      title = I18N.t('cardTitle'),
      titleFontFamily
    } = options;
    // 文本框水平/垂直偏移（逻辑像素，独立于内容缩放）
    const pX = (posX != null ? posX : pos) || 0;
    const pY = posY || 0;
    // 空字体串会导致 ctx.font 非法（浏览器忽略赋值），回退到系统字体栈
    const family = (fontFamily && String(fontFamily).trim()) || DEFAULT_FONT;
    // 卡片标题：底部居右、小字号、芫荽（Iansui），调用方传入 titleFontFamily 时覆盖
    const titleFamily = (titleFontFamily && String(titleFontFamily).trim()) || '"Iansui"';
    // 标题字号随卡片宽度联动（clamp 9~20），避免过小卡标题过大、过大卡标题过小
    const titleSize = Math.round(Math.max(9, Math.min(20, width / 62)));
    const titlePadRight = Math.max(10, Math.round(width / 55));  // 标题右侧留白（往左让一点，随宽度微调）
    const titlePadBottom = 12;  // 标题底部留白（往上升一点，不贴角落）
    const titleStrip = 21;      // 固定比例时底部为标题预留的条带（间隙 8 + 行高 13）

    const basePad = 16;      // 卡片自身内容边距（与 .elegant-card 的 padding 对齐）
    const padBottom = 16;    // 卡片底部留白
    const lineHeight = fontSize * 1.7;

    // 导出分辨率：3x 起（为高 DPI 屏 / 放大 / 打印留足清晰度）。
    // 说明：canvas 文本只能用灰度抗锯齿（grayscale AA），而页面 CSS 预览可用次像素（subpixel/LCD）抗锯齿，
    // 因此导出的 PNG 字迹天生比预览略柔，小字号更明显；这不是坐标或分辨率数字错误，靠更高像素密度兜底。
    const scale = Math.max(3, Math.min(4, Math.round(window.devicePixelRatio || 2)));
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    // 把逻辑坐标对齐到设备像素网格：避免文本画在小数坐标上导致字迹发虚
    const align = (v) => Math.round(v * scale) / scale;

    // 文本区域（受 padding 外扩影响；pX 水平偏移）
    const innerWidth = width - (basePad + padding) * 2;
    const textX = align(basePad + padding + pX);

    // 先按内容算自然高度：正文框（padding 外扩）→ 底部留白（标题覆盖在底部留白区）
    ctx.font = `${fontSize}px ${family}`;
    const textLines = wrapText(ctx, text, innerWidth);
    const textHeight = Math.max(textLines.length, 1) * lineHeight;
    const contentNatH = padding + textHeight;

    // 卡片比例：auto → 高度随内容；固定比例 → 宽高锁定，正文按用户所选字号排版（过长裁切），块内居中
    const RATIOS = { '1:1': 1, '2:3': 3 / 2, '3:2': 2 / 3, '4:3': 3 / 4, '16:9': 9 / 16, '9:16': 16 / 9 };
    const ratioH = RATIOS[ratio];
    const fixedH = ratioH ? Math.round(width * ratioH) : 0;
    const fixed = ratioH > 0 && fixedH > 0;

    // 正文字号完全由用户控制：固定比例下不再自动缩放正文（尊重用户选择的字号）；
    // 文本过长时按卡片边界裁切（WYSIWYG，与预览一致）；「自动」比例则高度随内容增长。
    const contentScale = 1;
    let cardH;
    if (fixed) {
      cardH = fixedH;
    } else {
      cardH = basePad + contentNatH + padBottom;
    }

    const sFontSize = fontSize * contentScale;
    const sLineHeight = lineHeight * contentScale;

    // 宽高必须一起设置（高度缺省会保持 150px，导致内容被裁、导出成宽扁图）
    canvas.width = width * scale;
    canvas.height = Math.round(cardH * scale);
    ctx.scale(scale, scale);
    ctx.textBaseline = 'alphabetic';

    // 1) 圆角背景
    ctx.save();
    roundedRectPath(ctx, 0, 0, width, cardH, radius);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.clip();

    // 正文块起始 y：auto → 顶对齐；固定比例 → 在「卡高 − 底部标题条」区域内垂直居中（放不下则顶对齐、底部裁切；对齐设备像素防发虚）
    const regionH = fixed ? (cardH - basePad - padBottom - titleStrip) : 0;
    const scaledBlockH = padding + textHeight * contentScale;
    const contentTop = align(fixed
      ? (basePad + Math.max(0, regionH - scaledBlockH) / 2)
      : basePad);

    // 2) 正文（自动换行；字号即用户所选，固定比例下不做等比缩放，过长按卡边界裁切 → 与预览一致）
    //    pY 垂直偏移整块正文
    ctx.font = `${sFontSize}px ${family}`;
    ctx.fillStyle = textColor;
    let y = align(contentTop + padding + sFontSize + pY);
    for (const line of textLines) {
      ctx.fillText(line, textX, y);
      y = align(y + sLineHeight);
    }

    // 3) 标题：卡片底部居右、小字号、芫荽字体（覆盖在底部留白区，与 .ec-title 预览一致）
    ctx.font = `400 ${titleSize}px ${titleFamily}`;
    ctx.textAlign = 'right';
    ctx.globalAlpha = 0.85;
    ctx.fillText(title, width - titlePadRight, align(cardH - titlePadBottom - 2));
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;

    ctx.restore();

    return {
      canvas,
      dataURL: canvas.toDataURL('image/png'),
      width,
      height: cardH
    };
  }

  // ========== 字体加载（卡片字体库用） ==========
  // font 为 card-fonts.json 里的一条：{ family, cssUrl?, woff2Url? }
  //   cssUrl 路由（多为中文多字重）：注入 <link rel=stylesheet>，再 document.fonts.load 确保就绪
  //   woff2Url 路由（单字重/可变字体，数字 id 无 result.css）：直接 FontFace 注册，family 可控
  // 幂等：同一 cssUrl / family 只注入/注册一次；失败静默回退系统字体。
  const _fontLinks = new Set();   // 已注入的 cssUrl
  const _fontFaces = new Map();   // family -> 已注册 FontFace（或 true 标记 css 路由加载过）

  async function loadFont(font) {
    if (!font || !font.family) return;
    const family = String(font.family).trim();
    if (!family || _fontFaces.has(family)) return;
    try {
      if (font.cssUrl && !font.woff2Url) {
        if (!_fontLinks.has(font.cssUrl)) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = font.cssUrl;
          document.head.appendChild(link);
          _fontLinks.add(font.cssUrl);
        }
        await document.fonts.load(`16px "${family}"`);
        _fontFaces.set(family, true);
      } else if (font.woff2Url) {
        const face = new FontFace(family, `url("${font.woff2Url}")`);
        await face.load();
        document.fonts.add(face);
        _fontFaces.set(family, face);
      }
    } catch (e) {
      // 字体加载失败：预览/导出自动回退系统字体，不阻塞
    }
  }

  return { render, loadFont };
})();
