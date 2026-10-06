#!/usr/bin/env python3
"""End-to-end check of the Hot Attic Games studio splash in a real browser (Chromium/Chrome).

Usage (after `npm run build`):
    npx vite preview --port 4173 --host 127.0.0.1 &      # serves dist/
    python3 scripts/splash_check.py http://127.0.0.1:4173 [screenshot_dir]

Exit code 0 only if every assertion passes. Needs `pip install playwright` and either Playwright's Chromium
(/opt/pw-browsers) or Google Chrome (the GitHub runner has it; launched via channel="chrome").
"""
import glob
import hashlib
import io
import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANON = os.path.join(ROOT, 'Hot_Attic_Games_Master_Logo_ALPHA_FINAL.png')
CANON_SHA = hashlib.sha256(open(CANON, 'rb').read()).hexdigest()
BG = (0x0F, 0x0C, 0x0B)

failures = []


def check(name, ok, detail=''):
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''))
    if not ok:
        failures.append(name)


def launch(p):
    exes = glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome')
    if exes:
        return p.chromium.launch(executable_path=exes[0], args=['--no-sandbox'])
    return p.chromium.launch(channel='chrome', args=['--no-sandbox'])


# Records every <html data-splash> change with a timestamp and the computed visibility of <main>/overlay at that moment.
OBSERVER = """
() => {
  window.__phases = [];
  const root = document.documentElement;
  const rec = () => window.__phases.push({
    t: performance.now(), phase: root.dataset.splash || 'initial',
    mainVisibility: getComputedStyle(document.querySelector('main')).visibility,
    overlayDisplay: getComputedStyle(document.getElementById('hag-splash')).display });
  rec();
  new MutationObserver(rec).observe(root, { attributes: true, attributeFilter: ['data-splash'] });
}
"""


def phase_time(phases, name):
    for ph in phases:
        if ph['phase'] == name:
            return ph['t']
    return None


