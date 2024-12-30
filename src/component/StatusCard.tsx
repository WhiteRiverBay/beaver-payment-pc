import { Badge } from "evergreen-ui"
import React from "react"

interface StatusCardProps {
    title: string
    value: string
}

class StatusCard extends React.Component<StatusCardProps> {
    render() {
        return (
            <div className="border padding-md border-radius-md margin-top-md">
                <div className="text-sm text-gray-500">{this.props.title}</div>
                <div className="flex items-center gap-md">
                    <div className="text-lg">
                        <Badge color={
                            this.props.value === 'RUNNING' ? 'green' : 'red'
                        } marginRight={8}>
                            {this.props.value}
                        </Badge>
                    </div>
                </div>
            </div>
        )
    }
}

export default StatusCard