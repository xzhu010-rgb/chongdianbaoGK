import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      componentSize="middle"
      theme={{
        token: {
          colorPrimary: '#087AFF',
          colorInfo: '#087AFF',
          colorText: '#17325E',
          colorTextSecondary: '#6D7F9C',
          colorBgLayout: '#F5F8FD',
          colorBorder: '#E1E8F4',
          borderRadius: 10,
          controlHeight: 40,
          fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
        },
        components: {
          Button: { borderRadius: 9 },
          Card: { borderRadiusLG: 13 },
          Input: { borderRadius: 10 },
          Select: { borderRadius: 10 },
          Modal: { borderRadiusLG: 16 },
        },
      }}
    >
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
)
