import React, {Component} from 'react';
import {findDOMNode} from "react-dom";
import numeric from "numericjs";
import * as d3 from "d3";
import d3Tip from 'd3-tip';
import intersection from 'lodash/intersection';
import without from 'lodash/without';
import countBy from 'lodash/countBy';
import cloneDeep from 'lodash/cloneDeep';
import flattenDeep from 'lodash/flattenDeep';
import isEqual from 'lodash/isEqual';

import roundedHull from "../../utils/roundedhull";
import {labelNormalColorMap, defaultColor, defaultBlueColor} from "../../utils/Color";
import {argMax} from '../../utils/arrayUtils';
// import ForceEdgeBundling from '../../utils/edgebundling';
import '../../styles/localboundarygraphcanvas.css';

/**
 * Some constants for the canvas
 * @type {number}
 */
const CANVAS_PADDING = -300;
const THICKNESS_TORUS = 10;
const INNER_CIRCLE_PADDING = 2;
// const OUTER_TORUS = 7;
const CONVEXHULL_PADDING = 2;


export default class LocalBoundaryGraphCanvas extends Component {
    constructor(props) {
        super(props);

        this.state = {
            distMethod: 'mean', // 'mean' or 'betweenAvg' or 'graph'
            basedData: 'All', // 'All' (all knn) or 'Target'
            layoutMethod: 'TSNE', // 'TSNE' or 'MDS'
            xScale: null,
            yScale: null,
            // numKNNEdges: props['numKNNEdges'],
            hoveredLastTime: false,

            /**
             * For showing activation
             */
        };
    }

    /**
     * Event handlers
     */
    handleGlyphHover = (idx) => {
        // this.setState({
        //         hoveredLastTime: true
        //     }, () =>
        //         this.props.handleLocalModelsHighlighted(idx)
        // );

        this.props.handleLocalModelsHighlighted(idx);
    };

    handleGlyphClick = (idx) => {
        this.props.handleLocalModelsClicked(idx);
    };

    handleGlyphDoubleClick = (idx) => {
        this.props.updateGlobalProjectionMatrixByLocalModelsIndex(idx);
    };

    shouldComponentUpdate(nextProps) {
        if (nextProps.numKNNEdges !== this.state.numKNNEdges) {
            this.forceUpdate();
            return true;
        } else {
            return false;
        }
    }

    // shouldComponentUpdate() {
    //     console.log('LocalBoundaryGraphCanvas: got refresh and stopped');
        //
        // return false;
    // }

    componentDidMount() {
        this.initializeCanvas();
    }

    componentWillReceiveProps(nextProps) {

        // console.log(nextProps.numKNNEdges);

        /**
         * Decide if should update is forbidden by states
         */
        // console.log('LocalBoundaryGraphCanvas: got new props');

        // if (this.state.hoveredLastTime) {
        //     console.log('LocalBoundaryGraphCanvas: caught hoveredLastTime');
        //     this.setState({
        //         hoveredLastTime: false
        //     });
        //     return;
        // }

        // console.log(nextProps);
        // this.setState({
        //     numKNNEdges: nextProps['numKNNEdges']
        // }, () =>


        this.updateScatter(this.props, nextProps);
    }

    initializeCanvas = () => {
        const {canvasHeight} = this.props;
        const canvasWidth = findDOMNode(this).getBoundingClientRect().width;
        const canvasHalfWidth = canvasWidth / 2,
            canvasHalfHeight = canvasHeight / 2;

        this.svgRoot = d3.select(findDOMNode(this));
        this.svgRoot.select('g#lbg-base-group')
        // .attr('transform', 'translate(' + canvasHalfWidth + ',' + canvasHalfHeight + ')');
            .attr('transform', 'translate(0,0)');

        this.setState({
            xScale: d3.scaleLinear().domain([-1, 1]).range(
                [-canvasHalfWidth + CANVAS_PADDING, canvasHalfWidth - CANVAS_PADDING]
            ),
            yScale: d3.scaleLinear().domain([-1, 1]).range(
                [canvasHalfHeight - CANVAS_PADDING, -canvasHalfHeight + CANVAS_PADDING]
            )
        }, () => {
            this.initializeScatter();
        });
    };

