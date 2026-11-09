"""End-to-end browser test (Playwright/Chromium, emulated phone & tablet viewports).
Plays the whole trial like a child: taps AND drags, makes some deliberate mistakes, reloads mid-game,
goes offline, and checks layout / numerals / digit order / symbol direction at every step.
usage: python3 tests/e2e.py [width height] [--short]"""
import asyncio, json, sys, re, time
from playwright.async_api import async_playwright

URL = 'http://127.0.0.1:8931/'
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 and sys.argv[1].isdigit() else (360, 640)
SHORT = '--short' in sys.argv
STORY = {'s1': ('pencil', 12), 's2': ('bead', 14), 's3': ('egg', 17), 's4': ('balloon', 20)}
R = {'checks': [], 'fail': [], 'steps': 0, 'layout_fail': [], 'viewport': f'{W}x{H}'}
def check(name, ok, info=''):
    R['checks'].append((name, bool(ok), info))
    if not ok: R['fail'].append(f'{name}: {info}'); print('FAIL', name, info, flush=True)

LAYOUT_JS = r'''() => {
  const out = {overflow: document.documentElement.scrollWidth > innerWidth + 1, sw: document.documentElement.scrollWidth, iw: innerWidth, off: [], small: [], latin: [], order: []};
  for (const e of document.querySelectorAll('.card,.tb-tray .piece,.tile,.slot,.btn,.pic-card,.obj,.lb,.tstring,.icon,.bundle')) {
    const r = e.getBoundingClientRect(); if (!r.width) continue;
    if (r.left < -1 || r.right > innerWidth + 1) out.off.push(e.className + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
    if ((e.matches('.card,.tile,.btn,.icon,.tb-tray .piece,.obj,.pic-card')) && (r.width < 44 || r.height < 44)) out.small.push(e.className + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  const txt = document.body.innerText; const m = txt.match(/[0-9]/g); if (m) out.latin.push(txt.slice(Math.max(0, txt.search(/[0-9]/) - 20), txt.search(/[0-9]/) + 20));
  for (const b of document.querySelectorAll('bdi.num')) {
    const t = b.textContent; if (t.length !== 2 || !b.getClientRects().length) continue;
    const tn = b.firstChild; const r = document.createRange();
    r.setStart(tn, 0); r.setEnd(tn, 1); const a = r.getBoundingClientRect(); r.setStart(tn, 1); r.setEnd(tn, 2); const c = r.getBoundingClientRect();
    if (!(a.left < c.left)) out.order.push(t);
  }
  out.glued = [];
  const lastRect = (tn, end) => { const r = document.createRange(); const L = tn.textContent.length; if (end) { r.setStart(tn, L - 1); r.setEnd(tn, L); } else { r.setStart(tn, 0); r.setEnd(tn, 1); } return r.getBoundingClientRect(); };
  for (const b of document.querySelectorAll('bdi.num')) {
    if (!b.getClientRects().length) continue; const B = b.getBoundingClientRect();
    const p = b.previousSibling, n = b.nextSibling;
    if (p && p.nodeType === 3 && /\S$/.test(p.textContent) && !/(^|\s)و$/.test(p.textContent)) { const t = lastRect(p, true); if (t.width && Math.abs(t.top - B.top) < B.height && t.left - B.right < 3) out.glued.push(p.textContent.slice(-8) + '|' + b.textContent); }
    if (n && n.nodeType === 3 && /^\S/.test(n.textContent) && !/^[،.:!؟)]/.test(n.textContent)) { const t = lastRect(n, false); if (t.width && Math.abs(t.top - B.top) < B.height && B.left - t.right < 3) out.glued.push(b.textContent + '|' + n.textContent.slice(0, 8)); }
  }
  out.dom = [...document.querySelectorAll('.dominoes .frame .cell')].map((c) => c.getBoundingClientRect().width).filter((w) => w).reduce((m, w) => Math.min(m, w), 999);
  return out; }'''

