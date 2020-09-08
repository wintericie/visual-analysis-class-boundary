import React, {Component} from 'react';
import union from 'lodash/union';
import xor from 'lodash/xor';
import uniq from 'lodash/uniq';
import {Tag, Table} from 'antd';
import {labelNormalColorMap} from '../../utils/Color';

import '../../styles/localboundarylist.css';


export default class LocalBoundaryTable extends Component {

    constructor(props) {
        super(props);

        const {localModels, labelNames} = props;
        const lenLocalModels = localModels.length;

        this.state = {
            // rowSelection: {
            //     selectedRowKeys: props.activatedLocalModels,
            //     onChange: this.handleRowSelectionChanged.bind(this)
            // },

            columns: [{
                title: 'ID',
                dataIndex: 'id',
                key: 'id',
                width: '15%',
                defaultSortOrder: 'ascend',
                sorter: (a, b) => a['id'] - b['id']
            }, {
                title: 'Base Class',
                dataIndex: 'baseLabel',
                key: 'baseLabel',
                render: baseLabel => (
                    <span>
                        <Tag color={labelNormalColorMap[baseLabel]}>
                            {labelNames[baseLabel]}
                        </Tag>
                    </span>
                ),
                width: '30%',
                defaultSortOrder: 'ascend',
                sorter: (a, b) => a['baseLabel'] - b['baseLabel']
            }, {
                title: '# Size',
                dataIndex: 'numKNNs',
                key: 'numKNNs',
                width: '22%',
                defaultSortOrder: 'descend',
                sorter: (a, b) => a['numKNNs'] - b['numKNNs']
            }, {
                title: '# Coverage',
                dataIndex: 'numCoverage',
                key: 'numCoverage',
                width: '28%',
                defaultSortOrder: 'descend',
                sorter: (a, b) => a['numCoverage'] - b['numCoverage']
            }],
        };
    }

    /**
     * Event Handlers
     */
    handleRowSelectionChanged = (selectedRowKeys) => {
        // console.log(
        //     `CurrentselectedRowKeys: ${this.props.activatedLocalModels}`,
        //     `selectedRowKeys: ${selectedRowKeys}`,
        //     'selectedRows: ', selectedRows
        // );

        // this.setState({selectedRowKeys});
        this.props.handleLocalModelsClicked(
            // xor(this.props.activatedLocalModels, selectedRows.map(m => m['id']))
            xor(this.props.activatedLocalModels, selectedRowKeys)
        );
    };

    handleTagCloseClicked = (idx) => {
        this.props.handleLocalModelsClicked(idx);
    };

    handleTagMouseEnter = (idx) => {
        this.props.handleLocalModelsHighlighted(idx);
    };

    handleTagMouseOut = (idx) => {
        this.props.handleLocalModelsHighlighted(idx);
    };

    render() {

        const {
            activatedLocalModels,
            highlightedLocalModels,
            localModels
        } = this.props;

        const mapModelToRow = (d, i) => ({
            id: i,
            baseLabel: d['targetLabel'][0],
            numKNNs: union(d['target'], d['knns']).length,
            numCoverage: union(d['coverage'], d['knns'], d['target']).length
        });

        // let dataSource = Array(localModels.length);
        //
        // // fill in selected localModels first
        // let lenActivatedLocalModels = activatedLocalModels.length;
        // for (let i = 0; i < lenActivatedLocalModels; i++) {
        //     const idx = activatedLocalModels[i];
        //     dataSource[i] = mapModelToRow(localModels[idx], idx);
        // }
        //
        // const activatedLodelModelsSet = new Set(activatedLocalModels);
        //
        // // fill in non-selected localModels
        // const lenLocalModels = localModels.length;
        // let iDataSouce = lenActivatedLocalModels;
        // for (let iLocal = 0; iLocal < lenLocalModels; iLocal++) {
        //     if (activatedLodelModelsSet.has(iLocal)) continue;
        //
        //     dataSource[iDataSouce] = mapModelToRow(localModels[iLocal], iLocal);
        //     iDataSouce++;
        // }

        const dataSource = localModels.map((d, i) => mapModelToRow(d, i));

        const rowSelection = {
            selectedRowKeys: activatedLocalModels,
            onChange: this.handleRowSelectionChanged.bind(this)
        };

        // let tagGroup;
        //
        // if (activatedLocalModels.length === 0) {
        //     tagGroup = <Tag
        //         style={{
        //             background: '#fff',
        //             borderStyle: 'dashed',
        //             marginLeft: 5
        //         }}
        //     >
        //         None
        //     </Tag>;
        // } else {
        //     tagGroup = activatedLocalModels.map((idx) => (
        //         <Tag
        //             key={'localmodel-tag-' + idx}
        //             style={{marginLeft: 5}}
        //             color={
        //                 labelNormalColorMap[localModels[idx]['targetLabel'][0]]
        //             }
        //             closable
        //             onClose={this.handleTagCloseClicked.bind(this, idx)}
        //             onMouseEnter={this.handleTagMouseEnter.bind(this, idx)}
        //             onMouseOut={this.handleTagMouseOut.bind(this, idx)}
        //         >
        //             {idx}
        //         </Tag>
        //     ));
        // }

        return (
            <div
                style={{marginTop: 10}}
            >
                {/*<div*/}
                    {/*style={{*/}
                        {/*height: 32,*/}
                        {/*paddingLeft: 5,*/}
                        {/*// marginBottom: 5,*/}
                        {/*overflowX: 'scroll'*/}
                    {/*}}*/}
                {/*>*/}
                    {/*<span style={{fontWeight: 'bold'}}>Selected Local Boundaries: </span>*/}
                    {/*{tagGroup}*/}
                {/*</div>*/}
                <Table
                    dataSource={dataSource}
                    columns={this.state.columns}
                    size="small"
                    bordered={false}
                    // scroll={{y: this.props.scrollY}}
                    scroll={{y: this.props.scrollY + 34}}
                    pagination={false}
                    rowSelection={rowSelection}
                    // onRow={(record) => {
                    //     return {
                    //         onMouseEnter: this.handleTagMouseEnter.bind(this),
                    //         onMouseOut: this.handleTagMouseOut.bind(this)
                    //     }
                    // }}
                />
            </div>
        );
    }
}