    initializeScatter = () => {
        // console.log(this);

        const {
            // canvasWidth, canvasHeight, // canvas sizes
            localModels,
            dataVectors,
            label,
            localModelKNNGraph,
            embeddingCoords, // main data
            // basedData, layoutMethod, // switches
            distMethod,
            // showKNNEdges,
            numKNNEdges,  // KNN edge data
            glyphCircleSizekey  // which key to use for accessing the size
        } = this.props;

        const canvasWidth = findDOMNode(this).getBoundingClientRect().width,
            canvasHeight = findDOMNode(this).getBoundingClientRect().height;

        if (distMethod === 'graph') {
            alert('Graph is not supported yet.');
            return;
        }

        /**
         * Compute the radius size scale based on the key of "glyphCircleSizekey"
         */
        const radiusScale = d3.scaleQuantile()
            .domain(d3.extent(localModels, (l) => l[glyphCircleSizekey].length))
            .range(d3.range(25, 50));

        const svgRootGroup = this.svgRoot.select('g#lbg-base-group'),
            xScale = this.state.xScale, yScale = this.state.yScale;
        const pointGroup = svgRootGroup.select('g#lbg-point-group'),
            edgeGroup = svgRootGroup.select('g#lbg-edge-group'),
            transparentCoverGroup = svgRootGroup.select('g#lbg-transparent-cover'),
            linkAbstactGroup = svgRootGroup.select('g#lbg-link-abstract-group');

        /**
         * Initialize the class proportions of knns
         */
        let nodeCoords = embeddingCoords.map((d, i) => {

            const localM = localModels[i];
            const localMknns = localM['knns'];
            const labelsOfKNNs = countBy(localMknns, (n) => label[n]);
            const lenKNNs = localMknns.length;

            /**
             * Compute the radius size based on the key of "glyphCircleSizekey"
             */
            const radiusSize = radiusScale(localM[glyphCircleSizekey].length);

            let initialAngle = 0;
            let arcProps = [];
            const arcGen = d3.arc()
            // .innerRadius(radiusSize - THICKNESS_TORUS)
                .padAngle(.02)
                .cornerRadius(1)
                .innerRadius(radiusSize - THICKNESS_TORUS)
                .outerRadius(radiusSize);

            for (let classId in labelsOfKNNs) {
                const angleDiff = labelsOfKNNs[classId] / lenKNNs * 2 * Math.PI;

                arcProps.push({
                    label: parseInt(classId, 10),
                    startAngle: initialAngle,
                    endAngle: initialAngle + angleDiff
                });

                initialAngle += angleDiff;
            }

            /**
             * Compute the contours and the biplot
             */
            const initSideMatrix = localM['initSideMatrix'];
            const knnVectors = localMknns.map((dataIdx) => dataVectors[dataIdx]),
                knnLabels = localMknns.map((dataIdx) => label[dataIdx]);
            let initProjCoords = numeric.dot(
                knnVectors,
                initSideMatrix
            );

            const rangeSize = (radiusSize - THICKNESS_TORUS - CONVEXHULL_PADDING) / Math.sqrt(2);
            const projXScale = d3.scaleLinear()
                    .domain(d3.extent(initProjCoords, d => d[0]))
                    // .range([-radiusSize + THICKNESS_TORUS, radiusSize - THICKNESS_TORUS]),
                    .range([-rangeSize, rangeSize]),
                projYScale = d3.scaleLinear()
                    .domain(d3.extent(initProjCoords, d => d[1]))
                    // .range([-radiusSize + THICKNESS_TORUS, radiusSize - THICKNESS_TORUS]);
                    .range([rangeSize, -rangeSize]);

            initProjCoords = initProjCoords.map(([x, y]) => [projXScale(x), projYScale(y)]);

            // find contours of different classes
            const convexPaths = arcProps.map((arcp) => {
                const classId = arcp['label'];
                const initProjCoordsForClass = initProjCoords.filter((p, i) => knnLabels[i] === classId);

                // get a convex hull
                const convexHull = (initProjCoordsForClass.length < 3)
                    ? initProjCoordsForClass
                    : d3.polygonHull(initProjCoordsForClass);

                return roundedHull(convexHull, CONVEXHULL_PADDING);
            });

            // compute the outer stroke-dasharray based on coverageAcc
            const {coverageAcc} = localM;
            const dashArray = `${1.3 * (1 - coverageAcc)}% ${1.9 * (1 - coverageAcc)}%`;

            const accArcGen = d3.arc()
                .startAngle(0)
                .endAngle(Math.PI * 2 * coverageAcc)
                .innerRadius(radiusSize + 3)
                .outerRadius(radiusSize + 4);

            return {
                index: i,
                size: radiusSize,
                x: xScale(d[0]),
                // fx: xScale(d[0]),
                y: yScale(d[1]),
                // fy: yScale(d[1])
                arcProps: arcProps,
                svgPaths: arcProps.map(prop => arcGen(prop)),
                convexPaths: convexPaths,
                normalVector: localM['localSVM']['coef'][0],
                dashArray: dashArray,
                accArc: accArcGen()
            };
        });

        /**
         * Deploy force
         */
        const forceEdges = cloneDeep(flattenDeep(
            localModelKNNGraph.map(
                edgeList => edgeList.slice(0, numKNNEdges)
            )
        ));

        const edgeStrengthScale = d3.scaleLinear()
            .domain(d3.extent(forceEdges, d => d.value))
            .range([0.1, 1.0]);

        const simulation = d3.forceSimulation(nodeCoords)
            .force("charge", d3.forceManyBody().strength(-5000))
            .force("center", d3.forceCenter(canvasWidth / 2, canvasHeight / 2))
            .force('collide', d3.forceCollide().radius(d => d.size + 2))
            .force("x", d3.forceX(canvasWidth / 2).strength(0.14))
            .force("y", d3.forceY(canvasHeight / 2).strength(0.14))
            .force(
                'link',
                d3.forceLink(forceEdges)
                    .id((d, i) => i)
                    .distance(
                        l => edgeStrengthScale(l.value)
                    )
            );
        // .stop();

        for (let i = 0; i < 500; i++) {
            simulation.tick();
        }

        // /**
        //  * Edge bundling
        //  */
        // const bundling = ForceEdgeBundling()
        //     .step_size(0.1)
        //     .compatibility_threshold(0.6)
        //     .nodes(nodeCoords)
        //     .edges(cloneDeep(flattenDeep(
        //         localModelKNNGraph.map(
        //             edgeList => edgeList.slice(0, numKNNEdges)
        //         )
        //     )));
        // const bundleResult = bundling();

        // let simulation = d3.forceSimulation().nodes(nodeCoords)
        // // .force('charge', d3.forceManyBody().strength(-1))
        // //     .force('x', d3.forceX().x(d => d['x']).strength(0.8))
        // //     .force('y', d3.forceY().y(d => d['y']).strength(0.8))
        //     .force('collide', d3.forceCollide().radius(d => d['size'] + 2))
        //     .stop();
        //
        // for (let i = 0; i < 100; i++) {
        //     simulation.tick();
        // }

        this.svgRoot.call(
            d3.zoom()
                .scaleExtent([0.1, 4])
                .on('zoom', () => {
                    const newTransform = d3.event.transform;

                    svgRootGroup.attr('transform', newTransform);
                    // pointGroup.selectAll('g.lbg-point-glyphs').attr(
                    //     'transform', function() {
                    //         let nodeTransform = d3.select(this).attr('transform');
                    //         return nodeTransform.split(' scale')[0] + ' scale(' + newTransform.k + ')';
                    //     }
                    // );
                })
        );

        this.svgRoot.on("dblclick.zoom", null);

        /**
         * Handle node rendering
         */

        pointGroup.selectAll('.lbg-point-glyphs')
            .data(nodeCoords)
            // .data(embeddingCoords)
            .enter()
            .call(appendNodeGlyph);

        // const _state = this.;
        const _handleGlyphDoubleClick = this.handleGlyphDoubleClick.bind(this);
        const _handleGlyphClick = this.handleGlyphClick.bind(this);
        const _handleGlyphHover = this.handleGlyphHover.bind(this);
        const _updateLocalModelIdxForDetailCard = this.props.updateLocalModelIdxForDetailCard;

        function appendNodeGlyph(n) {

            const pointGroup2 = n.append('g')
                .attr('id', (d, i) => 'lbg-point-glyph-' + i)
                .classed('lbg-point-glyphs', true)
                .attr('transform', (d) => 'translate(' + d['x'] + ',' + d['y'] + ') scale(1)');

            /**
             *
             * Circle glyph
             *
             * - Base white circle
             * - Outer torus
             * - Inner circle
             *
             */
            pointGroup2.append('circle')
                .classed('base-glyph-background', true)
                .attr('cx', 0)
                .attr('cy', 0)
                .attr('r', (d) => d['size'] + 4)
                .style('fill', 'white')
                .style('stroke', 'none');
            // .style('filter', 'url(#glow-shadow)');


            pointGroup2.append('circle')
                .classed('base-class-label-circle', true)
                .attr('cx', 0)
                .attr('cy', 0)
                .attr('r', (d) => d['size'] - THICKNESS_TORUS - INNER_CIRCLE_PADDING)
                .style('fill', (d, i) => labelNormalColorMap[localModels[i]['targetLabel'][0]])
                .style('stroke', '#231f20')
                .style('stroke-width', 0.2);

            pointGroup2.selectAll('path.pie-arc')
            // .data((d) => zip(d['arcProps'], d['svgPaths']))
                .data((d) =>
                    d['arcProps'].map((d2, i) => ({
                        arcProp: d2,
                        svgPath: d['svgPaths'][i],
                        parentIndex: d['index']
                    }))
                )
                .enter()
                .append('path')
                .classed('pie-arc', true)
                .attr('d', (d2) => d2['svgPath'])
                .style('fill', (d2) => labelNormalColorMap[d2['arcProp']['label']])
                .style('stroke', '#231f20')
                .style('stroke-width', 0.2);

            pointGroup2.append('circle')
                .classed('contour-base-circle', true)
                .attr('cx', 0)
                .attr('cy', 0)
                .attr('r', (d) => d['size'])
                .style('fill', 'white')
                .style('fill-opacity', 0);

            // pointGroup2.append('circle')
            //     .attr('cx', 0)
            //     .attr('cy', 0)
            //     .attr('r', d => d.size + 5)
            //     .style('fill', 'none')
            //     .style('stroke', '#888')
            //     .style('stroke-width', 1.5)
            //     .style('stroke-dasharray', d => d.dashArray);

            pointGroup2.append('path')
                .classed('acc-arc', true)
                .attr('d', d => d.accArc);
                // .style('fill', '#555')
                // .style('stroke-width', 1.5);
            // .style('marker-end', 'url(#stub)');

            pointGroup2.append('circle')
                .attr('cx', 0)
                .attr('cy', d => -d.size - 3.5)
                .attr('r', 2)
                .attr('fill', '#555')
                .attr('stroke', '#555');

            // .style('marker-end', 'url(#triangle-arrow)');


            // const contourGroup = pointGroup2.append('g')
            //     .classed('lbg-point-glyph-inner-dists', true);

            // contourGroup.append('circle')
            //     .classed('contour-base-circle', true)
            //     .attr('cx', 0)
            //     .attr('cy', 0)
            //     .attr('r', (d) => d['size'] - THICKNESS_TORUS)
            //     .style('fill', 'white')
            //     .on('click', (d, i) => {
            //         _handleGlyphClick(i);
            //     });

            // contourGroup.selectAll('path.scatter-contour')
            //     .data((d) =>
            //         d['arcProps'].map((d2, i, dParent) => ({
            //             arcProp: d2,
            //             convexPath: d['convexPaths'][i],
            //             parentIndex: d['index']
            //         }))
            //     )
            //     .enter()
            //     .append('path')
            //     .classed('scatter-contour', true)
            //     .attr('d', (d2) => d2['convexPath'])
            //     .style('fill', (d2) => labelNormalColorMap[d2['arcProp']['label']])
            //     .style('fill-opacity', 0.4)
            //     .style('stroke', '#555555')
            //     .style('stroke-width', 0.1);

            // .append('circle')
            // .attr('cx', 0)
            // .attr('cy', 0)
            // // .attr('r', (d) => radiusScale(d[1]['knnsSize'].length))
            // .attr('r', function (d) {
            //     return d['size'];
            // })
            // .style('fill', (d, i) => labelNormalColorMap[localModels[i]['targetLabel'][0]])
            // .style('stroke-width', 0.5)
            // .style('stroke', '#aaaaaa')
            // .on('click', (d, i) => {
            //     _handleGlyphClick(i);
            // });
        }


        /**
         * Handle edge rendering
         */
        edgeGroup.selectAll('.knn-edge')
            .data(nodeCoords)
            .enter()
            .call(appendEdges);

        // The edge curve generator


        function appendEdges(n) {
            const edgeGroup2 = n.append('g')
                .attr('id', (d, i) => 'knn-edge-group-' + i)
                .classed('knn-edge-groups', true)
                .style('display', 'none');

            const curveGen = d3.line().curve(d3.curveNatural);

            const edgeGroup3 = edgeGroup2.selectAll('g.knn-edge')
                .data((nodeC, nodei) => {
                    let knnEdges = localModelKNNGraph[nodei].slice(0, numKNNEdges);

                    // Scale for opacity
                    // const valueScale = d3.scaleLinear().domain(d3.extent(knnEdges, k => k['value'])).range([1, 0.3]);

                    // Scale for stroke
                    const valueScale = d3.scaleLinear()
                        .domain(d3.extent(knnEdges, k => k['value']))
                        .range([5, 1]);

                    knnEdges = knnEdges.map(d => {

                        const nodeCoordsSource = (typeof d.source === 'number') ? nodeCoords[d.source] : d.source,
                            nodeCoordsTarget = (typeof d.source === 'number') ? nodeCoords[d.target] : d.target;
                        const sourceNormal = nodeCoordsSource['normalVector'],
                            targetNormal = nodeCoordsTarget['normalVector'];

                        // compute the angle:
                        const cosineSourceToTarget = 1 - numeric.norm2(numeric.dot(sourceNormal, targetNormal))
                            / (numeric.norm2(sourceNormal) * numeric.norm2(targetNormal));

                        // compute the interpolation point
                        const x1 = nodeCoordsSource['x'], y1 = nodeCoordsSource['y'],
                            x2 = nodeCoordsTarget['x'], y2 = nodeCoordsTarget['y'];
                        const centerX = (x1 + x2) / 2, centerY = (y1 + y2) / 2;
                        const rotationMatrix = [[0, -1], [1, 0]];  // 90deg clockwise

                        const controlPoint = numeric.add(
                            [centerX, centerY],
                            numeric.dot([(x2 - x1) / 2 * cosineSourceToTarget, (y2 - y1) / 2 * cosineSourceToTarget], rotationMatrix)
                        );

                        // // generate the path
                        // const c = curveGen([
                        //     [x1, y1],
                        //     controlPoint,
                        //     [x2, y2]
                        // ]);

                        // Compute the color and the shape of the edges
                        let edgeColor = '#555555', strokeDashArray = '10 6';

                        if (d['lb'].length > 0) {
                            const maxCountIdx = argMax(d['lb'].map(_d => _d.count));

                            edgeColor = labelNormalColorMap[d['lb'][maxCountIdx]['label']];
                            strokeDashArray = null;
                        }


                        // return {...d, controlPoint, opacityValue: valueScale(d['value'])};
                        return {
                            ...d,
                            controlPoint,
                            strokeValue: valueScale(d['value']),
                            edgeColor,
                            strokeDashArray,

                            // arrowhead shift for the path
                            innerCircleRadius: nodeCoordsTarget['size'] - THICKNESS_TORUS - INNER_CIRCLE_PADDING
                        };
                    });

                    return knnEdges;
                })
                .enter()
                .append('g')
                .classed('knn-edge', true)
                .attr('id', d => `knn-edge-${d['source']}-${d['target']}`);

            edgeGroup3.append('path')
                .classed('knn-edge-arrowpath-border', true)
                .attr('id', d => `knn-edge-arrowpath-border-${d['source']}-${d['target']}`)
                .attr('d', (d) => {
                    const nodeCoordsSource = (typeof d.source === 'number') ? nodeCoords[d.source] : d.source,
                        nodeCoordsTarget = (typeof d.source === 'number') ? nodeCoords[d.target] : d.target;

                    return curveGen([
                        [nodeCoordsSource['x'], nodeCoordsSource['y']],
                        d['controlPoint'],
                        [nodeCoordsTarget['x'], nodeCoordsTarget['y']]
                    ]);
                })
                .style('fill', 'none')
                // .style('marker-end', 'url(#triangle-arrow)')
                // .style('stroke', '#555555')
                .style('stroke', '#555555')
                // .style('stroke-width', 3)
                // .style('stroke-width', d => (d['strokeValue'] < 2)? d['strokeValue']: d['strokeValue'] + 0.5)
                .style('stroke-width', d => d['strokeValue'] + 0.5)
                .style('stroke-dasharray', d => d['strokeDashArray'])
                // .style('stroke-opacity', d => d['opacityValue'])
                .style('stroke-opacity', 0.95)
                .style('stroke-linecap', 'round');

            edgeGroup3.append('path')
                .classed('knn-edge-arrowpath', true)
                .attr('id', d => `knn-edge-arrowpath-${d['source']}-${d['target']}`)
                .attr('d', (d) => {
                    const nodeCoordsSource = (typeof d.source === 'number') ? nodeCoords[d.source] : d.source,
                        nodeCoordsTarget = (typeof d.source === 'number') ? nodeCoords[d.target] : d.target;

                    return curveGen([
                        [nodeCoordsSource['x'], nodeCoordsSource['y']],
                        d['controlPoint'],
                        [nodeCoordsTarget['x'], nodeCoordsTarget['y']]
                    ]);
                })
                .style('fill', 'none')
                .style('marker-end', 'url(#triangle-arrow)')
                // .style('stroke', '#555555')
                .style('stroke', d => d['edgeColor'])
                // .style('stroke-width', 3)
                .style('stroke-width', d => d['strokeValue'])
                .style('stroke-dasharray', d => d['strokeDashArray'])
                // .style('stroke-opacity', d => d['opacityValue'])
                .style('stroke-opacity', 0.95)
                .style('stroke-linecap', 'round');

            // const lineGen = d3.line().x(d => d.x).y(d => d.y);

            /**
             * Add shadow abstract links
             */
            edgeGroup2.selectAll('g.knn-edge').each((d, i) => {
                const nodeCoordsSource = (typeof d.source === 'number') ? nodeCoords[d.source] : d.source,
                    nodeCoordsTarget = (typeof d.source === 'number') ? nodeCoords[d.target] : d.target;

                linkAbstactGroup.append('line')
                    .attr('id', `abstract-link-${d.source}-${d.target}`)
                    .classed('abstract-link', true)
                    .attr('x1', nodeCoordsSource.x)
                    .attr('y1', nodeCoordsSource.y)
                    .attr('x2', nodeCoordsTarget.x)
                    .attr('y2', nodeCoordsTarget.y);

                // linkAbstactGroup.append('path')
                //     .attr('id', `abstract-link-${d.source}-${d.target}`)
                //     .classed('abstract-link', true)
                //     .attr('d', lineGen(bundleResult[i]));
            })

            // Try to add the arrowhead
        }


        // Add tooptip
        const tooltip = d3Tip()
            .attr('class', 'd3-tip')
            .html(d => `Segment ${d.index}`)
            .direction('n')
            .offset([-5, 0]);

        svgRootGroup.call(tooltip);

        transparentCoverGroup.selectAll('.transparent-cover-circles')
            .data(nodeCoords)
            .enter()
            .append('circle')
            .attr('id', (d, i) => 'transparent-cover-circle-' + i)
            .classed('transparent-cover-circles', true)
            .attr('cx', d => d['x'])
            .attr('cy', d => d['y'])
            .attr('r', d => d['size'])
            .on('mouseenter', (d, i, n) => {
                tooltip.show(d, n[i]);
                _handleGlyphHover(i);
                _updateLocalModelIdxForDetailCard(i);
            })
            .on('mouseleave', (d, i, n) => {
                tooltip.hide(d, n[i]);
                _handleGlyphHover(i);
            })
            .on('click', (d, i) => {
                d3.event.stopPropagation();
                _handleGlyphClick(i);
            })
            .on('dblclick', (d, i) => {
                d3.event.stopPropagation();
                _handleGlyphDoubleClick(i);
            });


        /**
         * Set the coords obj to state
         */
        this.setState({nodeCoords});
    };

