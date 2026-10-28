# interact.py URL w h -> live smoke test: load, select a sheep, duplicate, drag, lasso, orbit; screenshots in out/live_*.png
import sys, json
from playwright.sync_api import sync_playwright
url, w, h = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); errs = []; res = {}
PROJ = """() => { const S = window.__sheep, r = document.getElementById('c').getBoundingClientRect();
  return S.sheep.filter(s => !s.dying).map(s => { const v = s.root.position.clone(); v.y += 0.35; v.project(S.camera); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }); }"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'])
    pg = b.new_page(viewport={'width': w, 'height': h})
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
    pg.goto(url + ('&' if '?' in url else '?') + 'nocache=' + str(__import__('time').time()), wait_until='load', timeout=120000)
    pg.wait_for_function('window.__sheep !== undefined', timeout=120000); pg.wait_for_timeout(4000)
    pg.screenshot(path='out/live_1_load.png')
    pts = pg.evaluate(PROJ); res['sheep_start'] = len(pts)
    x, y = pts[0]; pg.mouse.click(x, y); pg.wait_for_timeout(600)
    res['bar_visible'] = pg.evaluate("() => { const b = document.getElementById('bar'); return !!b && getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().width > 0 && !b.classList.contains('off'); }")
    pg.screenshot(path='out/live_2_selected.png')
    dup = pg.query_selector('#bar [data-act="dup"]')
    if dup: dup.click(); pg.wait_for_timeout(1500)
    res['sheep_after_dup'] = len(pg.evaluate(PROJ))
    pts = pg.evaluate(PROJ); x, y = pts[0]
    p0 = pg.evaluate("() => { const s = window.__sheep.sheep[0]; return [s.root.position.x, s.root.position.z]; }")
    pg.mouse.move(x, y); pg.mouse.down(); [pg.mouse.move(x + i * 6, y + i * 2) for i in range(1, 15)]; pg.mouse.up(); pg.wait_for_timeout(500)
    p1 = pg.evaluate("() => { const s = window.__sheep.sheep[0]; return [s.root.position.x, s.root.position.z]; }")
    res['drag_moved_m'] = round(((p1[0]-p0[0])**2 + (p1[1]-p0[1])**2) ** .5, 3)
    import math
    cx, cy = w * 0.62, h * 0.55; pg.mouse.move(cx + 90, cy); pg.mouse.down()
    for i in range(1, 41): a = i / 40 * 2 * math.pi; pg.mouse.move(cx + 90 * math.cos(a), cy + 60 * math.sin(a))
    pg.mouse.up(); pg.wait_for_timeout(2500); pg.screenshot(path='out/live_3_lasso.png')
    res['sheep_after_lasso'] = len(pg.evaluate(PROJ))
    res['fps'] = round(pg.evaluate('window.__sheep.fps'), 1)
    res['errors'] = errs
    b.close()
print(json.dumps(res, indent=1))