with sync_playwright() as p:
    browser = launch(p)

    # ---------- 1. cold launch, portrait phone
    ctx = browser.new_context(viewport={'width': 390, 'height': 844})
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE + '/', wait_until='commit')
    page.evaluate(OBSERVER)
    page.wait_for_function("document.documentElement.dataset.splash === 'hold'", timeout=5000)

    # exact canonical artwork is what is displayed
    info = page.evaluate("""async () => {
      const img = document.getElementById('hag-splash-img');
      const buf = await (await fetch(img.currentSrc)).arrayBuffer();
      const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf))).map(b => b.toString(16).padStart(2, '0')).join('');
      return { src: img.currentSrc, sha: h, nw: img.naturalWidth, nh: img.naturalHeight, complete: img.complete };
    }""")
    check('displayed image is the canonical Hot_Attic_Games_Master_Logo_ALPHA_FINAL.png (bytes identical)', info['sha'] == CANON_SHA and 'Hot_Attic_Games_Master_Logo_ALPHA_FINAL' in info['src'], info['src'].split('/')[-1])
    check('natural size 1536x1024 (unmodified)', (info['nw'], info['nh']) == (1536, 1024), f"{info['nw']}x{info['nh']}")

    # layout: contain-fit, aspect preserved, complete logo inside the viewport with margin
    def layout(pg, vw, vh):
        r = pg.evaluate("""() => { const b = document.getElementById('hag-splash-img').getBoundingClientRect(); return {x:b.x,y:b.y,w:b.width,h:b.height}; }""")
        scale = min(r['w'] / 1536, r['h'] / 1024)          # object-fit: contain
        cw, ch = 1536 * scale, 1024 * scale
        cx, cy = r['x'] + (r['w'] - cw) / 2, r['y'] + (r['h'] - ch) / 2
        return cw, ch, cx, cy

    cw, ch, cx, cy = layout(page, 390, 844)
    check('aspect ratio preserved (1.5)', abs(cw / ch - 1.5) < 0.01, f'{cw:.0f}x{ch:.0f}')
    margin = min(cx, 390 - (cx + cw), cy, 844 - (cy + ch))
    check('whole logo inside viewport with margin (portrait)', margin >= 0.06 * 390, f'margin {margin:.0f}px')
    check('logo is centred (portrait)', abs((cx + cw / 2) - 195) < 2 and abs((cy + ch / 2) - 422) < 2)

    # transparency: transparent corners of the artwork show the card background, centre shows artwork
    from PIL import Image
    shot = Image.open(io.BytesIO(page.screenshot())).convert('RGB')
    tl = shot.getpixel((int(cx) + 6, int(cy) + 6))
    br = shot.getpixel((int(cx + cw) - 6, int(cy + ch) - 6))
    mid = shot.getpixel((int(cx + cw / 2), int(cy + ch * 0.80)))
    check('transparent artwork corners composite over the card background (not white/black)', tl == BG and br == BG, f'{tl} {br}')
    check('artwork itself is drawn (centre pixel differs from background)', sum(abs(a - b) for a, b in zip(mid, BG)) > 60, str(mid))
    if SHOTS:
        os.makedirs(SHOTS, exist_ok=True)
        page.screenshot(path=os.path.join(SHOTS, 'splash_portrait.png'))

    # app UI hidden while the card is up
    check('app UI is not visible during the card (no uninitialised UI)', page.evaluate("getComputedStyle(document.querySelector('main')).visibility") == 'hidden')

    # wait for completion
    page.wait_for_function("document.documentElement.dataset.splash === 'done'", timeout=6000)
    ph = page.evaluate('window.__phases')
    t_in, t_hold, t_out, t_done = (phase_time(ph, n) for n in ('in', 'hold', 'out', 'done'))
    total = (t_done - t_in) / 1000
    check('display time is about 2.5 s (2-3 s window)', 2.3 <= total <= 3.0, f'{total:.2f}s')
    t_prep = phase_time(ph, 'prep')
    check('logo is pre-rasterised (prep phase) before the visible fade-in starts', t_prep is not None and t_in is not None and t_prep <= t_in)
    check('phase order in -> hold -> out -> done', all(v is not None for v in (t_in, t_hold, t_out, t_done)) and t_in < t_hold < t_out < t_done)
    out_rec = next(x for x in ph if x['phase'] == 'out')
    in_rec = next(x for x in ph if x['phase'] == 'in')
    check('app becomes visible only when the card starts fading out', in_rec['mainVisibility'] == 'hidden' and out_rec['mainVisibility'] == 'visible')
    check('card removed afterwards', page.evaluate("getComputedStyle(document.getElementById('hag-splash')).display") == 'none')
    check('product opening (Main Menu) follows the card', page.is_visible('#screen-menu') and 'Verbal' in page.inner_text('#screen-menu h1'))
    hit = page.evaluate("document.elementFromPoint(195, 300).closest('main') !== null")
    check('card does not block touches after it ends', hit)
    page.click('a[href="#cfm"]')
    try:
        page.wait_for_selector('#screen-cfm', state='visible', timeout=2000)   # hashchange is asynchronous
        nav_ok = True
    except Exception:
        nav_ok = False
    check('navigation continues after the card', nav_ok)

    # ---------- resume / background must not replay the card
    page.evaluate("""() => { Object.defineProperty(document, 'hidden', {value: true, configurable: true});
      document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide'));
      Object.defineProperty(document, 'hidden', {value: false, configurable: true});
      document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pageshow')); }""")
    page.wait_for_timeout(300)
    check('background/resume does not replay the studio card', page.evaluate("document.documentElement.dataset.splash") == 'done'
          and page.evaluate("getComputedStyle(document.getElementById('hag-splash')).display") == 'none')

    # ---------- reload within the same WebView session: card skipped before first paint
    page.reload(wait_until='commit')
    page.wait_for_function("document.documentElement.dataset.splash !== undefined", timeout=3000)
    check('reload in the same session skips the card', page.evaluate("document.documentElement.dataset.splash") == 'skip')
    page.wait_for_selector('#screen-cfm', state='visible', timeout=3000)   # the reload keeps the current route (#cfm)
    check('app UI visible immediately after a skipped card', page.evaluate("getComputedStyle(document.querySelector('main')).visibility") == 'visible')
    check('JS errors during all of the above', not errors, '; '.join(errors))
    ctx.close()

    # ---------- a new session (cold launch) shows the card again; other form factors
    for name, (w, h) in {'landscape phone': (844, 390), 'tablet portrait': (800, 1280), 'small phone': (320, 568)}.items():
        c = browser.new_context(viewport={'width': w, 'height': h})
        pg = c.new_page()
        pg.goto(BASE + '/', wait_until='commit')
        pg.wait_for_function("document.documentElement.dataset.splash === 'hold'", timeout=5000)
        cw, ch, cx, cy = layout(pg, w, h)
        m = min(cx, w - (cx + cw), cy, h - (cy + ch))
        check(f'cold launch shows the card; whole logo fits, aspect kept ({name} {w}x{h})', abs(cw / ch - 1.5) < 0.01 and m >= 0.06 * min(w, h), f'margin {m:.0f}px')
        if SHOTS and name == 'landscape phone':
            pg.screenshot(path=os.path.join(SHOTS, 'splash_landscape.png'))
        c.close()


    # ---------- navigation / history (Android Back is WebView history; MainActivity maps Back to history.back(), and closes the app only at the root)
    c = browser.new_context(viewport={'width': 390, 'height': 844})
    c.add_init_script("try { sessionStorage.setItem('hag.splash.shown', '1'); } catch (e) {}")   # skip the card: not under test here
    pg = c.new_page()
    pg.goto(BASE + '/')
    pg.wait_for_selector('#screen-menu', state='visible', timeout=5000)
    hash_now = lambda: pg.evaluate('location.hash')
    pg.click('a[href="#subcool"]')
    pg.wait_for_selector('#screen-subcool', state='visible', timeout=3000)
    check('menu -> tool pushes history (hash #subcool)', hash_now() == '#subcool')
    pg.go_back()
    pg.wait_for_selector('#screen-menu', state='visible', timeout=3000)
    check('Back from a tool screen returns to the Main Menu (not out of the app)', hash_now() == '' and pg.is_visible('#screen-menu'))
    pg.click('a[href="#pt"]')
    pg.wait_for_selector('#screen-pt', state='visible', timeout=3000)
    pg.click('#screen-pt a[href="#menu"]')
    pg.wait_for_selector('#screen-menu', state='visible', timeout=3000)
    check('"Main Menu" returns to the root and leaves no extra history behind', hash_now() == '' and pg.evaluate('history.state') is None)
    pg.click('a[href="#about"]')
    pg.wait_for_selector('#screen-about', state='visible', timeout=3000)
    pg.go_back()
    pg.wait_for_selector('#screen-menu', state='visible', timeout=3000)
    check('About -> Back returns to the Main Menu', hash_now() == '' and pg.is_visible('#screen-menu'))
    pg.click('a[href="#cfm"]')
    pg.wait_for_selector('#screen-cfm', state='visible', timeout=3000)
    pg.click('#screen-cfm a[href="#menu"]')
    pg.wait_for_selector('#screen-menu', state='visible', timeout=3000)
    pg.click('a[href="#subcool"]')
    pg.wait_for_selector('#screen-subcool', state='visible', timeout=3000)
    pg.go_back()
    pg.wait_for_selector('#screen-menu', state='visible', timeout=3000)
    check('repeated tool visits never stack up: one Back always returns to the menu', hash_now() == '')
    c.close()

    # ---------- failure: artwork cannot load -> card is skipped promptly, user not stranded
    c = browser.new_context(viewport={'width': 390, 'height': 844})
    pg = c.new_page()
    pg.route('**/Hot_Attic_Games_Master_Logo_ALPHA_FINAL*.png', lambda r: r.abort())
    t0 = time.time()
    pg.goto(BASE + '/', wait_until='commit')
    pg.wait_for_function("document.documentElement.dataset.splash === 'done'", timeout=6000)
    el = time.time() - t0
    check('missing artwork cannot strand the user (card skipped quickly)', el < 2.0 and pg.is_visible('#screen-menu'), f'{el:.2f}s')
    c.close()


    # ---------- slow first load of the artwork (slow cold start): the card is delayed, NEVER skipped, and still shows the full 2.5 s
    def slow_handler(delay):
        def handler(route):
            time.sleep(delay)
            route.continue_()
        return handler
    c = browser.new_context(viewport={'width': 390, 'height': 844})
    pg = c.new_page()
    pg.route('**/Hot_Attic_Games_Master_Logo_ALPHA_FINAL*.png', slow_handler(1.8))
    pg.goto(BASE + '/', wait_until='commit')
    pg.evaluate(OBSERVER)
    pg.wait_for_function("document.documentElement.dataset.splash === 'done'", timeout=15000)
    ph = pg.evaluate('window.__phases')
    t_in, t_done = phase_time(ph, 'in'), phase_time(ph, 'done')
    check('slow artwork load (1.8 s): the studio card is still shown (not skipped)', t_in is not None and t_done is not None)
    if t_in is not None and t_done is not None:
        check(f'slow artwork load: the card still stays about 2.5 s once visible ({(t_done - t_in) / 1000:.2f}s)', 2.3 <= (t_done - t_in) / 1000 <= 3.0)
        check(f'slow artwork load: the fade-in waited for the artwork ({t_in / 1000:.1f}s after page start)', t_in / 1000 >= 1.5)
    c.close()

    # ---------- artwork that effectively never loads: gives up after the wait ceiling, user reaches the app, nothing stranded
    c = browser.new_context(viewport={'width': 390, 'height': 844})
    pg = c.new_page()
    pg.route('**/Hot_Attic_Games_Master_Logo_ALPHA_FINAL*.png', slow_handler(7.0))
    pg.goto(BASE + '/', wait_until='commit')
    pg.evaluate(OBSERVER)          # timestamps come from inside the page: the blocking test handler stalls Python's own clock
    pg.wait_for_function("document.documentElement.dataset.splash === 'done'", timeout=20000)
    ph = pg.evaluate('window.__phases')
    t_done = phase_time(ph, 'done')
    shown = phase_time(ph, 'in') is not None
    check(f'artwork that never loads: card gives up after the wait ceiling and the app is reachable ({t_done / 1000:.1f}s in-page, shown={shown})',
          t_done is not None and t_done / 1000 < 3.6 and not shown and pg.evaluate("getComputedStyle(document.querySelector('main')).visibility") == 'visible')
    c.close()

    # ---------- failure: JavaScript never runs -> CSS-only failsafe removes the card
    c = browser.new_context(viewport={'width': 390, 'height': 844})
    pg = c.new_page()
    pg.route('**/*.js', lambda r: r.abort())
    pg.goto(BASE + '/', wait_until='commit')
    pg.wait_for_timeout(5200)
    state = pg.evaluate("({card: getComputedStyle(document.getElementById('hag-splash')).visibility, main: getComputedStyle(document.querySelector('main')).visibility})")
    check('CSS failsafe frees the user even if all JS fails (card hidden, UI visible after ~4.5 s)', state == {'card': 'hidden', 'main': 'visible'}, str(state))
    c.close()
    browser.close()

print('\nRESULT:', 'ALL PASS' if not failures else f'{len(failures)} FAILED: ' + '; '.join(failures))
sys.exit(1 if failures else 0)
