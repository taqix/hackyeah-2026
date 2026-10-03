import { XMLParser, XMLValidator } from 'fast-xml-parser';

import { coordinate, finiteNumber, isoDate, nonNegative, summarize, textValue } from './normalize';
import { ActivityImportError, type ActivitySample, type ImportedActivity } from './types';

function object(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function list(value: unknown): unknown[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

export function parseGpx(xml: string, maxSamples: number): ImportedActivity[] {
  // GPX needs neither DTDs nor custom entities. Reject before parsing/expanding.
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml) || XMLValidator.validate(xml) !== true) {
    throw new ActivityImportError('invalid-file', 'The GPX file is not valid XML.');
  }
  const encoding = xml.match(/<\?xml\b[^?]*\bencoding\s*=\s*['"]([^'"]+)['"]/i)?.[1];
  if (encoding && !/^utf-?8$/i.test(encoding)) {
    throw new ActivityImportError('invalid-file', 'GPX files must use UTF-8 encoding.');
  }
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false,
  });
  const document = object(parser.parse(xml));
  if (!Object.hasOwn(document, 'gpx')) {
    throw new ActivityImportError('invalid-file', 'The XML document is not a GPX file.');
  }
  const root = object(document.gpx);
  const activities: ImportedActivity[] = [];
  let sampleCount = 0;

  function parsePoint(value: unknown, segmentIndex: number): ActivitySample {
    if (++sampleCount > maxSamples) {
      throw new ActivityImportError('file-too-large', 'The activity contains too many samples.');
    }
    const point = object(value);
    const latitude = coordinate(point['@_lat'], 90);
    const longitude = coordinate(point['@_lon'], 180);
    if (latitude === null || longitude === null) {
      throw new ActivityImportError('invalid-file', 'A GPX point has invalid coordinates.');
    }
    const timestamp = isoDate(point.time);
    if (point.time !== undefined && timestamp === null) {
      throw new ActivityImportError('invalid-file', 'A GPX timestamp is invalid or missing its timezone.');
    }
    const extensions = object(point.extensions);
    const trackPoint = object(extensions.TrackPointExtension);
    return {
      timestamp,
      segmentIndex,
      latitude,
      longitude,
      altitudeMeters: finiteNumber(point.ele),
      distanceMeters: null,
      speedMetersPerSecond: nonNegative(trackPoint.speed ?? extensions.speed ?? point.speed),
      heartRateBpm: nonNegative(trackPoint.hr ?? extensions.hr),
      cadenceRpm: nonNegative(trackPoint.cad ?? extensions.cad),
      powerWatts: nonNegative(extensions.power ?? trackPoint.power),
    };
  }

  for (const kind of ['trk', 'rte'] as const) {
    for (const value of list(root[kind])) {
      const track = object(value);
      const segments = kind === 'trk'
        ? list(track.trkseg).map((segment) => list(object(segment).trkpt))
        : [list(track.rtept)];
      const samples = segments.flatMap((points, index) => points.map((point) => parsePoint(point, index)));
      if (!samples.length) continue;
      activities.push({
        ...summarize(samples),
        name: textValue(track.name) ?? textValue(object(root.metadata).name) ?? textValue(root.name),
        sport: textValue(track.type),
        kind: kind === 'rte' ? 'route' : 'activity',
      });
    }
  }
  return activities;
}
