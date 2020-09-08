import React, {Component} from 'react';
import {findDOMNode} from 'react-dom';
import flattenDeep from 'lodash/flattenDeep';
import fill from 'lodash/fill';
import zip from 'lodash/zip';
import intersection from 'lodash/intersection';
import without from 'lodash/without';
import union from 'lodash/union';
import numeric from 'numericjs';
import * as d3 from 'd3';

import gramSchmidt from '../../utils/gramschmidt';
import {sliderBottom} from "../../utils/d3-simple-slider";

import {
    Row, Col,
    Radio, Checkbox, InputNumber, Card,
    Menu, Dropdown, Button,
    Icon, List,
    Divider, Table
} from 'antd';

import {labelNormalColorMap} from '../../utils/Color';


export default class PathCanvas extends Component {

    constructor(props) {
        super(props);

        this.state = {};
    }

    shouldComponentUpdate() {
        return false;
    }

    componentDidMount() {
        const {height, explorationPath, activated, localModels} = this.props;

        /**
         * Initialize all the paths
         */

            // Expand the path into pieces
        const {pathOfLocalModels, interpolations} = explorationPath;

        let modelSeries = interpolations.map((inter, i) => {
            const localModelWithIdx = localModels[pathOfLocalModels[i]];

            if (inter.length === 0) {
                return [localModelWithIdx];
            } else {
                return [
                    localModelWithIdx,
                    interpolations[i].map(d => ({...d, interpolation: true}))
                ]
            }
        });

        modelSeries.push(localModels[
            pathOfLocalModels[pathOfLocalModels.length - 1]]);

        modelSeries = flattenDeep(modelSeries);

        // Get feature importance ranking
        const lenWeights = 5;
        const weightRankings = modelSeries.map((m, modelSeriesIdx) => {
            let wEnum = Array.from(m['localSVM']['coef'][0].entries());
            wEnum.sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
            return wEnum.slice(0, lenWeights).map(w => (
                {modelSeriesIdx: modelSeriesIdx, featureIdx: w[0], value: w[1], haveLeftSoc: false, haveRightSoc: false}
            ));
        });

        // for (let i = 0; i < lenModelSeries; i++) {
        //     let w_enum = Array.from(modelSeries[i]['localSVM']['coef'][0].entries);
        //     w_enum.sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
        // }

        /**
         * Compute the connections
         */
        let edges = [];
        let edgesMap = {};
        const lenModelSeries = modelSeries.length;
        // let previousConnectionMarks = Array(lenWeights);
        // fill(previousConnectionMarks, false);

        for (let i = 0; i < lenModelSeries - 1; i++) {
            const weight1 = weightRankings[i], weight2 = weightRankings[i + 1];

            for (let j1 = 0; j1 < lenWeights; j1++) {
                // let shouldj1PaintEndpoint = true,
                //     shouldj2PaingStartpoint = Array(lenWeights);
                //
                // fill(shouldj2PaingStartpoint, true);

                for (let j2 = 0; j2 < lenWeights; j2++) {
                    if (weight1[j1]['featureIdx'] === weight2[j2]['featureIdx']) {
                        edges.push({
                            source: [i, j1],
                            target: [i + 1, j2]
                        });

                        weightRankings[i][j1]['haveRightSoc'] = true;
                        weightRankings[i + 1][j2]['haveLeftSoc'] = true;
                    }
                    // else {
                    //     endpoints.push({type: 'end', grid: [i, j1]});
                    //     endpoints.push({type: 'start', grid: [i + 1, j2]});
                    // }
                }

                // // compute j1 endpoint
                // if (shouldj2PaingStartpoint) {
                //     endpoints.push({type: 'end', grid: [i, j1]});
                // }
                //
                // // compute j2 startpoint
                // const lenShouldj2PaingStartpoint = shouldj2PaingStartpoint.length;
                // for (let _j2 = 0; _j2 < lenShouldj2PaingStartpoint; _j2++) {
                //     if (shouldj2PaingStartpoint[_j2]) {
                //         endpoints.push({type: 'start', grid: [i + 1, _j2]});
                //     }
                // }
            }
        }

        // Compute end points
        let endpoints = [];
        for (let ii = 0; ii < lenModelSeries; ii++) {
            for (let j = 0; j < lenWeights; j++) {
                const weightObj = weightRankings[ii][j];

                if (weightObj['haveLeftSoc'] !== weightObj['haveRightSoc']) {
                    if (weightObj['haveLeftSoc']) {
                        endpoints.push({type: 'end', grid: [ii, j]});
                    } else if (weightObj['haveRightSoc']) {
                        endpoints.push({type: 'start', grid: [ii, j]});
                    }
                }
            }
        }

        // reverse Idx
        let reverseIdxMapTable = [];
        for (let i = 0; i < lenModelSeries; i++) {
            if (!modelSeries[i]['interpolation']) {
                reverseIdxMapTable.push(i);
            }
        }

        /**
         * Initialize canvas
         */
        this.initializeView(modelSeries, weightRankings, edges, endpoints, reverseIdxMapTable);
    }

