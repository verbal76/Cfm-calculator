#!/usr/bin/env python3
"""Install + launch smoke test of the built APK on an Android emulator (run inside reactivecircus/android-emulator-runner).

    python3 scripts/android_smoke.py <apk> <output_dir>

Drives the real app: install, cold launch (native start -> Hot Attic Games card -> Main Menu), open CFM, one calculation,
back, background/resume (the card must NOT replay), force-stop, cold launch again (the card MUST appear again), crash check.
Frames are captured continuously with `screencap` and classified by colour (dark launch frame / logo card / app / white flash).
Exit code 1 if any check fails. This is an EMULATOR check, not a physical-device check.
"""
import io
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

from PIL import Image

APK, OUT = sys.argv[1], sys.argv[2]
PKG = 'com.hotatticgames.cfmcalculator'
EXPECT_CODE = os.environ.get('EXPECT_VERSION_CODE', '')
os.makedirs(OUT, exist_ok=True)
REPORT = open(os.path.join(OUT, 'smoke-report.md'), 'w')
fails = []


def say(line):
    print(line, flush=True)
    REPORT.write(line + '\n')
    REPORT.flush()


def check(name, ok, detail=''):
    say(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''))
    if not ok:
        fails.append(name)


def adb(*args, check_rc=False, timeout=60):
    r = subprocess.run(['adb', *args], capture_output=True, timeout=timeout)
    if check_rc and r.returncode != 0:
        raise RuntimeError(r.stderr.decode(errors='replace'))
    return r.stdout.decode(errors='replace')


def shell(cmd, timeout=60):
    return adb('shell', cmd, timeout=timeout)


# ---------------------------------------------------------------- frame classification
BG = (15, 12, 11)        # native frame + studio card background (#0f0c0b)
APP = (18, 80, 110)      # app background (#12506e)


def near(px, ref, tol):
    return all(abs(a - b) <= tol for a, b in zip(px, ref))


def classify(img):
    im = img.convert('RGB').resize((54, 120))
    px = list(im.getdata())
    n = len(px)
    dark = sum(1 for p in px if near(p, BG, 14)) / n
    blue = sum(1 for p in px if near(p, APP, 24)) / n
    fire = sum(1 for p in px if p[0] > 170 and p[2] < 120 and p[0] - p[1] > 30) / n     # logo's orange/red/yellow
    white = sum(1 for p in px if min(p) > 225) / n
    if white > 0.6:
        return 'WHITE', dict(dark=dark, blue=blue, fire=fire, white=white)
    if fire > 0.012 and dark > 0.45:
        return 'card', dict(dark=dark, blue=blue, fire=fire, white=white)
    if blue > 0.5:
        return 'app', dict(dark=dark, blue=blue, fire=fire, white=white)
    if dark > 0.9:
        return 'dark', dict(dark=dark, blue=blue, fire=fire, white=white)
    return 'mix', dict(dark=dark, blue=blue, fire=fire, white=white)


def grab():
    r = subprocess.run(['adb', 'exec-out', 'screencap', '-p'], capture_output=True, timeout=30)
    return Image.open(io.BytesIO(r.stdout))


def capture(label, seconds, t0):
    frames = []
    i = 0
    while time.time() - t0 < seconds:
        try:
            img = grab()
        except Exception:
            time.sleep(0.2)
            continue
        cls, m = classify(img)
        t = time.time() - t0
        frames.append((t, cls, m))
        if i % 2 == 0 or cls == 'card':
            img.convert('RGB').resize((270, 600)).save(os.path.join(OUT, f'{label}_{i:02d}_{cls}.png'))
        i += 1
    return frames


def describe(frames):
    return ' '.join(f'{t:.1f}s:{c}' for t, c, _ in frames)


def runs(frames):
    out = []
    for t, c, _ in frames:
        if not out or out[-1][0] != c:
            out.append([c, t, t])
        else:
            out[-1][2] = t
    return out


# ---------------------------------------------------------------- UI helpers (uiautomator exposes WebView DOM text)
def ui_nodes():
    for _ in range(3):
        shell('uiautomator dump /sdcard/ui.xml >/dev/null 2>&1', timeout=40)
        xml = adb('exec-out', 'cat', '/sdcard/ui.xml', timeout=30)
        try:
            root = ET.fromstring(xml)
            return list(root.iter('node'))
        except ET.ParseError:
            time.sleep(1)
    return []


def all_text():
    parts = []
    for n in ui_nodes():
        parts += [n.get('text') or '', n.get('content-desc') or '']
    return ' | '.join(p for p in parts if p)


def find_center(text):
    for n in ui_nodes():
        if text.lower() in ((n.get('text') or '') + ' ' + (n.get('content-desc') or '')).lower():
            m = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', n.get('bounds') or '')
            if m:
                x1, y1, x2, y2 = map(int, m.groups())
                return (x1 + x2) // 2, (y1 + y2) // 2
    return None


def tap_text(text):
    c = find_center(text)
    if not c:
        return False
    shell(f'input tap {c[0]} {c[1]}')
    return True


# ---------------------------------------------------------------- run
say(f'# Android smoke test (emulator)\n- apk: {os.path.basename(APK)}')
say(f'- device: {shell("getprop ro.product.model").strip()} API {shell("getprop ro.build.version.sdk").strip()} {shell("wm size").strip()}')
adb('wait-for-device')
shell('input keyevent KEYCODE_WAKEUP')
shell('wm dismiss-keyguard')
shell('settings put global window_animation_scale 1; settings put global transition_animation_scale 1; settings put global animator_duration_scale 1')
adb('logcat', '-c')

