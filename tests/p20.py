"""New-design checks for the trial lesson ص ٢٠ (u6l4) + home world + index.
Plays the whole lesson with deliberate mistakes and checks: animations run (Web Animations API + event log),
predict-before-adding, drag ghost + landing preview + snap, auto-tie, undo (incl. undoing the auto-tie),
unbundle, error replays (over / under / wrong number / swapped digits), surprise + name praise,
garden grows, and that nothing on these screens is below the big-target minimum.
usage: python3 tests/p20.py [width height]"""
import asyncio, json, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
import e2e
from e2e import check, R, idle, tap, drag, choose_num, answer_lock, st, v2_board
from playwright.async_api import async_playwright
W, H = e2e.W, e2e.H
MIN_TAP, MIN_FONT = 64, 18
BIG_JS = r'''([minTap, minFont]) => {
  const bad = [];
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  for (const e of document.querySelectorAll('button, .card, .tile, .slot, .place, .idx-lesson, [role=button]')) {
    if (!vis(e) || e.closest('.hidden')) continue; const r = e.getBoundingClientRect();
    if (r.width < minTap - 0.5 || r.height < minTap - 0.5) bad.push('tap ' + (e.className || e.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) {
    if (!n.textContent.trim()) continue; const e = n.parentElement; if (!vis(e)) continue;
    const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < minFont - 0.1) bad.push('font ' + fs + 'px «' + n.textContent.trim().slice(0, 20) + '» in .' + e.className);
  }
  return [...new Set(bad)].slice(0, 12);
}'''
async def big(pg, tag):
    b = await pg.evaluate(BIG_JS, [MIN_TAP, MIN_FONT])
    R.setdefault('big', []).append(tag)
    check(f'big targets/text on [{tag}] (tap >= {MIN_TAP}px, text >= {MIN_FONT}px)', not b, '; '.join(b))
async def shot(pg, name): await pg.screenshot(path=f'/tmp/shots/p20_{W}_{name}.png')
async def log(pg): return await pg.evaluate('window.__v2log.slice()')
async def alog(pg): return await pg.evaluate('window.__audioLog.slice()')
async def wait_v2(pg, ev, n0, t=30000):
    await pg.wait_for_function(f"() => window.__v2log.slice({n0}).some(x => x.startsWith({json.dumps(ev)}))", timeout=t)
async def anims_during(pg, action):
    """run an action and sample how many Web Animations are running meanwhile"""
    await pg.evaluate("window.__anim = 0; window.__animT = setInterval(() => { window.__anim = Math.max(window.__anim, document.getAnimations().filter(a => a.playState === 'running').length) }, 30)")
    await action(); await pg.wait_for_timeout(500)
    return await pg.evaluate("clearInterval(window.__animT), window.__anim")