    initializeView = (modelSeries, weightRankings, edges, endpoints, reverseIdxMapTable) => {

        const {
            updateGlobalProjectionMatrix,
            handleActivatedPointsInPathRotation
        } = this.props;

        const {pathOfLocalModels} = this.props.explorationPath;
        const getCurrentModelLocation = val => {

            // if (Math.abs(Math.round(val) - val) < 0.02) {
            //     val = Math.round(val);
            // }

            const lenReverseIdxMapTable = reverseIdxMapTable.length;
            if (Number.isInteger(val)) {
                for (let i = 0; i < lenReverseIdxMapTable; i++) {
                    if (val === reverseIdxMapTable[i]) {
                        return pathOfLocalModels[i];
                    }
                }
            }

            for (let i = 0; i < lenReverseIdxMapTable - 1; i++) {
                if (val > reverseIdxMapTable[i] && val < reverseIdxMapTable[i + 1]) {
                    return [pathOfLocalModels[i], pathOfLocalModels[i + 1]];
                }
            }
        };

        const svgDOM = findDOMNode(this);
        const canvasWidth = svgDOM.clientWidth, canvasHeight = svgDOM.clientHeight;
        const {dimNames} = this.props;
        const svgRoot = d3.select(svgDOM);
        const rootGroup = svgRoot.select('g#root-group');
        const glyphGroup = rootGroup.select('g#glyph-group'),  // glyph above each column
            rankitemGroup = rootGroup.select('g#rankitem-group'),  // feature name rects
            rankedgeGroup = rootGroup.select('g#rankedge-group'),  // edges between rank items
            endpointGroup = rootGroup.select('g#endpoint-group'),  // Endpoints for non-connections
            progressBarGroup = rootGroup.select('g#progressbar-group');  // draggable progressbar

        /**
         * Constants
         * @type {number}
         */
        const LEFT_RIGHT_PADDING = 30, TOP_PADDING = 150, BOTTOM_PADDING = 5;
        const FEATURE_RECT_WIDTH = 90, FEATURE_RECT_HEIGHT = 18;
        const WEIGHT_BAR_HEIGHT = 20, WEIGHT_BAR_WIDTH = 40, WEIGHT_BAR_LEFT_RIGHT_PADDING = 5,
            WEIGHT_BAR_TOP_PADDING = 7, WEIGHT_BAR_GAP = 11, WEIGHT_BAR_TEXT_LEN = 20;

        /**
         * Get all horizontal coordinates of the labels
         */
            // const xCoords = d3.range(modelSeries.length).map(
            //     x => x / (modelSeries.length-1) * (canvasWidth - 2*LEFT_RIGHT_PADDING) + LEFT_RIGHT_PADDING
            // );
            // const yCoords = d3.range(weightRankings[0].length).map(
            //     y => y / (weightRankings[0].length-1) * (canvasHeight - TOP_PADDING - BOTTOM_PADDING)
            // );
        const xCoordsScale = x => x / (modelSeries.length - 1) * (canvasWidth - 2 * LEFT_RIGHT_PADDING - FEATURE_RECT_WIDTH) + LEFT_RIGHT_PADDING,
            // yCoordsScale = y => y / (weightRankings[0].length - 1) * (canvasHeight - TOP_PADDING - BOTTOM_PADDING) + TOP_PADDING;
            yCoordsScale = y => WEIGHT_BAR_TOP_PADDING + y * (WEIGHT_BAR_HEIGHT + WEIGHT_BAR_GAP);

        const appendTextBox = (r) => {
            r.append('rect')
                .attr('x', -FEATURE_RECT_WIDTH / 2)
                .attr('y', -FEATURE_RECT_HEIGHT / 2)
                .attr('width', FEATURE_RECT_WIDTH)
                .attr('height', FEATURE_RECT_HEIGHT)
                .attr('rx', 2)
                .attr('ry', 2)
                .style('stroke-width', 0.5)
                .style('stroke', '#333')
                .style('fill', '#eee');

            r.append('text')
                .attr('x', 0)
                .attr('y', 0)
                .attr('alignment-baseline', 'middle')
                .attr('text-anchor', 'middle')
                .attr('font-size', '9')
                .text(d => dimNames[d['weightIdx']]);
        };

        // Construct the target data
        const weightData = d3.cross(
            d3.range(modelSeries.length), d3.range(weightRankings[0].length)
        ).map(d => ({gridX: d[0], gridY: d[1], weightIdx: weightRankings[d[0]][d[1]]['featureIdx']}));

        /**
         * Draw the rankitems
         */
        const appendFeatureBox = (g) => {
            g.append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('height', WEIGHT_BAR_GAP / 2
                    + WEIGHT_BAR_HEIGHT * weightRankings[0].length
                    + WEIGHT_BAR_GAP * (weightRankings[0].length - 1)
                    + WEIGHT_BAR_GAP / 2
                )
                .attr('width', FEATURE_RECT_WIDTH) // canvasHeight - TOP_PADDING - BOTTOM_PADDING)
                .attr('rx', 4)
                .attr('ry', 4)
                .style('stroke', (d, i) => labelNormalColorMap[modelSeries[i]['targetLabel'][0]])
                .style('stroke-width', 2)
                .style('stroke-dasharray', (d, i) => (modelSeries[i]['interpolation'] === true) ? '7 4' : '6 0')
                .style('stroke-opacity', (d, i) => (modelSeries[i]['interpolation'] === true) ? 0.6 : 1)
                .style('fill', 'none');
            // .style('fill', (d, i) => {
            //                 //     if (modelSeries[i]['interpolation'] === true) {
            //                 //         return 'none';
            //                 //     } else {
            //                 //         return labelNormalColorMap[modelSeries[i]['targetLabel'][0]];
            //                 //     }
            //                 // })

            g.selectAll('line.row-separator')
                .data(d => d.slice(0, d.length - 1))
                .enter()
                .append('line')
                .classed('row-separator', true)
                .attr('x1', 0)
                .attr('y1', (d, i) => yCoordsScale(i) + WEIGHT_BAR_HEIGHT + WEIGHT_BAR_GAP / 2)
                .attr('x2', FEATURE_RECT_WIDTH)
                .attr('y2', (d, i) => yCoordsScale(i) + WEIGHT_BAR_HEIGHT + WEIGHT_BAR_GAP / 2)
                .style('stroke', (d, i) => labelNormalColorMap[modelSeries[d['modelSeriesIdx']]['targetLabel'][0]])
                .style('stroke-width', 2)
                .style('stroke-dasharray', (d, i) => (modelSeries[d['modelSeriesIdx']]['interpolation'] === true) ? '7 4' : '6 0')
                .style('stroke-opacity', (d, i) => (modelSeries[d['modelSeriesIdx']]['interpolation'] === true) ? 0.6 : 1);

            g.selectAll('rect.weight-bar')
                .data(d => d)
                .enter()
                .append('rect')
                .classed('weight-bar', true)
                .attr('x', 5)  // WEIGHT_BAR_TEXT_LEN)
                .attr('y', (d2, yi) => yCoordsScale(yi))
                .attr('width', d2 => Math.abs(d2['value']) * (FEATURE_RECT_WIDTH - 2 * WEIGHT_BAR_LEFT_RIGHT_PADDING))
                .attr('height', WEIGHT_BAR_HEIGHT)
                .attr('rx', 2)
                .attr('ry', 2)
                .style('fill', '#bbbbbb')
                .style('stroke', '#231f20')
                .style('stroke-width', 0.5);

            g.selectAll('text.weight-bar-text')
                .data(d => d)
                .enter()
                .append('text')
                .classed('weight-bar-text', true)
                .attr('x', 5)
                .attr('y', (d2, yi) => yCoordsScale(yi) + WEIGHT_BAR_HEIGHT / 2)
                .attr('font-size', 12)
                .attr('alignment-baseline', 'middle')
                // .text(d2 => d2['value'].toFixed(3));
                .text(d2 => dimNames[d2['featureIdx']]);
        };

        rankitemGroup.selectAll('g.feature-boxes')
            .data(weightRankings)
            .enter()
            .append('g')
            .attr('id', (d, i) => 'feature-box-' + i)
            .classed('feature-boxes', true)
            .attr('transform', (d, i) =>
                'translate(' + xCoordsScale(i) + ',' + TOP_PADDING + ')'
            )
            .call(appendFeatureBox);

        // rankitemGroup.selectAll('g.feature-boxes')
        // // .data(d3.cross(d3.range(modelSeries.length), weightRankings[0].length))
        //     .data(weightData)
        //     .enter()
        //     .append('g')
        //     .attr('id', d => 'feature-box-' + d['gridX'] + '-' + d['gridY'])
        //     .classed('feature-boxes', true)
        //     .attr('transform', d =>
        //         'translate(' + xCoordsScale(d['gridX']) + ',' + yCoordsScale(d['gridY']) + ')'
        //     )
        //     .call(appendTextBox);

        /**
         * Draw the edges
         */
        const curveGen = d3.linkHorizontal()
            .source(d => ({type: 'source', grid: d['source']}))
            .target(d => ({type: 'target', grid: d['target']}))
            .x(e => {
                let xCoord = xCoordsScale(e['grid'][0]);
                if (e['type'] === 'source') {
                    return xCoord + FEATURE_RECT_WIDTH;  // / 2;
                } else {
                    return xCoord; // - FEATURE_RECT_WIDTH / 2;
                }
            })
            .y(e => yCoordsScale(e['grid'][1]) + TOP_PADDING + WEIGHT_BAR_HEIGHT / 2); //  + WEIGHT_BAR_TOP_PADDING + WEIGHT_BAR_HEIGHT/2);

        rankedgeGroup.selectAll('path.feature-edges')
            .data(edges)
            .enter()
            .append('path')
            .attr('d', curveGen)
            .classed('feature-edges', true)
            .style('stroke', '#1890ff')
            .style('stroke-width', 9)
            .style('stroke-opacity', 0.7)
            .style('fill', 'none');

        // endpointGroup.selectAll('g.endpoints')
        //     .data(endpoints)
        //     .enter()
        //     .append('circle')
        //     .attr('cx', d => (d['type'] === 'start')
        //         ? xCoordsScale(d['grid'][0]) - FEATURE_RECT_WIDTH / 2
        //         : xCoordsScale(d['grid'][0]) + FEATURE_RECT_WIDTH / 2
        //     )
        //     .attr('cy', d => yCoordsScale(d['grid'][1]))
        //     .attr('r', 0.5 * 0.45 * FEATURE_RECT_HEIGHT)
        //     .style('fill', d => (d['type'] === 'start') ? '#41ab5d' : '#ef3b2c')
        //     .style('stroke', '#555')
        //     .style('stroke-width', 0.3);

        /**
         * Add the selection bar
         */
        const sliderWidth = canvasWidth - 2 * LEFT_RIGHT_PADDING - FEATURE_RECT_WIDTH;
        const slider = sliderBottom()
            .min(0)
            .max(modelSeries.length - 1)
            .width(sliderWidth)
            .displayFormat(val => {
                const valFloor = Math.floor(val), valCeiling = Math.ceil(val);

                if (valFloor === valCeiling) {
                    return 'LocalBoundary ' + getCurrentModelLocation(val);
                } else {
                    return getCurrentModelLocation(val).map(d => 'LocalBoundary ' + d).join(' | ');
                }
            })
            .tickFormat(null)
            .ticks(modelSeries.length)
            .default(0)
            .on('onchange', val => {
                progressBarGroup.select('line#vertical-place')
                    .attr('x1', sliderWidth * (val / (modelSeries.length - 1)))
                    .attr('x2', sliderWidth * (val / (modelSeries.length - 1)));
            })
            .on('end', val => {
                console.log(val);

                const valFloor = Math.floor(val), valCeiling = Math.ceil(val);

                /**
                 * Main procedure for updating the rotation matrix
                 */
                if (valFloor === valCeiling) {



                    updateGlobalProjectionMatrix(modelSeries[valFloor]['initSideMatrix']);
                } else {
                    /**
                     * Compute the activated points and the opacity
                     */
                    const leftOpacity = valCeiling - val;
                    const rightOpacity = 1 - leftOpacity;
                    const leftModel = modelSeries[valFloor], rightModel = modelSeries[valCeiling]

                    // find the intersections of the pointsets
                    // const leftKNNSet = new Set(leftModel['knns']), rightKNNSet = new Set(rightModel['knns']);

                    const activatedPoints = new Set(
                        union(leftModel['knns'], rightModel['knns'])
                    );
                    let opacityMapping = [];
                    const leftRightIntersection = intersection(leftModel['knns'], rightModel['knns']);

                    leftRightIntersection.forEach(d => {
                        opacityMapping[d] = 1.0;
                    });
                    without(leftModel['knns'], ...leftRightIntersection).forEach(d => {
                        opacityMapping[d] = leftOpacity;
                    });
                    without(rightModel['knns'], ...leftRightIntersection).forEach(d => {
                        opacityMapping[d] = rightOpacity;
                    });

                    let previousMatrix = modelSeries[valFloor]['initSideMatrix'],
                        nextMatrix = modelSeries[valCeiling]['initSideMatrix'];

                    const intermediateMatrix = numeric.add(
                        previousMatrix,
                        numeric.mul(
                            val - valFloor,
                            numeric.sub(nextMatrix, previousMatrix)
                        )
                    );

                    // updateGlobalProjectionMatrix(
                    //     numeric.transpose(
                    //         gramSchmidt(...numeric.transpose(intermediateMatrix))
                    //     )
                    // );

                    handleActivatedPointsInPathRotation(
                        activatedPoints,
                        opacityMapping,
                        numeric.transpose(
                            gramSchmidt(...numeric.transpose(intermediateMatrix))
                        )
                    );
                }
            });

        progressBarGroup
            .attr('transform', 'translate(' + (LEFT_RIGHT_PADDING + FEATURE_RECT_WIDTH / 2) + ', 10)')
            .call(slider);

        const verticalPlaceLine = progressBarGroup.append('line')
            .attr('id', 'vertical-place')
            .attr('x1', 0)
            .attr('x2', 0)
            .attr('y1', 10)
            .attr('y2', canvasHeight - 10 - BOTTOM_PADDING)
            .style('stroke', '#000')
            .style('stroke-width', 0.5)
            .style('stroke-opacity', 0);

        progressBarGroup.select('g.slider').select('g.parameter-value').select('path')
            .on('mouseenter', () => {
                verticalPlaceLine.transition().duration(200).style('stroke-opacity', 1);
            })
            .on('mouseleave', () => {
                verticalPlaceLine.transition().duration(200).style('stroke-opacity', 0);
            })

        //progressbarGroup.append();
    };

    componentWillReceiveProps(nextProps) {

    }

    render() {
        const {height, explorationPath, activated, localModels} = this.props;

        const {pathOfLocalModels, interpolations} = explorationPath;

        return (
            <svg width="100%" height={height}>
                <g id="root-group">
                    <g id="progressbar-group"/>
                    <g id="glyph-group"/>
                    <g id="endpoint-group"/>
                    <g id="rankedge-group"/>
                    <g id="rankitem-group"/>
                </g>
            </svg>
        );
    };

}