# 1. install
out = adb('install', '-r', APK, timeout=180)
check('install succeeds', 'Success' in out, out.strip()[:80])
if 'Success' not in out:
    sys.exit(1)
pkginfo = shell(f'dumpsys package {PKG}')
vc = re.search(r'versionCode=(\d+)', pkginfo)
vn = re.search(r'versionName=(\S+)', pkginfo)
say(f'- installed versionCode={vc.group(1) if vc else "?"} versionName={vn.group(1) if vn else "?"}')
if EXPECT_CODE:
    check('installed versionCode is the release number', bool(vc) and vc.group(1) == EXPECT_CODE and bool(vn) and not vn.group(1).endswith('-dev'), f'{vc and vc.group(1)} {vn and vn.group(1)}')


def cold_launch(label, seconds=9.0):
    shell(f'am force-stop {PKG}')
    time.sleep(1.5)
    t0 = time.time()
    subprocess.Popen(['adb', 'shell', f'am start -n {PKG}/.MainActivity'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    frames = capture(label, seconds, t0)
    say(f'frames[{label}]: {describe(frames)}')
    return frames


def check_cold(label, frames):
    seq = runs(frames)
    names = [r[0] for r in seq]
    card = [f for f in frames if f[1] == 'card']
    check(f'{label}: studio card appears ({len(card)} card frames)', len(card) >= 2)
    check(f'{label}: no white/black-flash frame', not any(c == 'WHITE' for _, c, _ in frames))
    if card:
        first_card = card[0][0]
        last_card = card[-1][0]
        apps = [f for f in frames if f[1] == 'app']
        check(f'{label}: order is launch frame -> card -> app (no app before card)', bool(apps) and apps[0][0] > first_card and not any(f[1] == 'app' and f[0] < first_card for f in frames), ' > '.join(names))
        check(f'{label}: card visible about 2-3.2 s (first to last card frame {last_card - first_card:.1f}s)', 1.6 <= last_card - first_card + 0.4 <= 3.6)
    else:
        check(f'{label}: order is launch frame -> card -> app', False, ' > '.join(names))
    check(f'{label}: ends on the app (Main Menu)', bool(frames) and frames[-1][1] == 'app')


f1 = cold_launch('cold1')
check_cold('cold launch #1', f1)

# 2. UI: main menu -> CFM -> calculation -> back
txt = all_text()
say(f'- ui text after launch: {txt[:160]!r}')
nodes_exposed = 'Choose a tool' in txt or "Verbal's CFM Calculator" in txt
check('Main Menu is shown (UI hierarchy exposes the web content)', nodes_exposed, txt[:80])
if nodes_exposed:
    check('open CFM calculator', tap_text('CFM') and (time.sleep(1.0) or True) and 'CFM per ton' in all_text())
    shell('input keyevent KEYCODE_TAB')   # focus moves into the page's first field
    # tap the first field explicitly to be safe, then Tab through the four fields
    first = [n for n in ui_nodes() if (n.get('class') or '').endswith('EditText')]
    if first:
        m = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', first[0].get('bounds') or '')
        if m:
            x1, y1, x2, y2 = map(int, m.groups())
            shell(f'input tap {(x1 + x2) // 2} {(y1 + y2) // 2}')
    for i, v in enumerate(['108000', '50', '1.08', '3']):
        shell(f'input text {v}')
        shell('input keyevent KEYCODE_TAB')
    shell('input keyevent KEYCODE_ENTER')       # Tab landed on "Calculate"
    time.sleep(1.0)
    res = all_text()
    say(f'- ui text after calculate: {res[:300]!r}')
    check('CFM calculation 108000/50/1.08/3 -> 2000 and 666.6666666666666', '2000' in res and '666.6666666666666' in res)
    shell('input keyevent KEYCODE_BACK')        # closes the keyboard if open
    time.sleep(0.6)
    if 'Choose a tool' not in all_text():
        shell('input keyevent KEYCODE_BACK')    # navigates back through the app's history to the menu
        time.sleep(0.8)
    check('back navigation returns to the Main Menu', 'Choose a tool' in all_text())
else:
    say('INFO: web content not exposed to uiautomator; CFM interaction steps skipped (not a pass)')

# 3. background / resume must NOT replay the card
shell('input keyevent KEYCODE_HOME')
time.sleep(2.0)
t0 = time.time()
subprocess.Popen(['adb', 'shell', f'monkey -p {PKG} -c android.intent.category.LAUNCHER 1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fr = capture('resume', 5.0, t0)
say(f'frames[resume]: {describe(fr)}')
check('background/resume does not replay the studio card', not any(c == 'card' for _, c, _ in fr) and any(c == 'app' for _, c, _ in fr))
check('resume shows no white flash', not any(c == 'WHITE' for _, c, _ in fr))

# 4. full close then cold launch: card appears again
f2 = cold_launch('cold2')
check_cold('cold launch #2 (after full close)', f2)

# 5. crash check
log = adb('logcat', '-d', timeout=60)
crash = [l for l in log.splitlines() if ('FATAL EXCEPTION' in l or 'ANR in' in l) and (PKG in l or 'AndroidRuntime' in l or 'ANR' in l)]
fatal = re.findall(r'FATAL EXCEPTION.*\n.*Process: ' + re.escape(PKG), log)
check('no crash / ANR in logcat', not crash and not fatal, '; '.join(crash[:2]))
open(os.path.join(OUT, 'logcat.txt'), 'w').write('\n'.join(l for l in log.splitlines() if PKG in l or 'chromium' in l.lower() or 'AndroidRuntime' in l)[-60000:])

say('\nRESULT: ' + ('ALL PASS' if not fails else f'{len(fails)} FAILED: ' + '; '.join(fails)))
sys.exit(1 if fails else 0)
