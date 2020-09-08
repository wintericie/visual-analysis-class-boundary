import React, {Component} from 'react';


// Echart groups
import ReactEchartsCore from 'echarts-for-react';
// import echarts from 'echarts/lib/echarts';
// import 'echarts/lib/chart/parallel';
// import 'echarts/lib/component/visualMap';
// import 'echarts/lib/component/legend';

// import {findDOMNode} from "react-dom";
// import * as d3 from "d3";
// import {Divider} from 'antd';

import {labelNormalColorMap} from "../../utils/Color";


export default class DetailCardPCP extends Component {
    constructor(props) {
        super(props);
    }

    /**
     * Event handlers
     */

    handleChartReady = (e) => {
        // console.log(e);
    };

    /**
     * React Functions
     */

    // shouldComponentUpdate() {
    //     return false;
    // }

    componentDidMount() {
        this.initializePCP();
    }

    componentWillReceiveProps(nextProps) {

    }

    initializePCP = () => {
        // const {
        //     filteredDataVectors,
        //     targetIndices,
        //     largestWeightedDims,
        //     filteredDimNames,
        //     filteredDimWeights
        // } = this.props;
    };

    render() {
        const {
            filteredDataVectors,
            // targetIndices,
            largestWeightedDims,
            filteredDimNames,
            // filteredDimWeights,
            labelNames
        } = this.props;

        /**
         * Organize the data
         */

            // separate the classes of data
        const option = {
                // parallelAxis: [
                //     {dim: 0, name: 'Price'},
                //     {dim: 1, name: 'Net Weight'},
                //     {dim: 2, name: 'Amount'},
                //     {
                //         dim: 3,
                //         name: 'Score',
                //         type: 'category',
                //         data: ['Excellent', 'Good', 'OK', 'Bad']
                //     }
                // ],

                parallel: {
                    left: 29,
                    right: 33,
                    bottom: 7,
                    top: 30,
                    // axisExpandable: true

                    parallelAxisDefault: {
                        type: 'value',
                        // nameLocation: 'start',
                        // nameRotate: 25,
                        nameLocation: 'end',
                        nameTextStyle: {
                            fontSize: 11
                        },
                        nameGap: 10,
                        // nameTruncate: {
                        //     maxWidth: 170
                        // },
                        // splitNumber: 3,
                        // tooltip: {
                        //     show: true
                        // },
                        axisLine: {
                            // show: false,
                            lineStyle: {
                                width: 1,
                                color: 'rgba(0,0,0,0.6)'
                            }
                        },
                        axisTick: {
                            show: false
                        },
                        axisLabel: {
                            fontSize: 10
                        },
                        splitLine: {
                            show: false
                        },
                        // z: 100
                    }
                },

                parallelAxis: largestWeightedDims.map((dim, i) => {
                    return {
                        dim: i + 1,
                        name: filteredDimNames[i]
                    };
                }),

                visualMap: {
                    show: false,
                    type: 'piecewise',
                    orient: 'horizontal',
                    categories: [0, 1, 2, 3],
                    inRange: {
                        color: labelNormalColorMap.slice(0, labelNames.length)
                    },
                    dimension: 0,
                    realtime: true,

                    left: 'center',
                    right: 'center',
                    padding: 2
                },

                series: {
                    type: 'parallel',
                    lineStyle: {
                        width: 1
                    },
                    smooth: true,
                    data: filteredDataVectors
                },

                animation: false
            };

        return (
            <ReactEchartsCore
                style={{width: '100%', height: '100%'}}
                // echarts={echarts}
                option={option}
                notMerge={true}
                lazeUpdate={false}
                // theme={''}
                onChartReady={this.handleChartReady}
            />
        );
    }
}