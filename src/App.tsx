import { Pane, Tab, Tablist, majorScale, Dialog, TextInputField } from 'evergreen-ui'
import { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import Wallets from './pages/Wallets'
import Settings from './pages/Settings'
import Server from './pages/Server'
import Orders from './pages/Orders'
import Airdrop from './pages/Airdrop'
import Collect from './pages/Collect'
const tabs = ['Dashboard', 'Wallets', 'Airdrop Gas', 'Collect Token', 'Server', 'Transactions', 'Settings']

export default function App() {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showSetupDialog, setShowSetupDialog] = useState(false)
  const [serverUrl, setServerUrl] = useState('')
  const [apiToken, setApiToken] = useState('')

  useEffect(() => {
    // 检查 localStorage 中是否存在必要的配置
    const storedServerUrl = localStorage.getItem('serverUrl')
    const storedApiToken = localStorage.getItem('apiToken')
    
    // 设置已存在的值
    if (storedServerUrl) setServerUrl(storedServerUrl)
    if (storedApiToken) setApiToken(storedApiToken)
    
    // 如果有任一值不存在，显示对话框
    if (!storedServerUrl || !storedApiToken) {
      setShowSetupDialog(true)
    }
  }, [])

  const handleSetupSubmit = () => {
    if (serverUrl && apiToken) {
      // 去掉 URL 末尾的斜杠后保存
      const trimmedUrl = serverUrl.replace(/\/+$/, '')
      localStorage.setItem('serverUrl', trimmedUrl)
      localStorage.setItem('apiToken', apiToken)
      setShowSetupDialog(false)
      // 刷新页面
      window.location.reload()
    }
  }

  const renderTabContent = () => {
    switch (selectedIndex) {
      case 0:
        return <Dashboard />
      case 1:
        return <Wallets />
      case 2:
        return <Airdrop />
      case 3:
        return <Collect />
      case 4:
        return <Server />
      case 5:
        return <Orders />
      case 6:
        return <Settings />
      default:
        return <Dashboard />
    }
  }

  return (
    <>
      <Dialog
        isShown={showSetupDialog}
        title="Initial Setup Required"
        hasClose={false}
        hasCancel={false}
        confirmLabel="Save"
        onConfirm={handleSetupSubmit}
        shouldCloseOnOverlayClick={false}
        preventBodyScrolling
      >
        <TextInputField
          label="Server URL"
          placeholder="Enter server URL"
          type="url"
          value={serverUrl}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServerUrl(e.target.value)}
          required
        />
        <TextInputField
          label="API Token"
          placeholder="Enter API token"
          value={apiToken}
          type="password"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiToken(e.target.value)}
          required
        />
      </Dialog>

      <Pane display="flex" height="100vh" width="100vw" background="white">
        {/* 侧边菜单 */}
        <Pane
          width={200}
          height="100%"
          background="tint2"
          borderRight
          padding={majorScale(2)}
          flexShrink={0}
        >
          <Tablist flexDirection="column" marginRight={24}>
            {tabs.map((tab, index) => (
              <Tab
                key={tab}
                id={tab}
                onSelect={() => setSelectedIndex(index)}
                isSelected={index === selectedIndex}
                aria-controls={`panel-${tab}`}
                direction="vertical"
                height={48}
              >
                {tab}
              </Tab>
            ))}
          </Tablist>
        </Pane>

        {/* 内容区域 */}
        <Pane flex={1} padding={majorScale(2)} background="white" width="100%">
          {renderTabContent()}
        </Pane>
      </Pane>
    </>
  )
}
