# GK充电宝 React 前端迁移版

根目录的 `../index.html` 是现有可点击原型，暂时保留不改；`legacy/index.html` 是迁移时的固定参考副本。

## 本地运行

```bash
npm ci
npm run dev
```

默认访问 `http://localhost:4174`。

## GK+ FastGPT 本地接口

Vite 开发服务器提供同源 `POST /api/chat` 代理。它在 Node 服务端读取 `GK_API_KEY`、`GK_APP_ID`、`GK_API_URL`，再请求 FastGPT；这些配置不会打进浏览器代码。

首次运行时，在本目录复制 `.env.example` 为 `.env.local`，填入 GK+ API Key、App ID 和 API 地址。例如：

```dotenv
GK_API_KEY=你的API密钥
GK_APP_ID=你的应用ID
GK_API_URL=http://223.108.218.44:53001/api/v1/chat/completions
```

保存后重启 `npm run dev`。`.env.local` 已被 Git 忽略，不要提交密钥。

## 迁移约定

- 页面状态放在 React 组件中，不再通过全局 DOM 查询修改页面。
- 前端 API 请求集中放在 `src/services/api.ts`，只访问同源 `/api/chat`。
- FastGPT 请求代理仅在本地 Vite 开发服务器运行；正式部署时需要配置等效的服务端接口。
- API Key 和 App ID 只由服务端读取，不能写入 `VITE_*` 前端变量。
