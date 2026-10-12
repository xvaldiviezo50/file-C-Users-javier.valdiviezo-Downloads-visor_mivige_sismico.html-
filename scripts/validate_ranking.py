"""Prospective validation of the actual browser motor. No replacement score formula."""
import contextlib
import datetime as dt
import functools
import gzip
import hashlib
import http.server
import json
import math
import os
from pathlib import Path
import subprocess
import threading
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'mivige-v2/data'
STATE = DATA / 'validation-state.json'
TARGETS = (4.0, 4.5, 6.0)
HORIZONS = (24, 72)
HOUR = 3600000
PROTOCOL = 'prospective-ranking-v1'


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def digest(value):
    return hashlib.sha256(encode(value)).hexdigest()


def utc(ms):
    return dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc).isoformat()


def next_start(now):
    # At least one hour to publish. Never use an earthquake's origin as issue time.
    return (math.floor((now + HOUR) / (6 * HOUR)) + 1) * 6 * HOUR


def distance(a, b, c, d):
    a, b, c, d = map(math.radians, (a, b, c, d))
    h = math.sin((c-a)/2)**2 + math.cos(a)*math.cos(c)*math.sin((d-b)/2)**2
    return 6371 * 2 * math.asin(min(1, math.sqrt(h)))


def inside(e, zone):
    if distance(e['lat'], e['lon'], zone['lat'], zone['lon']) > zone['r']:
        return False
    if zone.get('depth'):
        z = e.get('depth')
        if z is None or not zone['depth'][0] <= z <= zone['depth'][1]:
            return False
    return True


def outcome(zones, events, start, end, target, selected):
    # Half-open time interval, fixed geography, fixed threshold; retain misses.
    events = {e['id']: e for e in events if start <= e['time'] < end and e['mag'] >= target}
    rows = []
    confusion = dict(TP=0, FP=0, FN=0, TN=0)
    for row in zones:
        z = row['zone']
        ids = sorted(e['id'] for e in events.values() if inside(e, z))
        predicted = z['id'] in selected
        kind = ('TP' if ids else 'FP') if predicted else ('FN' if ids else 'TN')
        confusion[kind] += 1
        rows.append(dict(zone=z['id'], selected=predicted, eventIds=ids, outcome=kind))
    return dict(confusion=confusion, zones=rows)


def baseline(zones, start, target, k):
    def count(row):
        return sum(start-168*HOUR <= e['time'] < start and e['mag'] >= target and inside(e, row['zone'])
                   for e in {e['id']: e for e in row['history']}.values())
    ordered = sorted(zones, key=lambda row: (-count(row), row['zone']['ord']))
    return [row['zone']['id'] for row in ordered[:k]]


def get_catalogue(start, end):
    params = dict(format='geojson', starttime=utc(start), endtime=utc(end), minmagnitude=4,
                  orderby='time-asc', limit=20000)
    url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?' + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=60) as response:
        raw = response.read()
    obj = json.loads(raw)
    fs = obj.get('features')
    if not isinstance(fs, list) or len(fs) >= 20000 or obj.get('metadata', {}).get('count') != len(fs):
        raise ValueError('Catálogo incompleto: no se asignan negativos')
    events = []
    for f in fs:
        p, c = f['properties'], f['geometry']['coordinates']
        if p.get('mag') is None:
            raise ValueError('Magnitud ausente: evaluación pendiente')
        events.append(dict(id=f['id'], time=p['time'], updated=p.get('updated'), mag=p['mag'],
                           magType=p.get('magType'), lat=c[1], lon=c[0], depth=c[2]))
    return events, dict(url=url, fetchedAt=utc(int(time.time()*1000)), sha256=hashlib.sha256(raw).hexdigest(),
                        events=events, provider='USGS', magnitudePolicy='magnitud preferida del catálogo; tipos conservados')


def publication_time(snapshot):
    # Independent git history, not a field editable in the ledger.
    path = str(snapshot.relative_to(ROOT))
    result = subprocess.run(['git', 'log', '--diff-filter=A', '--format=%cI', '--', path],
                            cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip().splitlines()
    if not result:
        return None
    return int(dt.datetime.fromisoformat(result[-1]).timestamp()*1000)


def code_manifest():
    paths = list((ROOT/'mivige-v2').glob('*.js')) + list((ROOT/'v10').glob('*.js'))
    paths += [ROOT/'mivige-v3/index.html', Path(__file__), ROOT/'mivige-v2/segments.json']
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths) if p.exists()}


