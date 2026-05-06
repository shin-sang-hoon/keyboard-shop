"""
Playwright stealth 다중 이미지 추출 (5-H D2).

네이버는 외부 자동화를 차단하므로 (curl, httpx, curl-cffi 모두 차단),
실제 브라우저로 detail page 를 띄워서 HTML 안의 PRELOADED_STATE 에서 추출.

추출 패턴 (2026-05-06 spike 검증):
  - window.__PRELOADED_STATE__ 안에 representativeImageUrl + optionalImageUrls
  - JSON-LD <script type="application/ld+json"> 의 image 필드 (백업)

사용:
  from app.playwright_image_extractor import extract_brand_images_batch
  results = await extract_brand_images_batch(["10310833443", ...])
"""

import asyncio
import json
import re
from typing import Optional

from playwright.async_api import async_playwright, Browser, BrowserContext, Page

# ── 패턴 (spike 검증) ───────────────────────────────────────────────────────

# representativeImageUrl: "https:\u002F\u002F..." 형태
REPRESENTATIVE_PATTERN = re.compile(
    r'"representativeImageUrl"\s*:\s*"([^"]+)"'
)

# optionalImageUrls: ["...", "...", ...] 형태 (배열)
OPTIONAL_PATTERN = re.compile(
    r'"optionalImageUrls"\s*:\s*\[([^\]]*)\]'
)

# 배열 안 개별 URL
ARRAY_URL_PATTERN = re.compile(r'"([^"]+)"')

# JSON-LD <script>
JSONLD_PATTERN = re.compile(
    r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
    re.DOTALL,
)

# 한 product 당 최대 갤러리 이미지
MAX_IMAGES = 10

# Referer 페이지 (자연스러운 행동 패턴)
REFERER_URL = "https://brand.naver.com/keychron"

# UA + 헤더
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


def _decode_url(raw: str) -> str:
    """\u002F → / 디코드 + ?type= 쿼리 정리 (가장 큰 사이즈로)"""
    url = raw.replace(r"\u002F", "/")
    # ?type=f200 같은 작은 사이즈 → ?type=o1000 (원본/큰 사이즈)
    # 단 originalImageUrl 이 별도면 그대로 두고, 갤러리만 사이즈 통일
    return url


def _extract_from_preloaded_state(html: str) -> tuple[Optional[str], list[str]]:
    """
    HTML 안의 window.__PRELOADED_STATE__ 에서 이미지 추출.

    Returns:
        (representative_url, optional_urls_list)
    """
    # representativeImageUrl 들 모두 (2~3 개 매칭, 마지막 값이 보통 메인 product 의 것)
    rep_matches = REPRESENTATIVE_PATTERN.findall(html)
    representative = _decode_url(rep_matches[-1]) if rep_matches else None

    # optionalImageUrls 배열 (보통 1개 매칭)
    opt_matches = OPTIONAL_PATTERN.findall(html)
    optional_urls: list[str] = []
    if opt_matches:
        # 마지막 매칭이 메인 product 의 것 (representativeImageUrl 과 동일 인덱스)
        array_content = opt_matches[-1]
        urls = ARRAY_URL_PATTERN.findall(array_content)
        optional_urls = [_decode_url(u) for u in urls]

    return representative, optional_urls


def _extract_from_jsonld(html: str) -> Optional[str]:
    """JSON-LD 의 Product image 필드 (backup, 단일 string)"""
    matches = JSONLD_PATTERN.findall(html)
    for raw in matches:
        try:
            data = json.loads(raw.strip())
            if isinstance(data, dict) and data.get("@type") == "Product":
                image_field = data.get("image")
                if isinstance(image_field, str):
                    return image_field
                elif isinstance(image_field, list) and image_field:
                    return image_field[0] if isinstance(image_field[0], str) else None
        except Exception:
            continue
    return None


def merge_images(rep: Optional[str], optional: list[str], jsonld: Optional[str]) -> list[str]:
    """대표 + 갤러리 + JSON-LD 합치고 중복 제거 + MAX 적용"""
    urls: list[str] = []
    if rep:
        urls.append(rep)
    urls.extend(optional)
    if jsonld and jsonld not in urls:
        urls.append(jsonld)
    # 중복 제거 (순서 유지)
    seen = set()
    deduped = []
    for u in urls:
        if u and u not in seen:
            seen.add(u)
            deduped.append(u)
    return deduped[:MAX_IMAGES]


