import React, {Component} from 'react';
import {Table} from 'antd';

import '../styles/dimtable.css';
import onepxBar from '../images/1pxblue.png';


export default class DimTable extends Component {
    constructor(props) {
        super(props);

        this.state = {
            columns: [{
                title: 'Name',
                dataIndex: 'name',
                key: 'name',
                // className: 'dim-table-column',
                width: '24%',
                align: 'center'
            }, {
                title: 'Sep.',
                dataIndex: 'x',
                key: 'x',
                render: (x) => (
                    <div style={{
                        float: 'left',

                        width: '100%',
                        height: '100%',
                        background: 'url(' + onepxBar + ')',
                        backgroundSize: (Math.abs(x) * 100) + '% 8px',
                        backgroundRepeat: 'no-repeat',
                        borderRadius: 2,
                        paddingTop: 8
                    }}>
                        <span>{x}</span>
                    </div>
                ),
                // className: 'dim-table-column',
                width: '38%',
                sorter: (x1, x2) => Math.abs(x1.x) - Math.abs(x2.x),
                sortDirections: ['descend', 'ascend']
            }, {

                title: 'Var.',
                dataIndex: 'y',
                key: 'y',
                render: (y) => (
                    <div style={{
                        float: 'left',

                        width: '100%',
                        height: '100%',
                        background: 'url(' + onepxBar + ')',
                        backgroundSize: (Math.abs(y) * 100) + '% 8px',
                        backgroundRepeat: 'no-repeat',
                        borderRadius: 2,
                        paddingTop: 8
                    }}>
                        <span>{y}</span>
                    </div>
                ),
                // className: 'dim-table-column',
                width: '38%',
                sorter: (x1, x2) => Math.abs(x1.y) - Math.abs(x2.y),
                sortDirections: ['descend', 'ascend']
            }
            // , {
            //     title: 'Weight',
            //     dataIndex: 'weight',
            //     key: 'weight',
            //     render: (w) => (
            //         <div style={{
            //             float: 'left',
            //             width: '100%',
            //             height: '100%',
            //             background: 'url(' + onepxBar + ')',
            //             backgroundSize: (Math.abs(w) * 100) + '% 8px',
            //             backgroundRepeat: 'no-repeat',
            //             borderRadius: 2,
            //             paddingTop: 8
            //         }}>
            //             <span>{w}</span>
            //         </div>
            //     ),
            //     width: '60%',
            //     sorter: (w1, w2) => w1['weight'] - w2['weight'],
            //     sortOrder: 'descend'
            // }
            ]
        }
    }

    render() {

        // Update data format
        const dimNames = this.props.dimNames;
        const dataSource = this.props.projectionMatrix.map((d, i) => {
            return {
                key: 'dim-' + i,
                x: d[0].toFixed(3),
                y: d[1].toFixed(3),
                weight: Math.sqrt(d[0]*d[0] + d[1]*d[1]).toFixed(4),
                name: dimNames[i]
            }
        });

        return (
            <Table
                rowKey="key"
                size="small"
                pagination={false}
                columns={this.state.columns}
                dataSource={dataSource}
                rowClassName={() => 'dim-table-row'}
                scroll={{y: this.props.scrollY}}
                bordered={true}

                style={{
                    backgroundColor: '#fff',
                    marginTop: 10
                }}
            />
        );
    }
}