async def tray_drag_preview(pg):
    """drag a tray piece slowly: ghost follows the finger, the board shows the landing preview, drop snaps it in"""
    src = pg.locator('.v2board .tb-tray .piece').first; a = await src.bounding_box(); b = await pg.locator('.v2board .tb-board').bounding_box()
    await pg.mouse.move(a['x'] + a['width'] / 2, a['y'] + a['height'] / 2); await pg.mouse.down()
    tx, ty = b['x'] + b['width'] / 2, b['y'] + b['height'] * 0.75
    for k in range(1, 9): await pg.mouse.move(a['x'] + a['width'] / 2 + (tx - a['x'] - a['width'] / 2) * k / 8, a['y'] + a['height'] / 2 + (ty - a['y'] - a['height'] / 2) * k / 8)
    st_ = await pg.evaluate("() => ({ghost: !!document.querySelector('.ghost'), over: !!document.querySelector('.v2-area.over'), prev: getComputedStyle(document.querySelector('.v2-preview')).display})")
    await shot(pg, 'drag_preview')
    await pg.mouse.up()
    return st_

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await br.new_context(viewport={'width': W, 'height': H}, has_touch=True, is_mobile=W < 700, device_scale_factor=2, locale='ar')
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto(e2e.URL); await pg.evaluate("localStorage.clear(); localStorage.setItem('rs1-test-rate','3')"); await pg.reload()
        await pg.locator('.comp-card').first.wait_for(); await pg.wait_for_timeout(600)
        await big(pg, 'pick companion'); await shot(pg, 'pick')
        await pg.locator('.comp-card[data-k="1"]').click()
        await pg.locator('.world .btn.start').wait_for(timeout=15000); await pg.wait_for_timeout(1200)
        check('first tap greets with the built-in name', 'name_greet' in await alog(pg), str((await alog(pg))[:6]))
        await big(pg, 'home world'); await shot(pg, 'home')
        n_place = await pg.locator('.world .place').count(); imgs = await pg.evaluate("[...document.querySelectorAll('.world img, .idx-img')].every(i => i.complete && i.naturalWidth > 0)")
        check('world map with 5 places (one per lesson) and all images loaded', n_place == 5 and imgs, f'{n_place} {imgs}')
        await pg.locator('.lindex').scroll_into_view_if_needed(); await pg.wait_for_timeout(300)
        await big(pg, 'index'); await shot(pg, 'index')
        await e2e.check_index(pg, 'v2 fresh')
        # the place on the map asks the parent question too
        await pg.locator('.world .place[data-id="u6l4"]').click(); await answer_lock(pg, wrong_first=False)
        await pg.wait_for_function("document.body.dataset.screen === 'game' && window.__rs1", timeout=30000)
        pl = await pg.evaluate("window.__rs1.plan.lesson"); check('tapping the station on the map (+ parent question) opens ص ٢٠', pl == 'u6l4', pl)
        seen = set(); done_build_guided = done_solo = done_see_err = done_digits_err = False; last = None
        import time; T0 = time.time()
        while time.time() - T0 < 900:
            if await pg.evaluate("document.body.dataset.screen") != 'game': break
            s = await st(pg)
            if not s: await pg.wait_for_timeout(250); continue
            key = (s['idx'], json.dumps(s['step'], sort_keys=True))
            if key == last: await pg.wait_for_timeout(250); continue
            last = key; step = s['step']; g = step['g']; ph = step.get('phase', ''); print('step', s['idx'], g, ph, step.get('target', step.get('n', '')), flush=True)
            await pg.wait_for_timeout(300)
            if g in ('build', 'see', 'digits', 'story') and step.get('lesson', 'u6l4') == 'u6l4':
                check(f'v2 frame + scene on {g}/{ph}', await pg.evaluate("(() => { const g = document.querySelector('.game'); return g.classList.contains('v2') && !!g.dataset.scene && getComputedStyle(g).backgroundImage.includes('scene_') })()"))
            if g == 'build' and ph == 'demo':
                n0 = len(await log(pg))
                await wait_v2(pg, 'tie', n0, 60000); await shot(pg, 'demo_tied')
                L = (await log(pg))[n0:]
                check('demo: companion points, balloon flies + inflates, second ten ties itself', all(x in L for x in ('point', 'add', 'inflate', 'tie')), str(L))
                b = await v2_board(pg); check('demo: 19 + 1 -> two tens, no ones', b == {'n': 20, 'tens': 2, 'loose': 0}, str(b))
                await pg.locator('.num-cards .card.right').wait_for(timeout=60000); await big(pg, 'demo end'); seen.add('demo'); continue
            if g == 'build' and ph == 'guided':
                n0 = len(await log(pg))
                await pg.locator('.predict .card').first.wait_for(timeout=30000); await idle(pg); await pg.wait_for_timeout(300)
                await big(pg, 'predict'); await shot(pg, 'predict')
                a0 = len(await alog(pg))
                await tap(pg, '.predict .card[data-v="10"]')
                await pg.locator('.predict').wait_for(state='detached', timeout=20000)
                A = (await alog(pg))[a0:]; check('predict before adding (not graded): wrong guess -> "let us see"', 'predict' in (await log(pg)) and 'v_predict_see' in A, str(A))
                await idle(pg, 30000); await big(pg, 'guided board'); await shot(pg, 'guided')
                d = await tray_drag_preview(pg)
                check('drag: ghost follows the finger + landing preview on the board', d['ghost'] and d['over'] and d['prev'] == 'block', str(d))
                await wait_v2(pg, 'tie', n0); await idle(pg, 30000)
                b = await v2_board(pg); check('drop snaps in -> 20 forms the second ten (auto-tie)', b == {'n': 20, 'tens': 2, 'loose': 0}, str(b))
                L = (await log(pg))[n0:]; check('drop: add + inflate + tie events', all(x in L for x in ('add', 'inflate', 'tie')), str(L))
                # undo undoes the automatic tie and the added balloon
                k = await anims_during(pg, lambda: tap(pg, '.v2board .undo')); await idle(pg)
                b = await v2_board(pg); check('undo: un-ties and sends the balloon back (19 = ten + nine)', b == {'n': 19, 'tens': 1, 'loose': 9} and k > 0, f'{b} anims {k}')
                # unbundle: tap the bundle -> ten loose balloons again
                k = await anims_during(pg, lambda: tap(pg, '.v2board .v2-bundle')); await idle(pg, 30000)
                b = await v2_board(pg); check('unbundle: tap a ten -> its ten balloons come apart (same amount)', b == {'n': 19, 'tens': 0, 'loose': 19} and k > 0 and 'untie' in await log(pg), f'{b} anims {k}')
                await shot(pg, 'untied')
                a0 = len(await alog(pg)); await tap(pg, '.v2board .done'); await pg.wait_for_timeout(500); await idle(pg, 30000)
                check('"done" with ten loose ones -> companion points at the tie button (h_tie_first)', 'h_tie_first' in (await alog(pg))[a0:])
                await tap(pg, '.v2board .undo'); await idle(pg)
                b = await v2_board(pg); check('undo of an unbundle re-ties the ten', b == {'n': 19, 'tens': 1, 'loose': 9}, str(b))
                await pg.locator('.v2board .tb-tray .piece').first.click(); await pg.wait_for_function("document.querySelector('.v2board').dataset.tens === '2'", timeout=20000)
                await idle(pg, 30000); await tap(pg, '.v2board .done'); await choose_num(pg, 20); done_build_guided = True; continue
            if g == 'see' and not done_see_err and step.get('lesson', 'u6l4') == 'u6l4':
                await pg.locator('.num-cards .card').first.wait_for(timeout=30000); await idle(pg)
                wrongs = [v for v in await pg.evaluate("[...document.querySelectorAll('.num-cards .card')].map(c => +c.dataset.v)") if v != step['n']]
                n0 = len(await log(pg)); await tap(pg, f'.num-cards .card[data-v="{wrongs[0]}"]')
                await wait_v2(pg, 'replay', n0); await pg.wait_for_timeout(400); await shot(pg, 'see_err')
                pt = await pg.evaluate("!!document.querySelector('.comp-avatar.pointing')")
                await idle(pg, 40000)
                L = (await log(pg))[n0:]; check('wrong number card -> companion goes to the picture and the count is replayed', pt and any(x.startswith('replay:') for x in L) and 'point' in L, f'{L} pointing={pt}')
                check('wrong card is disabled, he chooses again himself', await pg.locator(f'.num-cards .card[data-v="{wrongs[0]}"]').is_disabled())
                await tap(pg, f'.num-cards .card[data-v="{step["n"]}"]'); done_see_err = True; continue
            if g == 'build' and ph == 'solo' and not done_solo:
                await pg.locator('.v2board:not(.static)').wait_for(timeout=30000); await idle(pg, 30000)
                t = step['target']; a0 = len(await alog(pg)); n0 = len(await log(pg))
                # under: says done too early
                await tap(pg, '.v2board .done'); await wait_v2(pg, 'replay:count', n0); await idle(pg, 60000)
                check('too few -> count replayed (each piece hops) + "add more"', 'v_need_more' in (await alog(pg))[a0:])
                while (await v2_board(pg))['n'] < t + 1:
                    await pg.locator('.v2board .tb-tray .piece').first.click(); await pg.wait_for_timeout(200); await idle(pg, 30000)
                n0 = len(await log(pg)); await tap(pg, '.v2board .done'); await wait_v2(pg, 'morph', n0); await pg.wait_for_timeout(300); await shot(pg, 'over_err')
                await idle(pg, 60000)
                L = (await log(pg))[n0:]; check('one too many -> the amount is shown, companion points at undo', 'replay:over' in L and any(x.startswith('morph:') for x in L) and await pg.locator('.v2board .undo.glow').count() == 1, str(L))
                await tap(pg, '.v2board .undo'); await idle(pg)
                b = await v2_board(pg); check('he fixes it himself with undo', b['n'] == t, str(b))
                await tap(pg, '.v2board .done'); await choose_num(pg, t); done_solo = True; continue
            if g == 'digits' and not done_digits_err:
                await pg.locator('.tile').first.wait_for(timeout=30000); await idle(pg)
                tt, o = divmod(step['n'], 10); n0 = len(await log(pg))
                await tap(pg, f'.tile[data-d="{o}"]'); await tap(pg, f'.tile[data-d="{tt}"]')
                await wait_v2(pg, 'morph', n0); await pg.wait_for_timeout(500); await shot(pg, 'swap_err')
                shown = await pg.evaluate("+document.querySelector('.v2board').dataset.shown")
                await idle(pg, 60000)
                L = (await log(pg))[n0:]
                check('swapped digits -> the picture turns into the wrong amount, then back; slots cleared', 'replay:swap' in L and shown == o * 10 + tt and f'morph:{step["n"]}' in L and await pg.evaluate("[...document.querySelectorAll('.slot')].every(s => !s.textContent.trim())"), f'{L} shown={shown}')
                await big(pg, 'digits')
                await tap(pg, f'.tile[data-d="{tt}"]'); await pg.wait_for_timeout(150); await drag(pg, pg.locator(f'.tile[data-d="{o}"]'), '.slot.s-ones'); done_digits_err = True; continue
            if g == 'story':
                await pg.locator('.v2story').wait_for(timeout=30000); await pg.wait_for_timeout(500); await shot(pg, 'story'); await big(pg, 'story')
            if g == 'gameEnd':
                a0 = len(await alog(pg)); st0 = await pg.evaluate("(JSON.parse(localStorage.getItem('riyadiyat-saf1-v1')).stickers || []).length")
                await pg.locator('.surprise .gift').wait_for(timeout=20000); await big(pg, 'surprise'); await shot(pg, 'gift')
                await pg.locator('.surprise .gift').click(); await pg.wait_for_timeout(1200); await shot(pg, 'sticker')
                await pg.locator('.surprise').wait_for(state='detached', timeout=40000)
                A = (await alog(pg))[a0:]; st1 = await pg.evaluate("(JSON.parse(localStorage.getItem('riyadiyat-saf1-v1')).stickers || []).length")
                check('surprise after the game: gift opens, sticker saved, name praise + end praise', st1 == st0 + 1 and 'name_praise' in A and 't_done_game' in A, f'{A} stickers {st0}->{st1}'); continue
            if g in ('build', 'see', 'digits', 'story'):
                await big(pg, f'{g}/{ph}')
            await e2e.solve(pg, step, {})
        A = await alog(pg)
        pr = [x for x in A if str(x).startswith('c_praise_') or x == 'name_praise']
        check('correct answers: name praise alternates with varied generic praise', 'name_praise' in pr and len(set(x for x in pr if x != 'name_praise')) >= 2, str(pr))
        check('all stages of ص ٢٠ visited', done_build_guided and done_solo and done_see_err and done_digits_err and 'demo' in seen)
        await pg.locator('.world').wait_for(timeout=30000); await pg.wait_for_timeout(800)
        g2 = await pg.evaluate("({fl: document.querySelectorAll('.garden2 .fl').length, stk: document.querySelectorAll('.garden2 .stk').length, stars: JSON.parse(localStorage.getItem('riyadiyat-saf1-v1')).stars})")
        check('the garden grows with his stars and shows the new sticker', g2['fl'] >= 1 and g2['stk'] >= 1 and g2['fl'] == min(g2['stars'], 48), str(g2))
        await shot(pg, 'home_after'); await big(pg, 'home after')
        await e2e.open_parent(pg); await big(pg, 'parent panel'); await shot(pg, 'parent')
        txt = await pg.locator('.screen.parent').inner_text()
        check('parent panel says the name is built in and recordings override it', 'مدمج' in txt and 'بدل المقطع المدمج' in txt)
        check('no JS errors', not [e for e in errs if 'Failed to load resource' not in e], str(errs[:5]))
        await br.close()
    R['ok'] = not R['fail']
    json.dump(R, open(f'/tmp/p20-{W}x{H}.json', 'w'), ensure_ascii=False, indent=1)
    print(json.dumps({'viewport': f'{W}x{H}', 'checks': len(R['checks']), 'passed': sum(1 for c in R['checks'] if c[1]), 'fail': R['fail']}, ensure_ascii=False, indent=1))
asyncio.run(main())
