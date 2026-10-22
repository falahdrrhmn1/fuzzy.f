"""Uji browser Fuzzy Flo (Playwright Python, Chromium headless + WebGL software).

Jalankan: server di http://localhost:3100 (npm run build && npx next start -p 3100), lalu
    python -I e2e/smoke.py [--only NAMA]
Menulis screenshot ke e2e/screenshots/ dan keluar dengan kode 1 bila ada assert gagal.
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')  # konsol Windows
BASE = 'http://localhost:3100'
OUT = Path(__file__).parent / 'screenshots'
OUT.mkdir(exist_ok=True)
fails: list[str] = []
only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None


def check(cond: bool, msg: str):
    print(('  ok   ' if cond else '  FAIL ') + msg)
    if not cond:
        fails.append(msg)


def wait_scene(page, mode: str | None = None):
    page.wait_for_function('() => window.__ffDebug && window.__ffDebug.bouquetBox', timeout=60000)
    if mode:
        page.wait_for_function(f'() => window.__ffDebug.mode === "{mode}"', timeout=30000)
    page.wait_for_timeout(1200)  # animasi kamera selesai


def dbg(page):
    return page.evaluate('() => ({...window.__ffDebug, camera: window.__ffDebug.camera(), zoom: window.__ffDebug.zoom(), drawCalls: window.__ffDebug.drawCalls()})')


def no_overflow(page, label):
    w = page.evaluate('() => [document.documentElement.scrollWidth, window.innerWidth]')
    check(w[0] <= w[1], f'{label}: tidak ada horizontal overflow ({w[0]} <= {w[1]})')


def new_page(browser, w, h, mobile=False):
    ctx = browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=mobile, is_mobile=mobile)
    page = ctx.new_page()
    errors: list[str] = []
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' else None)
    return ctx, page, errors


def run(name):
    return only is None or only == name


with sync_playwright() as p:
    browser = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])

    if run('catalog'):
        print('# katalog')
        for w, h in [(360, 780), (390, 844), (430, 932), (1280, 800), (1920, 1080)]:
            ctx, page, errors = new_page(browser, w, h, mobile=w < 600)
            page.goto(BASE + '/', wait_until='networkidle')
            check(page.locator('main li').count() == 7, f'katalog {w}px: 7 produk')
            no_overflow(page, f'katalog {w}px')
            page.screenshot(path=str(OUT / f'catalog-{w}.png'), full_page=w >= 1280)
            check(not errors, f'katalog {w}px: tanpa error console {errors[:2]}')
            ctx.close()

    if run('desktop'):
        print('# studio desktop')
        ctx, page, errors = new_page(browser, 1440, 900)
        page.goto(BASE + '/studio/pink-tulip-lily?debug=1', wait_until='networkidle')
        wait_scene(page, 'inspect')
        page.screenshot(path=str(OUT / 'd-inspect.png'))
        d0 = dbg(page)
        print('  info', json.dumps({k: d0[k] for k in ('bouquetBox', 'drawCalls', 'camera')}))
        # drag mouse → kamera berubah
        box = page.locator('.ff-viewer canvas').bounding_box()
        cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        page.mouse.move(cx, cy); page.mouse.down(); page.mouse.move(cx + 220, cy + 30, steps=12); page.mouse.up()
        page.wait_for_timeout(900)
        d1 = dbg(page)
        check(d1['camera'] != d0['camera'], 'drag mouse memutar kamera')
        check(d1['bouquetBox'] == d0['bouquetBox'], 'drag tidak mengubah ukuran buket')
        page.screenshot(path=str(OUT / 'd-rotated.png'))
        # zoom (wheel) tidak mengubah ukuran fisik
        page.mouse.move(cx, cy); page.mouse.wheel(0, -600); page.wait_for_timeout(900)
        d2 = dbg(page)
        dist = lambda c: sum(v * v for v in c) ** 0.5
        check(dist(d2['camera']) != dist(d1['camera']), 'scroll mengubah jarak kamera (zoom)')
        check(d2['bouquetBox'] == d1['bouquetBox'], 'zoom tidak mengubah Box3 buket')
        # reset
        page.get_by_role('button', name='Reset kamera').click(); page.wait_for_timeout(3000)  # animasi halus
        d3 = dbg(page)
        check(max(abs(a - b) for a, b in zip(d3['camera'], d0['camera'])) < 0.05, 'reset mengembalikan kamera ke posisi awal')

        # mode banding 170 cm
        page.get_by_role('button', name='Bandingkan Ukuran').click()
        wait_scene(page, 'compare')
        page.get_by_label('Tinggi badan (cm)').fill('170'); page.get_by_label('Tinggi badan (cm)').press('Enter')
        page.wait_for_timeout(1500)
        d = dbg(page)
        ah = d['avatarBox']['max'][1] - d['avatarBox']['min'][1]
        bh = d['bouquetBox']['max'][1] - d['bouquetBox']['min'][1]
        check(abs(ah - 1.70) < 0.009, f'avatar 170 cm → Box3 {ah:.4f} m')
        check(abs(bh - 0.52) < 0.0053, f'buket 52 cm → Box3 {bh:.4f} m')
        check(abs(d['avatarBox']['min'][1]) < 0.002 and abs(d['bouquetBox']['min'][1]) < 0.002, 'avatar & buket di lantai (y=0)')
        page.screenshot(path=str(OUT / 'd-compare-170.png'))
        page.get_by_label('Tinggi badan (cm)').fill('195'); page.get_by_label('Tinggi badan (cm)').press('Enter'); page.wait_for_timeout(1500)
        d = dbg(page)
        check(abs((d['bouquetBox']['max'][1] - d['bouquetBox']['min'][1]) - bh) < 1e-6, 'ganti tinggi avatar tidak mengubah tinggi buket')
        page.get_by_role('button', name='Laki-laki').click(); page.wait_for_timeout(1200)
        page.screenshot(path=str(OUT / 'd-compare-male-195.png'))
        page.get_by_label('Tanpa distorsi perspektif (ortografis)').check(); page.wait_for_timeout(1500)
        page.screenshot(path=str(OUT / 'd-compare-ortho.png'))
        page.get_by_role('button', name='Samping').click(); page.wait_for_timeout(1500)
        page.screenshot(path=str(OUT / 'd-compare-side.png'))

        # mode pegang
        page.get_by_role('button', name='Lihat Saat Dipegang').click()
        wait_scene(page, 'hold')
        for h in ['150', '195']:
            page.get_by_label('Tinggi badan (cm)').fill(h); page.get_by_label('Tinggi badan (cm)').press('Enter'); page.wait_for_timeout(1500)
            d = dbg(page)
            check(d['hold'] is not None and d['hold']['penetrationCm'] < 0.5, f'pegang {h} cm: tanpa tembus badan ({d["hold"]})')
            page.screenshot(path=str(OUT / f'd-hold-{h}.png'))
        page.get_by_role('button', name='Samping').click(); page.wait_for_timeout(1500)
        page.screenshot(path=str(OUT / 'd-hold-side.png'))
        # ganti produk saat mode pegang
        page.get_by_role('button', name='Garden Mix').click(); page.wait_for_timeout(2500)
        d = dbg(page)
        check(d['mode'] == 'hold' and d['hold'] is not None, 'ganti produk: tetap mode pegang & menempel')
        check('/studio/garden-mix' in page.url, 'URL ikut berganti tanpa reload')
        page.screenshot(path=str(OUT / 'd-hold-garden.png'))
        # jumbo: mode banding/pegang nonaktif
        page.get_by_role('button', name='Jumbo Tulip with Lights').click(); page.wait_for_timeout(2500)
        check(page.get_by_role('button', name='Bandingkan Ukuran').is_disabled(), 'jumbo: tombol Bandingkan nonaktif')
        check(page.get_by_role('button', name='Lihat Saat Dipegang').is_disabled(), 'jumbo: tombol Pegang nonaktif')
        check(dbg(page)['mode'] == 'inspect', 'jumbo: kembali ke mode Lihat 3D')
        page.screenshot(path=str(OUT / 'd-jumbo.png'))
        check(not errors, f'studio desktop: tanpa error console {errors[:3]}')
        ctx.close()

    if run('products'):
        print('# semua produk & varian (inspect)')
        ctx, page, errors = new_page(browser, 1100, 800)
        for pid in ['pink-lily-tulip', 'sunflower-tulip', 'brown-lily-rose', 'pink-tulip-lily', 'garden-mix', 'tulip-daisy', 'jumbo-tulip-lights']:
            page.goto(f'{BASE}/studio/{pid}?debug=1', wait_until='networkidle')
            wait_scene(page)
            page.screenshot(path=str(OUT / f'p-{pid}.png'))
            print('  ', pid, 'drawCalls', dbg(page)['drawCalls'])
        check(not errors, f'produk: tanpa error console {errors[:3]}')
        ctx.close()

    if run('mobile'):
        print('# studio mobile')
        for w, h in [(360, 740), (390, 844), (430, 932), (844, 390)]:
            ctx, page, errors = new_page(browser, w, h, mobile=True)
            page.goto(BASE + '/studio/tulip-daisy?debug=1', wait_until='networkidle')
            wait_scene(page)
            no_overflow(page, f'studio {w}x{h}')
            page.screenshot(path=str(OUT / f'm-{w}x{h}-peek.png'))
            small = page.evaluate("""() => [...document.querySelectorAll('.ff-viewer button, .ff-panel [role=tab]')]
                .filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(r => r.height < 40 || r.width < 40).length""")
            check(small == 0, f'{w}px: semua tombol utama ≥40px ({small} terlalu kecil)')
            page.get_by_role('tab', name='Avatar').click(); page.wait_for_timeout(500)
            snap = page.locator('.ff-panel').get_attribute('data-snap')
            check(snap == 'half', f'{w}px: tab membuka sheet ke setengah ({snap})')
            page.get_by_role('button', name='Bandingkan dengan tinggi badan').click()
            wait_scene(page, 'compare')
            page.screenshot(path=str(OUT / f'm-{w}x{h}-avatar.png'))
            if w < h:  # portrait: bottom sheet bisa ditutup; landscape: panel samping permanen
                page.get_by_role('button', name='Perkecil panel').click(); page.wait_for_timeout(500)
                page.get_by_role('button', name='Perkecil panel').click(); page.wait_for_timeout(500)
                check(page.locator('.ff-panel').get_attribute('data-snap') == 'peek', f'{w}px: sheet bisa ditutup kembali')
            else:
                vh = page.locator('.ff-viewer').bounding_box()['height']
                check(vh > h * 0.75, f'{w}x{h}: landscape memakai tinggi layar untuk 3D ({vh:.0f}px)')
            page.screenshot(path=str(OUT / f'm-{w}x{h}-compare.png'))
            # sentuh: drag satu jari di canvas
            before = dbg(page)['camera']
            box = page.locator('.ff-viewer canvas').bounding_box()
            cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
            page.evaluate("""([x,y]) => { const c = document.querySelector('.ff-viewer canvas');
              const mk = (t, xx) => new PointerEvent(t, {pointerId: 7, pointerType: 'touch', clientX: xx, clientY: y, bubbles: true, isPrimary: true, buttons: t==='pointerup'?0:1});
              c.dispatchEvent(mk('pointerdown', x)); for (let i=1;i<=10;i++) c.dispatchEvent(mk('pointermove', x + i*12));
              c.ownerDocument.dispatchEvent(mk('pointerup', x+120)); }""", [cx, cy])
            page.wait_for_timeout(900)
            check(dbg(page)['camera'] != before, f'{w}px: drag satu jari memutar kamera')
            check(not errors, f'mobile {w}: tanpa error console {errors[:3]}')
            ctx.close()

    browser.close()

    if run('nowebgl'):
        print('# fallback tanpa WebGL')
        nb = p.chromium.launch(args=['--disable-webgl', '--disable-3d-apis'])
        ctx = nb.new_context(viewport={'width': 390, 'height': 844})
        page = ctx.new_page()
        page.goto(BASE + '/studio/pink-lily-tulip', wait_until='networkidle')
        page.wait_for_timeout(1000)
        check(page.get_by_text('tidak mendukung WebGL').count() == 1, 'tanpa WebGL: pesan fallback tampil')
        check(page.locator('.ff-viewer img').count() >= 1, 'tanpa WebGL: foto asli produk tampil')
        check(page.get_by_text('± 65 × 40 cm (tinggi × lebar)').count() == 1, 'tanpa WebGL: ukuran tetap tampil')
        page.screenshot(path=str(OUT / 'nowebgl.png'))
        nb.close()

print(f'\n{len(fails)} gagal')
for f in fails:
    print(' -', f)
sys.exit(1 if fails else 0)
