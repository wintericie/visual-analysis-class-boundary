import React, {Component} from 'react';
// import {findDOMNode} from 'react-dom';
// import * as d3 from 'd3';
// import {
//     Row, Col,
//     Radio, Checkbox, InputNumber, Card,
//     Menu, Dropdown, Button,
//     Icon, List,
//     Divider, Table
// } from 'antd';

import PathCanvas from './PathCanvasOld';
// import {labelNormalColorMap} from '../../utils/Color';

import '../../styles/pathview.css';

export default class PathList extends Component {

    constructor(props) {
        super(props);

        this.state = {};
    }

    render() {
        const {
            height, explorationPath,
            activatedExplorationPathIdx, data,
            updateGlobalProjectionMatrix,
            handleActivatedPointsSet, handleHighlightedPointsSet,
            handleActivatedPointsInPathRotation
        } = this.props;

        return (
            <div
                style={{
                    width: '100%',
                    height: height,
                    overflow: 'scroll'
                }}
            >
                {explorationPath.map((p, i) => {
                    return (
                        <PathCanvas
                            height={height}
                            key={'pathcanvas-' + i}
                            activated={activatedExplorationPathIdx === i}
                            explorationPath={p}
                            localModels={data['localModels']}
                            dataVectors={data['dataVectors']}
                            dimNames={data['dimNames']}
                            updateGlobalProjectionMatrix={updateGlobalProjectionMatrix}
                            handleActivatedPointsSet={handleActivatedPointsSet}
                            handleHighlightedPointsSet={handleHighlightedPointsSet}
                            handleActivatedPointsInPathRotation={handleActivatedPointsInPathRotation}
                        />
                    );
                })}
            </div>
        );
    };

}