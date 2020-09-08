import React, {Component} from 'react';
import {findDOMNode} from 'react-dom';
import {Table, Tag} from 'antd';

import {labelNormalColorMap} from '../../utils/Color';


export default class DataTable extends Component {

    constructor(props) {
        super(props);

        /**
         * construct the data source and columns
         */

        const {dataVectors, label, labelNames} = props;
        const lenData = dataVectors.length;

        let dataSource = dataVectors.map((v, i) => ({
            id: i,
            label: label[i],
        }));

        this.state = {
            dataSource: dataSource,
            columns: [{
                title: 'ID',
                dataIndex: 'id',
                key: 'id',
                width: '30%'
            }, {
                title: 'Label',
                dataIndex: 'label',
                key: 'label',
                render: labelIdx => (
                    <span><Tag color={labelNormalColorMap[labelIdx]}>{labelNames[labelIdx]}</Tag></span>
                ),
                width: '70%'
            }]
        }
    }

    render() {

        return (
            <div style={{width: '100%', height: '100%'}}>
                <Table
                    rowKey='id'
                    dataSource={this.state.dataSource}
                    columns={this.state.columns}
                    size="small"
                    bordered={true}
                    scroll={{y: this.props.scrollY}}
                    pagination={{
                        defaultPageSize: 100,
                        position: 'bottom',
                        showQuickJumper: true,
                        size: 'small',
                        simple: true
                    }}
                />
            </div>
        );
    }

}