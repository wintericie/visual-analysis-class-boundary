import React, {Component} from 'react';
import {findDOMNode} from 'react-dom';
// import d3 from '../utils/d3-import';
import * as d3 from 'd3';
import numeric from 'numericjs';
import {Form, Checkbox, Row, Button, Modal, Input} from 'antd';

import '../styles/dimcontrol.css';

// const minorDimThreshold = 0.4;
const sgdLearningRateMiu = 0.005, energyMaxError = 1e-4;


/**
 * Projection Optimization Procedure
 */
function updateProjMatrixByMovingDimEndpoint(oldProjMatrix, idx, newPropX, newPropY) {
    // const oldProjMatrix = this.state.projectionMatrix;
    const dimLen = oldProjMatrix.length;
    // const sgdLearningRateMiu = sgdLearningRateMiu;

    // 计算能量e(A)
    const computeEnergy = (projMatrix) => {
        let sumX = 0, sumY = 0, dotXY = 0;
        for (let i = dimLen - 1; i--;) {
            const cx = projMatrix[i][0], cy = projMatrix[i][1];
            sumX += cx * cx;
            sumY += cy * cy;
            dotXY += cx * cy;
        }
        return (sumX - 1) * (sumX - 1) + (sumY - 1) * (sumY - 1) + dotXY * dotXY;
    };

    // 根据infovis 2013 Orthographic Star Coordinates的方法更新矩阵
    // 每次计算e(A)，并更新newProjMatrix
    let newProjMatrix = oldProjMatrix;
    newProjMatrix[idx][0] = newPropX;
    newProjMatrix[idx][1] = newPropY;

    // 初始化梯度矩阵
    let deltaEA = numeric.rep([dimLen, 2], 0);

    // 当前能量，及迭代计数器
    let eA = 10000, iters = 0;

    // 当能量足够小或迭代次数超过上限时时退出优化循环
    // const energyMaxError = energyMaxError;
    while (eA > energyMaxError && iters < 10000) {
        // 更新梯度矩阵
        let sumX = 0, sumY = 0, dotXY = 0;
        for (let i = dimLen - 1; i--;) {
            const cx = newProjMatrix[i][0], cy = newProjMatrix[i][1];
            sumX += cx * cx;
            sumY += cy * cy;
            dotXY += cx * cy;
        }

        const normXSqrMinusOne = sumX - 1, normYSqrMinusOne = sumY - 1;

        for (let j = dimLen - 1; j--;) {
            const xj = newProjMatrix[j][0], yj = newProjMatrix[j][1];
            deltaEA[j][0] = 4 * xj * normXSqrMinusOne + 2 * yj * dotXY;  // e_x_j
            deltaEA[j][1] = 4 * yj * normYSqrMinusOne + 2 * xj * dotXY;  // e_y_j
        }

        // 设置被改变的轴的梯度为0
        deltaEA[idx][0] = 0;
        deltaEA[idx][1] = 0;

        // 根据梯度更新投影矩阵
        newProjMatrix = numeric.add(
            numeric.mul(-sgdLearningRateMiu, deltaEA),
            newProjMatrix
        );

        // 计算矩阵属性
        // let trans = numeric.transpose(newProjMatrix);
        // console.log('Iter ' + iters + ':');
        // console.log(numeric.norm2(trans[0]));
        // console.log(numeric.norm2(trans[1]));
        // console.log(numeric.dot(trans[0], trans[1]));


        // 重新计算投影矩阵能量
        eA = computeEnergy(newProjMatrix);
        // console.log(eA);

        // 迭代次数计数器增加
        iters++;
    }

    // 更新投影矩阵，重新刷新界面
    // this.setState({
    //     projectionMatrix: newProjMatrix
    // });

    return newProjMatrix;
}


export default class DimControl extends Component {
    constructor(props) {
        super(props);

        this.state = {
            innerPadding: 10,
            displayText: false,
            importMatrixModalVisible: false
        };
    }

    updateGlyph() {

        const transpose = numeric.transpose(this.props.projectionMatrix);

        this.props.updateProjMatrixByMovingDimEndpoint(
            numeric.transpose([transpose[1], transpose[0]])
        );
    }

    handleUpdateProjectionMatrix(oldProjMatrix, idx, newPropX, newPropY) {
        // this.updateProjMatrixByMovingDimEndpoint(idx, newPropX, newPropY);
        this.props.handleGlobalProjectionMatrixRotated(
            updateProjMatrixByMovingDimEndpoint(
                oldProjMatrix, idx, newPropX, newPropY
            )
        );
    }

