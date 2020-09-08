import React, {Component} from 'react';
import {findDOMNode} from 'react-dom';
// import d3 from '../../utils/d3-import-remove';
import * as d3 from 'd3';
import d3Tip from 'd3-tip';
import isEqual from 'lodash/isEqual';
import {Menu, Checkbox, Icon} from 'antd';
import {labelNormalColorMap} from '../../utils/Color';


import '../../styles/scatterplot.css';
// import Scatterplot from "./Scatterplot";

const CANVAS_PADDING = 10;

const ACTIVATED_POINT_OPACITY = 0.85;


export default class TSNEScatterplot extends Component {

    constructor(props) {
        super(props);

        this.state = {
            //xScale: xScale,
            //yScale: yScale,
            coordinates: props['tsnePos'],
            estsneCoordinates: props['estsnePos'],
            enabledLabels: Array(this.props['labelNames'].length).fill(true),
            activatedPoints: new Set(),
            highlightedPoints: new Set()
        };
    }

    handleClassDisplayChange(classIdx, event) {

        let newEnabledLabels = this.state.enabledLabels;
        newEnabledLabels[classIdx] = event.target.checked;

        this.setState({
            enabledLabels: newEnabledLabels
        }, () => {
            this.refreshClassDrawing();
        });
    }

    refreshClassDrawing() {
        const numLabels = this.props.labelNames.length;
        const enabledLabels = this.state.enabledLabels;

        for (let i = 0; i < numLabels; i++) {
            const enable = enabledLabels[i];
            this.svgRoot.select('g#base-group')
                .select('g#point-group')
                .selectAll('.class-label-' + i)
                .classed('scatterplot-disabled-label', !enable);
        }
    }

    filterOutActivatedOrHighlightedPoints = (currentPoints, oldIndices, newIndices, localModels) => {
        if (isEqual(new Set(oldIndices), new Set(newIndices))) {
            return currentPoints;
        } else {
            let newPoints = new Set();

            for (let i = 0; i < newIndices.length; i++) {
                const knns = localModels[newIndices[i]]['knns'];

                for (let j = 0; j < knns.length; j++) {
                    newPoints.add(knns[j]);
                }
            }

            return newPoints;
        }
    };

    componentDidMount() {

        /**
         * Compute the points that should be disabled because of highlighting
         */
        const {
            activatedPoints, highlightedPoints, enableESTSNE
        } = this.props;

        const svgRoot = this.svgRoot = d3.select(findDOMNode(this)).select('svg');

        svgRoot.call(
            d3.zoom()
                .on('zoom', function () {
                    svgRoot.select('g#base-group')
                        .attr('transform', d3.zoomTransform(this));
                })
        );

        const {xScale, yScale} = (enableESTSNE)
            ? this.computeLinearScales(this.state.estsneCoordinates)
            : this.computeLinearScales(this.state.coordinates);

        this.initializeScatterplot({
            xScale: xScale,
            yScale: yScale,
            coordinates: (enableESTSNE) ? this.state.estsneCoordinates : this.state.coordinates,
            activatedPoints,
            highlightedPoints
        });

        this.setState({xScale, yScale, activatedPoints, highlightedPoints});
    }

    componentWillReceiveProps(nextProps) {
        /**
         * Compute the points that should be disabled because of highlighting
         */
        const {
            activatedPoints, highlightedPoints,
            activatedPointsOpacityMapping
        } = this.props;

        let newState = {};

        if (activatedPoints !== nextProps.activatedPoints) {
            newState['activatedPoints'] = nextProps.activatedPoints;
        } else {
            newState['activatedPoints'] = activatedPoints;
        }

        if (highlightedPoints !== nextProps.highlightedPoints) {
            newState['highlightedPoints'] = nextProps.highlightedPoints;
        } else {
            newState['highlightedPoints'] = highlightedPoints;
        }

        if (activatedPointsOpacityMapping !== nextProps.activatedPointsOpacityMapping) {
            newState['activatedPointsOpacityMapping'] = nextProps.activatedPointsOpacityMapping;
        } else {
            newState['activatedPointsOpacityMapping'] = activatedPointsOpacityMapping;
        }

        this.updateScatterplot({
            coordinates: (nextProps.enableESTSNE)
                ? this.state.estsneCoordinates
                : this.state.coordinates,  // may be overwritten by newState
            xScale: this.state.xScale,  // may be overwritten by newState
            yScale: this.state.yScale,  // may be overwritten by newState

            // latest xScale, yScale and coords.
            ...newState,
        });

        /**
         * Update current state
         */
        this.setState(newState);
    }

    shouldComponentUpdate() {
        return false;
    }

    computeLinearScales(coordinates) {

        // const halfCanvasWidth = this.props.canvasWidth / 2,
        const halfCanvasHeight = this.props.canvasHeight / 2,
            halfCanvasWidth = this.svgRoot.node().getBoundingClientRect().width / 2;

        return {
            xScale: d3.scaleLinear()
                .domain(d3.extent(coordinates, c => c[0]))
                .range([-halfCanvasWidth + CANVAS_PADDING, halfCanvasWidth - CANVAS_PADDING]),
            yScale: d3.scaleLinear()
                .domain(d3.extent(coordinates, c => c[1]))
                .range([halfCanvasHeight - CANVAS_PADDING, -halfCanvasHeight + CANVAS_PADDING])
        };
    }

