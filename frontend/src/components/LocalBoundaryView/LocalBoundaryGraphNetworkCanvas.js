import React, {Component} from 'react';
import {findDOMNode} from "react-dom";
import flatten from "lodash/flatten";
import * as d3 from "d3";

import {labelNormalColorMap} from "../../utils/Color";


export default class LocalBoundaryGraphNetworkCanvas extends Component {
    constructor(props) {
        super(props);

        this.state = {
            distMethod: 'mean', // 'mean' or 'betweenAvg' or 'graph'
            basedData: 'All', // 'All' (all knn) or 'Target'
            layoutMethod: 'TSNE', // 'TSNE' or 'MDS'
            xScale: null,
            yScale: null
        };
    }

    /**
     * Util functions
     */
    static filterTopK = (arr, k, directed = true) => {
        let directedResult = flatten(arr.map(a => a.slice(0, k)));

        if (directed) {
            return directedResult;
        } else {
            // filter out non-symmetric edges
            let edgeMapping = new Map();
            let undirectedResults = [];

            for (let i = 0; i < directedResult.length; i++) {
                const r = directedResult[i];
                // const edgeKey = Math.min(r['source'], r['target']) + '+' + Math.max(r['source'], r['target']);

                // Construct the edgeKey
                let edgeKey;
                const rSource = (r['source'].index === undefined) ? r['source'] : r['source'].index,
                    rTarget = (r['target'].index === undefined) ? r['target'] : r['target'].index;

                if (rSource < rTarget) {
                    edgeKey = rSource + '+' + rTarget;
                } else {
                    edgeKey = rTarget + '+' + rSource;
                }

                const v = edgeMapping.get(edgeKey);

                switch (v) {
                    case undefined:  // does not exist for the first time
                        edgeMapping.set(edgeKey, i);
                        break;
                    case null:  // already existed
                        break;
                    default:  // exists once; push it
                        undirectedResults.push(directedResult[v]);
                        edgeMapping.set(edgeKey, null);
                }

                // if (edgeMapping.has(edgeKey)) {
                //     if (edgeMapping.get(edgeKey) !== null) {
                //         undirectedResults.push(edgeMapping.get(edgeKey));
                //         edgeMapping.set(edgeKey, null);
                //     }
                // } else {
                //     edgeMapping.set(edgeKey, i);
                // }

            }

            return undirectedResults;
        }
    };

    static fixna = (x) => isFinite(x) ? x : 0;

    /**
     * Event handlers
     */
    handleGlyphClick = (idx) => {
        this.props.handleLocalModelsClicked(idx);
    };

    /**
     * React functions
     */

    shouldComponentUpdate() {
        console.log('graph got refresh');
        return false;
    }

    componentDidMount() {
        console.log('graph got mount');
        this.initializeGraph(this.props);
    }

    componentWillReceiveProps(nextProps) {
        console.log(nextProps);
        //this.updateGraph(nextProps);
        console.log('graph got nextProps');

        // Decide if simulation needs to be triggered
        if (nextProps.numKNNEdges !== this.props.numKNNEdges) {
            this.updateGraph(nextProps, true);
        } else {
            this.updateGraph(nextProps, false);
        }
    }

