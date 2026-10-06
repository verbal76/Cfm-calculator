# Dev-only UI smoke test. Run: npx vite build && (npx vite preview --port 4173 &) && python3 scripts/ui_smoke.py /tmp  (needs: pip install playwright; Chromium in /opt/pw-browsers)
import sys, glob
from playwright.sync_api import sync_playwright
exe = (glob.glob('/opt/pw-browsers/chromium-*/chrome-linux/chrome') or glob.glob('/opt/pw-browsers/chromium-*/chrome-linux64/chrome') or ['/opt/pw-browsers/chromium'])[0]
SCR = sys.argv[1]
errs=[]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=exe, args=['--no-sandbox'])
    pg = b.new_page(viewport={'width':390,'height':844})
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://127.0.0.1:4173/')
    assert pg.is_visible('#screen-menu'), 'menu is launch screen'
    print('menu buttons:', [a.inner_text() for a in pg.query_selector_all('#screen-menu .btn.big')])
    # CFM historical fixture
    pg.click('a[href="#cfm"]')
    pg.fill('#btuh','108000'); pg.fill('#deltat','50'); pg.fill('#spec','1.08'); pg.fill('#tons','3'); pg.click('#cfm-calc')
    print('CFM total/per-ton:', pg.inner_text('#cfm-total'), pg.inner_text('#cfm-per-ton'))
    # Superheat R-407C
    pg.go_back(); pg.click('a[href="#superheat"]')
    pg.click('#screen-superheat .chip[data-id="R-407C"]')
    pg.fill('#sh-psig','63.16'); pg.fill('#sh-temp','50'); pg.click('#sh-calc')
    print('SH R-407C:', pg.inner_text('#sh-actual'), '| dl:', pg.inner_text('#sh-results').replace('\n',' / '))
    pg.screenshot(path=f'{SCR}/superheat.png')
    # picker is shared: go to subcool and check selection persists
    pg.go_back(); pg.click('a[href="#subcool"]')
    print('subcool selected chip:', pg.get_attribute('#screen-subcool .chip[aria-checked="true"]','data-id'))
    pg.fill('#sc-psig','80.24'); pg.fill('#sc-temp','32'); pg.fill('#sc-target','8'); pg.click('#sc-calc')
    print('SC R-407C:', pg.inner_text('#sc-actual'), '|', pg.inner_text('#sc-verdict'))
    pg.screenshot(path=f'{SCR}/subcool.png')
    # errors
    pg.fill('#sc-psig','9999'); pg.click('#sc-calc'); print('err:', pg.inner_text('#sc-error'))
    pg.fill('#sc-psig',''); pg.click('#sc-calc'); print('err blank:', pg.inner_text('#sc-error'))
    # PT
    pg.go_back(); pg.click('a[href="#pt"]')
    pg.click('#screen-pt .chip[data-id="R-410A"]'); pg.fill('#pt-psig','118.8'); pg.fill('#pt-temp','40')
    print('PT R-410A:', pg.inner_text('#pt-p-results').replace('\n',' / '), '||', pg.inner_text('#pt-t-results').replace('\n',' / '))
    pg.click('#screen-pt .chip[data-id="R-32"]'); print('PT R-32 (no glide):', pg.inner_text('#pt-p-results').replace('\n',' / '))
    pg.click('#screen-pt .chip[data-id="R-454B"]'); pg.screenshot(path=f'{SCR}/pt.png', full_page=True)
    pg.go_back(); pg.click('a[href="#about"]'); pg.wait_for_timeout(200)
    print('about:', pg.inner_text('#about-dataset'))
    pg.click('#copy-diag'); pg.wait_for_timeout(200); print('copy status:', pg.inner_text('#copy-status')[:80])
    # landscape
    pg.set_viewport_size({'width':844,'height':390}); pg.goto('http://127.0.0.1:4173/#superheat'); pg.screenshot(path=f'{SCR}/landscape.png')
    b.close()
print('JS errors:', errs)