    updateScatter = (oldProps = null, nextProps = null) => {
        // const props = (nextProps === null) ? this.props : nextProps;

        const {
            // canvasWidth, canvasHeight, // canvas sizes
            // localModels,
            // distMethod, basedData, layoutMethod, // switches
            // showKNNEdges, // KNN edge data
            localModels,
            // embeddingCoords, // main data
            enabledLabels,
            enabledSize,
            activatedLocalModels,
            highlightedLocalModels,
            // enableBiplotInGlyph,
            // enableScatterInGlyph,
            // showKNNEdges
        } = nextProps;

        let oldActivatedLocalModels = oldProps.activatedLocalModels,
            oldHighlightedLocalModels = oldProps.highlightedLocalModels;

        if (oldActivatedLocalModels === undefined) oldActivatedLocalModels = [];
        if (oldHighlightedLocalModels === undefined) oldHighlightedLocalModels = [];

        const svgRootGroup = this.svgRoot.select('g#lbg-base-group'),
            xScale = this.state.xScale, yScale = this.state.yScale;
        const pointGroup = svgRootGroup.select('g#lbg-point-group'),
            edgeGroup = svgRootGroup.select('g#lbg-edge-group'),
            maskGroup = svgRootGroup.select('g#lbg-point-masks'),
            coverGroup = svgRootGroup.select('g#lbg-transparent-cover'),
            activatedOrdersGroup = svgRootGroup.select('#activated-orders'),
            linkAbstactGroup = svgRootGroup.select('g#lbg-link-abstract-group');

        /**
         * Handle switches
         */

        /**
         * Inner scatterplot distribution
         */
        // if (enableScatterInGlyph) {
        //     svgRootGroup.selectAll('g.lbg-point-glyph-inner-dists')
        //         .style('display', null);
        //
        //     svgRootGroup.selectAll('g.lbg-point-glyph-inner-dists')
        //         .transition()
        //         .duration(200)
        //         .style('opacity', 1);
        // } else {
        //     svgRootGroup.selectAll('g.lbg-point-glyph-inner-dists')
        //         .transition()
        //         .duration(200)
        //         .style('opacity', 0)
        //         .on('end', () => svgRootGroup.selectAll('g.lbg-point-glyph-inner-dists')
        //             .style('display', 'none'));
        // }

        /**
         * Handle class switches and size filters
         */
        const shouldBeDisabledByRange = (d, i) => {
            const localM = localModels[i];
            const _size = localM.knns.length + localM.coverage.length;

            return !(_size >= enabledSize[0] && _size <= enabledSize[1]);
        };

        const shouldBeDisabledByLabels = (d, i) =>
            !(enabledLabels[localModels[i]['targetLabel'][0]]);

        const flagsOfShouldBeDisabled = localModels.map(
            (l, i) => shouldBeDisabledByLabels(null, i) || shouldBeDisabledByRange(null, i)
        );

        if (!isEqual(oldProps.enabledSize, enabledSize)) {
            // disable the sizes which is not in the range
            pointGroup.selectAll('g.lbg-point-glyphs')
            // .style('display', (d, i) => (shouldBeDisabledByRange(d, i)) ? 'none' : null);
                .style('display', (d, i) => (flagsOfShouldBeDisabled[i]) ? 'none' : null);
            coverGroup.selectAll('circle.transparent-cover-circles')
            // .style('display', (d, i) => (shouldBeDisabledByRange(d, i)) ? 'none' : null);
                .style('display', (d, i) => (flagsOfShouldBeDisabled[i]) ? 'none' : null);
        }

        if (!isEqual(oldProps.enabledLabels, enabledLabels)) {
            for (let i = 0; i < enabledLabels.length; i++) {
                // if (enabledLabels[i] !== this.props.enabledLabels[i]) {
                //     const targetGlyphGroup = svgRootGroup.selectAll('g.target-label-' + i);
                //
                //     if (enabledLabels[i]) {
                //         targetGlyphGroup.style('display', null);
                //
                //         targetGlyphGroup.transition()
                //             .duration(200)
                //             .style('opacity', 1);
                //     } else {
                //         targetGlyphGroup.transition()
                //             .duration(200)
                //             .style('opacity', 0);
                //         targetGlyphGroup.style('display', 'none');
                //     }
                // }
                pointGroup.selectAll('g.lbg-point-glyphs')
                // .style('display', (d, i) => (shouldBeDisabledByLabels(d, i)) ? 'none' : null);
                    .style('display', (d, i) => (flagsOfShouldBeDisabled[i]) ? 'none' : null);
                coverGroup.selectAll('circle.transparent-cover-circles')
                // .style('display', (d, i) => (shouldBeDisabledByLabels(d, i)) ? 'none' : null);
                    .style('display', (d, i) => (flagsOfShouldBeDisabled[i]) ? 'none' : null);
            }
        }

        // disable corresponding edges
        edgeGroup.selectAll('g.knn-edge-groups').each(function (d, i) {
            d3.select(this).selectAll('g.knn-edge')
                .classed(
                    'forever-disable',
                    d => flagsOfShouldBeDisabled[d.source] || flagsOfShouldBeDisabled[d.target]
                )
        });

        linkAbstactGroup.selectAll('line')
            .classed('forever-disable', function (d, i) {
                const [_source, _target] = d3.select(this)
                    .attr('id')
                    .split('-')
                    .slice(2, 4)
                    .map(n => parseInt(n, 10));

                return flagsOfShouldBeDisabled[_source] || flagsOfShouldBeDisabled[_target];
            });


        /**
         * Handle activation (click) on glyphs
         */
        // if (nextProps.activatedLocalModels.length > 0) {
        //     // activate the selected Models
        //
        //     const _len = nextProps.activatedLocalModels.length;
        //     for (let i = 0; i < _len; i++) {
        //         pointGroup.select('g#lbg-point-glyph-' + nextProps.activatedLocalModels[i])
        //             .select('circle.contour-base-circle')
        //             .style('filter', 'url(#glow-shadow)');
        //     }
        // } else {
        //     // disable selected models
        //     pointGroup.selectAll('g.lbg-point-glyphs')
        //         .select('circle.contour-base-circle')
        //         .attr('filter', null);
        // }

        /**
         * Utility functions for highlighting
         */
        const highlightNodesAndKNNEdges = (modelIdx, shouldDimIrrelevantNodes = false) => {

            // Mark the highlighted edges
            const highlightedEdgeGroup = svgRootGroup.select('g#lbg-edge-group')
                .select('g#knn-edge-group-' + modelIdx);

            highlightedEdgeGroup.classed('edge-highlighted', true)
                .style('display', null)
                .selectAll('g.knn-edge')
                .style('display', null);

            // Get the involved node IDs
            let targetNodeIds = new Set();
            highlightedEdgeGroup.selectAll('g.knn-edge').each(function (d) {
                // hack: select data does not work; use ids instead
                targetNodeIds.add(
                    parseInt(d3.select(this).attr('id').split('-').slice(-1), 10)
                );
            });

            targetNodeIds.add(modelIdx);

            // Dim none-connected nodes
            if (shouldDimIrrelevantNodes) {
                pointGroup.selectAll('g.lbg-point-glyphs')
                    .classed('dimmed-nodes', (d, i) => !targetNodeIds.has(i));
            }

            // Append the mask of the inner label circle
            // const datum = pointGroup.select('g#lbg-point-glyph-' + modelIdx).datum();
            // .select('circle.base-class-label-circle')

            // maskGroup.append('circle')
            //     .attr('id', 'base-class-label-circle-mask-' + modelIdx)
            //     .classed('base-class-label-circle-mask', true)
            //     .attr('cx', datum['x'])
            //     .attr('cy', datum['y'])
            //     .attr('r', datum['size'] - THICKNESS_TORUS - INNER_CIRCLE_PADDING)
            //     .style('fill', labelNormalColorMap[localModels[modelIdx]['targetLabel'][0]])
            //     .style('stroke', '#231f20')
            //     .style('stroke-width', 1);
        };

        if (activatedLocalModels.length > 0 || oldActivatedLocalModels.length > 0) {
            // update the status of activatedLocalModels
            const commonLocalModels = intersection(activatedLocalModels, oldActivatedLocalModels);
            const removed = without(oldActivatedLocalModels, commonLocalModels),
                added = without(activatedLocalModels, commonLocalModels);

            // open newly selected models
            if (removed.length > 0) {
                const lenRemoved = removed.length;

                for (let i = 0; i < lenRemoved; i++) {
                    const removedModelIdx = removed[i];

                    // remove shadow
                    pointGroup.select('g#lbg-point-glyph-' + removedModelIdx).style('filter', null);

                    maskGroup.selectAll('circle#base-class-label-circle-mask-' + removedModelIdx).remove();
                    // edgeGroup.select('g#knn-edge-group-' + removedModelIdx).style('display', 'none');

                    const _edgeGroupDOM = edgeGroup.select('g#knn-edge-group-' + removedModelIdx);
                    _edgeGroupDOM.style('display', 'none');
                    _edgeGroupDOM.selectAll('g.knn-edges').each((d) => {
                        maskGroup.select('circle#base-class-label-circle-mask-' + d['target']).remove();
                    });
                }
            }

            if (added.length > 0) {
                const lenAdded = added.length;

                for (let i = 0; i < lenAdded; i++) {
                    const addedModelIdx = added[i];

                    pointGroup.select('g#lbg-point-glyph-' + addedModelIdx).style('filter', 'url(#glow-shadow)');

                    // toggle the light
                    //highlightNodesAndKNNEdges(addedModelIdx, false);
                }
            }

            // Add an order on the right side of the glyph
            // First, clear all the tags
            activatedOrdersGroup.selectAll('g.orders').remove();

            // Then, add the back based on the current order
            let activatedDatums = new Array(activatedLocalModels.length);

            for (let i = 0; i < activatedLocalModels.length; i++) {
                activatedDatums[i] = pointGroup.select('g#lbg-point-glyph-' + activatedLocalModels[i]).datum();
            }

            activatedOrdersGroup.selectAll('g.orders')
                .data(activatedLocalModels.map((a, i) => ({
                    idx: a,
                    datum: activatedDatums[i]
                })))
                .enter()
                .append('g')
                .attr('id', d => `order-${d.idx}`)
                .classed('orders', true)
                .attr('transform', d => `translate(${d.datum.x + d.datum.size + 10},${d.datum.y})`)
                .call(function (idGroup) {

                    const BACK_RECT_SIZE = 28;
                    const FRONT_FONT_SIZE = 22;

                    idGroup.append('rect');

                    idGroup.append('text')
                        .classed('order-numbers', true)
                        .attr('dx', BACK_RECT_SIZE / 2)
                        .style('alignment-baseline', 'middle')
                        .style('text-anchor', 'middle')
                        .style('font-size', FRONT_FONT_SIZE - 1)
                        .style('font-weight', 'bold')
                        .style('fill', '#fefefe')
                        .text((d, i) => i + 1);

                    idGroup.append('text')
                        .classed('id-numbers', true)
                        .attr('dx', BACK_RECT_SIZE + 2)
                        // .attr('dx', 2)
                        .style('alignment-baseline', 'middle')
                        .style('text-anchor', 'start')
                        .style('font-size', FRONT_FONT_SIZE)
                        .style('filter', 'url(#glow-shadow)')
                        .text(d => `Segment ${d.idx}`);

                    // let textBB = [];
                    // idGroup.select('text.order-numbers').each(function(d, i) {
                    //     textBB.push(this.getBBox());
                    // });

                    idGroup.selectAll('rect')
                    // .attr('x', -BACK_RECT_SIZE / 2)
                    // .attr('y', -BACK_RECT_SIZE / 2)
                        .attr('x', 0)
                        .attr('y', -BACK_RECT_SIZE / 2)
                        .attr('width', BACK_RECT_SIZE)
                        .attr('height', BACK_RECT_SIZE - 3)
                        .attr('rx', 10)
                        .attr('ry', 10)
                        // .style('stroke', '#555')
                        // .style('stroke-width', 0.5)
                        .style('fill', defaultBlueColor)
                        .style('filter', 'url(#glow-shadow)');
                });

            // .append('text')
            // .style('alignment-baseline', 'ideographic')
            // .style('text-anchor', 'start')
            // .style('font-size', 20)
            // .style('filter', 'url(#glow-shadow)')
            // .text(d => d.idx);

            // Finally, activate the edges in between
            // Clear the activated edges before
            for (let i = 0; i < oldActivatedLocalModels.length - 1; i++) {
                const sourceIdx = oldActivatedLocalModels[i]; //, targetIdx = activatedLocalModels[i + 1];

                edgeGroup.select(`g#knn-edge-group-${sourceIdx}`).style('display', 'none');
                edgeGroup.select(`g#knn-edge-group-${sourceIdx}`)
                    .selectAll('g')
                    .style('display', null);
            }

            for (let i = 0; i < activatedLocalModels.length - 1; i++) {
                const sourceIdx = activatedLocalModels[i], targetIdx = activatedLocalModels[i + 1];

                edgeGroup.select(`g#knn-edge-group-${sourceIdx}`)
                    .style('display', null)
                    .selectAll('g')
                    .style('display', 'none');

                edgeGroup.select(`g#knn-edge-group-${sourceIdx}`)
                    .select(`g#knn-edge-${sourceIdx}-${targetIdx}`)
                    .style('display', null);
            }

        }


        /**
         * Handle hovering on glyphs
         */
        if (highlightedLocalModels.length === 0) {

            // remove the dimmed status first
            pointGroup.selectAll('g.lbg-point-glyphs').classed('dimmed-nodes', false);
            pointGroup.selectAll('g.lbg-point-glyphs').classed('nondimmed-nodes', true);

            linkAbstactGroup.selectAll('line').classed('dimmed-nodes', false);
            linkAbstactGroup.selectAll('line').classed('nondimmed-nodes', true);

            // All highlights should be removed
            for (let i = 0; i < oldHighlightedLocalModels.length; i++) {
                const oldModel = oldHighlightedLocalModels[i];

                // Check if it needs to remain activated
                if (activatedLocalModels.indexOf(oldModel) < 0) { // not in activation list
                    // maskGroup.selectAll('*').remove();
                    // edgeGroup.selectAll('g.knn-edge-groups').style('display', 'none');
                    // pointGroup.selectAll('g.lbg-point-glyphs').classed('dimmed-nodes', false);
                    // pointGroup.selectAll('g.lbg-point-glyphs').classed('nondimmed-nodes', true);

                    maskGroup.selectAll('circle#base-class-label-circle-mask-' + oldModel).remove();

                    const _edgeGroupDOM = edgeGroup.select('g#knn-edge-group-' + oldModel);
                    _edgeGroupDOM.style('display', 'none');
                    // _edgeGroupDOM.selectAll('g.knn-edges').each((d, i) => {
                    //     maskGroup.select('circle#base-class-label-circle-mask-' + d['target'])
                    //         .remove();
                    // });
                }
            }
        } else {
            linkAbstactGroup.selectAll('line').classed('dimmed-nodes', true);
            for (let i = 0; i < highlightedLocalModels.length; i++) {
                // if (true) {  //activatedLocalModels.indexOf(highlightedLocalModels[i]) < 0) {

                highlightNodesAndKNNEdges(highlightedLocalModels[i], true);

                //
                // const _highlightedIdx = highlightedLocalModels[i];
                //
                // // Mark the highlighted edges
                // const highlightedEdgeGroup = svgRootGroup.select('g#lbg-edge-group')
                //     .select('g#knn-edge-group-' + _highlightedIdx);
                //
                // highlightedEdgeGroup.classed('edge-highlighted', true).style('display', null);
                //
                // // Get the involved node IDs
                // let targetNodeIds = new Set();
                // highlightedEdgeGroup.selectAll('g.knn-edge').each((d, i) => {
                //     targetNodeIds.add(d['target']);
                // });
                //
                // targetNodeIds.add(_highlightedIdx);
                //
                // // Dim none-connected nodes
                // pointGroup.selectAll('g.lbg-point-glyphs')
                //     .classed('dimmed-nodes', (d, i) => !targetNodeIds.has(i));
                //
                // // Append the mask of the inner label circle
                // const datum = pointGroup.select('g#lbg-point-glyph-' + _highlightedIdx).datum();
                // // .select('circle.base-class-label-circle')
                //
                // maskGroup.append('circle')
                //     .classed('base-class-label-circle-mask', true)
                //     .attr('cx', datum['x'])
                //     .attr('cy', datum['y'])
                //     .attr('r', datum['size'] - THICKNESS_TORUS - INNER_CIRCLE_PADDING)
                //     .style('fill', labelNormalColorMap[localModels[_highlightedIdx]['targetLabel'][0]])
                //     .style('stroke', '#231f20')
                //     .style('stroke-width', 1);
                // }
            }
        }


        // if (enableScatterInGlyph) {
        //     svgRootGroup.selectAll('g.lbg-point-glyph-inner-dists').style('display', 'none');
        // } else {
        //
        // }

        // if (enableBiplotInGlyph) {
        //
        // }

        // const pointGroupWithData = svgRootGroup.select('g#lbg-point-group')
        //     .selectAll('.lbg-point-glyphs')
        //     .data(embeddingCoords);
        //
        // const t = d3.transition().duration(350);
        //
        // pointGroupWithData.transition(t)
        //     .attr('transform', (d) => 'translate(' + xScale(d[0]) + ',' + yScale(d[1]) + ')');
    };


