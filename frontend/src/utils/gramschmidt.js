'use strict';

const math = require('mathjs');
const _ = require('lodash');


/**
 * Normalizes a vector given in as a one dimensional array
 * @param  {Array} vector
 * @return {Array} returns the normalized vector
 */
function normalize(vector) {

    // _.each(vector, function (v) {
    //     length += Math.pow(v, 2);
    // });
    //
    // length = Math.sqrt(length);

    return math.multiply(1 / math.norm(vector), vector);
}

/**
 * Adds up a list of vectors recursively
 * @param  {Array of Arrays} vector list
 * @return {Array} returns of sum of all vectors in arguments
 */
function recursiveVectorSum(vectors) {

    // if length is 1, then return the vector
    // if (vectors.length === 1) {
    //     return vectors.pop()
    // }
    // else {
    //     return math.add(vectors.pop(), recursiveVectorSum(vectors));
    // }
    if (vectors.length === 1) {
        return vectors.pop()
    }

    const vecLen = vectors.length;
    let s = vectors[0];

    for (let i = 1; i < vecLen; i++) {
        s = math.add(s, vectors[i]);
    }

    return s;
}

/**
 * Handy helper function for checking if a list of
 * n-dimensional vectors all have equal sizes
 * @param  {Array or Arrays}
 * @return {Boolean}
 */
function vectorSizesArentEqual(vectors) {

    for (let i = 0; i < vectors.length; i++) {
        if (i !== 0) {
            if (vectors[i].length !== vectors[i - 1].length) {
                return true;
            }
        }
    }
    return false;
}


/**
 * Implements Gram Schmidt Process given basis vectors in any
 * dimension as arguments
 * @return {Array} returns an array of orthonormalized basis
 * vectors
 */
function gramSchmidt() {

    let vectors = Array.prototype.slice.call(arguments);

    if (vectorSizesArentEqual(vectors)) {
        throw "All Vector Sizes Must Match";
    }

    let orthoVectors = [];

    for (let i = 0; i < vectors.length; i++) {
        if (i === 0) {
            orthoVectors.push(normalize(vectors[0]));
        }
        // subtract it from the sum of all the previous ones which
        // we will reduce through a loop as a sum! iterates over the orthovectors!
        else {
            let projections = [];

            for (let j = 0; j < orthoVectors.length; j++) {
                let res = math.multiply(math.dot(vectors[i], orthoVectors[j]), orthoVectors[j]);
                projections.push(res);
                // console.log(projections);
            }

            let totalProjection = recursiveVectorSum(projections);

            orthoVectors.push(normalize(math.subtract(vectors[i], totalProjection)));
        }
    }

    return orthoVectors;
}


// module.exports = [gramSchmidt, recursiveVectorSum];
module.exports = gramSchmidt;
