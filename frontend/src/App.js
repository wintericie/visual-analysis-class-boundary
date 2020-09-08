import React, {Component} from 'react';
import './App.css';
import {Layout, Row, Col} from 'antd';
// import numeric from 'numericjs';
import xor from 'lodash/xor';
import union from 'lodash/union';

import GlobalProjectionView from './components/GlobalProjectionView/GlobalProjectionView';
import DetailCard from './components/LocalBoundaryView/DetailCard';
import LocalBoundaryGraph from './components/LocalBoundaryView/LocalBoundaryGraph';
import PathView from './components/PathView/PathView';
import isEqual from "lodash/isEqual";

const {Content} = Layout;


class App extends Component {

    constructor(props) {
        super(props);

        this.state = {
            globalProjectionMatrix: props['data']['initialProjections']['pca'],
            // projectionMatrix: props.data.initialProjections.pca,
            // minorDimThreshold: 0.4,
            // sgdLearningRateMiu: 0.005,
            // energyMaxError: 1e-4,
            activatedLocalModels: [],
            highlightedLocalModels: [],

            activatedPoints: new Set(),
            commonPointsForGlobalProjectionView: new Set(),
            highlightedPoints: new Set(),

            activatedPointsOpacityMapping: [],

            /**
             * Hovering from the path view
             */
            hoveredPoint: null,

            // Selected view type for the scatterplot
            // scatterplotType: 'linear'  // 'linear' or 'tsne'

            /**
             * Global exploration path
             */
            explorationPath: [],

            activatedExplorationPathIdx: -1,

            /**
             * Detailed Card
             */
            localModelIdxForDetailCard: undefined
        };
    }

    filterOutActivatedOrHighlightedPoints = (currentPoints, oldIndices, newIndices, localModels) => {
        if (isEqual(new Set(oldIndices), new Set(newIndices))) {
            return currentPoints;
        } else {
            let newPoints = new Set();

            for (let i = 0; i < newIndices.length; i++) {
                const targetHighlights = union(
                    localModels[newIndices[i]]['coverage'],
                    localModels[newIndices[i]]['knns']
                );

                for (let j = 0; j < targetHighlights.length; j++) {
                    newPoints.add(targetHighlights[j]);
                }
            }

            return newPoints;
        }
    };

    updateGlobalProjectionMatrix = (newProjMatrix) => {
        this.setState({
            globalProjectionMatrix: newProjMatrix
        });
    };

    updateGlobalProjectionMatrixByLocalModelsIndex = (idx) => {
        this.updateGlobalProjectionMatrix(
            this.props['data']['localModels'][idx]['initSideMatrix']
        )
    };

    addNewExplorationPath = (prePath) => {
        const shortestPaths = this.props['shortestPaths'];

        let pathOfLocalModels = [];

        const lenPrePathMinus1 = prePath.length - 1;

        for (let i = 0; i < lenPrePathMinus1; i++) {
            const sourceIdx = prePath[i], targetIdx = prePath[i + 1];

            // Append the first source
            pathOfLocalModels.push({
                localModelIdx: sourceIdx,
                isInSelection: true
            });

            // Expand the non-connected nodes
            const intermediatePath = shortestPaths[sourceIdx][targetIdx];
            const lenIntermediatePathMinus1 = intermediatePath.length - 1;

            for (let j = 1; j < lenIntermediatePathMinus1; j++) {
                pathOfLocalModels.push({
                    localModelIdx: intermediatePath[j],
                    isInSelection: false
                })
            }
        }

        // Append the last one
    };

    /**
     * Event handlers
     */

    handleActivatedPointsInPathRotation = (points, commonPoints, opacityMapping, newProjMatrix) => {
        this.handlePointsHighlighted(commonPoints, true);

        if (newProjMatrix === null) {
            this.setState({
                activatedPoints: points,
                // commonPointsForGlobalProjectionView: commonPoints,
                activatedPointsOpacityMapping: opacityMapping,
            });
        } else {
            this.setState({
                // activatedPointsInPathRotation: points,  // new Set(points),
                activatedPoints: points,
                // commonPointsForGlobalProjectionView: commonPoints,
                activatedPointsOpacityMapping: opacityMapping,
                globalProjectionMatrix: newProjMatrix
            });
        }
    };

