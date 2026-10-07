# TabU AI

> 智能标签页管家 · 阅读增强 · Chrome 扩展 (MV3)

快照回溯 · 全局搜索 · 划词词典 · 翻译朗读 · AI 对话 · 终端桥接

## 功能概览

### 🔴 红层 · 高频工具

| 功能 | 说明 |
|------|------|
| 划词即显 | 选中词/句即出浮层：离线词典（内置 5 万高频词，全量 77 万词按需云端拉取）、翻译（MyMemory → Google → 当前 LLM 渠道三级兜底）、AI 一句话详解、真人发音；支持 iframe 页面、浮层内直接切换目标语言 |
| 朗读 / 翻译 | 选中文本即读即译，支持多语言；TTS 多引擎（系统 / 本地 Kokoro、Qwen3 / 云端 / Azure / CosyVoice），每个朗读场景可单独指定音色 |
| AI 对话 | 侧边栏内直接对话，三渠道任选：**API**（自配 OpenAI 兼容 / Anthropic 渠道，流式 + 多轮）、**本地**（localhost OpenAI 兼容端口）、**页面注入**（驱动已登录的 ChatGPT / Kimi / DeepSeek 等网页）；支持思考模式展示与关联页面全文上下文 |
| 语音工作台 | 录音 → 识别（浏览器内置 / Azure / OpenAI Whisper / 阿里云 / 本地服务）→ AI 问答 → 朗读，一条闭环 |
| 注入输入 | 聚焦网页输入框时浮现发送按钮，一键将内容发到 AI 页面 |
| 标签快照 | 一键保存当前标签状态，随时回溯 |
| 去重标签 | 检测并关闭重复标签 |
| 全局搜索 | 跨标签、书签、历史记录搜索 |
| 摘录卡片 | 将文本制作为精美卡片（字体 / 配色可选，可导出 PNG） |

### 🔵 蓝层 · 低频回溯

| 功能 | 说明 |
|------|------|
| 六个折叠分区 | 快速设置 / AI 能力中心 / 卡片工具 / 历史与日志 / 数据与备份 / 关于；粘性导航 + 设置搜索（中英过滤） |
| 站点健康 | 浏览器免费 AI 四站（DeepSeek / Kimi / Claude / ChatGPT）状态一览 + 手动刷新 |
| 截图 / 打印 / 邮件导出 | 页面内容多种导出方式 |
| 导入 / 导出备份 | 数据备份与恢复 |
| 定时保存快照 | 自动定期保存标签状态 |
| 设置 / 统计 / 数据管理 | 版本保留数配置、数据清理 |

### 🔌 本地 AI 服务 (TabU AI Bridge)

把浏览器里已登录的免费 AI 网页（ChatGPT / Kimi / DeepSeek 等）变成一个**本地 AI 服务端口**——类似 Ollama 的 `11434`，但后端是网页版 AI，不花 API 钱。终端工具和桌面/网页应用都能接：

```
终端工具 / Chatbox / CherryStudio / OpenSound 等应用
    → HTTP(Anthropic 或 OpenAI 协议) → bridge-server → WebSocket → Chrome 扩展 → AI 页面 → 流式原路返回
```

| 客户端 | 接入方式 |
|--------|---------|
| Claude Code / Cursor | `ANTHROPIC_BASE_URL=http://127.0.0.1:11434`，`ANTHROPIC_API_KEY=<token>` |
| Chatbox / CherryStudio / LobeChat | OpenAI 兼容提供商：`API Host=http://127.0.0.1:11434/v1`，API Key 填 token，模型名随意 |
| 网页应用（如 OpenSound） | 同上直接 fetch；网页 Origin 需在白名单（默认放行 `opensound.world`、`world.opensound.local` 与 localhost，可在扩展设置页自行添加） |

- **多站故障转移**：请求站点失败时按 `deepseek → kimi → claude → chatgpt`（国内可达优先）自动换站重试，响应带 `tabu_via_site`（实际服务站点）与 `tabu_failover`（失败腿明细）；
- **附件与指定站点**：OpenAI 协议请求可带 `tabu_site`（指定站点）与 `images`（≤6 项 base64 附件，PDF/图片均可）；
- **端口防冲突**：默认 `11434`，被占用（如 Ollama 正在跑）时自动顺延 `11435/11436/…`，扩展设置页会显示实际地址；也可用 `TABU_BRIDGE_EXTRA_ORIGINS`、`TABU_BRIDGE_HTTP_PORT` 等环境变量控制；
- **真流式**：回复过程中增量实时转发为 SSE，不再是等完再假装分块；
- **多轮上下文**：messages 数组中的历史对话会拼进注入问题（system 提示词不转发）；
- **诊断端点**：`GET /`（服务自述）、`POST /v0/diag/health`（站点健康快照）、`POST /v0/diag/probe`（站点能力探测）。

> ⚠️ 桥接驱动的是你**已登录的个人 AI 账号**，注意各站点 ToS 风险，建议低频个人使用。

## 安装

### Chrome 扩展

1. 打开 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目根目录（或 `npm run pack` 产出的 `dist/tabu-ai-<version>/`）

### 终端桥接（可选）

```bash
npm install
npm run bridge
```

首次运行会自动生成 Token 并打印，按提示配置即可（详见 `options.html` 中的说明，以及桥接启动横幅打印的接入命令）。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+S` / `Cmd+Shift+S` | 打开/关闭侧边栏 |

## 技术栈

- Chrome Extension Manifest V3
- 纯原生 JavaScript（无框架依赖）
- Node.js WebSocket 桥接服务（依赖 `ws`）

## 项目结构

```
Tabu-AI/
├── background.js          # Service Worker：核心逻辑、AI 注入、站点健康/故障转移、桥接客户端
├── sidepanel.html/js/css  # 侧边栏 UI（红区主面板 + 蓝区折叠设置）
├── capabilities.js        # AI 能力封装（注入调用、API/本地流式调用、翻译链）
├── ai-api.js              # 自定义 AI API 适配层（供应商预设 / SSE 解析 / CSP 双路径）
├── content/
│   ├── input-inject.js    # 注入输入工具（浮动发送按钮）
│   ├── selection.js       # 选区状态追踪
│   └── instant-dict.js    # 划词即显浮层（词典 / 翻译 / AI 详解 / 发音）
├── tts-voices.js          # 系统音色枚举（页面上下文）
├── bridge/
│   ├── server.js          # 终端桥接服务（Node.js）
│   └── test.mjs           # 桥接回归测试（npm run test:bridge）
├── card.js                # 摘录卡片生成
├── i18n.js                # 国际化（中文/英文）
├── options.html/js        # 管理设置页
├── welcome.html/js        # 首次安装引导
├── data/                  # 离线词典数据（ECDICT 子集；全量词典走 CDN 按需拉取）
└── manifest.json          # MV3 清单文件
```

## 开发

```bash
npm run bridge       # 启动终端桥接服务
npm run test:bridge  # 桥接回归测试（双协议/流式/CORS/认证/端口顺延等 20 项）
npm run pack         # 打包扩展 → dist/tabu-ai-<version>/ 与 .zip
npm run build:dict   # 重建离线词典数据（ECDICT 子集 / 全量桶）
```

## 数据安全

所有数据仅保存在浏览器本地（IndexedDB + chrome.storage），不会上传到任何服务器。API Key、桥接 Token 等敏感配置同样只存本机。
