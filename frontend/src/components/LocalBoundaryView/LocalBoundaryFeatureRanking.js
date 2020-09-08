import React, {Component} from 'react';
import {findDOMNode} from 'react-dom';
import * as d3 from 'd3';
import d3Tip from 'd3-tip';
import numeral from 'numeral-es6';
import flatten from 'lodash/flatten';
import {List} from 'antd';

// import {labelNormalColorMap} from '../../utils/Color';

import '../../styles/localboundaryfeatureranking.css';
import {defaultColor} from "../../utils/Color";


export default class LocalBoundaryFeatureRanking extends Component {

    constructor(props) {
        super(props);

        this.state = {};
    }

    render() {

        const {height, localModelDimRankings, localModelDimRankingHists, dimNames} = this.props;

        // Check the maximum value of the localModelDimRankings
        const rankingHistExtent = d3.extent(flatten(localModelDimRankingHists));

        return (
            <div style={{
                height: height,
                overflow: 'scroll'
            }}>
                <List
                    itemLayout="horizontal"
                    dataSource={dimNames.map((d, i) => ({
                        dimName: d,
                        rankingAcrossLocalModels: localModelDimRankings[i],
                        rankingHist: localModelDimRankingHists[i]
                    }))}
                    size="small"
                    renderItem={dim => (
                        <List.Item
                            style={{
                                paddingTop: 3,
                                paddingBottom: 3
                            }}
                        >
                            <LocalBoundaryFeatureBarChart
                                dimDescription={dim}
                                rankingHistExtent={rankingHistExtent}
                            />
                        </List.Item>
                    )}
                />
            </div>
        );
    }
}


const HEIGHT_BARS = 70, UP_PADDING = 12, WIDTH_BARS = 236, LEFT_PADDING = 17;

class LocalBoundaryFeatureBarChart extends Component {
    constructor(props) {
        super(props);

        this.state = {};
    }

    shouldComponentUpdate() {
        return false;
    }

    componentDidMount() {
        this.initializeBarChart();
    }

    initializeBarChart() {
        const {dimDescription, rankingHistExtent} = this.props;
        const {rankingHist, rankingAcrossLocalModels, dimName} = dimDescription;
        const rootGroup = d3.select(findDOMNode(this)).select('svg.bar-canvases').select('g#root-group');
        rootGroup.attr('transform', 'translate(' + LEFT_PADDING + ',-6)');

        const tooltip = d3Tip()
            .attr('class', 'd3-tip')
            .html(d => {
                return `<p>Feature ${dimName}:</p><p>Ranks ${numeral(d.order + 1).format('Oo')} in ${d.count} segments</p>`;
            })
            .direction('ne')
            .offset([-5, 0]);

        const x = d3.scaleBand()
                .domain(rankingHist.map((d, i) => i + 1 + ''))
                .range([0, WIDTH_BARS - LEFT_PADDING])
                .padding(0.1),
            y = d3.scaleLinear()
                .domain([rankingHistExtent[0], rankingHistExtent[1]])
                .nice()
                .range([HEIGHT_BARS - UP_PADDING, UP_PADDING]);

        rootGroup.append('g')
            .attr('id', 'bar-group')
            .selectAll('.ranking-bars')
            .data(rankingHist)
            .enter()
            .append('rect')
            .classed('ranking-bars', true)
            .attr('x', (d, i) => x(i + 1 + ''))
            .attr('width', x.bandwidth())
            .attr('y', (d) => y(d))
            .attr('height', (d) => HEIGHT_BARS - UP_PADDING - y(d))
            .style('fill', defaultColor)
            .on('mouseenter', (d, i, n) => {
                tooltip.show({
                    order: i,
                    count: d
                }, n[i]);
            })
            .on('mouseleave', (d, i, n) => {
                tooltip.hide(null, n[i]);
            });

        rootGroup.append('g').attr('transform', 'translate(0,' + (HEIGHT_BARS - UP_PADDING)  + ')')
            .call(
                d3.axisBottom(x)
                    .tickValues(
                        x.domain().filter((d, i) => !(i % 5))
                    )
                    .tickFormat(d => numeral(d).format('Oo'))
                    .tickSize(2)
                    .ticks(10)
            );

        rootGroup.append('g').call(
            d3.axisLeft(y)
                .tickSize(2)
                .tickValues(y.ticks(2).concat([y.domain()[1]]))
                // .ticks([2])
        );

        rootGroup.call(tooltip);
    }

    render() {

        const {dimDescription, rankingHistExtent} = this.props;

        return (
            <div>
                <div
                    style={{
                        marginLeft: 12,
                        fontSize: 13,
                        fontWeight: 'bold'
                    }}
                >
                    {dimDescription['dimName']}
                    </div>
                <svg
                    className="bar-canvases"
                    width={WIDTH_BARS}
                    height={HEIGHT_BARS}
                >
                    <g id="root-group"/>
                </svg>
            </div>
        );
    }
}