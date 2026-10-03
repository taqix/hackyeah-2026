import { SaxesParser, type SaxesTagNS } from 'saxes';
import { activity, nonnegative, numeric, sample, warn } from './normalize.js';
import { ExtractionError, type Config, type Extraction, type Sample } from './types.js';

const GPX = 'http://www.topografix.com/GPX/1/1';
const sensors = new Set([
  'http://www.garmin.com/xmlschemas/TrackPointExtension/v1',
  'http://www.garmin.com/xmlschemas/TrackPointExtension/v2',
]);
interface XmlNode {
  uri: string;
  local: string;
  attributes: Record<string, string>;
  text: string;
  children: XmlNode[];
}
const children = (n: XmlNode, local: string) =>
  n.children.filter((c) => c.uri === GPX && c.local === local);
const text = (n: XmlNode, local: string) => children(n, local)[0]?.text ?? null;

export function parseGpx(bytes: Uint8Array, result: Extraction, config: Config): void {
  const stack: XmlNode[] = [];
  let root: XmlNode | null = null,
    points = 0;
  const parser = new SaxesParser({ xmlns: true });
  parser.on('doctype', () => {
    throw new ExtractionError('invalid_xml', 'DTD declarations are prohibited.');
  });
  parser.on('error', () => {
    throw new ExtractionError('invalid_xml', 'Malformed XML.');
  });
  parser.on('opentag', (tag: SaxesTagNS) => {
    if (stack.length >= config.maxXmlDepth)
      throw new ExtractionError('xml_depth_limit', 'GPX nesting exceeds configured limit.');
    if (
      tag.uri === GPX &&
      ['trkpt', 'rtept', 'wpt'].includes(tag.local) &&
      ++points > config.maxSamples
    )
      throw new ExtractionError('sample_limit', 'GPX point count exceeds configured limit.');
    const node: XmlNode = {
      uri: tag.uri,
      local: tag.local,
      attributes: Object.fromEntries(
        Object.values(tag.attributes)
          .filter((a) => !a.uri)
          .map((a) => [a.local, a.value]),
      ),
      text: '',
      children: [],
    };
    const parent = stack.at(-1);
    if (parent) parent.children.push(node);
    else root = node;
    stack.push(node);
  });
  const addText = (value: string) => {
    const node = stack.at(-1);
    if (node) node.text += value;
  };
  parser.on('text', addText);
  parser.on('cdata', addText);
  parser.on('closetag', () => {
    stack.pop();
  });
  try {
    parser.write(new TextDecoder('utf-8', { fatal: true }).decode(bytes)).close();
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError('invalid_xml', 'Invalid UTF-8 or malformed GPX XML.');
  }
  // Assignment happens in parser callbacks, so TypeScript cannot track it.
  const document = root as XmlNode | null;
  if (
    !document ||
    document.uri !== GPX ||
    document.local !== 'gpx' ||
    document.attributes.version !== '1.1'
  )
    throw new ExtractionError('unsupported_gpx', 'Only namespace-correct GPX 1.1 is supported.');
  result.metadata = { creator: document.attributes.creator ?? null };
  function point(node: XmlNode, index: number, entity: string): Sample {
    const p = sample(
      index,
      {
        timestamp: text(node, 'time'),
        latitude: node.attributes.lat,
        longitude: node.attributes.lon,
        elevationM: text(node, 'ele'),
        source: {},
      },
      result.warnings,
      entity,
    );
    if (p.latitude === null || p.longitude === null)
      warn(result.warnings, 'missing_coordinates', entity, 'GPX point lacks valid coordinates.');
    function sensor(n: XmlNode): void {
      if (sensors.has(n.uri)) {
        if (n.local === 'hr') p.heartRateBpm = nonnegative(n.text);
        else if (n.local === 'cad')
          p.cadence = { value: nonnegative(n.text), unit: 'rpm', context: 'gpx.garmin' };
        else if (n.local === 'atemp') p.temperatureC = numeric(n.text);
        else if (n.local !== 'TrackPointExtension')
          warn(
            result.warnings,
            'unsupported_extension',
            entity,
            'GPX sensor extension not mapped.',
          );
      } else warn(result.warnings, 'unsupported_extension', entity, 'GPX extension not mapped.');
      n.children.forEach(sensor);
    }
    children(node, 'extensions').forEach((ext) => ext.children.forEach(sensor));
    return p;
  }
  for (const [i, track] of children(document, 'trk').entries()) {
    const a = activity(`track:${i}`, text(track, 'name'), text(track, 'type'));
    a.segments = children(track, 'trkseg').map((s, j) => ({
      id: `${a.id}/segment:${j}`,
      samples: children(s, 'trkpt').map((p, k) => point(p, k, `${a.id}/segment:${j}/sample:${k}`)),
    }));
    const ps = a.segments.flatMap((s) => s.samples);
    a.startTime = ps[0]?.timestamp ?? null;
    a.endTime = ps.at(-1)?.timestamp ?? null;
    result.activities.push(a);
  }
  for (const [i, route] of children(document, 'rte').entries())
    result.routes.push({
      name: text(route, 'name'),
      source: {},
      points: children(route, 'rtept').map((p, k) => point(p, k, `route:${i}/point:${k}`)),
    });
  for (const [i, node] of children(document, 'wpt').entries())
    result.waypoints.push({ name: text(node, 'name'), point: point(node, i, `waypoint:${i}`) });
}
