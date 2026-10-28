# timing probe: load, then report how long until __sheep and the paint timings if exposed
import sys, time
from playwright.sync_api import sync_playwright
url = sys.argv[1]
with sync_playwright() as p:
    t0 = time.time(); b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'])
    pg = b.new_page(viewport={'width': 1188, 'height': 716}, device_scale_factor=2); t1 = time.time()
    pg.goto(url, wait_until='load', timeout=120000); t2 = time.time()
    pg.wait_for_function('window.__sheep !== undefined', timeout=200000); t3 = time.time()
    pg.wait_for_timeout(3000); pg.screenshot(path='out/_t.png'); t4 = time.time()
    print('launch %.1f load %.1f init %.1f shot %.1f' % (t1 - t0, t2 - t1, t3 - t2, t4 - t3)); b.close()
