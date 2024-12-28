import React from 'react'
import { Pane } from 'evergreen-ui'

// Data card, with a title, and a value, and a unit, color can be passed as a prop
interface DataCardProps {
    title: string;
    value: string | number;
    unit?: string;
    color?: string;
}

class DataCard extends React.Component<DataCardProps> {
    render() {
        return (
            <Pane className="border padding-md border-radius-md margin-top-md width-100">
                <div className="text-sm text-gray-500">{this.props.title}</div>
                <div className="flex items-center gap-md">
                    <div className="text-lg" style={{ color: this.props.color }}>
                        {this.props.value}
                    </div>
                    {this.props.unit && (
                        <div className="text-sm text-gray-500">
                            {this.props.unit}
                        </div>
                    )}
                </div>
            </Pane>
        )
    }
}

export default DataCard