    handleExportProjectionMatrix() {
        console.log(JSON.stringify(this.props.projectionMatrix));
    }

    handleTextToggling(event) {
        console.log(event);
        this.setState({
            displayText: event.target.checked
        }, () => {
            this.toggleTextDrawing(this.state.displayText);
        });
    }

    handleImportMatrixModalOpen() {
        console.log(this.refs);

        this.setState({
            importMatrixModalVisible: true
        }, () => {
            this.forceUpdate();
        });
    }

    handleImportMatrixModalOk() {

        const value = this.refs.importMatrix.input.value;
        console.log(value);

        this.setState({
            importMatrixModalVisible: false
        }, () => {
            this.forceUpdate();
        });
    }

    handleImportMatrixModalCancel() {
        this.setState({
            importMatrixModalVisible: false
        }, () => {
            this.forceUpdate();
        });
    }


    /**
     * React Functions
     */
    componentDidMount() {
        const {controlWidth, controlHeight} = this.props;
        const canvasHalfMinSizeWithPadding = Math.min(controlWidth, controlHeight) / 2 - this.state.innerPadding;

        this.svgRoot = d3.select(findDOMNode(this));
        this.svgRoot.select('g#base-group')
            .attr('transform', 'translate(' + controlWidth / 2 + ',' + controlHeight / 2 + ')');

        this.setState({
            xScale: d3.scaleLinear().domain([-1, 1]).range([-canvasHalfMinSizeWithPadding, canvasHalfMinSizeWithPadding]),
            yScale: d3.scaleLinear().domain([-1, 1]).range([canvasHalfMinSizeWithPadding, -canvasHalfMinSizeWithPadding])
        }, () => {
            this.initializeDimControl(this.props.projectionMatrix);
        });
    }

    componentWillReceiveProps(nextProps) {
        this.updateDimControl(nextProps.projectionMatrix);
    }