    handleActivatedPointsSet = (newActivatedPoints) => {
        this.setState({
            activatedPoints: new Set(newActivatedPoints)
        });
    };

    handleHighlightedPointsSet = (newHighlightedPoints) => {
        // const newSet = new Set(newHighlightedPoints);

        this.setState({
            highlightedPoints: new Set(newHighlightedPoints)
        });
    };

    handleLocalModelsClicked = (idx) => {
        if (Number.isInteger(idx)) {
            idx = [idx];
        }

        const newActivatedLocalModels = xor(this.state.activatedLocalModels, idx)
        const newActivatedPoints = this.filterOutActivatedOrHighlightedPoints(
            this.state.activatedPoints,
            this.state.activatedLocalModels,
            newActivatedLocalModels,
            this.props.data.localModels
        );

        this.setState({
            activatedLocalModels: newActivatedLocalModels,
            activatedPoints: newActivatedPoints
        });
    };

    handleLocalModelsHighlighted = (idx) => {
        if (Number.isInteger(idx)) {
            idx = [idx];
        }

        const newHighlightedLocalModels = xor(this.state.highlightedLocalModels, idx);
        const newHighlightedPoints = this.filterOutActivatedOrHighlightedPoints(
            this.state.highlightedPoints,
            this.state.highlightedLocalModels,
            newHighlightedLocalModels,
            this.props.data.localModels
        );

        this.setState({
            highlightedLocalModels: xor(this.state.highlightedLocalModels, idx),
            highlightedPoints: newHighlightedPoints
        });
    };

    handlePointsHighlighted = (pointSet, overwrite = true) => {

        if (overwrite) {
            this.setState({
                highlightedPoints: pointSet
            });
        } else {
            const newHighlightedPoints = xor(
                Array.from(this.state.highlightedPoints),
                Array.from(pointSet)
            );

            this.setState({
                highlightedPoints: new Set(newHighlightedPoints)
            });
        }
    };

    handleHoverPointInPathView = (idx) => {
        this.setState({
            hoveredPoint: idx
        });
    };

    handleAddPathClicked = async () => {

        let lenExplorationPath = this.state.explorationPath.length;

        /**
         * Send to the backend for path
         * @type {Response}
         */
        let payload = [];
        for (let i = 0; i < this.state.activatedLocalModels.length - 1; i++) {
            payload.push({
                sourceLocalSVM: this.state.activatedLocalModels[i],
                targetLocalSVM: this.state.activatedLocalModels[i + 1]
            });
        }

        await fetch('/api/path', {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        }).then(response => response.json())
            .then(interpolations => {
                let newPath = {
                    pathOfLocalModels: this.state.activatedLocalModels,
                    interpolations: interpolations
                };

                this.setState(prevState => ({
                    explorationPath: [...prevState.explorationPath, newPath],
                    activatedExplorationPathIdx: lenExplorationPath
                }));
            })
            .catch(error => console.log('Error for Path API: ', error));
    };

    updateActivatedExplorationPathIdx = (idx) => {
        this.setState({
            activatedExplorationPathIdx: idx
        });
    };

    handleClearActivatedLocalModelsClicked = () => {
        this.setState({
            activatedLocalModels: [],
            activatedPoints: new Set()
        });
    };

    handleClearPointsInScatterplots() {
        this.setState({
            activatedPoints: new Set(),
            highlightedPoints: new Set()
        });
    }

    updateLocalModelIdxForDetailCard = (idx) => {
        this.setState({
            localModelIdxForDetailCard: idx
        });
    };

    /**
     * React functions
     */

