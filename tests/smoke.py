import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':360,'height':740}, device_scale_factor=2, has_touch=True, is_mobile=True)
        errs=[]
        pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto('http://localhost:8931/')
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path='/tmp/s1.png')
        await pg.click('.comp-card[data-k="1"]')
        await pg.wait_for_timeout(3500)
        await pg.screenshot(path='/tmp/s2.png')
        await pg.click('.start')
        await pg.wait_for_timeout(9000)
        await pg.screenshot(path='/tmp/s3.png')
        print(await pg.evaluate('document.body.dataset.step'))
        print('\n'.join(errs))
        await b.close()
asyncio.run(main())
