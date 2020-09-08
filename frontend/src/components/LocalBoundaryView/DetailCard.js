import React, {Component} from 'react';
// import {findDOMNode} from "react-dom";
// import * as d3 from "d3";
import union from 'lodash/union';
import {Empty, Row, Col, Statistic} from 'antd';

import DetailCardPCP from './DetailCardPCP';
import DetailCardWeightBar from './DetailCardWeightBar';
import {sortWithIndices} from '../../utils/arrayUtils';
import {labelNormalColorMap} from "../../utils/Color";


const HEIGHT_PCP_WEIGHTBARS = 312;


export default class DetailCard extends Component {
    constructor(props) {
        super(props);

        this.state = {
            numFirstDims: 5,
            enableCoverage: false
        };
    }

    render() {

        const {
            height,
            displayModel, modelIdx,
            dataVectors, label, labelNames, dimNames,
            viewHeight
        } = this.props;

        if (displayModel === undefined) {
            return (
                <div
                    // style={{
                    // height: '100%',
                    // width: '100%',
                    // textAlign: 'center',
                    // display: 'flex',
                    // justifyContent: 'center',
                    // alignContent: 'center',
                    // flexDirection: 'column',
                    // margin: 'auto',
                    // background: '#fafafa',
                    // borderRadius: 4

                    // }}
                    className="main-container"
                    style={{
                        height: height,
                        width: '100%',
                        // marginTop: 10,
                        padding: 10
                    }}
                >
                    {/*<p style={{fontSize: 24, fontWeight: 'bold', color: '#cccccc', margin: 0}}>*/}
                    {/*Please Hover on a Local Boundary*/}
                    {/*</p>*/}
                    {/*<p style={{fontSize: 24, fontWeight: 'bold', color: '#cccccc', margin: 0}}>To See Details</p>*/}
                    <Row
                        style={{
                            width: '100%',
                            float: 'left',
                            borderBottom: '1px solid #e8e8e8',
                            paddingBottom: 8,
                            marginBottom: 12
                        }}
                    >
                        <Col
                            span={12}
                            style={{
                                float: 'left'
                            }}
                        >
                        <span
                            style={{
                                fontWeight: 'bold',
                                fontSize: 18,
                                padding: 4
                            }}
                        >
                            {`Segment Detail View`}
                        </span>
                        </Col>
                    </Row>
                    <Row>
                        <Empty
                            style={{marginTop: 136}}
                            description="No segment selected"
                        />
                    </Row>
                </div>
            );
        }

        /**
         * Assemble the data
         */

            // Select the largest `numFirstDims` dims
        const dimWeights = displayModel['localSVM']['coef'][0];
        const largestWeightedDims = sortWithIndices(
            dimWeights.map(d => Math.abs(d)), true
        ).sortIndices.slice(0, this.state.numFirstDims);

        const lenLargestWeightedDims = largestWeightedDims.length;

        // Assemble the new dimNames
        let filteredDimNames = Array(lenLargestWeightedDims),
            filteredDimWeights = Array(lenLargestWeightedDims);

        for (let i = 0; i < lenLargestWeightedDims; i++) {
            filteredDimNames[i] = dimNames[largestWeightedDims[i]];
            filteredDimWeights[i] = dimWeights[largestWeightedDims[i]];
        }

        // Get the target data instance indices
        const targetIndices = (this.state.enableCoverage)
            ? union(displayModel['coverage'], displayModel['knns'])
            : union(displayModel['knns']);
        const lenTargetIdx = targetIndices.length;

        let filteredDataVectors = Array(lenTargetIdx);  // The first one is the label

        // Filter out the selected dims from the dataVectors
        for (let i = 0; i < lenTargetIdx; i++) {
            const tIdx = targetIndices[i];
            const dataVec = dataVectors[tIdx];

            // The first one is the label
            let filteredVector = Array(lenLargestWeightedDims + 1);
            filteredVector[0] = label[tIdx];

            for (let j = 0; j < lenLargestWeightedDims; j++) {
                filteredVector[j + 1] = dataVec[largestWeightedDims[j]];
            }

            filteredDataVectors[i] = filteredVector;
        }

        // Filter the labels
        let filteredLabels = Array(lenTargetIdx);

        for (let i = 0; i < lenTargetIdx; i++) {
            filteredLabels[i] = label[targetIndices[i]];
        }

        return (
            <div
                className="main-container"
                style={{
                    height: height,
                    width: '100%',
                    // marginTop: 10,
                    padding: 10
                }}
            >
                <Row
                    style={{
                        width: '100%',
                        float: 'left',
                        borderBottom: '1px solid #e8e8e8',
                        paddingBottom: 8,
                        marginBottom: 12
                    }}
                >
                    <Col
                        span={12}
                        style={{
                            float: 'left'
                        }}
                    >
                        <span
                            style={{
                                fontWeight: 'bold',
                                fontSize: 18,
                                padding: 4
                            }}
                        >
                            {`Segment Detail View (Segment ${modelIdx})`}
                        </span>
                    </Col>
                </Row>
                <Row
                >
                    {/*<span*/}
                    {/*style={{*/}
                    {/*fontWeight: 'bold',*/}
                    {/*marginTop: 10*/}
                    {/*}}*/}
                    {/*>*/}

                    {/*</span>*/}
                    {/*<div*/}
                    {/*style={{width: '100%'}}*/}
                    {/*>*/}
                    <Row
                        gutter={8}
                        style={{
                            height: viewHeight - HEIGHT_PCP_WEIGHTBARS - 20,
                            // backgroud: 'blue'
                        }}
                    >
                        <Col span={9}>
                            <Statistic
                                title="Class"
                                value={labelNames[displayModel.targetLabel[0]]}
                                valueStyle={{
                                    color: labelNormalColorMap[displayModel.targetLabel[0]]
                                }}
                            />
                        </Col>
                        <Col span={5}>
                            <Statistic
                                title="#Seeds"
                                // value={displayModel.knns.length}
                                value={displayModel.target.length}
                            />
                        </Col>
                        <Col span={5}>
                            <Statistic
                                title="#Coverage"
                                value={union(displayModel.knns, displayModel.coverage).length}
                            />
                        </Col>
                        <Col span={5}>
                            <Statistic
                                title="Accuracy"
                                value={(displayModel.coverageAcc * 100).toFixed(2)}
                                precision={2}
                                suffix="%"
                            />
                        </Col>
                    </Row>
                    <Row
                        style={{
                            marginTop: 40,
                            height: HEIGHT_PCP_WEIGHTBARS
                        }}
                    >
                        <Col
                            span={6}
                            style={{height: '100%'}}
                        >
                            <DetailCardWeightBar
                                filteredDimNames={filteredDimNames}
                                filteredDimWeights={filteredDimWeights}
                            />
                        </Col>
                        <Col
                            span={18}
                            style={{height: '100%'}}
                        >
                            <DetailCardPCP
                                filteredDataVectors={filteredDataVectors}
                                targetIndices={targetIndices}
                                largestWeightedDims={largestWeightedDims}
                                filteredDimNames={filteredDimNames}
                                filteredDimWeights={filteredDimWeights}
                                filteredLabels={filteredLabels}
                                labelNames={labelNames}
                            />
                        </Col>
                    </Row>
                    {/*</div>*/}
                </Row>
            </div>
        );
    }
}