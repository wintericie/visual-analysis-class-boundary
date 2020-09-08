import React, {Component} from 'react';
// import {findDOMNode} from 'react-dom';
import * as d3 from 'd3';
import {
    Row, Col, Checkbox, Collapse, Card, Icon, Divider, Tag, Button, InputNumber
} from 'antd';

import {labelNormalColorMap} from '../../utils/Color';

import LocalBoundaryGraphCanvas from './LocalBoundaryGraphCanvas';
// import LocalBoundaryGraphNetworkCanvas from './LocalBoundaryGraphNetworkCanvas';
import LocalBoundaryFeatureRanking from './LocalBoundaryFeatureRanking';
import LocalBoundarySizeFilter from './LocalBoundarySizeFilter';
// import LocalBoundaryTable from './LocalBoundaryTable';
// import DetailCard from './DetailCard';

import '../../styles/localboundarygraph.css';

// const RadioButton = Radio.Button;
// const RadioGroup = Radio.Group;


const INIT_GLYPH_CIRCLE_SIZE_KEY = 'knns';

export default class LocalBoundaryGraph extends Component {

    constructor(props) {
        super(props);
        this.myRef = React.createRef();

        // Get the labels

        this.state = {
            distMethod: 'mean', // 'mean' or 'betweenAvg' or 'graph'
            basedData: 'Target', // 'All' (all knn) or 'Target'
            layoutMethod: 'TSNE', // 'TSNE' or 'MDS'
            enabledLabels: Array(this.props.data['labelNames'].length).fill(true),
            enabledSize: [0, 1000000],
            enableScatterInGlyph: true,
            enableBiplotInGlyph: true,
            showKNNEdges: false,
            numKNNEdges: 5,

            glyphCircleSizekey: INIT_GLYPH_CIRCLE_SIZE_KEY,
            rangeBySize: d3.extent(
                props.data['localModels'].map(
                    (m) => m[INIT_GLYPH_CIRCLE_SIZE_KEY].length
                )
            ),

            // Interactions with global views
            activatedLocalModels: [],
            highlightedLocalModels: [],

            // Showing localModel for the DetailCard
            localModelIdxForDetailCard: undefined
        };
    }

    /**
     * Event handlers
     */
    handleGraphSetting = (e) => {

        const {name, value} = e.target;

        this.setState({
            [name]: value
        });
    };

    handleScatterInGlyphSwitch = (e) => {
        this.setState({
            enableScatterInGlyph: e.target.checked
        })
    };

    handleBiplotInGlyphSwitch = (e) => {
        this.setState({
            enableBiplotInGlyph: e.target.checked
        })
    };

    handleClassDisplayChange(classIdx, event) {

        let newEnabledLabels = this.state.enabledLabels;
        newEnabledLabels[classIdx] = event.target.checked;

        this.setState({
            enabledLabels: newEnabledLabels
        });
    }

    handleGlyphDisplaySizeFilterChange(sizeRange) {
        this.setState({
            enabledSize: sizeRange
        });
    }

    handleKNNEdgeSwitch = (e) => {
        this.setState({
            showKNNEdges: e.target.checked
        })
    };

    handleNumKNNChanged = (e) => {
        this.setState({
            numKNNEdges: parseInt(e)
        });
    };

    handleLocalModelsClicked = (idx) => {
        this.props.handleLocalModelsClicked(idx);

        // this.setState({
        //     activatedLocalModels: xor(
        //         this.state.activatedLocalModels,
        //         [idx]
        //     )
        // })
    };

    handleLocalModelsHighlighted = (idx) => {
        this.props.handleLocalModelsHighlighted(idx);

        // this.setState({
        //     highlightedLocalModels: xor(this.state.highlightedLocalModels, [idx])
        // });
    };

    updateGlobalProjectionMatrixByLocalModelsIndex = (idx) => {
        this.props.updateGlobalProjectionMatrixByLocalModelsIndex(idx);
    };

