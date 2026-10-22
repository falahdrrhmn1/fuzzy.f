"""Screenshot pembanding kualitas (bukan test): python -I e2e/shots.py <id> [<id> ...] [--mode inspect|compare|hold]
Menulis e2e/screenshots/q-<id>-<quality>-<mode>.png untuk mode Ringan & Bagus."""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
OUT = Path(__file__).parent / 'screenshots'
OUT.mkdir(exist_ok=True)
args = [a for a in sys.argv[1:] if not a.startswith('--')]
mode = sys.argv[sys.argv.index('--mode') + 1] if '--mode' in sys.argv else 'inspect'
if mode in args:
    args.remove(mode)
LABEL = {'compare': 'Bandingkan Ukuran', 'hold': 'Lihat Saat Dipegang'}

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    page = b.new_page(viewport={'width': 900, 'height': 760})
    errors: list[str] = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    for pid in args:
        for q in ['standard', 'high']:
            page.goto(f'http://localhost:3100/studio/{pid}?debug=1&quality={q}', wait_until='networkidle')
            page.wait_for_function(f'() => window.__ffDebug && window.__ffDebug.quality === "{q}"', timeout=120000)
            if mode in LABEL:
                page.get_by_role('button', name=LABEL[mode]).click()
                page.wait_for_function(f'() => window.__ffDebug.mode === "{mode}"', timeout=120000)
            page.get_by_role('button', name='Depan').click()
            page.wait_for_timeout(4000 if q == 'high' else 2000)
            page.screenshot(path=str(OUT / f'q-{pid}-{q}-{mode}.png'), timeout=240000)
            print(pid, q, mode, 'drawCalls', page.evaluate('window.__ffDebug.drawCalls()'))
    print('errors:', errors[:3])
    b.close()
