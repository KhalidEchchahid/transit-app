/**
 * Utility functions for smooth route visualization
 * Implements Catmull-Rom spline interpolation for curved polylines
 */

interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Interpolates points using Catmull-Rom spline for smooth curves
 * This creates a smooth path through all the given points
 */
export function interpolateCatmullRom(
  points: Coordinate[],
  tension: number = 0.5,
  numSegments: number = 10
): Coordinate[] {
  if (points.length < 2) return points;
  if (points.length === 2) {
    // For just 2 points, create a simple interpolation
    return interpolateLinear(points[0], points[1], numSegments);
  }

  const result: Coordinate[] = [];

  // Add the first point
  result.push(points[0]);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Generate interpolated points between p1 and p2
    for (let t = 1; t <= numSegments; t++) {
      const tNorm = t / numSegments;
      const point = catmullRomPoint(p0, p1, p2, p3, tNorm, tension);
      result.push(point);
    }
  }

  return result;
}

/**
 * Calculate a single point on the Catmull-Rom spline
 */
function catmullRomPoint(
  p0: Coordinate,
  p1: Coordinate,
  p2: Coordinate,
  p3: Coordinate,
  t: number,
  tension: number
): Coordinate {
  const t2 = t * t;
  const t3 = t2 * t;

  const s = (1 - tension) / 2;

  const lat =
    s * (2 * p1.latitude +
      (-p0.latitude + p2.latitude) * t +
      (2 * p0.latitude - 5 * p1.latitude + 4 * p2.latitude - p3.latitude) * t2 +
      (-p0.latitude + 3 * p1.latitude - 3 * p2.latitude + p3.latitude) * t3);

  const lon =
    s * (2 * p1.longitude +
      (-p0.longitude + p2.longitude) * t +
      (2 * p0.longitude - 5 * p1.longitude + 4 * p2.longitude - p3.longitude) * t2 +
      (-p0.longitude + 3 * p1.longitude - 3 * p2.longitude + p3.longitude) * t3);

  return { latitude: lat, longitude: lon };
}

/**
 * Simple linear interpolation between two points
 */
function interpolateLinear(
  start: Coordinate,
  end: Coordinate,
  numSegments: number
): Coordinate[] {
  const result: Coordinate[] = [start];

  for (let i = 1; i <= numSegments; i++) {
    const t = i / numSegments;
    result.push({
      latitude: start.latitude + (end.latitude - start.latitude) * t,
      longitude: start.longitude + (end.longitude - start.longitude) * t,
    });
  }

  return result;
}

/**
 * Simplify a path using the Douglas-Peucker algorithm
 * Reduces the number of points while preserving the shape
 */
export function simplifyPath(
  points: Coordinate[],
  tolerance: number = 0.00001
): Coordinate[] {
  if (points.length <= 2) return points;

  // Find the point with the maximum distance from the line between start and end
  let maxDistance = 0;
  let maxIndex = 0;

  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPath(points.slice(maxIndex), tolerance);

    // Combine results (remove duplicate point at junction)
    return [...left.slice(0, -1), ...right];
  }

  // If all points are within tolerance, just return endpoints
  return [start, end];
}

/**
 * Calculate perpendicular distance from a point to a line
 */
function perpendicularDistance(
  point: Coordinate,
  lineStart: Coordinate,
  lineEnd: Coordinate
): number {
  const dx = lineEnd.longitude - lineStart.longitude;
  const dy = lineEnd.latitude - lineStart.latitude;

  const lineLengthSq = dx * dx + dy * dy;

  if (lineLengthSq === 0) {
    // Line start and end are the same point
    return Math.sqrt(
      Math.pow(point.longitude - lineStart.longitude, 2) +
      Math.pow(point.latitude - lineStart.latitude, 2)
    );
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.longitude - lineStart.longitude) * dx +
        (point.latitude - lineStart.latitude) * dy) /
        lineLengthSq
    )
  );

  const projectionLon = lineStart.longitude + t * dx;
  const projectionLat = lineStart.latitude + t * dy;

  return Math.sqrt(
    Math.pow(point.longitude - projectionLon, 2) +
    Math.pow(point.latitude - projectionLat, 2)
  );
}

/**
 * Smooth a route path for better visualization
 * Uses Catmull-Rom interpolation with adaptive segment count based on distance
 */
export function smoothRoutePath(
  coordinates: Coordinate[],
  options: {
    tension?: number;
    minSegments?: number;
    maxSegments?: number;
    simplifyTolerance?: number;
  } = {}
): Coordinate[] {
  const {
    tension = 0.3, // Lower tension = smoother curves
    minSegments = 3,
    maxSegments = 8,
    simplifyTolerance = 0.00002,
  } = options;

  if (coordinates.length < 2) return coordinates;

  // Calculate adaptive segment count based on average distance between points
  const totalDistance = coordinates.reduce((sum, coord, i) => {
    if (i === 0) return 0;
    const prev = coordinates[i - 1];
    return sum + Math.sqrt(
      Math.pow(coord.latitude - prev.latitude, 2) +
      Math.pow(coord.longitude - prev.longitude, 2)
    );
  }, 0);

  const avgDistance = totalDistance / (coordinates.length - 1);
  
  // More segments for longer distances (more curved paths)
  const segmentCount = Math.min(
    maxSegments,
    Math.max(minSegments, Math.round(avgDistance * 10000))
  );

  // Apply Catmull-Rom interpolation
  const smoothed = interpolateCatmullRom(coordinates, tension, segmentCount);

  // Simplify to reduce point count while preserving shape
  return simplifyPath(smoothed, simplifyTolerance);
}

/**
 * Create an offset parallel path for route outlines
 */
export function createOffsetPath(
  coordinates: Coordinate[],
  offsetMeters: number
): Coordinate[] {
  if (coordinates.length < 2) return coordinates;

  const result: Coordinate[] = [];
  const offsetDegrees = offsetMeters / 111320; // Approximate meters to degrees

  for (let i = 0; i < coordinates.length; i++) {
    const curr = coordinates[i];
    let angle: number;

    if (i === 0) {
      // First point: use angle to next point
      const next = coordinates[i + 1];
      angle = Math.atan2(
        next.latitude - curr.latitude,
        next.longitude - curr.longitude
      );
    } else if (i === coordinates.length - 1) {
      // Last point: use angle from previous point
      const prev = coordinates[i - 1];
      angle = Math.atan2(
        curr.latitude - prev.latitude,
        curr.longitude - prev.longitude
      );
    } else {
      // Middle points: average of incoming and outgoing angles
      const prev = coordinates[i - 1];
      const next = coordinates[i + 1];
      const inAngle = Math.atan2(
        curr.latitude - prev.latitude,
        curr.longitude - prev.longitude
      );
      const outAngle = Math.atan2(
        next.latitude - curr.latitude,
        next.longitude - curr.longitude
      );
      angle = (inAngle + outAngle) / 2;
    }

    // Calculate perpendicular offset
    const perpAngle = angle + Math.PI / 2;
    result.push({
      latitude: curr.latitude + offsetDegrees * Math.sin(perpAngle),
      longitude: curr.longitude + offsetDegrees * Math.cos(perpAngle),
    });
  }

  return result;
}
