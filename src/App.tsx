import { Pane, Tab, Tablist, majorScale } from 'evergreen-ui'
import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Wallets from './pages/Wallets'
import Settings from './pages/Settings'
import Server from './pages/Server'
import Orders from './pages/Orders'

const tabs = ['Dashboard', 'Wallets', 'Server', 'Orders', 'Settings']

export default function App() {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const renderTabContent = () => {
    switch (selectedIndex) {
      case 0:
        return <Dashboard />
      case 1:
        return <Wallets />
      case 2:
        return <Server />
      case 3:
        return <Orders />
      case 4:
        return <Settings />
      default:
        return <Dashboard />
    }
  }

  return (
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
  )
}
