# GK充电宝 React 前端迁移版

根目录的 `../index.html` 是现有可点击原型，暂时保留不改；`legacy/index.html` 是迁移时的固定参考副本。

## 本地运行

```bash
npm ci
npm run dev
```

默认访问 `http://localhost:4174`。

## 回答 API 和追问推荐 API

Vite 开发服务器提供两个同源代理：`POST /api/chat` 使用 GK+ API 生成回答；`POST /api/suggestions` 使用独立的 OpenAI 兼容 API，根据当前问题和回答生成三个追问。两组 API 密钥和模型配置仅由 Node 服务端读取，不会打进浏览器代码。

首次运行时，在本目录复制 `.env.example` 为 `.env.local`，分别填写 GK+ 和追问推荐服务的凭证及模型名称：

```dotenv
GK_API_KEY=你的GK_API密钥
GK_APP_ID=你的GK应用ID
GK_API_URL=https://huagpt.meta-stone.net/api/v1/chat/completions

FOLLOWUP_API_KEY=你的追问推荐API密钥
FOLLOWUP_API_MODEL=服务商提供的模型名称
FOLLOWUP_API_BASE_URL=http://223.108.218.44:54001/v1
```

保存后重启 `npm run dev`。`.env.local` 已被 Git 忽略，不要提交密钥。追问推荐服务未配置或请求失败时，界面会显示内置的相关问题。

## 迁移约定

- 页面状态放在 React 组件中，不再通过全局 DOM 查询修改页面。
- 前端 API 请求集中放在 `src/services/api.ts`，只访问同源 `/api/chat` 和 `/api/suggestions`。
- 两个 API 代理仅在本地 Vite 开发服务器运行；正式部署时需要配置等效的服务端接口。
- API Key 和 App ID 只由服务端读取，不能写入 `VITE_*` 前端变量。
