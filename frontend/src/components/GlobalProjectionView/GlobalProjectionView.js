import React, {Component} from 'react';
import {Row, Col, Tabs, Switch} from 'antd';
// import numeric from 'numericjs';
// import xor from 'lodash/xor';

import Scatterplot from './Scatterplot';
import TSNEScatterplot from './TSNEScatterplot';
// import DataTable from './DataTable';
import DimControl from '../DimControl';
import DimTable from '../DimTable';

import '../../styles/globalprojectionview.css';

const TabPane = Tabs.TabPane;
// const RadioButton = Radio.Button;
// const RadioGroup = Radio.Group;


export default class GlobalProjectionView extends Component {

    constructor(props) {
        super(props);

        this.state = {
            scatterplotType: 'linear',
            enableESTSNE: false
        };
    }

    handleScatterplotTypeChanged = (event) => {
        this.setState({
            scatterplotType: event.target.value
        });
    };

    handleGlobalProjectionMatrixRotated = (newProjMatrix) => {
        this.props.updateGlobalProjectionMatrix(newProjMatrix);
    };

    changeTSNEMeasure = (checked) => {
        this.setState({enableESTSNE: checked});
    };

    render() {

        const {
            data,
            globalProjectionMatrix,
            activatedLocalModels,
            highlightedLocalModels,
            activatedPoints,
            highlightedPoints,
            canvasHeight,
            activatedPointsOpacityMapping,
            handleClearPointsInScatterplots,
            hoveredPoint
        } = this.props;

        return (
            <div
                className="main-container"
                style={{
                    paddingTop: 7,
                    paddingBottom: 10,
                    paddingLeft: 10,
                    paddingRight: 10
                }}
            >

                <Row>
                    <Col span={17}>
                        <Tabs
                            defaultActiveKey="scatter1"
                            size="default"
                            tabBarExtraContent={<span style={{
                                fontWeight: 'bold',
                                fontSize: 18,
                                paddingLeft: 4,
                                paddingBottom: 8,
                                paddingTop: 0,
                                marginRight: 200
                            }}>
                                    Projection View
                                </span>}
                        >
                            <TabPane tab="Linear" key="scatter1" forceRender={true}>
                                <Scatterplot
                                    dataVectors={data.dataVectors}
                                    label={data.label}
                                    projectionMatrix={globalProjectionMatrix}
                                    // canvasWidth={300}
                                    labelNames={data.labelNames}
                                    canvasHeight={canvasHeight}
                                    activatedLocalModels={activatedLocalModels}
                                    highlightedLocalModels={highlightedLocalModels}
                                    activatedPoints={activatedPoints}
                                    highlightedPoints={highlightedPoints}
                                    activatedPointsOpacityMapping={activatedPointsOpacityMapping}
                                    handleClearPointsInScatterplots={handleClearPointsInScatterplots}
                                    hoveredPoint={hoveredPoint}
                                />
                            </TabPane>
                            <TabPane tab="T-SNE" key="scatter2" forceRender={true}>
                                <div
                                    style={{
                                        height: '100%',
                                        width: '100%'
                                    }}
                                >
                                <TSNEScatterplot
                                    // data={data}
                                    label={data.label}
                                    localModels={data.localModels}
                                    tsnePos={data.tsnePos}
                                    estsnePos={data.estsnePos}
                                    labelNames={data.labelNames}
                                    // canvasWidth={300}
                                    canvasHeight={canvasHeight}
                                    activatedLocalModels={activatedLocalModels}
                                    highlightedLocalModels={highlightedLocalModels}
                                    activatedPoints={activatedPoints}
                                    highlightedPoints={highlightedPoints}
                                    activatedPointsOpacityMapping={activatedPointsOpacityMapping}
                                    handleClearPointsInScatterplots={handleClearPointsInScatterplots}
                                    enableESTSNE={this.state.enableESTSNE}
                                />
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 67,
                                        right: 15
                                    }}
                                >
                                    {/*<Switch*/}
                                    {/*    checkedChildren="Supervised"*/}
                                    {/*    unCheckedChildren="Unsupervised"*/}
                                    {/*    defaultChecked={this.state.enableESTSNE}*/}
                                    {/*    onChange={this.changeTSNEMeasure}*/}
                                    {/*/>*/}
                                </div>
                                </div>
                            </TabPane>
                        </Tabs>
                    </Col>
                    <Col span={7}>
                        <Tabs
                            defaultActiveKey="1"
                            size="default"
                            style={{
                                marginLeft: 10
                            }}
                        >
                            {/*<TabPane tab="Data View" key="2">*/}
                            {/*<Card*/}
                            {/*bodyStyle={{*/}
                            {/*padding: 10,*/}
                            {/*height: canvasHeight*/}
                            {/*}}*/}
                            {/*>*/}
                            {/*<Divider*/}
                            {/*orientation="left"*/}
                            {/*style={{*/}
                            {/*fontSize: 14,*/}
                            {/*marginTop: 5,*/}
                            {/*marginBottom: 5,*/}
                            {/*marginLeft: 0,*/}
                            {/*marginRight: 0*/}
                            {/*}}*/}
                            {/*>*/}
                            {/*Selected Data*/}
                            {/*</Divider>*/}
                            {/*<p className="description-label"><span># Instances:</span> test </p>*/}
                            {/*<p className="description-label"><span># Detected Local Bds.:</span> test </p>*/}
                            {/*<Divider*/}
                            {/*orientation="left"*/}
                            {/*style={{*/}
                            {/*fontSize: 14,*/}
                            {/*marginTop: 5,*/}
                            {/*marginBottom: 5,*/}
                            {/*marginLeft: 0,*/}
                            {/*marginRight: 0*/}
                            {/*}}*/}
                            {/*>*/}
                            {/*Data Table*/}
                            {/*</Divider>*/}
                            {/*<DataTable*/}
                            {/*dataVectors={data['dataVectors']}*/}
                            {/*label={data['label']}*/}
                            {/*labelNames={data['labelNames']}*/}
                            {/*scrollY={310}*/}
                            {/*/>*/}
                            {/*</Card>*/}
                            {/*</TabPane>*/}
                            {/*<TabPane tab="Proj. Control" key="1">*/}
                            <TabPane tab="Proj. Weights" key="1">
                                <div>
                                    <DimControl
                                        projectionMatrix={globalProjectionMatrix}
                                        handleGlobalProjectionMatrixRotated={this.handleGlobalProjectionMatrixRotated.bind(this)}
                                        // updateProjMatrixByMovingDimEndpoint={this.updateProjMatrixByMovingDimEndpoint.bind(this)}
                                        controlWidth={228}
                                        controlHeight={198}
                                        dimNames={data['dimNames']}
                                    />
                                </div>
                                <div style={{width: '100%'}}>
                                    <DimTable
                                        projectionMatrix={globalProjectionMatrix}
                                        dimNames={data['dimNames']}
                                        scrollY={195}
                                    />
                                </div>
                            </TabPane>
                        </Tabs>
                    </Col>
                </Row>
            </div>
        );
    }
}