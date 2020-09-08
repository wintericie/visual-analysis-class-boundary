import React, {Component} from 'react';
// import {findDOMNode} from 'react-dom';
// import * as d3 from 'd3';
import {
    Row, Col,
    Icon, List,
    Tag, Empty
} from 'antd';

// import PathList from './PathList';
import PathCanvas from './PathCanvas';
import {labelNormalColorMap} from '../../utils/Color';

import '../../styles/pathview.css';
// import flattenDeep from "lodash/flattenDeep";

export default class PathView extends Component {

    constructor(props) {
        super(props);

        this.state = {};
    }

    updateActivatedExplorationPathIdx = (idx) => {
        this.props.updateActivatedExplorationPathIdx(idx);
    };

    render() {

        const {
            height, explorationPath,
            activatedExplorationPathIdx, data,
            updateGlobalProjectionMatrix,
            handleActivatedPointsSet, handleHighlightedPointsSet,
            handleActivatedPointsInPathRotation,
            handleLocalModelsHighlighted,
            handlePointsHighlighted,
            handleHoverPointInPathView
        } = this.props;

        const {localModels} = data;

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
                <Row gutter={8}>
                    <Col span={4}>
                        <Row
                            style={{
                                width: '100%',
                                float: 'left',
                                borderBottom: '1px solid #e8e8e8',
                                paddingBottom: 8
                            }}
                        >
                            <Col
                                // span={6}
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
                                    Path Exploration View
                                </span>
                            </Col>
                        </Row>

                        <Row>
                            <Col
                                span={24}
                            >
                                {(explorationPath.length === 0)
                                    ? <Empty
                                        style={{marginTop: 100}}
                                        description="No path created"
                                    />
                                    : <List
                                        bordered={true}
                                        style={{
                                            marginTop: 16,
                                            height: 410,
                                            width: '100%',
                                            overflowY: 'scroll',
                                            backgroundColor: '#fcfcfc'
                                        }}
                                        dataSource={explorationPath}
                                        renderItem={
                                            (item, i) => <List.Item
                                                key={`path-row-${i}`}
                                                style={{
                                                    paddingLeft: 16,
                                                    paddingRight: 16
                                                }}
                                            >
                                                <List.Item.Meta
                                                    title={
                                                        <a
                                                            href="#"
                                                            onClick={this.updateActivatedExplorationPathIdx.bind(this, i)}
                                                        >
                                                            <b>
                                                                {`Path ${i + 1}:`}
                                                            </b>
                                                        </a>
                                                    }
                                                    description={item.pathOfLocalModels.map(
                                                        (idx, ii) => (
                                                            <div
                                                                style={{float: 'left'}}
                                                                key={`tag-${i}-${ii}`}
                                                            >
                                                                <Icon type="arrow-right"/>
                                                                <Tag
                                                                    color={labelNormalColorMap[localModels[idx]['targetLabel'][0]]}
                                                                    style={{
                                                                        marginRight: 0,
                                                                        marginBottom: 8
                                                                    }}
                                                                >
                                                                    {idx}
                                                                </Tag>
                                                            </div>
                                                        )
                                                    )}
                                                >
                                                </List.Item.Meta>
                                            </List.Item>
                                        }
                                    />
                                }
                            </Col>
                        </Row>

                    </Col>

                    <Col span={20}>
                        {(activatedExplorationPathIdx === -1)
                            ? <Empty
                                style={{marginTop: 136}}
                                description="No path selected"
                            />
                            : <PathCanvas
                                // height={height - 22}
                                height={height - 22}
                                // key={'pathcanvas-' + i}
                                activatedExplorationPathIdx={activatedExplorationPathIdx}
                                explorationPath={explorationPath[activatedExplorationPathIdx]}
                                dataVectors={data['dataVectors']}
                                label={data['label']}
                                localModels={data['localModels']}
                                labelNames={data['labelNames']}
                                dimNames={data['dimNames']}
                                updateGlobalProjectionMatrix={updateGlobalProjectionMatrix}
                                handleActivatedPointsSet={handleActivatedPointsSet}
                                handleHighlightedPointsSet={handleHighlightedPointsSet}
                                handleActivatedPointsInPathRotation={handleActivatedPointsInPathRotation}
                                handleLocalModelsHighlighted={handleLocalModelsHighlighted}
                                handlePointsHighlighted={handlePointsHighlighted}
                                handleHoverPointInPathView={handleHoverPointInPathView}
                            />
                        }
                    </Col>
                </Row>

                {/*</Row>*/}
            </div>
        );
    }
}