    initializeScatterplot({xScale, yScale, coordinates, activatedPoints, highlightedPoints}) {
        // const halfCanvasWidth = this.props.canvasWidth / 2,
        const halfCanvasHeight = this.props.canvasHeight / 2,
            halfCanvasWidth = this.svgRoot.node().getBoundingClientRect().width / 2;

        const {label, labelNames, handleClearPointsInScatterplots} = this.props;
        const enabledLabels = this.state.enabledLabels;

        const svgRoot = this.svgRoot,
            baseGroup = svgRoot.select('g#base-group');

        // const {xScale, yScale, activatedPoints, highlightedPoints} = this.state;
        const tooltip = d3Tip()
            .attr('class', 'd3-tip-scatterplot')
            .html(d => `<p>Instance: ${d.index}</p><p style="margin-bottom:0">Label: <span style="color:${labelNormalColorMap[d.label]}">${labelNames[d.label]}</span></p>`)
            .direction('n')
            .offset([-3, 0]);

        baseGroup.select('g#point-group').selectAll('.point').remove();
        baseGroup.call(tooltip);

        svgRoot.on('click', () => {
            handleClearPointsInScatterplots();
        }).on('dblclick.zoom', null);

        baseGroup.select('g#point-group')
            .attr('transform', 'translate(' + halfCanvasWidth + ',' + halfCanvasHeight + ')')
            .selectAll('.point')
            .data(coordinates)
            .enter()
            .append('circle')
            .attr('class', (d, i) => 'class-label-' + label[i])
            .classed('point', true)
            .classed('scatterplot-non-activated', (d, i) => !activatedPoints.has(i) && activatedPoints.size > 0)
            .classed('scatterplot-disabled-label', (d, i) => !(enabledLabels[label[i]]))
            .attr('r', 3.5)
            .attr('cx', function (d) {
                return xScale(d[0]);
            })
            .attr('cy', (d) => yScale(d[1]))
            .style('fill', (d, i) => labelNormalColorMap[label[i]])
            .style('z-index', (d, i) => (!activatedPoints.has(i) && activatedPoints.size > 0) ? -1 : 1)
            .on('mouseenter', (d, i, n) => {
                tooltip.show({
                    index: i,
                    label: label[i]
                }, n[i]);
            })
            .on('mouseleave', (d, i, n) => {
                tooltip.hide({
                    index: i,
                    label: label[i]
                }, n[i]);
            })
            .on('click', () => {
                d3.event.stopPropagation();
            });
        // .style('fill', (d, i) => d3.schemeCategory10[label[i]]);
    }

    updateScatterplot({
                          xScale, yScale, coordinates,
                          activatedPoints, activatedPointsOpacityMapping,
                          highlightedPoints, enabledLabels
                      }) {

        const {label} = this.props;
        const pointGroup = this.svgRoot.select('g#base-group').select('g#point-group');
        const isHighlightedPointsExist = highlightedPoints.size > 0,
            isActivatedPointsExist = activatedPoints.size > 0;

        if (coordinates !== undefined) {
            // update the coords with xScale and yScale
            pointGroup.selectAll('.point')
                .attr('cx', (d, i) => xScale(coordinates[i][0]))
                .attr('cy', (d, i) => yScale(coordinates[i][1]));
        }

        // update highlight status
        pointGroup.selectAll('.point')
            .classed(
                'scatterplot-highlighted',
                (d, i) => highlightedPoints.has(i)
            )
            .classed(
                'scatterplot-not-highlighted',
                (d, i) => !highlightedPoints.has(i)
                    && isHighlightedPointsExist
                    && !activatedPoints.has(i)
            );

        // if (highlightedPoints.size === 0) {
        // update activate status
        pointGroup.selectAll('.point')
            .classed('scatterplot-non-activated', (d, i) => !activatedPoints.has(i) && activatedPoints.size > 0)
            .style('fill-opacity', (d, i) => {
                if (!activatedPoints.has(i) && isActivatedPointsExist) {
                    return 0.1;
                } else if (activatedPointsOpacityMapping[i] !== undefined) {
                    return activatedPointsOpacityMapping[i] * ACTIVATED_POINT_OPACITY;
                } else {
                    return null;
                }
            })
            .style('stroke-opacity', (d, i) => {
                if (!activatedPoints.has(i) && isActivatedPointsExist) {
                    return 0.1;
                } else if (activatedPointsOpacityMapping[i] !== undefined) {
                    return activatedPointsOpacityMapping[i] * ACTIVATED_POINT_OPACITY;
                } else {
                    return null;
                }
            });

        if (isHighlightedPointsExist) {
            // highlighted points should not be non-activated
            pointGroup.selectAll('.point')
                .classed('scatterplot-non-activated', (d, i) => !highlightedPoints.has(i));
        }

        if (enabledLabels !== undefined) {
            // update the enable class
            pointGroup.classed('scatterplot-disabled-label', (d, i) => !(enabledLabels[label[i]]))
        }
    }

    render() {

        let menu = (
            <Menu>
                {this.props['labelNames'].map((name, i) => {
                    const keyName = '' + i;
                    return (
                        <Menu.Item key={keyName}>
                            <Checkbox
                                onChange={this.handleClassDisplayChange.bind(this, i)}
                                defaultChecked={true}
                                key={keyName}
                            >
                                <Icon type="plus-circle" theme="filled"
                                      style={{color: labelNormalColorMap[i], marginRight: 3}}/> {name}
                            </Checkbox>
                        </Menu.Item>
                    );
                })}
            </Menu>
        );

        console.log(menu);

        return (
            <div
                // style={{background: '#fff', width: this.props.canvasWidth, height: this.props.canvasHeight}}
                style={{
                    background: '#fff',
                    border: '1px solid #e8e8e8',
                    borderRadius: '1px',
                    height: this.props.canvasHeight + 2
                }}
            >
                <svg
                    id={'scatterplot-canvas'}
                    //width={this.props.canvasWidth}
                    height={this.props.canvasHeight}
                    width="100%"
                    // height="100%"
                >
                    <g id="base-group">
                        <g id="point-group"/>
                    </g>
                </svg>
            </div>
        );
    }
}