async def layout(pg, tag):
    L = await pg.evaluate(LAYOUT_JS)
    bad = []
    if L['overflow']: bad.append(f"hscroll {L['sw']}>{L['iw']}")
    if L['off']: bad.append('offscreen ' + '; '.join(L['off'][:3]))
    if L['small']: bad.append('small ' + '; '.join(L['small'][:3]))
    if L['latin']: bad.append('latin digits: ' + L['latin'][0])
    if L['order']: bad.append('digit order ' + ','.join(L['order']))
    if L['glued']: bad.append('word glued to number ' + ','.join(L['glued'][:3]))
    if L['dom'] < 999:
        R.setdefault('domino_cell_px', []).append(round(L['dom'], 1))
        if L['dom'] < 18: bad.append(f"domino beads too small {L['dom']:.0f}px")
    if bad: R['layout_fail'].append(f'{tag}: ' + ' | '.join(bad))

async def st(pg): return await pg.evaluate('window.__rs1 ? {idx: window.__rs1.idx, step: window.__rs1.step} : null')
async def idle(pg, t=15000):
    await pg.wait_for_function("() => !document.querySelector('.game.busy')", timeout=t)

async def tap(pg, sel, idx=0):
    loc = pg.locator(sel).nth(idx)
    await loc.wait_for(state='visible', timeout=20000)
    await loc.click()

async def drag(pg, src, dst_sel):
    a = await src.bounding_box(); b = await pg.locator(dst_sel).first.bounding_box()
    await pg.mouse.move(a['x'] + a['width'] / 2, a['y'] + a['height'] / 2); await pg.mouse.down()
    for k in range(1, 8):
        await pg.mouse.move(a['x'] + a['width'] / 2 + (b['x'] + b['width'] / 2 - a['x'] - a['width'] / 2) * k / 7, a['y'] + a['height'] / 2 + (b['y'] + b['height'] / 2 - a['y'] - a['height'] / 2) * k / 7)
    await pg.mouse.up()

async def board_state(pg):
    return await pg.evaluate("() => { const b = document.querySelector('.play .tb:not(.static)'); return b ? {n: +b.dataset.n, tens: +b.dataset.tens, bundle: b.classList.contains('mode-bundle'), balloon: b.classList.contains('skin-balloon')} : null }")

async def solve_build(pg, target, use_drag=False, drop_outside=False):
    await pg.locator('.play .tb:not(.static)').wait_for(timeout=20000)
    k = 0
    if drop_outside:
        e0 = await pg.evaluate('S => 0')
        before_err = await pg.evaluate("JSON.parse(localStorage.getItem('riyadiyat-saf1-v1')).errors.length")
        m0 = await pg.evaluate('window.__touchMisses()')
        n0 = (await board_state(pg))['n']
        await drag(pg, pg.locator('.tb-tray .piece').first, '.taskbar')
        await pg.wait_for_timeout(600)
        m1 = await pg.evaluate('window.__touchMisses()'); n1 = (await board_state(pg))['n']
        after_err = await pg.evaluate("JSON.parse(localStorage.getItem('riyadiyat-saf1-v1')).errors.length")
        check('drop outside returns piece, no maths error', m1 == m0 + 1 and n1 == n0 and after_err == before_err and await pg.locator('.ghost').count() == 0, f'misses {m0}->{m1} n {n0}->{n1} errors {before_err}->{after_err}')
    for _ in range(60):
        s = await board_state(pg)
        loose = s['n'] - 10 * s['tens'] if s['bundle'] else 0
        if s['bundle'] and loose >= 10:
            if s['balloon']: await pg.wait_for_timeout(700); continue
            await tap(pg, '.tie'); await pg.wait_for_timeout(250); continue
        if s['n'] < target:
            p = pg.locator('.tb-tray .piece').first
            if use_drag and k % 2 == 0: await drag(pg, p, '.tb-board')
            else: await p.click()
            k += 1; await pg.wait_for_timeout(120); continue
        break
    s = await board_state(pg)
    check('board reached target', s['n'] == target, f"{s} target {target}")
    await idle(pg); await tap(pg, '.done')

