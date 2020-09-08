import React, {Component} from 'react';

import onepxBar from '../../images/1pxblue.png';
import '../../styles/detailcardweightbar.css';

export default class DetailCardPCP extends Component {
    constructor(props) {
        super(props);
    }

    render() {

        const {filteredDimNames, filteredDimWeights} = this.props;
        const width = 114;

        return (
            <div
                style={{
                    marginTop: 6,
                    border: '1px solid #e8e8e8',
                    borderRadius: 4,
                    padding: 5,
                    backgroundColor: '#fcfcfc'
                }}
            >
                <div
                    style={{
                        marginBottom: 3,
                        fontWeight: 'bold'
                    }}
                >
                    Top Features
                </div>
                {filteredDimNames.map((n, i) => (
                    <div
                        style={{
                            marginBottom: 22
                        }}
                        key={'dim-weight-' + i}
                    >
                        <div style={{fontSize: 11}}>
                            <b>{n}:</b> {filteredDimWeights[i].toFixed(3)}
                            </div>
                        <div
                            style={{
                                float: 'left',
                                width: '100%',
                                height: '100%',
                                background: 'url(' + onepxBar + ')',
                                backgroundSize: (Math.abs(filteredDimWeights[i]) * 100) + '% 8px',
                                backgroundRepeat: 'no-repeat',
                                borderRadius: 2,
                                paddingTop: 8,
                            }}
                        />
                    </div>
                ))}
            </div>
        );
    }
}