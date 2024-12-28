import { Pane, Button } from 'evergreen-ui'

export default function Backup() {
  return (
    <Pane>
      <Button intent="success" marginRight={10}>Backup Local Database</Button>
      <Button intent='success' marginRight={10}>Backup Remote Database</Button>
      <Button>Settings...</Button>
    </Pane>
  )
} 