async def wait_log(pg, log0, ids, t=20000):
    try:
        await pg.wait_for_function(f"() => window.__audioLog.slice({log0}).some(x => {json.dumps(ids)}.includes(x))", timeout=t)
    except Exception: pass
    await idle(pg, 40000)
    return await pg.evaluate(f'window.__audioLog.slice({log0})')

async def choose_num(pg, v, wrong=None):
    await pg.locator('.num-cards .card').first.wait_for(timeout=30000)
    await idle(pg)
    if wrong is not None and await pg.locator(f'.num-cards .card[data-v="{wrong}"]').count():
        log0 = await pg.evaluate('window.__audioLog.length')
        await tap(pg, f'.num-cards .card[data-v="{wrong}"]')
        await pg.wait_for_function("!!document.querySelector('.tb.pv-show, .tb.hl-tens, .tb.hl-ones')", timeout=20000); hl = True
        log = await wait_log(pg, log0, ['h_pv', 'h_count_on'])
        return log, hl
    await tap(pg, f'.num-cards .card[data-v="{v}"]')
    return None, None

async def solve(pg, step, mistakes):
    g = step['g']
    if g in ('say', 'probeEnd', 'warmups', 'gameEnd', 'close'): return
    if step.get('phase') == 'demo' and g == 'build': return   # watch only
    if g == 'build':
        await solve_build(pg, step['target'], use_drag=step.get('phase') == 'guided', drop_outside=mistakes.pop('drop', False) if step.get('phase') == 'guided' else False)
        if step.get('choose', True) is not False:
            if step.get('phase') == 'demo': return
            await choose_num(pg, step['target'])
        if step.get('untie'):
            await pg.locator('.bundle').first.wait_for(timeout=20000); await idle(pg)
            await pg.wait_for_function("() => document.querySelector('.task-text').textContent.includes('تفك')", timeout=20000)
            n0 = await board_state(pg)
            await tap(pg, '.bundle')
            n1 = await board_state(pg)
            check('untie shows ten single pencils again', n1['tens'] == n0['tens'] - 1 and n1['n'] == n0['n'], f'{n0}->{n1}')
    elif g == 'see':
        wrong = None
        if mistakes.get('reverse') and step['n'] in (12, 13, 14, 15, 16, 17, 18, 19):
            wrong = int(str(step['n'])[::-1]); mistakes.pop('reverse')
            log, hl = await choose_num(pg, step['n'], wrong)
            if log is not None:
                check('reversed digits -> place-value hint (tens/ones highlighted + h_pv)', 'h_pv' in log and hl, str(log[:6]))
                return  # a new example is inserted by the session
        await choose_num(pg, step['n'])
    elif g in ('hear', 'hearSmall'):
        await pg.locator('.pic-card').first.wait_for(timeout=30000); await idle(pg)
        await tap(pg, f'.pic-card[data-v="{step["n"]}"]')
    elif g == 'digits':
        await pg.locator('.tile').first.wait_for(timeout=30000); await idle(pg)
        t, o = divmod(step['n'], 10)
        if mistakes.get('digits') and t != o:
            mistakes.pop('digits'); log0 = await pg.evaluate('window.__audioLog.length')
            await tap(pg, f'.tile[data-d="{o}"]'); await tap(pg, f'.tile[data-d="{t}"]')
            await pg.wait_for_function("!!document.querySelector('.dslots.hl')", timeout=20000); hl = True
            log = await wait_log(pg, log0, ['h_pv'])
            check('digit tiles reversed -> place-value hint', 'h_pv' in log and hl, str(log[:5]))
            return
        await tap(pg, f'.tile[data-d="{t}"]'); await pg.wait_for_timeout(150)
        # drag the ones digit into the ones slot (drag path), tap path used for tens
        await drag(pg, pg.locator(f'.tile[data-d="{o}"]'), '.slot.s-ones')
    elif g == 'compare':
        a, b = step['a'], step['b']
        if step['mode'] == 'pair':
            if step['phase'] != 'demo':
                await pg.locator('.cmp').wait_for(timeout=20000)
                if a >= 10 and b >= 10: await tap(pg, '.colA .tstring')
                for _ in range(min(a % 10, b % 10)):
                    await pg.wait_for_timeout(120); await tap(pg, '.colA .lb.next')
                await pg.locator('.word-cards .card').first.wait_for(timeout=30000); await idle(pg)
                rel = 'gt' if a > b else 'lt' if a < b else 'eq'
                await tap(pg, f'.word-cards .card[data-v="{rel}"]')
            else:
                await pg.locator('.word-cards').wait_for(timeout=60000)
        await pg.locator('.sym-cards .card').first.wait_for(timeout=60000)
        if step['phase'] == 'demo': await pg.wait_for_function("() => document.querySelector('.cmp-line .mid svg')", timeout=30000); await geom(pg, a, b); return
        await idle(pg)
        right = 'eq' if a == b else 'right' if a > b else 'left'
        if mistakes.get('symbol') and right != 'eq' and step['phase'] == 'solo':
            mistakes.pop('symbol'); log0 = await pg.evaluate('window.__audioLog.length')
            await tap(pg, f'.sym-cards .card[data-v="{"left" if right == "right" else "right"}"]')
            await pg.wait_for_function("!!document.querySelector('.cmp-line.hl-big-A, .cmp-line.hl-big-B')", timeout=20000); hl = True
            log = await wait_log(pg, log0, ['l5_left', 'l5_equal'], 40000)
            check('mirrored symbol -> "opening faces the bigger number" hint + bead rows', 'h_sym' in log and hl and await pg.locator('.rows-hint .cmp').count() > 0, str(log[:6]))
            return
        await tap(pg, f'.sym-cards .card[data-v="{right}"]')
        await pg.wait_for_function("() => document.querySelector('.cmp-line .mid svg')", timeout=10000)
        await geom(pg, a, b)
    elif g == 'pickExtreme':
        await pg.locator('.num-cards .card').first.wait_for(timeout=30000); await idle(pg)
        v = max(step['vals']) if step['big'] else min(step['vals'])
        await tap(pg, f'.num-cards .card[data-v="{v}"]')
    elif g == 'story':
        if step['id'] == 's5':
            await pg.locator('.num-cards .card').first.wait_for(timeout=60000); await idle(pg)
            await tap(pg, '.num-cards .card[data-v="8"]')
        else:
            skin, t = STORY[step['id']]
            await pg.locator('.play .tb:not(.static)').wait_for(timeout=60000)
            await solve_build(pg, t)
            await choose_num(pg, t)
    elif g == 'countTap':
        await pg.locator('.obj').first.wait_for(timeout=20000)
        n = await pg.locator('.obj').count()
        await pg.locator('.obj').first.click(); await pg.wait_for_timeout(200)
        a0 = await pg.evaluate('window.__audioLog.length')
        await pg.locator('.obj').first.click(); await pg.wait_for_timeout(200)  # counting the same one twice
        check('count-once: re-tapping a counted object does not count it', 'f_already' in await pg.evaluate(f'window.__audioLog.slice({a0})'))
        for i in range(1, n): await pg.locator('.obj').nth(i).click(); await pg.wait_for_timeout(150)
        await choose_num(pg, step['k'])
    elif g == 'makeTen':
        await pg.locator('.play .tb').wait_for(timeout=20000)
        target = 9 if mistakes.get('make10') and step.get('phase') == 'probe' else 10
        if target == 9: mistakes.pop('make10')
        while (await board_state(pg))['n'] < target: await pg.locator('.tb-tray .piece').first.click(); await pg.wait_for_timeout(100)
        await idle(pg); await tap(pg, '.done')
        if target == 9: await idle(pg, 20000)
    elif g == 'moreQty':
        await pg.locator('.pic-card').first.wait_for(timeout=20000); await idle(pg)
        await tap(pg, f'.pic-card[data-v="{"a" if step["a"] > step["b"] else "b"}"]')
    elif g == 'addSub':
        await choose_num(pg, step['a'] + step['b'] if step['op'] == 'add' else step['a'] - step['b'])