    updateLocalModelIdxForDetailCard = (idx) => {
        this.props.updateLocalModelIdxForDetailCard(idx);
        // this.setState({localModelIdxForDetailCard: idx});
    };

    // Event handlers for tags
    handleTagCloseClicked = (idx) => {
        this.handleLocalModelsClicked(idx);
    };

    handleTagMouseEnter = (idx) => {
        this.handleLocalModelsHighlighted(idx);
    };

    handleTagMouseOut = (idx) => {
        this.handleLocalModelsHighlighted(idx);
    };

    // Add a new path
    handleAddPathClicked = () => {
        this.props.handleAddPathClicked();
    };

    handleClearActivatedLocalModelsClicked = () => {
        this.props.handleClearActivatedLocalModelsClicked();
    };

    /**
     * React interfaces
     */

    componentDidMount() {
        // const {canvasWidth, canvasHeight} = this.props;

    }

    render() {

        const {
            activatedLocalModels, highlightedLocalModels,
            // localModelIdxForDetailCard
        } = this.props;
        const {
            dataVectors, label, localModels, labelNames, localModelKNNGraph,
            dimNames, localModelDimRankings, localModelDimRankingHists
        } = this.props.data;

        const canvasWidth = 693, canvasHeight = 486;

        const embedAttrName = this.state.distMethod + this.state.basedData + this.state.layoutMethod;
        const isCurrentLayoutGraph = this.state.distMethod === 'graph';

        // let menu = (
        //     <Menu>
        //         {labelNames.map((name, i) => {
        //             const keyName = '' + i;
        //             return (
        //                 <Menu.Item key={keyName}>
        //                     <Checkbox
        //                         onChange={this.handleClassDisplayChange.bind(this, i)}
        //                         defaultChecked={true}
        //                         key={keyName}
        //                     >
        //                         <Icon type="plus-circle" theme="filled"
        //                               style={{color: labelNormalColorMap[i], marginRight: 3}}/> {name}
        //                     </Checkbox>
        //                 </Menu.Item>
        //             );
        //         })}
        //     </Menu>
        // );

        let classCheckboxes = labelNames.map((name, i) => {
            const keyName = '' + i;
            return (
                <Row key={keyName}>
                <Checkbox
                    onChange={this.handleClassDisplayChange.bind(this, i)}
                    defaultChecked={true}
                    style={{
                        marginLeft: 10,
                        marginBottom: 5
                    }}
                >
                    <Icon type="plus-circle" theme="filled"
                          style={{color: labelNormalColorMap[i]}}/>
                          <span style={{color: labelNormalColorMap[i]}}>{name}</span>
                            : {localModels.filter(l => l.targetLabel[0] === i).length} Segments
                </Checkbox>
                </Row>
            );
        });

        return (
            <Row
                className="main-container"
                gutter={8}
                style={{
                    marginLeft: 0,
                    marginRight: 0,
                    padding: 10
                }}
            >
                <Row
                    id="local-boundary-graph-control-container"
                    style={{
                        width: '100%',
                        float: 'left',
                        borderBottom: '1px solid #e8e8e8',
                        paddingBottom: 9,
                        marginTop: 4
                    }}
                >
                        <span
                            style={{
                                fontWeight: 'bold',
                                fontSize: 18,
                                padding: 4
                            }}
                        >
                            Segment Relation View
                        </span>
                </Row>
                <Row>
                    <Col
                        span={7}
                        style={{
                            marginTop: 6
                        }}
                    >
                        <Row>
                            <Col
                                span={24}
                                style={{
                                    paddingRight: 10,
                                    paddingTop: 10
                                }}
                            >
                                <Card
                                    bodyStyle={{
                                        padding: 10,
                                        height: canvasHeight
                                    }}
                                >
                                    <Divider
                                        orientation="left"
                                        style={{
                                            fontSize: 14,
                                            marginTop: 5,
                                            marginBottom: 5,
                                            marginLeft: 0,
                                            marginRight: 0
                                        }}
                                    >Dataset</Divider>
                                    {/*<p className="description-label"><span className="emphasize-span">Dataset: Wall-following</span></p>*/}
                                    <p className="description-label"><span># Instances:</span> {dataVectors.length}</p>
                                    <p className="description-label">
                                        <span># Detected Segments:</span> {localModels.length}
                                    </p>

                                    {/*<Divider*/}
                                        {/*orientation="left"*/}
                                        {/*style={{*/}
                                            {/*fontSize: 14,*/}
                                            {/*marginTop: 10,*/}
                                            {/*marginBottom: 5,*/}
                                            {/*marginLeft: 0,*/}
                                            {/*marginRight: 0*/}
                                        {/*}}*/}
                                    {/*>Filters</Divider>*/}
                                    <Collapse
                                        bordered={false}
                                        defaultActiveKey={['1']}
                                        accordion={true}
                                    >
                                        <Collapse.Panel
                                            header="Filters"
                                            key="1"
                                        >
                                            {classCheckboxes}
                                            <LocalBoundarySizeFilter
                                                height={140}
                                                localModels={localModels}
                                                labelNames={labelNames}
                                                handleGlyphDisplaySizeFilterChange={this.handleGlyphDisplaySizeFilterChange.bind(this)}
                                            />
                                        </Collapse.Panel>
                                        <Collapse.Panel
                                            header="Features Ranking Distributions"
                                            key="2"
                                        >
                                            <LocalBoundaryFeatureRanking
                                                // height={canvasHeight - 31 - 21 - 21 - 36 - 21 * 4 - 36}
                                                height={349}
                                                localModels={localModels}
                                                localModelDimRankings={localModelDimRankings}
                                                localModelDimRankingHists={localModelDimRankingHists}
                                                dimNames={dimNames}
                                            />
                                        </Collapse.Panel>
                                    </Collapse>
                                    {/*<Divider*/}
                                    {/*orientation="left"*/}
                                    {/*style={{*/}
                                    {/*fontSize: 14,*/}
                                    {/*marginTop: 10,*/}
                                    {/*marginBottom: 5,*/}
                                    {/*marginLeft: 0,*/}
                                    {/*marginRight: 0*/}
                                    {/*}}*/}
                                    {/*>Features Ranking Distributions</Divider>*/}

                                </Card>

                            </Col>

                        </Row>
                    </Col>
                    <Col
                        span={17}
                        style={{
                            marginTop: 16
                        }}
                    >
                        <Row>
                            {(activatedLocalModels.length > 0)
                                ?
                                <div
                                    style={{
                                        position: 'absolute',
                                        left: 15,
                                        marginRight: 15,
                                        top: 10,
                                        zIndex: 2,
                                        padding: 5,
                                        background: '#fcfcfc',
                                        border: '1px solid #d9d9d9',
                                        borderRadius: '2px'
                                    }}
                                >
                                    <b>Selected Segments: </b>{activatedLocalModels.map(idx => (
                                    <Tag
                                        key={'test-localmodel-tag-' + idx}
                                        style={{marginBottom: 5}}
                                        color={
                                            labelNormalColorMap[localModels[idx]['targetLabel'][0]]
                                        }
                                        closable
                                        onClose={this.handleTagCloseClicked.bind(this, idx)}
                                        onMouseEnter={this.handleTagMouseEnter.bind(this, idx)}
                                        onMouseOut={this.handleTagMouseOut.bind(this, idx)}
                                    >
                                        {idx}
                                    </Tag>
                                ))}
                                    <div style={{paddingTop: 3, marginBottom: 3}}>
                                        <Button
                                            // size="small"
                                            type="primary"
                                            icon="plus"
                                            onClick={this.handleAddPathClicked.bind(this)}
                                        >Create a Path</Button>
                                        <Button
                                            // size="small"
                                            icon="delete"
                                            onClick={this.handleClearActivatedLocalModelsClicked.bind(this)}
                                            style={{marginLeft: 5}}
                                        >Clear Selections</Button>
                                    </div>
                                </div>
                                : null
                            }

                            <LocalBoundaryGraphCanvas
                                key={`lbg-${this.state.numKNNEdges}`}
                                canvasHeight={canvasHeight}
                                canvasWidth={canvasWidth}
                                embeddingCoords={
                                    isCurrentLayoutGraph
                                        ? null
                                        : this.props.data.localModelDistsEmbed[embedAttrName]
                                }
                                localModels={localModels}
                                dataVectors={dataVectors}
                                label={label}
                                labelNames={labelNames}
                                localModelKNNGraph={localModelKNNGraph}
                                distMethod={this.state.distMethod}
                                basedData={this.state.basedData}
                                layoutMethod={this.state.layoutMethod}
                                enabledLabels={this.state.enabledLabels.slice()}
                                enabledSize={this.state.enabledSize.slice()}
                                enableBiplotInGlyph={this.state.enableBiplotInGlyph}
                                enableScatterInGlyph={this.state.enableScatterInGlyph}
                                showKNNEdges={this.state.showKNNEdges}
                                numKNNEdges={this.state.numKNNEdges}
                                activatedLocalModels={activatedLocalModels}
                                highlightedLocalModels={highlightedLocalModels}
                                handleLocalModelsClicked={this.handleLocalModelsClicked}
                                handleLocalModelsHighlighted={this.handleLocalModelsHighlighted}
                                updateGlobalProjectionMatrixByLocalModelsIndex={this.updateGlobalProjectionMatrixByLocalModelsIndex}
                                updateLocalModelIdxForDetailCard={this.updateLocalModelIdxForDetailCard.bind(this)}
                                glyphCircleSizekey={this.state.glyphCircleSizekey}
                            />
                            {/*!*/}
                            {/*// (<LocalBoundaryGraphNetworkCanvas*/}
                            {/*//     canvasHeight={canvasHeight - 10 * 2}*/}
                            {/*//     canvasWidth={canvasWidth - 10 * 2}*/}
                            {/*//     embeddingCoords={*/}
                            {/*//         isCurrentLayoutGraph*/}
                            {/*//             ? null*/}
                            {/*//             : this.props.data.localModelDistsEmbed[embedAttrName]*/}
                            {/*//     }*/}
                            {/*//     localModels={localModels}*/}
                            {/*//     localModelKNNGraph={localModelKNNGraph}*/}
                            {/*//     dataVectors={dataVectors}*/}
                            {/*//     label={label}*/}
                            {/*//     distMethod={this.state.distMethod}*/}
                            {/*//     basedData={this.state.basedData}*/}
                            {/*//     layoutMethod={this.state.layoutMethod}*/}
                            {/*//     showKNNEdges={this.state.showKNNEdges}*/}
                            {/*//     numKNNEdges={this.state.numKNNEdges}*/}
                            {/*//     activatedLocalModels={activatedLocalModels}*/}
                            {/*//     highlightedLocalModels={highlightedLocalModels}*/}
                            {/*//     handleLocalModelsClicked={this.handleLocalModelsClicked}*/}
                            {/*//     handleLocalModelsHighlighted={this.handleLocalModelsHighlighted}*/}
                            {/*// />)*/}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 20,
                                    right: 20
                                }}
                            >
                                {/*<InputNumber*/}
                                {/*    min={1}*/}
                                {/*    max={7}*/}
                                {/*    defaultValue={this.state.numKNNEdges}*/}
                                {/*    onChange={this.handleNumKNNChanged}*/}
                                {/*/>*/}
                            </div>
                        </Row>
                    </Col>
                </Row>
            </Row>
        );
    }
}