    render() {
        const {canvasHeight} = this.props;

        return (
            <div
                style={{
                    background: '#fff',
                    border: '1px solid #e8e8e8',
                    borderRadius: '1px',
                    width: '100%',  //canvasWidth + 2,
                    height: canvasHeight + 2,
                    position: 'absolute',
                    left: 0,
                    top: 0
                }}
            >
                <svg
                    id="local-boundary-graph-canvas"
                    width='100%' // {canvasWidth}
                    height={canvasHeight}
                    style={{float: 'left'}}
                >
                    <defs>
                        <marker id="triangle-arrow" refX="6" refY="6" markerWidth="30" markerHeight="30"
                                markerUnits="userSpaceOnUse" orient="auto">
                            <path
                                d="M 0 0 12 6 0 12 3 6"
                                style={{fill: '#333'}}
                            />
                        </marker>
                        <marker
                            id="stub"
                            markerHeight={5}
                            markerWidth={5}
                            markerUnits="strokeWidth"
                            orient="auto"
                            refX="0"
                            refY="0"
                            viewBox="-1 -5 2 10"
                        >
                            <path
                                d="M 0,0 m -0.5,-5 L 0.5,-5 L 0.5,5 L -0.5,5 Z"
                                style={{
                                    stroke: 'none',
                                    strokeWidth: 0.75,
                                    fill: '#333'
                                }}
                            />
                        </marker>
                        <filter id="glow-shadow" width="2.5" height="2.5" x="-.25" y="-.25">
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
                        {/*<filter id="blur-me">*/}
                            {/*<feGaussianBlur in="SourceGraphic" stdDeviation="2"/>*/}
                        {/*</filter>*/}
                    </defs>
                    <g id="lbg-base-group">
                        <g id="lbg-link-abstract-group"/>
                        <g id="lbg-point-group"/>
                        <g id="lbg-edge-group"/>
                        <g id="lbg-point-masks"/>
                        <g id="lbg-transparent-cover"/>
                        <g id="activated-orders"/>
                    </g>
                    <g>

                    </g>
                </svg>
            </div>
        );
    }
}