async def geom(pg, a, b):
    g = await pg.evaluate('''() => { const L = document.querySelector('.cmp-line:last-of-type') ; const ls=[...document.querySelectorAll('.cmp-line')]; const l = ls[ls.length-1];
       const A = l.querySelector('.opA').getBoundingClientRect(), B = l.querySelector('.opB').getBoundingClientRect(), s = l.querySelector('.mid svg');
       return {ax: A.left, bx: B.left, open: s.dataset.open, at: l.querySelector('.opA').textContent, bt: l.querySelector('.opB').textContent} }''')
    ok_side = g['ax'] > g['bx']   # first number on the right, like the book
    big_right = a > b
    ok_open = (g['open'] == 'eq') if a == b else ((g['open'] == 'right') == big_right)
    check(f'compare {a} ? {b}: first number on the right & opening faces bigger', ok_side and ok_open, json.dumps(g, ensure_ascii=False))

async def play_until(pg, stop_pred, mistakes, maxsteps=200, tag=''):
    last = None; t0 = time.time()
    for _ in range(maxsteps):
        if (await pg.evaluate("document.body.dataset.screen")) != 'game':
            return 'home'
        s = await st(pg)
        if s is None:
            await pg.wait_for_timeout(250); continue
        key = (s['idx'], s['step']['g'], s['step'].get('phase'), s['step'].get('target'), s['step'].get('n'), s['step'].get('a'), s['step'].get('b'))
        if key == last:
            await pg.wait_for_timeout(250)
            if time.time() - t0 > 60:
                await pg.screenshot(path='/tmp/stuck.png'); check('step not stuck', False, f"{tag} {s} {await pg.evaluate('window.__audioLog.slice(-8)')}"); return 'stuck'
            continue
        last = key; t0 = time.time(); R['steps'] += 1
        print(tag, s['idx'], s['step']['g'], s['step'].get('phase',''), s['step'].get('target', s['step'].get('n', '')), flush=True)
        if stop_pred(s): return 'stop'
        await pg.wait_for_timeout(300)
        await layout(pg, f"{tag} #{s['idx']} {s['step']['g']}/{s['step'].get('phase', '')}")
        try:
            await solve(pg, s['step'], mistakes)
        except Exception as ex:
            await pg.screenshot(path='/tmp/fail.png')
            print('EXC', tag, s, await pg.evaluate("document.querySelector('.task-text') && document.querySelector('.task-text').textContent"), await pg.evaluate('window.__audioLog.slice(-8)'), str(ex)[:300])
            raise
        await pg.wait_for_timeout(200)
        await layout(pg, f"{tag} #{s['idx']} {s['step']['g']}/{s['step'].get('phase', '')} after")
    return 'max'

