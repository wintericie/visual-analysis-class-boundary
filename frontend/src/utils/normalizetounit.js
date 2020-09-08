import numeric from 'numericjs';

const normalizeToUnit = (vec) => {
    return numeric.div(vec, numeric.norm2(vec));
};

export default normalizeToUnit;