async def _setup_browser() -> tuple:
    """stealth 브라우저 + context 생성"""
    p = await async_playwright().start()
    browser: Browser = await p.chromium.launch(
        headless=True,   # 본 실행은 headless (백그라운드)
        args=[
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-dev-shm-usage",
        ],
    )
    context: BrowserContext = await browser.new_context(
        user_agent=USER_AGENT,
        viewport={"width": 1280, "height": 800},
        locale="ko-KR",
        timezone_id="Asia/Seoul",
    )
    # stealth 스크립트
    await context.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', {get: () => false});
        Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3]});
        Object.defineProperty(navigator, 'languages', {get: () => ['ko-KR', 'ko', 'en-US', 'en']});
    """)
    return p, browser, context


async def extract_one(page: Page, source_id: str) -> dict:
    """
    keychron_* source_id 1개 → 다중 이미지 추출.

    Returns:
        {"sourceId": ..., "imageUrls": [...], "ok": bool, "error": str | None}
    """
    if not source_id.startswith("keychron_"):
        return {"sourceId": source_id, "imageUrls": [], "ok": False,
                "error": "not keychron source"}

    product_id = source_id[len("keychron_"):]
    url = f"https://brand.naver.com/keychron/products/{product_id}"

    try:
        response = await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        if not response or response.status != 200:
            return {"sourceId": source_id, "imageUrls": [], "ok": False,
                    "error": f"HTTP {response.status if response else 'no_response'}"}

        # 짧게 hydration 대기 (PRELOADED_STATE 가 즉시 들어있어서 networkidle 불필요)
        await page.wait_for_timeout(800)

        html = await page.content()

        # 차단 페이지인지 확인
        if len(html) < 50000 or "에러페이지" in html[:2000]:
            return {"sourceId": source_id, "imageUrls": [], "ok": False,
                    "error": "blocked or error page"}

        # 추출
        rep, optional = _extract_from_preloaded_state(html)
        jsonld_img = _extract_from_jsonld(html)
        urls = merge_images(rep, optional, jsonld_img)

        return {"sourceId": source_id, "imageUrls": urls, "ok": len(urls) > 0,
                "error": None if urls else "no images extracted"}

    except Exception as e:
        return {"sourceId": source_id, "imageUrls": [], "ok": False,
                "error": str(e)[:200]}


async def extract_brand_images_batch(
    source_ids: list[str],
    delay_seconds: float = 2.0,
    progress_every: int = 5,
) -> list[dict]:
    """
    keychron_* source_id 리스트 → 각각 detail page 띄워서 이미지 추출.

    - 사람처럼 천천히 (delay 2초)
    - referer page 한 번 방문 후 detail 들 순회 (세션 유지)
    - 한 product 가 실패해도 다음 진행
    """
    p, browser, context = await _setup_browser()
    page = await context.new_page()

    results: list[dict] = []

    # 자연스러운 진입 — referer page 방문
    print(f"[Playwright] referer 진입: {REFERER_URL}")
    try:
        await page.goto(REFERER_URL, wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_timeout(2000)
    except Exception as e:
        print(f"[Playwright] referer 실패 ({e}) — 계속 진행")

    print(f"[Playwright] {len(source_ids)}개 detail 추출 시작")

    success_count = 0
    fail_count = 0

    for idx, source_id in enumerate(source_ids):
        result = await extract_one(page, source_id)
        results.append(result)

        if result["ok"]:
            success_count += 1
        else:
            fail_count += 1

        if (idx + 1) % progress_every == 0 or idx == len(source_ids) - 1:
            print(
                f"  [Playwright] 진행 {idx + 1}/{len(source_ids)} — "
                f"성공 {success_count} / 실패 {fail_count}"
            )

        # 사람처럼 딜레이
        if idx < len(source_ids) - 1:
            await page.wait_for_timeout(int(delay_seconds * 1000))

    await browser.close()
    await p.stop()

    print(f"[Playwright] 완료 — 성공 {success_count} / 실패 {fail_count}")
    return results


# ── 단독 테스트용 ────────────────────────────────────────────────────────────

async def _test():
    """python -m app.playwright_image_extractor 로 직접 실행 시 keychron 1개 spike"""
    test_ids = ["keychron_10310833443"]
    results = await extract_brand_images_batch(test_ids, delay_seconds=0.5)
    for r in results:
        print(f"\n{r['sourceId']}:")
        print(f"  ok: {r['ok']}, error: {r['error']}")
        print(f"  imageUrls ({len(r['imageUrls'])}개):")
        for img in r["imageUrls"]:
            print(f"    - {img[:120]}")


if __name__ == "__main__":
    asyncio.run(_test())
