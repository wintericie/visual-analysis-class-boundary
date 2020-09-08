function sortWithIndices(toSort, descend=false) {

    let first, last;

    if (descend) {
        first = 1;
        last = -1;
    } else {
        first = -1;
        last = 1;
    }

    for (let i = 0; i < toSort.length; i++) {
        toSort[i] = [toSort[i], i];
    }
    toSort.sort(function (left, right) {
        return left[0] < right[0] ? first : last;
    });
    toSort.sortIndices = [];
    for (let j = 0; j < toSort.length; j++) {
        toSort.sortIndices.push(toSort[j][1]);
        toSort[j] = toSort[j][0];
    }
    return toSort;
}

function argMax(array) {
    return array.map((x, i) => [x, i]).reduce((r, a) => (a[0] > r[0] ? a : r))[1];
}


export {sortWithIndices, argMax};