    initializeDimControl(projectionMatrix) {
        // const {controlWidth, controlHeight, dimNames} = this.props;
        const {dimNames} = this.props;
        // const canvasHalfMinSize = Math.min(controlWidth, controlHeight) / 2;
        const svgRoot = this.svgRoot;
        const endPointGroup = svgRoot.select('g#end-point-group'),
            linkGroup = svgRoot.select('g#link-group'),
            textGroup = svgRoot.select('g#text-group'),
            labelGroup = svgRoot.select('g#label-group');
        const xScale = this.state.xScale, yScale = this.state.yScale;

        // const xAxis = d3.axisBottom(xScale).ticks(0),
        //     yAxis = d3.axisLeft(yScale).ticks(0);

        // let endPos = projectionMatrix.map((d) => [
        //     d[0] * canvasHalfMinSize,
        //     d[1] * canvasHalfMinSize
        // ]);

        // for (let i = 0; i < projectionMatrix.length; i++) {
        //     const projX = projectionMatrix[i][0],
        //         projY = projectionMatrix[i][1];
        //
        //     let x = 0, y = 0;
        //
        //     x = projX * canvasHalfMinSize;
        //     y = projY * canvasHalfMinSize;
        // }

        endPointGroup.selectAll('circle.end-point').remove();
        linkGroup.selectAll('line.end-link').remove();
        textGroup.selectAll('text.end-point-text').remove();
        svgRoot.select('g#x-axis').remove();
        svgRoot.select('g#y-axis').remove();


        linkGroup.selectAll('line.end-link')
            .data(projectionMatrix)
            .enter()
            .append('line')
            .attr('id', (d, i) => 'end-link-' + i)
            .classed('end-link', true)
            .attr('x1', 0)
            .attr('y1', 0)
            .attr('x2', d => xScale(d[0]))
            .attr('y2', d => yScale(d[1]));

        endPointGroup.selectAll('circle.end-point')
            .data(projectionMatrix)
            .enter()
            // .append('g')
            // .attr('id', (d, i) => 'end-point-bundle-' + i)
            // .classed('end-point-bundle-group', true)
            .append('circle')
            .attr('id', (d, i) => 'end-point-' + i)
            .classed('end-point', true)
            .attr('cx', d => xScale(d[0]))
            .attr('cy', d => yScale(d[1]))
            .attr('r', 3.5)
            .on('mouseover', (d, i) => {
                if (this.state.displayText) {
                    textGroup.select('text#end-point-text-' + i).classed('end-point-text-emphasize', true);
                } else {
                    textGroup.select('text#end-point-text-' + i).classed('dim-control-disable-text', false);
                    textGroup.select('text#end-point-text-' + i).classed('end-point-text-emphasize', true);
                }
            })
            .on('mouseout', (d, i) => {
                if (this.state.displayText) {
                    textGroup.select('text#end-point-text-' + i).classed('end-point-text-emphasize', false);
                } else {
                    textGroup.select('text#end-point-text-' + i).classed('dim-control-disable-text', true);
                    textGroup.select('text#end-point-text-' + i).classed('end-point-text-emphasize', false);
                }
            });

        textGroup.selectAll('text.end-point-text')
            .data(projectionMatrix)
            .enter()
            .append('text')
            .attr('id', (d, i) => 'end-point-text-' + i)
            .classed('end-point-text', true)
            .classed('dim-control-disable-text', !(this.state.displayText))
            .attr('x', d => xScale(d[0]))
            .attr('y', d => yScale(d[1]))
            .attr('transform', 'translate(4,0)')
            .attr('text-anchor', 'start')
            .attr('alignment-baseline', 'middle')
            .text((d, i) => dimNames[i]);

        // svgRoot.select('g#base-group')
        //     .append('g')
        //     .attr('id', 'x-axis')
        //     .attr('class', 'axis')
        //     .call(xAxis)
        //     .selectAll();
        // // .attr('transform', 'translate(')
        //
        // svgRoot.select('g#base-group')
        //     .append('g')
        //     .attr('id', 'y-axis')
        //     .attr('class', 'axis')
        //     .call(yAxis);

        const TICK_LENGTH = 4;

        // Main axis
        labelGroup.append('line')
            .classed('dim-axis', true)
            .attr('x1', xScale(-1))
            .attr('y1', 0)
            .attr('x2', xScale(1))
            .attr('y2', 0);

        labelGroup.append('line')
            .classed('dim-axis', true)
            .attr('x1', 0)
            .attr('y1', yScale(-1))
            .attr('x2', 0)
            .attr('y2', yScale(1));

        // x ticks
        labelGroup.append('line')
            .classed('dim-axis', true)
            .attr('x1', xScale(-1))
            .attr('y1', yScale(0) - TICK_LENGTH)
            .attr('x2', xScale(-1))
            .attr('y2', yScale(0) + TICK_LENGTH);

        labelGroup.append('line')
            .classed('dim-axis', true)
            .attr('x1', xScale(1))
            .attr('y1', yScale(0) - TICK_LENGTH)
            .attr('x2', xScale(1))
            .attr('y2', yScale(0) + TICK_LENGTH);

        // y ticks
        labelGroup.append('line')
            .classed('dim-axis', true)
            .attr('x1', xScale(0) - TICK_LENGTH)
            .attr('y1', yScale(-1))
            .attr('x2', xScale(0) + TICK_LENGTH)
            .attr('y2', yScale(-1));

        labelGroup.append('line')
            .classed('dim-axis', true)
            .attr('x1', xScale(0) - TICK_LENGTH)
            .attr('y1', yScale(1))
            .attr('x2', xScale(0) + TICK_LENGTH)
            .attr('y2', yScale(1));

        // labels
        labelGroup.append('text')
            .classed('label-separation', true)
            .attr('x', xScale(-1))
            .attr('y', -TICK_LENGTH - 1)
            .style('text-anchor', 'start')
            .style('alignment-baseline', 'ideographic')
            .text('Variance');

        labelGroup.append('text')
            .classed('label-variance', true)
            .attr('x', xScale(-1))
            .attr('y', -TICK_LENGTH - 1)
            .style('text-anchor', 'start')
            .style('alignment-baseline', 'ideographic')
            .text('Separation');

        // labelGroup.append('text')
        //     .attr('x')
        //     .attr('y')
        //     .style('text-anchor', 'end')
        //     .style('alignment-baseline', 'middle')
        //     .text('Min. Var');
        // labelGroup.append('text')
        //     .attr('x')
        //     .attr('y')
        //     .style('text-anchor', 'end')
        //     .style('alignment-baseline', 'middle')
        //     .text('Min. Sep');
        // labelGroup.append('text')
        //     .attr('x')
        //     .attr('y')
        //     .style('text-anchor', 'end')
        //     .style('alignment-baseline', 'middle')
        //     .text('Min. Sep');

        const handleUpdateProjectionMatrix = this.handleUpdateProjectionMatrix.bind(this);

        const dragEndPointCallback = (d, i, el) => {
            const circle = d3.select(el[i]);
            const oldcx = parseFloat(circle.attr('cx')), oldcy = parseFloat(circle.attr('cy'));
            const newcx = oldcx + d3.event.dx, newcy = oldcy + d3.event.dy;

            // circle.attr('cx', newcx);
            // circle.attr('cy', newcy);

            handleUpdateProjectionMatrix(
                projectionMatrix,
                parseInt(circle.attr('id').replace('end-point-', ''), 10),
                //newcx / canvasHalfMinSize,
                //newcy / canvasHalfMinSize
                xScale.invert(newcx),
                yScale.invert(newcy)
            );
        };

        svgRoot.selectAll('circle.end-point').call(
            d3.drag().on('drag', dragEndPointCallback)
        );
    }