    render() {
        return (
            <Layout className="layout" style={{
                // height: '100%',
                // weight: '100%',
                // height: '100%',
                // weight: '100%',
                // backgroundColor: 'rgba(0, 0, 0, 0)'
            }}>
                <Content style={{padding: '10px 10px', float: 'left'}}>
                    <Row gutter={8} type="flex" justify="center">
                        <Col span={12} style={{
                            height: '100%'
                        }}>

                            <LocalBoundaryGraph
                                data={this.props.data}
                                handleLocalModelsClicked={this.handleLocalModelsClicked.bind(this)}
                                handleLocalModelsHighlighted={this.handleLocalModelsHighlighted.bind(this)}
                                updateGlobalProjectionMatrixByLocalModelsIndex={
                                    this.updateGlobalProjectionMatrixByLocalModelsIndex.bind(this)
                                }
                                handleAddPathClicked={this.handleAddPathClicked.bind(this)}
                                handleClearActivatedLocalModelsClicked={this.handleClearActivatedLocalModelsClicked.bind(this)}
                                updateLocalModelIdxForDetailCard={this.updateLocalModelIdxForDetailCard.bind(this)}
                                activatedLocalModels={this.state.activatedLocalModels}
                                highlightedLocalModels={this.state.highlightedLocalModels}
                                explorationPath={this.state.explorationPath}
                                activatedExplorationPathIdx={this.state.activatedExplorationPathIdx}
                                style={{
                                    height: '100%'
                                }}
                            />
                        </Col>
                        <Col span={12}>
                            <GlobalProjectionView
                                data={this.props.data}
                                globalProjectionMatrix={this.state.globalProjectionMatrix}
                                activatedLocalModels={this.state.activatedLocalModels}
                                highlightedLocalModels={this.state.highlightedLocalModels}
                                activatedPoints={this.state.activatedPoints}
                                highlightedPoints={this.state.highlightedPoints}
                                canvasHeight={486}
                                updateGlobalProjectionMatrix={this.updateGlobalProjectionMatrix.bind(this)}
                                // activatedPointsInPathRotation={this.state.activatedPointsInPathRotation}
                                activatedPointsOpacityMapping={this.state.activatedPointsOpacityMapping}
                                handleClearPointsInScatterplots={this.handleClearPointsInScatterplots.bind(this)}
                                hoveredPoint={this.state.hoveredPoint}
                            />
                        </Col>
                    </Row>
                    <Row
                        gutter={8}
                        style={{marginTop: 10}}
                    >
                        <Col span={8}>
                            <DetailCard
                                height={483}
                                viewHeight={423}
                                dataVectors={this.props.data.dataVectors}
                                label={this.props.data.label}
                                labelNames={this.props.data.labelNames}
                                dimNames={this.props.data.dimNames}
                                displayModel={this.props.data.localModels[this.state.localModelIdxForDetailCard]}
                                modelIdx={this.state.localModelIdxForDetailCard}
                            />
                        </Col>
                        <Col span={16}>
                            <PathView
                                height={483}
                                data={this.props.data}
                                explorationPath={this.state.explorationPath}
                                activatedExplorationPathIdx={this.state.activatedExplorationPathIdx}
                                updateActivatedExplorationPathIdx={this.updateActivatedExplorationPathIdx.bind(this)}
                                updateGlobalProjectionMatrix={this.updateGlobalProjectionMatrix.bind(this)}
                                handleActivatedPointsSet={this.handleActivatedPointsSet.bind(this)}
                                handleHighlightedPointsSet={this.handleHighlightedPointsSet.bind(this)}
                                handleActivatedPointsInPathRotation={this.handleActivatedPointsInPathRotation.bind(this)}
                                handleLocalModelsHighlighted={this.handleLocalModelsHighlighted.bind(this)}
                                handlePointsHighlighted={this.handlePointsHighlighted.bind(this)}
                                handleHoverPointInPathView={this.handleHoverPointInPathView.bind(this)}
                            />
                        </Col>
                    </Row>
                </Content>
            </Layout>
        );
    }
}

export default App;
