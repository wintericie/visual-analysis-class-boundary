import normalizeToUnit from './normalizetounit';

const rotateVector = (vec, cosineAngle, isAntiClockwise, shouldNormalizeToUnit) => {

    let rotateMatrix;
    let sineAngle = Math.sqrt(1 - cosineAngle*cosineAngle) * ((isAntiClockwise) ? 1 : -1);

    let newVec = [
        vec[0] * cosineAngle - vec[1] * sineAngle,
        vec[0] * sineAngle + vec[1] * cosineAngle
    ];

    if (shouldNormalizeToUnit) {
        return normalizeToUnit(newVec);
    } else {
        return newVec;
    }
};

export default rotateVector;