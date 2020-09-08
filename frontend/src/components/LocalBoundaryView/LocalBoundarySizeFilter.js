import React, {Component} from 'react';
import {findDOMNode} from 'react-dom';
import * as d3 from 'd3';
import d3Tip from 'd3-tip';
import flatten from 'lodash/flatten';

import {labelNormalColorMap, defaultColor} from "../../utils/Color";

const PADDING_LEFT = 20;
const PADDING_RIGHT = 14;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 38;


export default class LocalBoundarySizeFilter extends Component {

    constructor(props) {
        super(props);
    }

    componentDidMount() {
        // Compute the canvas size
        const {height, width} = findDOMNode(this).getBoundingClientRect();

        this.initializeCanvas(height, width);
    }

    initializeCanvas(height, width) {
        const {localModels, labelNames} = this.props;
        const baseGroup = d3.select(findDOMNode(this)).select('g#size-filter-base-group');
        const _handleGlyphDisplaySizeFilterChange = this.props.handleGlyphDisplaySizeFilterChange;

        const sizeArray = localModels.map(l => ({
            label: l.targetLabel[0],
            size: l.coverage.length + l.knns.length
        }));

        const xScale = d3.scaleLinear()
            .domain(d3.extent(sizeArray, s => s.size))
            .nice()
            .range([PADDING_LEFT, width - PADDING_RIGHT]);

        let bins = Array(labelNames.length);

        for (let i = 0; i < labelNames.length; i++) {
            bins[i] = d3.histogram()
                .value(d => d.size)
                .domain(xScale.domain())
                .thresholds(xScale.ticks(20))
                (sizeArray.filter(s => s.label === i));
        }

        const binsForAll = d3.histogram()
            .value(d => d.size)
            .domain(xScale.domain())
            .thresholds(xScale.ticks(20))
            (sizeArray);


        // Append the offset to bars
        for (let j = 0; j < bins[0].length; j++) {
            const bar = bins[0][j];
            bar.offset = 0;
            bar.label = 0;
        }

        for (let i = 1; i < bins.length; i++) {
            const currentRow = bins[i];

            for (let j = 0; j < currentRow.length; j++) {
                const bar = bins[i][j], previousBar = bins[i - 1][j];
                bar.offset = previousBar.offset + previousBar.length;
                bar.label = i;
            }
        }

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(binsForAll, d => d.length)])
            .nice()
            .range([height - PADDING_BOTTOM, PADDING_TOP]);

        /**
         * Rendering
         */

        const xAxis = g => g
            .attr('transform', `translate(0, ${height - PADDING_BOTTOM})`)
            .call(d3.axisBottom(xScale).tickSizeOuter(0).ticks(5))
            .call(
                g => g.append('text')
                    .attr('x', width - PADDING_RIGHT)
                    .attr('y', -4)
                    .attr('fill', '#000')
                    .attr('font-weight', 'normal')
                    .attr('text-anchor', 'end')
                    .text(bins.x)
            );

        const yAxis = g => g
            .attr('transform', `translate(${PADDING_LEFT},0)`)
            .call(d3.axisLeft(yScale).ticks(3))
            .call(
                g => g.select(".domain").remove()
            )
            .call(
                g => g.select(".tick:last-of-type text").clone()
                    .attr("x", 4)
                    .attr("text-anchor", "start")
                    .attr("font-weight", "bold")
                    .text(bins.y)
            );

        const brush = d3.brushX()
            .extent([[PADDING_LEFT, PADDING_TOP], [width - PADDING_RIGHT, height - PADDING_BOTTOM]])
            .on('brush end', function () {
                if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom")
                    return;

                const s = d3.event.selection;
                const newRange = (s === null) ? xScale.domain() : s;

                _handleGlyphDisplaySizeFilterChange(
                    newRange.map(d => xScale.invert(d))
                );
            });

        const tooltip = d3Tip()
            .attr('class', 'd3-tip')
            .html(d => `${d.length} Segment${d.length === 1 ? ' ' : 's '} for <span style="color:${labelNormalColorMap[d.label]}">${labelNames[d.label]}</span>`)
            .direction('ne')
            .offset([-5, 0]);

        baseGroup.call(tooltip);

        baseGroup.append('g')
            .attr('id', 'brush-group')
            .call(brush);
        // .call(brush.move, xScale.range());

        // append bars
        baseGroup.selectAll('rect.stacked-bar')
            .data(flatten(bins))
            .enter()
            .append('rect')
            .classed('stacked-bar', true)
            .attr('x', d => xScale(d.x0) + 1)
            .attr('y', d => yScale(d.length + d.offset))
            .attr('width', d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 1))
            .attr('height', d => yScale(0) - yScale(d.length))
            .style('fill', d => labelNormalColorMap[d.label])
            .on('mouseenter', (d, i, n) => {
                tooltip.show(d, n[i]);
            })
            .on('mouseleave', (d, i, n) => {
                tooltip.hide(d, n[i]);
            });

        baseGroup.append('g')
            .attr('id', 'x-axis')
            .call(xAxis);
        // .selectAll('text')
        // .attr('transform', 'rotate(-45)')
        // .attr('dx', -6)
        // .attr('text-anchor', 'end');
        baseGroup.append('g')
            .attr('id', 'y-axis')
            .call(yAxis);

        baseGroup.append('text')
            .attr('x', PADDING_LEFT)
            .attr('y', 3)
            .style('text-anchor', 'start')
            .style('alignment-baseline', 'hanging')
            .style('font-size', 11)
            .text('Num. Segments');

        baseGroup.append('text')
            .attr('x', width - PADDING_RIGHT)
            .attr('y', height - 2)
            .style('text-anchor', 'end')
            .style('alignment-baseline', 'ideographic')
            .style('font-size', 11)
            .text('Size of Coverages');
    }

    render() {
        return (
            <svg
                id="size-filter"
                width="100%"
                height={this.props.height}
                style={{
                    marginTop: 12,
                    marginBottom: 8
                }}
            >
                <g id="size-filter-base-group"/>
            </svg>
        );
    }
}