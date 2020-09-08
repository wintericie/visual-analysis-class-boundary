import React, {Component} from 'react';
import {findDOMNode} from 'react-dom';
import * as d3 from 'd3';
import d3Tip from 'd3-tip';
import union from 'lodash/union';
import intersection from "lodash/intersection";
import without from "lodash/without";
import throttle from 'lodash/throttle';
import numeric from 'numericjs';
import flattenDeep from "lodash/flattenDeep";

import {defaultBlueColor, defaultColor, labelNormalColorMap} from '../../utils/Color';
import gramSchmidt from '../../utils/gramschmidt';
import normalizeToUnit from '../../utils/normalizetounit';
import rotateVector from "../../utils/rotatevector";
import {sliderBottom} from "../../utils/d3-simple-slider";
import '../../styles/pathcanvas.css';


export default class PathCanvas extends Component {
    constructor(props) {
        super(props);

        this.svgRef = React.createRef();
        this.state = {};
    }

    handleStartAnimation() {

    }

    shouldComponentUpdate() {
        return false;
    }

    componentDidMount() {

        const {
            modelSeries, scatterplotSeries, weightRankings, connections
        } = this.initializeData(this.props);


        this.initializeCanvas(
            this.props,
            this.svgRef.current.getBoundingClientRect().width,
            modelSeries,
            scatterplotSeries,
            weightRankings,
            connections
        );
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.activatedExplorationPathIdx !== this.props.activatedExplorationPathIdx) {
            // a full reset
            const rootGroup = d3.select(findDOMNode(this)).select('g#root-group');
            const stableRootGroup = d3.select(findDOMNode(this)).select('g#stable-root-group');
            rootGroup.select('g#scatterplot-group').selectAll('g').remove();
            rootGroup.select('g#scatterplot-edge-group').selectAll('path').remove();
            stableRootGroup.select('g#progressbar-group').selectAll('g').remove();
            stableRootGroup.select('g#progressbar-frame').selectAll('rect').remove();
            stableRootGroup.select('g#label-group').selectAll('g').remove();
            stableRootGroup.select('g#label-line-group').selectAll('line').remove();

            const {
                modelSeries, scatterplotSeries, weightRankings, connections
            } = this.initializeData(nextProps);

            this.initializeCanvas(
                nextProps,
                this.svgRef.current.getBoundingClientRect().width,
                modelSeries,
                scatterplotSeries,
                weightRankings,
                connections
            );
        }
    }

    initializeData(props) {
        const {
            explorationPath, localModels,
            dataVectors, label, labelNames
        } = props;

        /**
         * Initialize all the paths
         */

            // Expand the path into pieces
        const {pathOfLocalModels, interpolations} = explorationPath;

        let modelSeries = interpolations.map((inter, i) => {
            const localModelWithIdx = localModels[pathOfLocalModels[i]];

            if (inter.length === 0) {
                return [{
                    index: pathOfLocalModels[i],
                    model: localModelWithIdx
                }];
            } else {
                return [{
                    index: pathOfLocalModels[i],
                    model: localModelWithIdx,
                },
                    interpolations[i].map((d, ii) => ({
                        index: pathOfLocalModels[i],
                        subIndex: ii,
                        model: {...d, interpolation: true}
                    }))
                ]
            }
        });

        modelSeries.push({
            index: pathOfLocalModels[pathOfLocalModels.length - 1],
            model: localModels[pathOfLocalModels[pathOfLocalModels.length - 1]]
        });

        modelSeries = flattenDeep(modelSeries);

        /**
         * Get feature importance ranking
         */
        const lenWeights = 5;
        const weightRankings = modelSeries.map((m, modelSeriesIdx) => {
            let wEnum = Array.from(m.model.localSVM.coef[0].entries());
            wEnum.sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
            return wEnum.slice(0, lenWeights).map(w => ({
                modelSeriesIdx: modelSeriesIdx,
                featureIdx: w[0],
                value: w[1],
                // haveLeftSoc: false,
                // haveRightSoc: false
            }));
        });

        /**
         * Compute common points between two models
         */
        let connections = [];
        for (let i = 0; i < modelSeries.length - 1; i++) {
            const currentModel = modelSeries[i].model;
            const nextModel = modelSeries[i + 1].model;

            const commonData = intersection(currentModel.knns, nextModel.knns);

            if (commonData.length === 0) {
                connections.push({isEmpty: true});
            } else {
                const commonLabels = commonData.map(c => label[c]);
                let counterArray = new Array(labelNames.length).fill(0);

                commonLabels.forEach(c => {
                    counterArray[c]++
                });
                connections.push({
                    isEmpty: false,
                    commonLabels: counterArray,
                    commonData: commonData,
                    labelMax: counterArray.indexOf(Math.max(...counterArray))
                })
            }
        }

        /**
         * Compute the interpolate zig-zag matrices
         */
        const lenModelSeries = modelSeries.length;
        let scatterplotSeries = [];

        for (let i = 0; i < lenModelSeries; i++) {
            let scatterplot = {};

            // First scatter block
            const currentModelSeriesObj = modelSeries[i];
            const currentModel = currentModelSeriesObj.model;
            const pointIndices = union(currentModel.knns, currentModel.coverage);
            const currentDataVectors = pointIndices.map(p => dataVectors[p]);
            const currentLabel = pointIndices.map(p => label[p]);

            // get point projections
            let projectionMatrix = currentModel.initSideMatrix;
            // const projT = numeric.transpose(projectionMatrix);
            let svmOnRightProjectionMatrix = projectionMatrix; //numeric.transpose(
            // [projT[1], projT[0]]
            // );
            let isSVMAxisOnLeft = true;

            // if (i % 2 === 1) {
            if (true) {
                // swap the two axis
                const projT = numeric.transpose(projectionMatrix);
                projectionMatrix = numeric.transpose(
                    [projT[1], projT[0]]
                );
                isSVMAxisOnLeft = false;
                svmOnRightProjectionMatrix = numeric.dot(
                    currentModel.initSideMatrix,
                    [[-1, 0], [0, 1]]
                );
            }


            // get the projected coordinates
            let projection = numeric.dot(
                currentDataVectors, projectionMatrix);

            // scale coordinates into [-1, 1]
            // const leftScaler = d3.scaleLinear().domain(
            //     d3.extent(projection, p => p[0])
            // ).range(
            //     // [-1, 1]
            //     d3.extent(projection, p => p[0])
            // );
            // const rightScaler = d3.scaleLinear().domain(
            //     d3.extent(projection, p => p[1])
            // ).range(
            //     // [-1, 1]
            //     d3.extent(projection, p => p[1])
            // );
            //
            // for (let pi = 0; pi < projection.length; pi++) {
            //     projection[pi][0] = leftScaler(projection[pi][0]);
            //     projection[pi][1] = rightScaler(projection[pi][1]);
            // }

            // judge the SVM split line
            let splitLine = {};
            // if (isSVMAxisOnLeft) {
            //     splitLine.x1 = splitLine.x2 = leftScaler(numeric.dot(
            //         currentModel.planeSamples[0],
            //         projectionMatrix
            //     )[0]);  // do not forget the scaler
            //     [splitLine.y1, splitLine.y2] = [-1, 1]; // d3.extent(projection, p => p[1]);
            // } else {
            //     splitLine.y1 = splitLine.y2 = rightScaler(numeric.dot(
            //         currentModel.planeSamples[0],
            //         projectionMatrix
            //     )[1]);  // do not forget the scaler
            //     [splitLine.x1, splitLine.x2] = [-1, 1]; // d3.extent(projection, p => p[0]);
            // }


            let beforeCommonPointIndices, afterCommonPointIndices;

            // compute common point indices

            if (i < lenModelSeries - 1) {
                // compute after common indices
                const nextModel = modelSeries[i + 1].model;
                const nextPointIndices = union(nextModel.knns, nextModel.coverage);
                afterCommonPointIndices = new Set(intersection(pointIndices, nextPointIndices));
            }

            if (i > 0) {
                // compute before common indices
                // const previousModel = modelSeries[i - 1].model;
                // const previousPointIndices = union(previousModel.knns, previousModel.coverage);
                beforeCommonPointIndices = scatterplotSeries[scatterplotSeries.length - 2].afterCommonPointIndices;
                //intersection(pointIndices, previousPointIndices);
            }

            // compute the coordinates of the SVM split line
            // let svmAxisIndex = (isSVMAxisOnLeft)
            // if (isSVMAxisOnLeft)

            scatterplot.projectionMatrix = projectionMatrix;
            scatterplot.svmOnRightProjectionMatrix = svmOnRightProjectionMatrix;
            scatterplot.coords = projection;
            scatterplot.cosineRotation = 1.0;  // align with the scatterplot rotation for intermediate scatterplots
            scatterplot.sineRotation = 0.0;  // align with the scatterplot rotation for intermediate scatterplots
            scatterplot.pointIndices = pointIndices.slice(0);
            scatterplot.beforeCommonPointIndices = beforeCommonPointIndices;
            scatterplot.afterCommonPointIndices = afterCommonPointIndices;
            scatterplot.targetLabel = label[currentModel.target[0]];
            scatterplot.label = currentLabel;
            scatterplot.isInterpolation = currentModel.interpolation === true;
            scatterplot.isInter = false;
            scatterplot.isSVMAxisOnLeft = isSVMAxisOnLeft;
            scatterplot.localModelIdx = currentModelSeriesObj.index;
            scatterplot.localModelSubIdx = currentModelSeriesObj.subindex;
            scatterplot._currentModel = currentModel;
            scatterplot.splitLine = splitLine;

            scatterplotSeries.push(scatterplot);

            // Intermediate scatter block
            if (i !== lenModelSeries - 1) {
                let interScatterplot = {};

                const nextModelSeriesObj = modelSeries[i + 1];
                const nextModel = nextModelSeriesObj.model;
                const nextPointIndices = union(nextModel.knns, nextModel.coverage);
                const allPointIndices = union(pointIndices, nextPointIndices);
                const commonPointIndices = afterCommonPointIndices;  // intersection(pointIndices, nextPointIndices);

                const interDataVectors = allPointIndices.map(p => dataVectors[p]);
                const interLabel = allPointIndices.map(p => label[p]);

                // judge the direction
                const isCurrentSVMAxisOnLeft = i % 2 === 0;
                let projectionMatrix;

                const currentModelNormal = numeric.transpose(currentModel.initSideMatrix)[0];
                const nextModelNormal = numeric.transpose(nextModel.initSideMatrix)[0];

                projectionMatrix = numeric.transpose([
                    nextModelNormal, currentModelNormal
                ]);

                // compute the Grad-Schmidt-fied projection matrix
                // let orthoProjectionMatrix = gramSchmidt(...numeric.transpose(projectionMatrix));
                let gramMatrix = gramSchmidt(...[
                    currentModelNormal, nextModelNormal
                ]);
                const transposedProjectionMatrix = numeric.transpose(projectionMatrix);

                let orthoProjectionMatrix = [normalizeToUnit(gramMatrix[1]), normalizeToUnit(gramMatrix[0])];

                // angle between gramSchmidt and the n2 should be in 90d
                if (numeric.dot(orthoProjectionMatrix[1], transposedProjectionMatrix[1]) < 0) {
                    orthoProjectionMatrix[1] = numeric.dot(orthoProjectionMatrix[1], -1.0);
                }

                // compute the rotation matrix for 2-D scatterplots (cosine(theta))
                const normalVectorAngleBisector = normalizeToUnit(
                    numeric.add(transposedProjectionMatrix[0], transposedProjectionMatrix[1])
                );
                const gradSchmidtBisector = normalizeToUnit(
                    numeric.add(orthoProjectionMatrix[0], orthoProjectionMatrix[1])
                );
                const cosineRotation = numeric.dot(normalVectorAngleBisector, gradSchmidtBisector);
                let sineRotation = Math.sqrt(1 - cosineRotation * cosineRotation);
                const isMinusTheta = (numeric.dot(transposedProjectionMatrix[0], transposedProjectionMatrix[1]) > 0) ? 1 : -1;
                sineRotation *= isMinusTheta;

                // compute the angle of two normals before and after
                const cosineTwoNormals = Math.abs(
                    numeric.dot(transposedProjectionMatrix[0], transposedProjectionMatrix[1])
                );

                // transpose the required projection matrix
                orthoProjectionMatrix = numeric.transpose(orthoProjectionMatrix);

                // let projection = numeric.dot(interDataVectors, projectionMatrix);
                let orthoProjection = numeric.dot(interDataVectors, orthoProjectionMatrix);

                interScatterplot.projectionMatrix = projectionMatrix;
                interScatterplot.orthoProjectionMatrix = orthoProjectionMatrix;
                interScatterplot.coords = orthoProjection;
                interScatterplot.cosineRotation = cosineRotation;
                interScatterplot.sineRotation = sineRotation;
                interScatterplot.cosineTwoNormals = cosineTwoNormals;
                interScatterplot.pointIndices = allPointIndices;
                interScatterplot.commonPointIndices = commonPointIndices;
                interScatterplot.label = interLabel;
                interScatterplot.targetLabels = [label[currentModel.target[0]], label[nextModel.target[0]]];
                interScatterplot.isInter = true;
                interScatterplot.isCurrentSVMAxisOnLeft = isCurrentSVMAxisOnLeft;
                interScatterplot.previousLocalModelIdx = currentModelSeriesObj.index;
                interScatterplot.previousLocalModelSubIdx = currentModelSeriesObj.subindex;
                interScatterplot.nextLocalModelIdx = nextModelSeriesObj.index;
                interScatterplot.nextLocalModelSubIdx = nextModelSeriesObj.subindex;

                scatterplotSeries.push(interScatterplot);
            }
        }


        // Compute a global scale
        let xMinExtents = 100000000, xMaxExtents = -100000000, yMinExtents = 100000000, yMaxExtents = -100000000;
        for (let i = 0; i < scatterplotSeries.length; i++) {
            const scatterplot = scatterplotSeries[i];

            const xExtent = d3.extent(scatterplot.coords, c => c[0]);
            const yExtent = d3.extent(scatterplot.coords, c => c[1]);

            // xMinExtents.push(xExtent[0]);
            // xMaxExtents.push(xExtent[1]);
            // yMinExtents.push(yExtent[0]);
            // yMaxExtents.push(yExtent[1]);

            if (xExtent[0] < xMinExtents) {
                xMinExtents = xExtent[0];
            }
            if (xExtent[1] > xMaxExtents) {
                xMaxExtents = xExtent[1];
            }
            if (yExtent[0] < yMinExtents) {
                yMinExtents = yExtent[0];
            }
            if (yExtent[1] > yMaxExtents) {
                yMaxExtents = yExtent[1];
            }

        }

        let globalXExtent = [xMinExtents, xMaxExtents];
        let globalYExtent = [yMinExtents, yMaxExtents];

        const leftScaler = d3.scaleLinear().domain(globalXExtent).range([-1, 1]);
        const rightScaler = d3.scaleLinear().domain(globalYExtent).range([-1, 1]);

        // let i = 0;

        for (let i = 0; i < scatterplotSeries.length; i++) {
            const scatterplot = scatterplotSeries[i];
            let {coords} = scatterplot;
            const lenCoords = coords.length;

            for (let j = 0; j < lenCoords; j++) {
                coords[j][0] = leftScaler(coords[j][0]);
                coords[j][1] = rightScaler(coords[j][1]);
            }

            if (scatterplot.splitLine !== undefined) {
                let splitLine = {};
                const {isSVMAxisOnLeft, _currentModel, projectionMatrix} = scatterplot;

                if (isSVMAxisOnLeft) {
                    splitLine.x1 = splitLine.x2 = leftScaler(numeric.dot(
                        _currentModel.planeSamples[0],
                        projectionMatrix
                    )[0]);  // do not forget the scaler
                    [splitLine.y1, splitLine.y2] = [-1, 1]; // d3.extent(projection, p => p[1]);
                } else {
                    splitLine.y1 = splitLine.y2 = rightScaler(numeric.dot(
                        _currentModel.planeSamples[0],
                        projectionMatrix
                    )[1]);  // do not forget the scaler
                    [splitLine.x1, splitLine.x2] = [-1, 1]; // d3.extent(projection, p => p[0]);
                }

                scatterplot.splitLine = splitLine;
            }
        }

        return {
            modelSeries, scatterplotSeries, weightRankings, connections
        };
    }

    computeZigZagPositions = (scatterplotSeriesRaw, initX, initY, initDirectVec, edgeLength) => {

        let turnAntiClockwiseForInter = false;
        // let turnAntiClockwiseForInter = true;

        scatterplotSeriesRaw[0].canvasX = initX;
        scatterplotSeriesRaw[0].canvasY = initY;
        scatterplotSeriesRaw[0].canvasDirectVec = initDirectVec;
        scatterplotSeriesRaw[0].canvasRotationAntiClockwise = Math.atan2(initDirectVec[1], initDirectVec[0]) / Math.PI * 180;
        turnAntiClockwiseForInter = !turnAntiClockwiseForInter;

        /**
         * Attention: use screen coordinate system
         *
         * x right, y down
         */

        const lenScatterplotSeriesRaw = scatterplotSeriesRaw.length;

        for (let i = 1; i < lenScatterplotSeriesRaw; i++) {
            const scatterplot = scatterplotSeriesRaw[i];
            const prevScatterplot = scatterplotSeriesRaw[i - 1];

            const prevX = prevScatterplot.canvasX, prevY = prevScatterplot.canvasY,
                prevDirectVec = prevScatterplot.canvasDirectVec;// prevanvasRotationAntiClockwise = prevScatterplot.canvasRotationAntiClockwise;

            if (scatterplot.isInter) {
                /**
                 * Inter scatterplot
                 */
                const {cosineTwoNormals} = scatterplot;
                const stepVec = numeric.dot(prevDirectVec, edgeLength);

                const [canvasX, canvasY] = numeric.add([prevX, prevY], stepVec);

                const canvasDirectVec = rotateVector(
                    prevDirectVec, cosineTwoNormals, turnAntiClockwiseForInter, true
                );

                const bisectorVec = rotateVector(
                    prevDirectVec, Math.sqrt((1 + cosineTwoNormals) / 2), turnAntiClockwiseForInter, true
                );

                // const bisector = normalizeToUnit(numeric.add(prevDirectVec, ))

                // assign new values
                scatterplot.canvasX = canvasX;
                scatterplot.canvasY = canvasY;
                scatterplot.canvasDirectVec = canvasDirectVec;
                // scatterplot.canvasRotationAntiClockwise = Math.atan2(bisectorVec[1], bisectorVec[0]) / Math.PI * 180;
                // scatterplot.canvasRotationAntiClockwise = 0;
                scatterplot.canvasRotationAntiClockwise = prevScatterplot.canvasRotationAntiClockwise;

                // finished, turn the rotation direction indicator
                turnAntiClockwiseForInter = !turnAntiClockwiseForInter;
            } else {
                /**
                 * Not inter
                 */
                const stepVec = numeric.dot(prevDirectVec, edgeLength);

                const [canvasX, canvasY] = numeric.add([prevX, prevY], stepVec);

                // assign new values
                scatterplot.canvasX = canvasX;
                scatterplot.canvasY = canvasY;
                scatterplot.canvasDirectVec = prevDirectVec.slice();
                scatterplot.canvasRotationAntiClockwise = Math.atan2(prevDirectVec[1], prevDirectVec[0]) / Math.PI * 180;
            }
        }

        return scatterplotSeriesRaw;
    };

    initializeCanvas(props, svgWidth, modelSeries, scatterplotSeriesRaw, weightRankings, connections) {
        const svgRoot = d3.select(findDOMNode(this));
        const rootGroup = svgRoot.select('g#root-group');
        const stableRootGroup = svgRoot.select('g#stable-root-group');
        const scatterplotGroup = rootGroup.select('g#scatterplot-group');
        const edgeGroup = rootGroup.select('g#scatterplot-edge-group');
        const progressBarGroup = stableRootGroup.select('g#progressbar-group');  // draggable progressbar
        const labelGroup = stableRootGroup.select('g#label-group');
        // const labelLineGroup = stableRootGroup.select('g#label-line-group');
        const progressbarFrameGroup = stableRootGroup.select('g#progressbar-frame');
        const {pathOfLocalModels} = props.explorationPath;

        const {
            height,
            dimNames,
            labelNames,
            updateGlobalProjectionMatrix,
            handleActivatedPointsInPathRotation,
            handleLocalModelsHighlighted,
            handlePointsHighlighted,
            handleHoverPointInPathView
        } = props;

        /**
         * Dimensions
         * @type {number}
         */
        const SQRT_2 = Math.sqrt(2);
        const DIAG_RADIUS = height / 4 - 16;
        const GUTTER = DIAG_RADIUS; // 13; the old value for previous review
        const SCATTERPLOT_WIDTH = DIAG_RADIUS * SQRT_2;
        const INTER_SCATTERPLOT_WIDTH = SCATTERPLOT_WIDTH + 10;
        const SCATTERPLOT_WIDTH_INTER_SHIFT = 50;

        const VERTICAL_CENTER = height / 2 + 17;
        const SCATTERGROUP_VERTICAL_SHIFT = 20;
        const LEFT_PADDING = DIAG_RADIUS + 20;

        const DOT_R = 1.5;
        const SCATTER_INNER_PADDING = 10;

        const WEIGHT_BAR_START_SHIFT = 0;  // 10
        const WEIGHT_BAR_WIDTH = 30;  // 68
        const WEIGHT_BAR_HEIGHT = SCATTERPLOT_WIDTH / 5;  // 18
        const WEIGHT_BAR_GUTTER = 0;  // 5
        const FEATURE_FONT_SIZE = 13;

        const SLIDER_Y = 18;
        const PROGRESSBAR_LEFT_PADDING = 100;

        // const scatterplotSeries = scatterplotSeriesRaw;
        const scatterplotSeries = this.computeZigZagPositions(
            scatterplotSeriesRaw,
            LEFT_PADDING,
            VERTICAL_CENTER,
            [Math.sqrt(2) / 2, -Math.sqrt(2) / 2],
            DIAG_RADIUS * 2 + 10
        );

        /**
         * The global rotation
         */
        const rootGroupRotateVec = [
            scatterplotSeries[scatterplotSeries.length - 1].canvasX - scatterplotSeries[0].canvasX,
            scatterplotSeries[scatterplotSeries.length - 1].canvasY - scatterplotSeries[0].canvasY
        ];

        const rootGroupRotateAngle = -Math.atan2(rootGroupRotateVec[1], rootGroupRotateVec[0]) / Math.PI * 180;

        rootGroup.attr('transform',
            `translate(0,${SCATTERGROUP_VERTICAL_SHIFT})
            rotate(${rootGroupRotateAngle} ${scatterplotSeries[0].canvasX} ${scatterplotSeries[1].canvasY})`
        );

        /**
         * Scalers
         */

        const xScaler = d3.scaleLinear()
            .domain([-1, 1])
            .range([
                -0.5 * SCATTERPLOT_WIDTH + SCATTER_INNER_PADDING,
                0.5 * SCATTERPLOT_WIDTH - SCATTER_INNER_PADDING
            ]);
        const yScaler = d3.scaleLinear()
            .domain([-1, 1])
            .range([
                0.5 * SCATTERPLOT_WIDTH - SCATTER_INNER_PADDING,
                -0.5 * SCATTERPLOT_WIDTH + SCATTER_INNER_PADDING
            ]);

        const tooltip = d3Tip()
            .attr('class', 'd3-tip-scatterplot')
            .html(d => `<p>
                    Instance: ${d.index}
                </p>
                <p style="margin-bottom:0">
                    Label: <span style="color:${labelNormalColorMap[d.label]}">${labelNames[d.label]}</span>
                </p>
            `)
            .direction('n')
            .offset([-3, 0]);

        scatterplotGroup.call(tooltip);

        const appendScatterplots = (scatterplotGroupDOM) => {

            /**
             * Add feature boxes for the central scatterplots
             */
            scatterplotGroupDOM.filter(d => !d.isInter)
                .append('g')
                .classed('feature-weight-bars', true)
                // .attr('transform', (d, i) => `rotate(${(i % 2 === 0) ? 0 : -90})`)
                // .attr('transform', (d, i) => `rotate(0)`)
                .selectAll('rect')
                .data((d, i) => {
                    return weightRankings[i];
                })
                .enter()
                .append('rect')
                .classed('feature-weight-bars-rects', true)
                .attr('x', 0.5 * SCATTERPLOT_WIDTH + 1)
                .attr('y', (_d, _i) => WEIGHT_BAR_START_SHIFT + -0.5 * SCATTERPLOT_WIDTH + _i * (WEIGHT_BAR_HEIGHT + WEIGHT_BAR_GUTTER))
                .attr('width', _d => Math.abs(_d.value) * WEIGHT_BAR_WIDTH)
                .attr('height', WEIGHT_BAR_HEIGHT);
            // .style('fill', '#AEB8C2')
            // .style('stroke', '#AEB8C2');

            scatterplotGroupDOM.filter(d => !d.isInter)
                .append('g')
                .classed('feature-weight-bar-texts', true)
                .on('mouseenter', function (d, i) {
                    d3.select(this)
                        .selectAll('text')
                        .text((_d, _i) => `${dimNames[_d.featureIdx]}: ${_d.value.toFixed(3)}`);
                })
                .on('mouseleave', function () {
                    d3.select(this)
                        .selectAll('text')
                        .text((_d, _i) => `${dimNames[_d.featureIdx]}`);
                })
                .selectAll('text')
                .data((d, i) => {
                    return weightRankings[i];
                })
                .enter()
                .append('text')
                .attr('x', 0.5 * SCATTERPLOT_WIDTH + 3)
                .attr('y', (_d, _i) => WEIGHT_BAR_START_SHIFT + WEIGHT_BAR_HEIGHT / 2 - 0.5 * SCATTERPLOT_WIDTH + _i * (WEIGHT_BAR_HEIGHT + WEIGHT_BAR_GUTTER))
                .style('text-anchor', 'start')
                .style('alignment-baseline', 'central')
                .style('font-size', FEATURE_FONT_SIZE)
                .style('fill', '#333')
                .text((_d, _i) => `${dimNames[_d.featureIdx]}`);

            scatterplotGroupDOM.filter(d => !d.isInter)
                .append('text')
                .attr('x', 0)
                .attr('y', -SCATTERPLOT_WIDTH / 2 - 3)
                .classed('segment-name-text', true)
                .text(d => `Segment ${d.localModelIdx}`)
                .on('click', function (d, i) {
                    slider.value(i * 2);
                });

            scatterplotGroupDOM.append('rect')
                .classed('base-white-rect', true)
                .attr('x', d => (d.isInter) ? -0.5 * SCATTERPLOT_WIDTH - SCATTERPLOT_WIDTH_INTER_SHIFT / 2 : -0.5 * SCATTERPLOT_WIDTH)
                .attr('y', d => (d.isInter) ? -0.5 * SCATTERPLOT_WIDTH - SCATTERPLOT_WIDTH_INTER_SHIFT / 2 : -0.5 * SCATTERPLOT_WIDTH)
                .attr('rx', d => (d.isInter) ? 100 : 2)
                .attr('ry', d => (d.isInter) ? 100 : 2)
                .attr('width', d => (d.isInter) ? SCATTERPLOT_WIDTH + SCATTERPLOT_WIDTH_INTER_SHIFT : SCATTERPLOT_WIDTH)
                .attr('height', d => (d.isInter) ? SCATTERPLOT_WIDTH + SCATTERPLOT_WIDTH_INTER_SHIFT : SCATTERPLOT_WIDTH)
                .style('stroke', 'white')
                .style('stroke-width', d => (d.isInter) ? 1 : 3)
                .style('fill', 'white');

            scatterplotGroupDOM.append('rect')
                .classed('frame', true)
                .attr('x', d => (d.isInter) ? -0.5 * SCATTERPLOT_WIDTH - SCATTERPLOT_WIDTH_INTER_SHIFT / 2 : -0.5 * SCATTERPLOT_WIDTH)
                .attr('y', d => (d.isInter) ? -0.5 * SCATTERPLOT_WIDTH - SCATTERPLOT_WIDTH_INTER_SHIFT / 2 : -0.5 * SCATTERPLOT_WIDTH)
                .attr('rx', d => (d.isInter) ? 100 : 2)
                .attr('ry', d => (d.isInter) ? 100 : 2)
                .attr('width', d => (d.isInter) ? SCATTERPLOT_WIDTH + SCATTERPLOT_WIDTH_INTER_SHIFT : SCATTERPLOT_WIDTH)
                .attr('height', d => (d.isInter) ? SCATTERPLOT_WIDTH + SCATTERPLOT_WIDTH_INTER_SHIFT : SCATTERPLOT_WIDTH)
                .style('stroke', d => (d.isInter) ? '#555' : labelNormalColorMap[d.targetLabel])
                .style('stroke-width', d => (d.isInter) ? 1 : 3)
                .style('stroke-dasharray', d => (d.isInterpolation) ? '7 4' : null)
                .style('fill', 'white');

            scatterplotGroupDOM.append('g')
                .classed('scatter-points', true)
                .selectAll('circle')
                .data(d => d.pointIndices.map((pIndex, _i) => ({
                    pointIdx: pIndex,
                    coord: d.coords[_i],
                    label: d.label[_i],
                    cosineRotation: d.cosineRotation,
                    sineRotation: d.sineRotation
                })))
                .enter()
                .append('circle')
                .attr('id', _d => `p-${_d.pointIdx}`)
                .classed('small-point', true)
                .attr('cx', _d => {
                    // const {cosineRotation, sineRotation} = _d;
                    // const _x = xScaler(_d.coord[0]), _y = yScaler(_d.coord[1]);
                    // return _x * cosineRotation - _y * sineRotation;
                    // return _x;
                    return xScaler(_d.coord[0]);
                })
                // .attr('cy', _d => yScaler(_d.coord[1]))
                .attr('cy', _d => {
                    // const {cosineRotation, sineRotation} = _d;
                    // const _x = xScaler(_d.coord[0]), _y = yScaler(_d.coord[1]);
                    // return _x * sineRotation + _y * cosineRotation;
                    // return _y;
                    return yScaler(_d.coord[1]);
                })
                .attr('r', DOT_R)
                .style('fill', _d => labelNormalColorMap[_d.label])
                // .style('fill-opacity', 0.4)
                // .style('stroke', '#555')
                // .style('stroke-width', 0.25)
                .on('mouseenter', (d, i, n) => {
                    handleHoverPointInPathView(d.pointIdx);
                    tooltip.show({
                        index: d.pointIdx, label: d.label
                    }, n[i]);
                })
                .on('mouseleave', (d, i, n) => {
                    handleHoverPointInPathView(null);
                    tooltip.hide({}, n[i]);
                });

            scatterplotGroupDOM.filter(d => !d.isInter)
                .each(function (d, i) {

                    // Try to figure out the rectangle
                    const labelRect = d3.select(this).append('rect');
                    const {targetLabel, coords, label} = d;
                    const {x1, x2, y1, y2} = d.splitLine;

                    if (d.isSVMAxisOnLeft) {
                        // left - right, stat the
                        let leftRightCount = [0, 0];

                        for (let i = 0; i < d.label.length; i++) {
                            if (label[i] === targetLabel) {
                                if (coords[i][0] <= x1) leftRightCount[0]++;
                                else leftRightCount[1]++;
                            }
                        }

                        // test which side is the main one
                        if (leftRightCount[0] > leftRightCount[1]) {
                            // left side
                            labelRect.attr('x', -0.5 * SCATTERPLOT_WIDTH)
                                .attr('y', -0.5 * SCATTERPLOT_WIDTH)
                                .attr('width', xScaler(x1) + 0.5 * SCATTERPLOT_WIDTH)
                                .attr('height', SCATTERPLOT_WIDTH);
                        } else {
                            labelRect.attr('x', xScaler(x1))
                                .attr('y', -0.5 * SCATTERPLOT_WIDTH)
                                .attr('width', 0.5 * SCATTERPLOT_WIDTH - xScaler(x1))
                                .attr('height', SCATTERPLOT_WIDTH);
                        }
                    } else {
                        // up-down
                        let upDownCount = [0, 0];  // up down
                        for (let i = 0; i < d.label.length; i++) {
                            if (label[i] === targetLabel) {
                                if (coords[i][1] <= y1) upDownCount[1]++;
                                else upDownCount[0]++;
                            }
                        }

                        // test up or down
                        if (upDownCount[0] > upDownCount[1]) {
                            // up side
                            labelRect.attr('x', -0.5 * SCATTERPLOT_WIDTH)
                                .attr('y', -0.5 * SCATTERPLOT_WIDTH)
                                .attr('height', yScaler(y1) + 0.5 * SCATTERPLOT_WIDTH)
                                .attr('width', SCATTERPLOT_WIDTH);
                        } else {
                            // down side
                            labelRect.attr('x', -0.5 * SCATTERPLOT_WIDTH)
                                .attr('y', yScaler(y1))
                                .attr('height', 0.5 * SCATTERPLOT_WIDTH - yScaler(y1))
                                .attr('width', SCATTERPLOT_WIDTH);
                        }
                    }

                    labelRect.style('fill', labelNormalColorMap[targetLabel])
                        .style('opacity', 0.15);
                });
            // .select('g.scatter-points')
            // .append('line')
            // .attr('x1', d => (d.isSVMAxisOnLeft)
            //     ? xScaler(d.splitLine.x1)
            //     : xScaler.range()[0] - SCATTER_INNER_PADDING)
            // .attr('x2', d => (d.isSVMAxisOnLeft)
            //     ? xScaler(d.splitLine.x2)
            //     : xScaler.range()[1] + SCATTER_INNER_PADDING)
            // .attr('y1', d => (d.isSVMAxisOnLeft)
            //     ? yScaler.range()[0] + SCATTER_INNER_PADDING
            //     : yScaler(d.splitLine.y1))
            // .attr('y2', d => (d.isSVMAxisOnLeft)
            //     ? yScaler.range()[1] - SCATTER_INNER_PADDING
            //     : yScaler(d.splitLine.y2))
            // // .attr('x1', d => xScaler(d.splitLine.x1))
            // // .attr('x2', d => xScaler(d.splitLine.x2))
            // // .attr('y1', d => yScaler(d.splitLine.y1))
            // // .attr('y2', d => yScaler(d.splitLine.y2))
            // .style('stroke', 'black');


        };

        /**
         * Create scatterplot groups
         */


        scatterplotGroup.selectAll('g.scatterplots')
            .data(scatterplotSeries)
            .enter()
            .append('g')
            .attr('id', (d, i) => `scatterplot-${i}`)
            .attr('transform', (d, i) => {
                // let x, y;
                // const {isInter, isCurrentSVMAxisOnLeft, cosineTwoNormals} = d;
                //
                // if (isInter) {
                //     x = LEFT_PADDING + DIAG_RADIUS + i * (DIAG_RADIUS + 0.5 * SQRT_2 * GUTTER);
                //
                //     if (isCurrentSVMAxisOnLeft) {
                //         // y up
                //         y = VERTICAL_CENTER - 0.5*DIAG_RADIUS - (1 - cosineTwoNormals) * (0.5*DIAG_RADIUS + 0.5 * SQRT_2 * GUTTER);
                //
                //     } else {
                //         // y down
                //         y = VERTICAL_CENTER + 0.5*DIAG_RADIUS + (1 - cosineTwoNormals) * (0.5*DIAG_RADIUS + 0.5 * SQRT_2 * GUTTER);
                //     }
                //
                //
                // } else {
                //     x = LEFT_PADDING + DIAG_RADIUS + i * (DIAG_RADIUS + 0.5 * SQRT_2 * GUTTER);
                //     y = VERTICAL_CENTER;
                // }
                //
                // return `translate(${x},${y}),rotate(45)`

                const {canvasX, canvasY, canvasRotationAntiClockwise} = d;

                return `translate(${canvasX},${canvasY}),rotate(${canvasRotationAntiClockwise})`;
                // return `translate(${canvasX},${canvasY})`;
            })
            .style('cursor', 'pointer')
            .call(appendScatterplots)
            .on('mouseenter', function (d, i) {
                if (!d.isInter && !d.isInterpolation) {
                    handleLocalModelsHighlighted(d.localModelIdx);
                    labelGroup.select(`#label-${d.localModelIdx}`)
                        .style('filter', 'url(#glow-shadow)');
                    // labelLineGroup.select(`#label-line-${d.localModelIdx}`)
                    //     .select('line')
                    //     .classed('bold-line', true);
                    d3.select(this).style('filter', 'url(#glow-shadow)');
                } else {
                    const highlightedDataSet = new Set(d.pointIndices);
                    handlePointsHighlighted(highlightedDataSet, false);
                    d3.select(this).style('filter', 'url(#glow-shadow)');
                }
            })
            .on('mouseleave', function (d, i) {
                if (!d.isInter && !d.isInterpolation) {
                    handleLocalModelsHighlighted(d.localModelIdx);
                    labelGroup.select(`#label-${d.localModelIdx}`)
                        .style('filter', null);
                    // labelLineGroup.select(`#label-line-${d.localModelIdx}`)
                    //     .select('line')
                    //     .classed('bold-line', false);
                    d3.select(this).style('filter', null);
                } else {
                    const highlightedDataSet = new Set(d.pointIndices);
                    handlePointsHighlighted(highlightedDataSet, false);
                    d3.select(this).style('filter', null);
                }
            });

        // Interactions
        svgRoot.call(
            d3.zoom()
                .scaleExtent([0.5, 5])
                .on('zoom', () => {
                        let {x, y, k} = d3.event.transform;
                        // const bound = -(LEFT_PADDING + (scatterplotSeries.length - 20) * (2 * DIAG_RADIUS + SQRT_2 * GUTTER));
                        //
                        // if (x < bound) x = bound;

                        const rotateStr = rootGroup.attr('transform').split('rotate')[1];

                        rootGroup.attr('transform', `translate(${x},${y}) scale(${k}) rotate${rotateStr}`);
                    }
                )
        );

        svgRoot.on('dblclick.zoom', null);

        /**
         * Edge connections
         */

        const edgeStrokeScaler = d3.scaleLinear().domain(
            d3.extent(flattenDeep(connections.filter(c => !c.isEmpty).map(c => c.commonLabels)))
        ).range([2, 16]);

        edgeGroup.selectAll('path')
            .data(connections)
            .enter()
            .append('path')
            .classed('transition-edges', true)
            // .attr('x1', (d, i) =>
            //     (LEFT_PADDING + DIAG_RADIUS) + i * (2 * DIAG_RADIUS + SQRT_2 * GUTTER)
            // )
            // .attr('y1', VERTICAL_CENTER + SCATTERGROUP_VERTICAL_SHIFT)
            // .attr('x2', (d, i) =>
            //     (LEFT_PADDING + DIAG_RADIUS) + (i + 1) * (2 * DIAG_RADIUS + SQRT_2 * GUTTER)
            // )
            // .attr('y2', VERTICAL_CENTER + SCATTERGROUP_VERTICAL_SHIFT)
            .attr('d', (d, i) => {
                const prevScatterplot = scatterplotSeries[i * 2],
                    interScatterplot = scatterplotSeries[i * 2 + 1],
                    nextScatterplot = scatterplotSeries[i * 2 + 2];

                return `M ${prevScatterplot.canvasX} ${prevScatterplot.canvasY} 
                L ${interScatterplot.canvasX} ${interScatterplot.canvasY}
                L ${nextScatterplot.canvasX} ${nextScatterplot.canvasY}`;
            })
            .style('stroke', d => (d.isEmpty) ? '#555' : labelNormalColorMap[d.labelMax])
            .style('stroke-width', d => (d.isEmpty) ? 1 : edgeStrokeScaler(d.commonLabels[d.labelMax]))
            .style('stroke-dasharray', d => (d.isEmpty) ? '6 4' : '6 0')
            .style('fill', 'none')
            .style('cursor', 'pointer')
            .on('mouseenter', function (d, i) {
                const prevScatterplotGroup = scatterplotGroup.select(`g#scatterplot-${2 * i}`);
                const intermediateScatterplotGroup = scatterplotGroup.select(`g#scatterplot-${2 * i + 1}`);
                const nextScatterplotGroup = scatterplotGroup.select(`g#scatterplot-${2 * (i + 1)}`);

                const commonDataSet = new Set(d.commonData);

                const prevCircles = prevScatterplotGroup.selectAll('circle'),
                    interCircles = intermediateScatterplotGroup.selectAll('circle'),
                    nextCircles = nextScatterplotGroup.selectAll('circle');

                // Filter out the common points and highlight them
                prevCircles.filter(d => commonDataSet.has(d.pointIdx))
                    .classed('small-dots-highlighted', true);
                nextCircles.filter(d => commonDataSet.has(d.pointIdx))
                    .classed('small-dots-highlighted', true);
                interCircles.filter(d => commonDataSet.has(d.pointIdx))
                    .classed('small-dots-highlighted', true);

                prevCircles.filter(d => !commonDataSet.has(d.pointIdx))
                    .classed('small-dots-dimmed', true);
                nextCircles.filter(d => !commonDataSet.has(d.pointIdx))
                    .classed('small-dots-dimmed', true);
                interCircles.filter(d => !commonDataSet.has(d.pointIdx))
                    .classed('small-dots-dimmed', true);

                handlePointsHighlighted(commonDataSet, false);
            })
            .on('mouseleave', function (d, i) {
                // const prevScatterIdx = i, nextScatterIdx = i + 1;

                const prevScatterplotGroup = scatterplotGroup.select(`g#scatterplot-${2 * i}`);
                const intermediateScatterplotGroup = scatterplotGroup.select(`g#scatterplot-${2 * i + 1}`);
                const nextScatterplotGroup = scatterplotGroup.select(`g#scatterplot-${2 * (i + 1)}`);

                // disable the highlighting of the common nodes
                prevScatterplotGroup.selectAll('circle').classed('small-dots-highlighted', false);
                nextScatterplotGroup.selectAll('circle').classed('small-dots-highlighted', false);
                intermediateScatterplotGroup.selectAll('circle').classed('small-dots-highlighted', false);
                prevScatterplotGroup.selectAll('circle').classed('small-dots-dimmed', false);
                nextScatterplotGroup.selectAll('circle').classed('small-dots-dimmed', false);
                intermediateScatterplotGroup.selectAll('circle').classed('small-dots-dimmed', false);

                const commonDataSet = new Set(d.commonData);
                handlePointsHighlighted(commonDataSet, false);
            });


        /**
         * Add the selection bar
         */
        function onSliderChanged(val) {

            const valFloor = Math.floor(val), valCeiling = Math.ceil(val);

            progressBarGroup.select('line#vertical-place')
                .attr('x1', sliderWidth * (val / (scatterplotSeries.length - 1)))
                .attr('x2', sliderWidth * (val / (scatterplotSeries.length - 1)));


            /**
             * Main procedure for updating the rotation matrix
             */
            if (valFloor === valCeiling) {
                // updateGlobalProjectionMatrix(scatterplotSeries[valFloor].projectionMatrix);
                updateGlobalProjectionMatrix(scatterplotSeries[valFloor].svmOnRightProjectionMatrix);
            } else {
                /**
                 * Compute the activated points and the opacity
                 */
                const leftOpacity = valCeiling - val;
                const rightOpacity = 1 - leftOpacity;
                const leftScatter = scatterplotSeries[valFloor],
                    rightScatter = scatterplotSeries[valCeiling];
                // const edge = connections[valFloor];

                // find the intersections of the pointsets
                // const leftKNNSet = new Set(leftModel['knns']), rightKNNSet = new Set(rightModel['knns']);

                const activatedPoints = new Set(
                    union(leftScatter['pointIndices'], rightScatter['pointIndices'])
                );
                let opacityMapping = [];
                const leftRightIntersection = intersection(leftScatter['pointIndices'], rightScatter['pointIndices']);

                leftRightIntersection.forEach(d => {
                    opacityMapping[d] = 1.0;
                });
                without(leftScatter['pointIndices'], ...leftRightIntersection).forEach(d => {
                    opacityMapping[d] = leftOpacity;
                });
                without(rightScatter['pointIndices'], ...leftRightIntersection).forEach(d => {
                    opacityMapping[d] = rightOpacity;
                });

                let previousMatrix = leftScatter.projectionMatrix,
                    nextMatrix = rightScatter.projectionMatrix;

                // swap depending on the id, always keep SVM axes on the right side
                if (!leftScatter.isInter) {
                    // use svmOnRightProjectionMatrix
                    previousMatrix = leftScatter.svmOnRightProjectionMatrix;
                }

                if (!rightScatter.isInter) {
                    // use svmOnRightProjectionMatrix
                    nextMatrix = rightScatter.svmOnRightProjectionMatrix;
                }

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

                /**
                 * Handle common point highlighting in Path Scatterplots
                 */
                    // Clear the classes first
                const commonData = (leftScatter.commonPointIndices !== undefined)
                    ? leftScatter.commonPointIndices
                    : rightScatter.commonPointIndices;

                handleActivatedPointsInPathRotation(
                    activatedPoints,
                    new Set(commonData),
                    opacityMapping,
                    numeric.transpose(
                        gramSchmidt(...numeric.transpose(intermediateMatrix))
                    )
                );
            }
        }

        const sliderWidth = svgWidth - 2 * PROGRESSBAR_LEFT_PADDING; // (DIAG_RADIUS + 0.5 * SQRT_2 * GUTTER) * (scatterplotSeries.length - 1);
        const slider = sliderBottom()
            .min(0)
            .max(scatterplotSeries.length - 1)
            .width(sliderWidth)
            .displayFormat(val => {
                // const valFloor = Math.floor(val), valCeiling = Math.ceil(val);
                //
                // if (valFloor === valCeiling) {
                //     return 'LocalBoundary ' + getCurrentModelLocation(val);
                // } else {
                //     return getCurrentModelLocation(val).map(d => 'LocalBoundary ' + d).join(' | ');
                // }

                return '';
            })
            .tickFormat(val => '')
            .ticks(scatterplotSeries.length)
            .default(0)
            .on('onchange', throttle(onSliderChanged, 10))
            .on('end', onSliderChanged);

        stableRootGroup
            .on('mouseenter', function () {
                const sliderVal = slider.value();
                const valFloor = Math.floor(sliderVal), valCeiling = Math.ceil(sliderVal);
                const leftScatter = scatterplotSeries[valFloor],
                    rightScatter = scatterplotSeries[valCeiling];

                const leftOpacity = valCeiling - sliderVal;
                const rightOpacity = 1 - leftOpacity;
                // const edge = connections[valFloor];

                // find the intersections of the pointsets
                // const leftKNNSet = new Set(leftModel['knns']), rightKNNSet = new Set(rightModel['knns']);

                const activatedPoints = new Set(
                    union(leftScatter['pointIndices'], rightScatter['pointIndices'])
                );
                let opacityMapping = [];
                const leftRightIntersection = intersection(leftScatter['pointIndices'], rightScatter['pointIndices']);

                leftRightIntersection.forEach(d => {
                    opacityMapping[d] = 1.0;
                });
                without(leftScatter['pointIndices'], ...leftRightIntersection).forEach(d => {
                    opacityMapping[d] = leftOpacity;
                });
                without(rightScatter['pointIndices'], ...leftRightIntersection).forEach(d => {
                    opacityMapping[d] = rightOpacity;
                });

                const commonData = (leftScatter.commonPointIndices !== undefined)
                    ? leftScatter.commonPointIndices
                    : rightScatter.commonPointIndices;

                handleActivatedPointsInPathRotation(
                    activatedPoints,
                    new Set(commonData),
                    opacityMapping,
                    null
                );
            })
            .on('mouseleave', function () {
                const sliderVal = slider.value();
                const valFloor = Math.floor(sliderVal), valCeiling = Math.ceil(sliderVal);
                const leftScatter = scatterplotSeries[valFloor],
                    rightScatter = scatterplotSeries[valCeiling];

                const leftOpacity = valCeiling - sliderVal;
                const rightOpacity = 1 - leftOpacity;

                const activatedPoints = new Set(
                    union(leftScatter['pointIndices'], rightScatter['pointIndices'])
                );
                let opacityMapping = [];
                const leftRightIntersection = intersection(leftScatter['pointIndices'], rightScatter['pointIndices']);

                leftRightIntersection.forEach(d => {
                    opacityMapping[d] = 1.0;
                });
                without(leftScatter['pointIndices'], ...leftRightIntersection).forEach(d => {
                    opacityMapping[d] = leftOpacity;
                });
                without(rightScatter['pointIndices'], ...leftRightIntersection).forEach(d => {
                    opacityMapping[d] = rightOpacity;
                });

                handleActivatedPointsInPathRotation(
                    activatedPoints,
                    new Set(),
                    opacityMapping,
                    null
                );
            });

        /**
         * Progress Bar Frame
         */
        progressbarFrameGroup.append('rect')
            .classed('progressbar-frame-rect', true)
            .attr('x', PROGRESSBAR_LEFT_PADDING - 60)
            .attr('y', 4)
            .attr('width', svgWidth - (PROGRESSBAR_LEFT_PADDING - 60) * 2)
            .attr('height', 60)
            .attr('rx', 1)
            .attr('ry', 1)
            .on('mouseenter', function () {
            })
            .on('mouseleave', function () {
                const d3self = d3.select(this);
            });

        progressBarGroup
            .attr('transform', `translate(${PROGRESSBAR_LEFT_PADDING},${SLIDER_Y})`)
            .call(slider);

        /**
         * TODO: implement the same effect as the edges
         */
        progressBarGroup.select('g.slider').select('g.parameter-value').select('path')
            .on('mouseenter', () => {
                const sliderVal = slider.value();
                const ceilingSliderVal = Math.ceil(sliderVal);
                const upperRange = ceilingSliderVal + (ceilingSliderVal % 2 === 1) ? 1 : 0;
                const connectionIdx = upperRange / 2;
                const currentConnection = connections[connectionIdx];

            })
            .on('mouseleave', () => {
                const sliderVal = slider.value();
            });

        /**
         * Play button for the path
         */
        let isTimerRunning = false;  // flag for judge if it is running
        let timer;  // d3-timer object
        const playButton = progressBarGroup.append('g')
            .classed('play-button', true)
            .on('click', () => {

                // If running, stop the current timer and change the icon
                if (isTimerRunning) {
                    timer.stop();
                    isTimerRunning = false;
                    playButton.select('text').html('&#9658');
                }

                // if not running, start a new timer
                else {
                    let currentPos = slider.value(), maxPos = slider.max();
                    const step = 0.05, timeStep = 100;
                    isTimerRunning = true;
                    playButton.select('text').html('&#x23F8');

                    // new timer object from the current position
                    timer = d3.timer(() => {
                        if (currentPos >= maxPos) {
                            timer.stop();
                            isTimerRunning = false;
                            playButton.select('text').html('&#9658');
                            return;
                        } else if (currentPos + step > maxPos) {
                            currentPos = maxPos;
                        } else {
                            currentPos += step;
                        }

                        slider.value(currentPos);
                    }, timeStep);
                }
            });

        playButton.append('rect')
            .attr('x', -40)
            .attr('y', -8)
            .attr('rx', 2)
            .attr('ry', 2)
            .attr('width', 24)
            .attr('height', 20)
            .style('cursor', 'pointer')
            .style('stroke', '#bbbbbb')
            .style('fill', '#eeeeee');

        playButton.append('text')
            .attr('x', -25)
            .attr('y', 2)
            .style('text-anchor', 'middle')
            .style('alignment-baseline', 'central')
            .style('cursor', 'pointer')
            .html('&#9658');

        /**
         * Name labels that are aligned to the slider
         */
        let orderCounter = 1;
        const tickGapDistance = (svgWidth - 2 * PROGRESSBAR_LEFT_PADDING) / (scatterplotSeries.length - 1);
        for (let i = 0; i < modelSeries.length; i++) {
            const modelSeriesObj = modelSeries[i];
            const m = modelSeriesObj.model;

            if (m.interpolation) continue;

            const x = PROGRESSBAR_LEFT_PADDING + 2 * i * tickGapDistance;
            const y = SLIDER_Y + 30;

            const labelG = labelGroup.append('g')
                .attr('id', `label-${modelSeriesObj.index}`);
            // .attr('transform', `translate(${x},${y})`);

            const BACK_RECT_SIZE = 25;
            const FRONT_FONT_SIZE = 14;

            labelG.append('rect')
                .attr('x', -BACK_RECT_SIZE / 2)
                .attr('y', -BACK_RECT_SIZE / 2)
                .attr('width', BACK_RECT_SIZE)
                .attr('height', BACK_RECT_SIZE - 3)
                .attr('rx', 10)
                .attr('ry', 10)
                // .style('stroke', '#555')
                // .style('stroke-width', 0.5)
                .style('fill', defaultBlueColor);
            // .style('filter', 'url(#glow-shadow)');

            labelG.append('text')
            // .classed('order-numbers', true)
                .style('alignment-baseline', 'middle')
                .style('text-anchor', 'middle')
                .style('font-size', FRONT_FONT_SIZE)
                .style('font-weight', 'bold')
                .style('fill', '#fefefe')
                .text(orderCounter);

            labelG.append('text')
                .classed('id-numbers', true)
                .attr('dx', BACK_RECT_SIZE / 2 + 2
                )
                .style('alignment-baseline', 'middle')
                .style('text-anchor', 'start')
                .style('font-size', FRONT_FONT_SIZE)
                .text(`Segment ${pathOfLocalModels[orderCounter - 1]}`)
                .on('click', () => {
                    slider.value(i * 2);
                });

            const labelGWidth = labelG.node().getBBox().width;

            labelG.attr('transform', `translate(${x + BACK_RECT_SIZE / 2 - labelGWidth / 2},${y})`);

            orderCounter++;
        }

        if (scatterplotSeries.length === 7) {
            const currentTransform = scatterplotGroup.select('g#scatterplot-3').attr('transform');
            scatterplotGroup.select('g#scatterplot-3').attr('transform', currentTransform + ',scale(-1,1)');
        } else if (scatterplotSeries.length === 5) {
            const currentTransform = scatterplotGroup.select('g#scatterplot-3').attr('transform');
            scatterplotGroup.select('g#scatterplot-3').attr('transform', currentTransform + ',scale(-1,1)');
        }

        this.setState({
            slider: slider
        });
    }

    render() {
        return (
            <svg width="100%" height={this.props.height} ref={this.svgRef}>
                <def>
                    <filter id="glow-shadow-path" width="2.5" height="2.5" x="-.25" y="-.25">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="3.5" result="blur"/>
                        <feColorMatrix result="bluralpha" type="matrix" values=
                            "1 0 0 0   0
                                 0 1 0 0   0
                                 0 0 1 0   0
                                 0 0 0 0.4 0 "/>
                        <feOffset in="bluralpha" dx="10" dy="10" result="offsetBlur"/>
                        <feMerge>
                            <feMergeNode in="offsetBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </def>
                <g id="root-group">
                    <g id="scatterplot-edge-group"/>
                    <g id="scatterplot-group"/>
                </g>
                <g id="stable-root-group">
                    <g id="progressbar-frame"/>
                    >
                    <g id="label-line-group"/>
                    <g id="label-group"/>
                    <g id="progressbar-group"/>
                </g>
            </svg>
        );
    }
}