    updateDimControl(projectionMatrix) {
        const svgRoot = this.svgRoot;
        const endPointGroup = svgRoot.select('g#end-point-group'),
            linkGroup = svgRoot.select('g#link-group'),
            textGroup = svgRoot.select('g#text-group');
        const xScale = this.state.xScale, yScale = this.state.yScale;

        endPointGroup.selectAll('circle.end-point')
            .attr('cx', (d, i) => xScale(projectionMatrix[i][0]))
            .attr('cy', (d, i) => yScale(projectionMatrix[i][1]));
        linkGroup.selectAll('line.end-link')
            .attr('x1', 0)
            .attr('y1', 0)
            .attr('x2', (d, i) => xScale(projectionMatrix[i][0]))
            .attr('y2', (d, i) => yScale(projectionMatrix[i][1]));
        textGroup.selectAll('text.end-point-text')
            .attr('x', (d, i) => xScale(projectionMatrix[i][0]))
            .attr('y', (d, i) => yScale(projectionMatrix[i][1]));
    }

    toggleTextDrawing() {
        this.svgRoot.select('g#text-group').selectAll('text.end-point-text').classed('dim-control-disable-text', !(this.state.displayText));
    }

    shouldComponentUpdate() {
        // console.log('DimControl got update signal');
        return false;
    }

    render() {
        console.log('dimcontrol rendering');

        return (
            <div
                id="dimcontrol-container"
                style={{
                    background: '#fff',
                    border: '1px solid #e8e8e8',
                    borderRadius: '4px'
                }}
            >
                <Row style={{padding: 10, backgroundColor: 'rgba(0, 0, 0, 0)'}}>
                    <Form layout="inline">
                        <Checkbox
                            //checked={this.state.displayText}
                            onChange={this.handleTextToggling.bind(this)}
                        >
                            Name
                        </Checkbox>
                        <Button
                            size="small"
                            style={{marginRight: 5}}
                            onClick={this.handleExportProjectionMatrix.bind(this)}
                        >
                            Export
                        </Button>
                        <Button
                            size="small"
                            style={{marginRight: 5}}
                            onClick={this.handleImportMatrixModalOpen.bind(this)}
                        >
                            Import
                        </Button>
                        <Modal
                            ref="importMatrixModal"
                            title="Import Projection Matrix"
                            visible={this.state.importMatrixModalVisible}
                            onOk={this.handleImportMatrixModalOk.bind(this)}
                            onCancel={this.handleImportMatrixModalCancel.bind(this)}
                        >
                            <Input ref="importMatrix" placeholder="Matrix"/>
                        </Modal>
                    </Form>
                </Row>
                <Row
                    type="flex"
                >
                    <svg
                        id={'dimcontrol-canvas'}
                        width={this.props.controlWidth}
                        height={this.props.controlHeight}
                        // width="100%"
                        // height="100%"
                        style={{
                            background: '#fff',
                            margin: 'auto'
                        }}
                    >
                        <g id="base-group">
                            <g id="content-group">
                                <g id="label-group"/>
                                <g id="end-point-group"/>
                                <g id="link-group"/>
                                <g id="text-group"/>
                                {/*<defs>*/}
                                {/*<filter id="glow" x="-30%" y="-30%" width="160%" height="160%">*/}
                                {/*<feGaussianBlur stdDeviation="10 10" result="glow"/>*/}
                                {/*<feMerge>*/}
                                {/*<feMergeNode in="glow"/>*/}
                                {/*<feMergeNode in="glow"/>*/}
                                {/*<feMergeNode in="glow"/>*/}
                                {/*</feMerge>*/}
                                {/*</filter>*/}
                                {/*</defs>*/}
                                {/*</g>*/}
                            </g>
                        </g>
                    </svg>
                </Row>
            </div>
        );
    }
}