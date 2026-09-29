# TabU AI

> 智能标签页管家 · Chrome 扩展 (MV3)

一键快照 · 版本回溯 · 全局搜索 · AI 注入 · 终端桥接

## 功能概览

### 🔴 红层 · 高频工具

| 功能 | 说明 |
|------|------|
| 朗读 / 翻译 | 选中文本即读即译，支持多语言 |
| AI 对话 | 侧边栏内直接与 ChatGPT / Claude / Kimi / DeepSeek 对话 |
| 注入输入 | 聚焦网页输入框时浮现发送按钮，一键将内容发到 AI 页面 |
| 标签快照 | 一键保存当前标签状态，随时回溯 |
| 去重标签 | 检测并关闭重复标签 |
| 全局搜索 | 跨标签、书签、历史记录搜索 |
| 摘录卡片 | 将文本制作为精美卡片 |

### 🔵 蓝层 · 低频回溯

| 功能 | 说明 |
|------|------|
| 截图 / 打印 / 邮件导出 | 页面内容多种导出方式 |
| 导入 / 导出备份 | 数据备份与恢复 |
| 定时保存快照 | 自动定期保存标签状态 |
| 设置 / 统计 / 数据管理 | 版本保留数配置、数据清理 |

### 🔌 本地 AI 服务 (TabU AI Bridge)

把浏览器里已登录的免费 AI 网页（ChatGPT 等）变成一个**本地 AI 服务端口**——类似 Ollama 的 `11434`，但后端是网页版 AI，不花 API 钱。终端工具和桌面/网页应用都能接：

```
终端工具 / Chatbox / CherryStudio / OpenSound 等应用
    → HTTP(Anthropic 或 OpenAI 协议) → bridge-server → WebSocket → Chrome 扩展 → ChatGPT 页面 → 流式原路返回
```

| 客户端 | 接入方式 |
|--------|---------|
| Claude Code / Cursor | `ANTHROPIC_BASE_URL=http://127.0.0.1:11434`，`ANTHROPIC_API_KEY=<token>` |
| Chatbox / CherryStudio / LobeChat | OpenAI 兼容提供商：`API Host=http://127.0.0.1:11434/v1`，API Key 填 token，模型名随意 |
| 网页应用（如 OpenSound） | 同上直接 fetch；网页 Origin 需在白名单（默认放行 `opensound.world`、`world.opensound.local` 与 localhost，可在扩展设置页自行添加） |

- **端口防冲突**：默认 `11434`，被占用（如 Ollama 正在跑）时自动顺延 `11435/11436/…`，扩展设置页会显示实际地址；也可用 `TABU_BRIDGE_EXTRA_ORIGINS`、`TABU_BRIDGE_HTTP_PORT` 等环境变量控制。
- **真流式**：ChatGPT 回复过程中增量实时转发为 SSE，不再是等完再假装分块。
- **多轮上下文**：messages 数组中的历史对话会拼进注入问题（system 提示词不转发）。

详见 `003-bridge-v2.md`。

## 安装

### Chrome 扩展

1. 打开 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目根目录

### 终端桥接（可选）

```bash
npm install
npm run bridge
```

首次运行会自动生成 Token 并打印，按提示配置即可。详见 `options.html` 中的说明。

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
├── background.js          # Service Worker：核心逻辑、AI 注入、桥接客户端
├── sidepanel.html/js/css  # 侧边栏 UI
├── capabilities.js        # AI 能力封装（注入调用、API 流式调用）
├── ai-api.js              # 自定义 AI API 适配层
├── content/
│   ├── input-inject.js    # 注入输入工具（浮动发送按钮）
│   └── selection.js       # 选区状态追踪
├── bridge/
│   └── server.js          # 终端桥接服务（Node.js）
├── card.js                # 摘录卡片生成
├── i18n.js                # 国际化（中文/英文）
├── options.html/js        # 管理设置页
├── welcome.html/js        # 首次安装引导
└── manifest.json          # MV3 清单文件
```

## 数据安全

所有数据仅保存在浏览器本地（IndexedDB + chrome.storage），不会上传到任何服务器。