async def answer_lock(pg, wrong_first=True):
    await pg.locator('.modal').wait_for(timeout=3000)
    q = await pg.locator('.modal p').filter(has_text='×').inner_text()
    ar = '٠١٢٣٤٥٦٧٨٩'; nums = [int(''.join(str(ar.index(c)) for c in x)) for x in re.findall('[٠-٩]+', q)]
    if wrong_first:
        await pg.locator('.keys button[data-d="1"]').click(); await pg.locator('.modal .ok').click()
        await pg.wait_for_timeout(300)
        check('wrong lock answer changes nothing', await pg.locator('.modal').count() == 1 and await pg.evaluate("document.body.dataset.screen") == 'home')
        await pg.locator('.keys button[data-d="x"]').click()
    for d in str(nums[0] * nums[1]): await pg.locator(f'.keys button[data-d="{d}"]').click()
    await pg.locator('.modal .ok').click()

EXPECT_TITLES = {'u6l1': 'ص ٨ العددان ١١ و١٢', 'u6l2': 'ص ١٢ الأعداد ١٣ و١٤ و١٥', 'u6l3': 'ص ١٦ الأعداد ١٦ و١٧ و١٨', 'u6l4': 'ص ٢٠ العددان ١٩ و٢٠', 'u6l5': 'ص ٢٢ مقارنة الأعداد ضمن ٢٠'}
STATUS = {'new': 'لم يبدأ', 'learning': 'يتدرب', 'confirm': 'يتدرب', 'mastered': 'أتقنه'}
async def check_index(pg, tag):
    items = await pg.evaluate("[...document.querySelectorAll('.idx-lesson')].map(b => ({id: b.dataset.id, t: b.querySelector('.idx-t').innerText.replace(/\\s+/g,' ').trim(), s: b.querySelector('.idx-s').innerText.replace(' ★','').trim()}))")
    units = await pg.evaluate("[...document.querySelectorAll('.lindex .unit h3')].map(h => h.innerText)")
    stv = await pg.evaluate("JSON.parse(localStorage.getItem('riyadiyat-saf1-v1'))")
    want_s = {k: STATUS[(stv or {}).get('lessons', {}).get(k, {}).get('stage', 'new')] for k in EXPECT_TITLES}
    ok_t = [x['t'] for x in items] == list(EXPECT_TITLES.values())
    ok_s = all(x['s'] == want_s[x['id']] for x in items)
    check(f'index [{tag}]: book titles in order, grouped by unit 6..10, status matches progress', ok_t and ok_s and len(units) == 5 and units[0].startswith('الوحدة ٦'), json.dumps({'items': items, 'want': want_s, 'units': units}, ensure_ascii=False))