def capture():
    from playwright.sync_api import sync_playwright
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *_):
            pass
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as pw:
            options = {}
            proxy_url = os.getenv('HTTPS_PROXY') or os.getenv('https_proxy')
            if proxy_url:
                proxy = urllib.parse.urlparse(proxy_url)
                options['proxy'] = {'server': f'{proxy.scheme}://{proxy.hostname}:{proxy.port}', 'bypass':'127.0.0.1,localhost'}
                if proxy.username:
                    options['proxy'].update(username=urllib.parse.unquote(proxy.username), password=urllib.parse.unquote(proxy.password or ''))
            browser = pw.chromium.launch(headless=True, args=['--no-sandbox'], **options)
            page = browser.new_page()
            page.on('pageerror', lambda error: print('Viewer error:', str(error)[:200], flush=True))
            page.goto(f'http://127.0.0.1:{server.server_port}/mivige-v3/', wait_until='domcontentloaded', timeout=60000)
            page.wait_for_function("""() => {
              const c=window.mivigeValidationCapture?.();
              if(!c || document.getElementById('refresh')?.disabled) return false;
              const s=c.sourceStatus.USGS;
              return c.zones.length>=10 && c.events.length>0 && s?.ok && !s.cached && !s.truncated &&
                Date.now()-s.fetchedAt<15*60000 && Date.now()-c.scoreTime<15*60000;
            }""", timeout=180000)
            result = page.evaluate('window.mivigeValidationCapture()')
            if any(e['time'] > result['capturedAt'] + 60000 for e in result['events']):
                raise ValueError('Catálogo con tiempos futuros: emisión suspendida')
            replay = page.evaluate('(c)=>window.mivigeValidationReplay(c)', result)
            saved = {r['zone']['id']:r['score'] for r in result['zones']}
            if any(abs(r['score']-saved[r['id']]) > 0.001 for r in replay):
                raise ValueError('Replay mismatch: snapshot is not reproducible')
            browser.close()
            return result
    finally:
        server.shutdown()


def evaluate_pending(state, now):
    for issue in state['issues']:
        path = ROOT / issue['snapshot']
        publication = publication_time(path)
        if publication is None:
            continue  # Initial local execution; not yet public.
        if publication >= issue['start'] or publication < issue['issuedAt'] - 5*60000:
            issue['status'] = 'INVALID_PUBLICATION'
            continue
        issue['publishedAt'] = publication
        with gzip.open(path, 'rt') as f:
            snapshot = json.load(f)
        if digest(snapshot) != issue['inputHash']:
            raise ValueError('Snapshot changed: refusing retrospective rewrite')
        for hours in HORIZONS:
            key = str(hours)
            end = issue['start'] + hours*HOUR
            if now < end + 24*HOUR or key in issue['evaluations']:
                continue
            try:
                events, evidence = get_catalogue(issue['start'], end)
                out = {}
                for target in TARGETS:
                    selected = [r['zone']['id'] for r in snapshot['capture']['zones'] if r['score'] >= 40 and r['hasEvidence']]
                    zones = snapshot['capture']['zones']
                    out[str(target)] = {
                        'threshold40': outcome(zones, events, issue['start'], end, target, selected),
                        'top5': outcome(zones, events, issue['start'], end, target, issue['top5']),
                        'baseline': outcome(zones, events, issue['start'], end, target, issue['baselines'][str(target)])}
                issue['evaluations'][key] = dict(evaluatedAt=now, end=end, targets=out, catalogue=evidence)
                issue.pop('evaluationError', None)
            except Exception as exc:
                issue['evaluationError'] = str(exc)[:300]
        issue['status'] = 'EVALUATED' if len(issue['evaluations']) == len(HORIZONS) else 'PENDING'


def main():
    DATA.mkdir(exist_ok=True, parents=True)
    state = json.loads(STATE.read_text()) if STATE.exists() else dict(protocol=PROTOCOL, issues=[])
    now = int(time.time()*1000)
    evaluate_pending(state, now)
    start = next_start(now)
    if not any(i['start'] == start for i in state['issues']):
        try:
            cap = capture()
            issued = int(time.time()*1000)
            start = next_start(issued)
            manifest = code_manifest()
            snapshot = dict(capture=cap, manifest=manifest, protocol=PROTOCOL,
                            codeRevision=os.getenv('GITHUB_SHA', 'local-unpublished'))
            algorithm = digest(manifest)
            identity = str(start) + '-' + algorithm[:12]
            rel = f'mivige-v2/data/validation-snapshots/{identity}.json.gz'
            path = ROOT / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            if path.exists():
                raise ValueError('Immutable snapshot already exists')
            with gzip.open(path, 'wb') as f:
                f.write(encode(snapshot))
            top = cap['ranking'][:5]
            state['issues'].append(dict(id=identity, issuedAt=issued, start=start, algorithm=algorithm,
                snapshot=rel, inputHash=digest(snapshot), codeRevision=snapshot['codeRevision'],
                top5=top, zones=[dict(zone=r['zone'], score=r['score'], coverage=r['coverage'], components=r['components']) for r in cap['zones']],
                baselines={str(m):baseline(cap['zones'], cap['scoreTime'], m, len(top)) for m in TARGETS},
                status='PENDING', evaluations={}))
            state.pop('captureError', None)
        except Exception as exc:
            state['captureError'] = str(exc)[:500]
    state['updatedAt'] = int(time.time()*1000)
    STATE.write_bytes(encode(state)+b'\n')
    print(json.dumps(dict(issues=len(state['issues']), captureError=state.get('captureError')), ensure_ascii=False))

if __name__ == '__main__':
    main()