    /**
     * D3 functions
     */
    initializeGraph = (nextProps) => {

        // Save root nodes and bind events
        const svgRoot = this.svgRoot = d3.select(findDOMNode(this));
        const rootGroup = this.rootGroup = this.svgRoot.select('g#lbg-base-group');
        svgRoot.call(d3.zoom().scaleExtent([.1, 4]).on('zoom', () => {
            rootGroup.attr('transform', d3.event.transform);
        }));

        // Update the graph content
        const {dataVector, label, canvasWidth, canvasHeight, localModels, numKNNEdges} = nextProps;
        // const {svgRoot, rootGroup} = this;

        // util function for finiteness
        const filterTopK = LocalBoundaryGraphNetworkCanvas.filterTopK;
        const fixna = LocalBoundaryGraphNetworkCanvas.fixna;
        const _handleGlyphClick = this.handleGlyphClick;

        // Construct the nodes
        const localModelKNNGraph = filterTopK(nextProps.localModelKNNGraph, numKNNEdges, true);

        // const nodes = localModels.map((d, i) => {
        //
        //
        //
        //     return {
        //         id: i,
        //         knnsSize: d['knnsSize'],
        //         coverageSize: d['coverage'].length,
        //         label: d['targetLabel'][0],
        //         knnsProjCoords: null
        //     }
        // });

        // Scale node attributes and compute the radius
        const radiusScale = d3.scaleLinear()
            .domain(d3.extent(localModels, d => d['knnsSize']))
            .range([30, 115]);

        const edgeStrokeWidthScale = d3.scaleLinear()
            .domain(d3.extent(localModelKNNGraph, d => d['value']))
            .range([3, 10]);

        const edgeOpacityScale = d3.scaleLinear()
            .domain(d3.extent(localModelKNNGraph, d => d['value']))
            .range([1.0, 0.1]);

        const edgeStrengthScale = d3.scaleLinear()
            .domain(d3.extent(localModelKNNGraph, d => d['value']))
            .range([0.1, 1.0]);

        const ticked = () => {
            edgeDOM.call(updateEdge);
            nodeDOM.call(updateNode);
        };

        const simulation = this.simulation = d3.forceSimulation(localModels)
            .force("charge", d3.forceManyBody().strength(-5000))
            .force("center", d3.forceCenter(canvasWidth / 2, canvasHeight / 2))
            .force('collision', d3.forceCollide().radius(d => radiusScale(d['knnsSize']) * 1.5))
            .force("x", d3.forceX(canvasWidth / 2).strength(1))
            .force("y", d3.forceY(canvasHeight / 2).strength(1))
            .force('link', d3.forceLink(localModelKNNGraph).id((d, i) => i).distance(l => {
                return edgeStrengthScale(l['value']);
            }))
            .on('tick', ticked);

        const nodeFocus = () => {
            const nodeIdx = d3.select(d3.event.target).datum().index;

            nodeDOM.classed('dimmed-nodes', (d, i) => (i !== nodeIdx));
            edgeDOM.classed('dimmed-edges', e =>
                !((e['source'].index === nodeIdx) || (e['target'].index === nodeIdx)));

            console.log('In: ' + nodeIdx);
        };

        const nodeUnfocus = (d) => {
            const nodeIdx = d3.select(d3.event.target).datum().index;

            nodeDOM.classed('dimmed-nodes', false);
            edgeDOM.classed('dimmed-edges', false);

            console.log('Out: ' + nodeIdx)
        };

        function dragstarted(d) {
            d3.event.sourceEvent.stopPropagation();
            if (!d3.event.active) {
                simulation.alphaTarget(0.1).restart();
            }
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(d) {
            d.fx = d3.event.x;
            d.fy = d3.event.y;
        }

        function dragended(d) {
            if (!d3.event.active) {
                simulation.alphaTarget(0)
            }
            d.fx = null;
            d.fy = null;
        }

        const nodeDOM = rootGroup.select('g#lbg-point-group')
            .selectAll('g')
            .data(localModels)
            .enter()
            .append('g')
            .attr('id', (d, i) => 'node-' + i)
            .classed('local-boundary-node-group', true)
            .call(appendNodeGlyph)
            .call(
                d3.drag()
                    .on("start", dragstarted)
                    .on("drag", dragged)
                    .on("end", dragended)
            )
            .on('click', (d, i) => _handleGlyphClick(i))
            .on('mouseover', nodeFocus)
            .on('mouseout', nodeUnfocus);

        function appendNodeGlyph(n) {
            // n.append('circle')
            //     .classed('changed', true)
            //     .attr('r', d => radiusScale(d['knnsSize']))
            //     .attr('fill', (d) => labelNormalColorMap[d['targetLabel'][0]])
            //     .classed('local-boundary-node', true);

            n.append('rect')
                .classed('local-boundary-node', true)
                .attr('rx', 5)
                .attr('ry', 5)
                .attr('x', d => -radiusScale(d['knnsSize']) / 2)
                .attr('y', d => -radiusScale(d['knnsSize']) / 2)
                .attr('width', d => radiusScale(d['knnsSize']))
                .attr('height', d => radiusScale(d['knnsSize']))
                .style('stroke-width', 2)
                .style('stroke', d => labelNormalColorMap[d['targetLabel'][0]])
                .style('fill', 'white');

            n.append('line')
                .attr('x1', 0)
                .attr('y1', d => -radiusScale(d['knnsSize']) / 2)
                .attr('x2', 0)
                .attr('y2', d => radiusScale(d['knnsSize']) / 2)
                .style('stroke-width', 2)
                .style('stroke', d => labelNormalColorMap[d['targetLabel'][0]]);
        }

        const edgeDOM = rootGroup.select('g#lbg-edge-group')
            .selectAll('line')
            .data(localModelKNNGraph)
            .enter()
            .append('line')
            .classed('local-boundary-edge', true)
            .style('stroke', '#888888')
            .style('stroke-width', d => edgeStrokeWidthScale(d['value']))
            .style('stroke-opacity', d => edgeOpacityScale(d['value']))
            .style('stroke-linecap', 'round');

        const updateNode = (n) => {
            n.attr('transform', (d) => {
                return 'translate(' + fixna(d.x) + ',' + fixna(d.y) + ')';
            })
        };

        const updateEdge = (e) => {
            e.attr('x1', (d) => {
                //console.log(d);
                return fixna(d.source.x);
            })
                .attr('y1', d => fixna(d.source.y))
                .attr('x2', d => fixna(d.target.x))
                .attr('y2', d => fixna(d.target.y));
        };


    };

    updateGraph = (nextProps, shouldTriggerSimulation) => {

        const {localModels, numKNNEdges, localModelKNNGraph} = nextProps;

        const filterTopK = LocalBoundaryGraphNetworkCanvas.filterTopK;
        const fixna = LocalBoundaryGraphNetworkCanvas.fixna;
        const filteredLocalModelKNNGraph = filterTopK(localModelKNNGraph, numKNNEdges, true);

        let edgeGroup = this.rootGroup.select('g#lbg-edge-group')
            .selectAll('line')
            .data(filteredLocalModelKNNGraph);

        const edgeStrengthScale = d3.scaleLinear()
            .domain(d3.extent(filteredLocalModelKNNGraph, d => d['value']))
            .range([0.1, 1.0]);

        // Update the number of edges
        edgeGroup.enter().append('line')
            .attr('stroke', '#aaa')
            .attr('stroke-width', '1px')
            .classed('local-boundary-edge', true)
            .merge(edgeGroup);

        edgeGroup.exit().remove();

        // Re-create ticked event

        const nodeDOM = this.rootGroup.select('g#lbg-point-group')
            .selectAll('g.local-boundary-node-group');
        const edgeDOM = this.rootGroup.select('g#lbg-edge-group')
            .selectAll('line');

        const ticked = () => {
            edgeDOM.call(updateEdge);
            nodeDOM.call(updateNode);
        };

        const updateNode = (n) => {
            n.attr('transform', (d) => {
                return 'translate(' + fixna(d.x) + ',' + fixna(d.y) + ')';
            })
        };

        const updateEdge = (e) => {
            e.attr('x1', (d) => fixna(d.source.x))
                .attr('y1', d => fixna(d.source.y))
                .attr('x2', d => fixna(d.target.x))
                .attr('y2', d => fixna(d.target.y));
        };

        // Update simulation

        if (shouldTriggerSimulation) {
            this.simulation.force(
                'link',
                d3.forceLink(filteredLocalModelKNNGraph).distance(l => {
                    return edgeStrengthScale(l['value']);
                })
            ).alphaTarget(1).on('tick', ticked).restart();
        }
    };

    /**
     * Render function
     * @returns {*}
     */
    render() {
        const {canvasWidth, canvasHeight} = this.props;

        return (
            <svg
                id="local-boundary-graph-canvas"
                width={canvasWidth}
                height={canvasHeight}
                style={{float: 'left'}}
            >
                <g id="lbg-base-group">
                    <g id="lbg-edge-group"/>
                    <g id="lbg-point-group"/>
                </g>
            </svg>
        );
    }
}