async def index_jump(pg, lid, child_first=False):
    if child_first:
        b0 = await pg.evaluate("JSON.stringify(JSON.parse(localStorage.getItem('riyadiyat-saf1-v1')).session)")
        await pg.locator(f'.idx-lesson[data-id="{lid}"]').click()
        await pg.locator('.modal').wait_for(timeout=3000)
        await pg.locator('.modal .cancel').click(); await pg.wait_for_timeout(500)
        b1 = await pg.evaluate("JSON.stringify(JSON.parse(localStorage.getItem('riyadiyat-saf1-v1')).session)")
        check('child tap on a lesson does not jump (needs the parent question)', await pg.evaluate("document.body.dataset.screen") == 'home' and await pg.locator('.modal').count() == 0 and b0 == b1)
    await pg.locator(f'.idx-lesson[data-id="{lid}"]').click()
    await answer_lock(pg, wrong_first=child_first)
    await pg.wait_for_function("document.body.dataset.screen === 'game' && window.__rs1", timeout=30000)
    pl = await pg.evaluate("({lesson: window.__rs1.plan.lesson, gs: window.__rs1.plan.steps.map(s => s.lesson || '')})")
    check(f'parent jump plays {lid} directly', pl['lesson'] == lid and all(x in ('', lid) for x in pl['gs']), json.dumps(pl)[:200])

