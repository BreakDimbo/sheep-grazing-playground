# usage: [DPR=2] shot.py url out.png w h wait_s
import sys, os, asyncio
from playwright.sync_api import sync_playwright
url, out, w, h = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]); wait = float(sys.argv[5]) if len(sys.argv) > 5 else 3
dpr = float(os.environ.get('DPR', 1))
msgs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True,
        args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'])
    pg = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=dpr)
    pg.on('console', lambda m: msgs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: msgs.append(f'pageerror: {e}'))
    pg.goto(url, wait_until='load', timeout=120000)
    pg.wait_for_function('window.__sheep !== undefined', timeout=120000)
    pg.wait_for_timeout(wait * 1000)
    pg.screenshot(path=out)
    b.close()
print('\n'.join(msgs) if msgs else 'no console errors/warnings')
