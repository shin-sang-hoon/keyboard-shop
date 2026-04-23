"""
brand.naver.com 상품 목록 API (ID 목록 소스) 탐색
"""
import asyncio
import json

CHANNEL_ID = "2sWDw1c6bldrOqZFkyltv"

async def debug():
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        )
        page = await context.new_page()

        # 모든 JSON 응답 캡처
        responses = []

        async def on_response(response):
            url = response.url
            if "brand.naver.com/n/" in url:
                try:
                    body = await response.json()
                    responses.append({"url": url, "body": body})
                except Exception:
                    pass

        page.on("response", on_response)

        url = f"https://brand.naver.com/keychron/products?pageNum=1&pagingSize=24"
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(4000)

        print(f"=== brand.naver.com/n/ API 응답 ({len(responses)}개) ===\n")
        for r in responses:
            body_str = json.dumps(r["body"], ensure_ascii=False)
            # ID 배열이 포함된 응답 찾기
            has_ids = isinstance(r["body"], list) and len(r["body"]) > 3
            has_product_ids = "productIds" in body_str or '"ids"' in body_str
            has_items = "items" in body_str or "products" in body_str.lower()

            print(f"URL: {r['url']}")
            print(f"  타입: {type(r['body']).__name__}, 길이힌트: {body_str[:150]}")
            print()

        await browser.close()

asyncio.run(debug())
