/**
 * Round-cornered convex hull path
 * http://bl.ocks.org/hollasch/f70f1fe7700f092b5a505e3efd1d9232
 */

// import * as d3 from 'd3';


const vecScale = function (scale, v) {
    // Returns the vector 'v' scaled by 'scale'.
    return [scale * v[0], scale * v[1]];
};


const vecSum = function (pv1, pv2) {
    // Returns the sum of two vectors, or a combination of a point and a vector.
    return [pv1[0] + pv2[0], pv1[1] + pv2[1]];
};


const unitNormal = function (p0, p1) {
    // Returns the unit normal to the line segment from p0 to p1.
    const n = [p0[1] - p1[1], p1[0] - p0[0]];
    const nLength = Math.sqrt(n[0] * n[0] + n[1] * n[1]);
    return [n[0] / nLength, n[1] / nLength];
};


// const strictHull = function (polyPoints) {
//     // This method returns a polygon given the specified points. The points are assumed to be
//     // in polygon order.
//
//     return (
//         'M ' + polyPoints[0]
//         + ' L '
//         + d3.range(1, polyPoints.length)
//             .map(function (i) {
//                 return polyPoints[i];
//             })
//             .join(' L')
//         + ' Z'
//     );
// };

const roundedHull = function (polyPoints, hullPadding) {

    // Returns the SVG path data string representing the polygon, expanded and rounded.

    // Handle special cases
    if (!polyPoints || polyPoints.length < 1) return "";
    if (polyPoints.length === 1) return roundedHull1(polyPoints, hullPadding);
    if (polyPoints.length === 2) return roundedHull2(polyPoints, hullPadding);

    let segments = new Array(polyPoints.length);

    // Calculate each offset (outwards) segment of the convex hull.
    for (let segmentIndex = 0; segmentIndex < segments.length; ++segmentIndex) {
        let p0 = (segmentIndex === 0) ? polyPoints[polyPoints.length - 1] : polyPoints[segmentIndex - 1];
        let p1 = polyPoints[segmentIndex];

        // Compute the offset vector for the line segment, with length = hullPadding.
        let offset = vecScale(hullPadding, unitNormal(p0, p1));

        segments[segmentIndex] = [vecSum(p0, offset), vecSum(p1, offset)];
    }

    let arcData = 'A ' + [hullPadding, hullPadding, '0,0,0,'].join(',');

    segments = segments.map(function (segment, index) {
        let pathFragment = "";
        if (index === 0) {
            pathFragment = 'M ' + segments[segments.length - 1][1] + ' ';
        }
        pathFragment += arcData + segment[0] + ' L ' + segment[1];

        return pathFragment;
    });

    return segments.join(' ');
};


const roundedHull1 = function (polyPoints, hullPadding) {
    // Returns the path for a rounded hull around a single point (a circle).

    let p1 = [polyPoints[0][0], polyPoints[0][1] - hullPadding];
    let p2 = [polyPoints[0][0], polyPoints[0][1] + hullPadding];

    return 'M ' + p1
        + ' A ' + [hullPadding, hullPadding, '0,0,0', p2].join(',')
        + ' A ' + [hullPadding, hullPadding, '0,0,0', p1].join(',');
};


const roundedHull2 = function (polyPoints, hullPadding) {
    // Returns the path for a rounded hull around two points (a "capsule" shape).

    let offsetVector = vecScale(hullPadding, unitNormal(polyPoints[0], polyPoints[1]));
    let invOffsetVector = vecScale(-1, offsetVector);

    let p0 = vecSum(polyPoints[0], offsetVector);
    let p1 = vecSum(polyPoints[1], offsetVector);
    let p2 = vecSum(polyPoints[1], invOffsetVector);
    let p3 = vecSum(polyPoints[0], invOffsetVector);

    return 'M ' + p0
        + ' L ' + p1 + ' A ' + [hullPadding, hullPadding, '0,0,0', p2].join(',')
        + ' L ' + p3 + ' A ' + [hullPadding, hullPadding, '0,0,0', p0].join(',');
};


export default roundedHull;