async def open_parent(pg):
    btn = pg.locator('.parent-btn'); bb = await btn.bounding_box()
    await pg.mouse.move(bb['x'] + 10, bb['y'] + 10); await pg.mouse.down(); await pg.wait_for_timeout(600); await pg.mouse.up()
    check('short tap does not open the parent lock', await pg.locator('.modal').count() == 0)
    await pg.mouse.down(); await pg.wait_for_timeout(2300); await pg.mouse.up()
    await answer_lock(pg)
    await pg.locator('.screen.parent').wait_for(timeout=3000)

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await br.new_context(viewport={'width': W, 'height': H}, has_touch=True, is_mobile=W < 700, device_scale_factor=2, locale='ar')
        pg = await ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto(URL)
        await pg.evaluate("localStorage.clear(); localStorage.setItem('rs1-test-rate','3')")
        await pg.reload()
        await pg.locator('.comp-card').first.wait_for()
        await layout(pg, 'pick companion')
        await pg.locator('.comp-card[data-k="2"]').click()
        await pg.locator('.btn.start').wait_for(timeout=15000)
        await layout(pg, 'home')
        await check_index(pg, 'fresh')
        await pg.locator('.btn.start').click(); await pg.wait_for_function("document.body.dataset.screen === 'game' && window.__rs1", timeout=30000)
        mistakes = {'make10': True, 'drop': True, 'reverse': True, 'digits': True}
        # play until the middle of lesson 1 (first 'see' solo step), then reload
        r = await play_until(pg, lambda s: s['step'].get('lesson') == 'u6l1' and s['step']['g'] == 'see' and s['step'].get('phase') == 'solo', mistakes, tag='S1')
        check('placement rounds then warm-up for weak skill', r == 'stop' and await pg.evaluate("JSON.parse(localStorage.getItem('riyadiyat-saf1-v1')).foundation.skills.make10.status") in ('weak', 'ok'))
        plan_steps = await pg.evaluate("window.__rs1.plan.steps.map(s => s.g + ':' + (s.phase||'') + ':' + (s.skill||''))")
        check('warm-up items for the weak skill (make10) inserted before lesson', any(x.startswith('makeTen:warmup') for x in plan_steps), str([x for x in plan_steps if 'warm' in x]))
        before = await pg.evaluate("(() => { const s = JSON.parse(localStorage.getItem('riyadiyat-saf1-v1')); return {idx: s.session.idx, stars: s.stars, step: s.session.steps[s.session.idx]} })()")
        await pg.reload()
        await pg.locator('.btn.start').wait_for(timeout=15000)
        check('home offers to continue after reload', 'نكمل' in await pg.locator('.btn.start').inner_text())
        await pg.locator('.btn.start').click(); await pg.wait_for_function("document.body.dataset.screen === 'game' && window.__rs1", timeout=30000)
        await pg.wait_for_function('window.__rs1', timeout=20000)
        after = await st(pg)
        stars_after = await pg.evaluate("JSON.parse(localStorage.getItem('riyadiyat-saf1-v1')).stars")
        check('progress survives reload mid-game (same step, same stars)', after['idx'] == before['idx'] and json.dumps(after['step'], sort_keys=True) == json.dumps(before['step'], sort_keys=True) and stars_after == before['stars'], f"{before['idx']} vs {after['idx']}")
        r = await play_until(pg, lambda s: False, mistakes, tag='S1b')
        check('session 1 reaches the gentle close', r == 'home')
        await pg.locator('.bye').wait_for(timeout=20000)
        check('after the daily session the start button is replaced by "see you tomorrow"', await pg.locator('.btn.start').count() == 0)
        stv = await pg.evaluate("JSON.parse(localStorage.getItem('riyadiyat-saf1-v1'))")
        check('lesson 6-1 passed 2 independent examples -> waits for confirmation in a later session', stv['lessons']['u6l1']['stage'] in ('confirm',), stv['lessons']['u6l1']['stage'])
        check('greeting played (generic)', 't_welcome' in await pg.evaluate('window.__audioLog'))
        praises = [x for x in await pg.evaluate('window.__audioLog') if str(x).startswith('c_praise_')]
        check('praise phrases vary', len(set(praises)) >= 3, str(praises[:8]))
        check('game-end praise played', 't_done_game' in await pg.evaluate('window.__audioLog'))
        await check_index(pg, 'after session 1')
        await layout(pg, 'home with index')
        # lessons 2..5: the parent taps the lesson in the home index, answers the lock question, and it plays directly
        for lid in (['u6l2', 'u6l3', 'u6l4', 'u6l5'] if not SHORT else ['u6l5']):
            if lid in ('u6l2', 'u6l5'):
                await open_parent(pg)
                await layout(pg, 'parent panel')
                check('parent panel has no lesson dropdown any more', await pg.locator('select.school').count() == 0)
                if lid == 'u6l2':
                    txt = await pg.locator('.screen.parent .sum').inner_text()
                    check('parent summary sentence present', 'يحتاج' in txt or 'أتقن' in txt, txt)
                    check('parent panel lists real errors', await pg.locator('.errs li').count() >= 1)
                await pg.locator('.btn.close').click()
            await index_jump(pg, lid, child_first=(lid == 'u6l2'))
            mistakes['symbol'] = (lid == 'u6l5')
            r = await play_until(pg, lambda s: False, mistakes, tag=lid)
            check(f'{lid} session completes', r == 'home')
            stv = await pg.evaluate("JSON.parse(localStorage.getItem('riyadiyat-saf1-v1'))")
            check(f'{lid} passed (confirm stage)', stv['lessons'][lid]['stage'] in ('confirm', 'mastered'), stv['lessons'][lid]['stage'])
            await pg.locator('.lindex').wait_for(timeout=10000); await check_index(pg, f'after {lid}')
        # one ordinary session (extra session opened by the parent): reviews confirm lessons on another material
        await open_parent(pg); await pg.locator('.btn.extra').click(); await pg.locator('.btn.close').click()
        await pg.locator('.btn.start').click(); await pg.wait_for_function("document.body.dataset.screen === 'game' && window.__rs1", timeout=30000)
        r = await play_until(pg, lambda s: False, mistakes, tag='normal')
        check('ordinary session after the jumps completes', r == 'home')
        await pg.locator('.lindex').wait_for(timeout=10000); await check_index(pg, 'after ordinary session')
        stv = await pg.evaluate("JSON.parse(localStorage.getItem('riyadiyat-saf1-v1'))")
        if not SHORT:
            check('lesson 6-1 mastered after the confirmation in a later session on another material', stv['lessons']['u6l1']['stage'] == 'mastered', stv['lessons']['u6l1'])
            check('mastery praise/celebration played', 't_mastered' in await pg.evaluate('window.__audioLog'))
        # offline: service worker cached everything -> reload with network off
        await open_parent(pg)
        await pg.wait_for_function("() => /جاهز بدون نت/.test(document.querySelector('.offline').textContent)", timeout=60000)
        check('parent sees "جاهز بدون نت" after full download', True)
        await pg.locator('.btn.extra').click(); await pg.locator('.btn.close').click()
        await ctx.set_offline(True)
        await pg.reload()
        await pg.locator('.btn.start').wait_for(timeout=15000)
        check('offline reload shows the app', True)
        await pg.locator('.btn.start').click(); await pg.wait_for_function("document.body.dataset.screen === 'game' && window.__rs1", timeout=30000)
        r = await play_until(pg, lambda s: s['idx'] > 6, mistakes, tag='offline')
        bad_audio = [x for x in await pg.evaluate('window.__audioLog') if str(x).startswith('!')]
        check('offline: games run and audio files load from cache', r == 'stop' and not bad_audio, str(bad_audio[:5]))
        await ctx.set_offline(False)
        check('no JS errors', not [e for e in errs if 'Failed to load resource' not in e], str(errs[:5]))
        await br.close()
    R['ok'] = not R['fail'] and not R['layout_fail']
    json.dump(R, open(f'/tmp/e2e-{W}x{H}.json', 'w'), ensure_ascii=False, indent=1)
    print(json.dumps({'viewport': R['viewport'], 'steps': R['steps'], 'checks': len(R['checks']), 'fail': R['fail'], 'layout_fail': R['layout_fail'][:15], 'n_layout_fail': len(R['layout_fail'])}, ensure_ascii=False, indent=1))

asyncio.run(main())
