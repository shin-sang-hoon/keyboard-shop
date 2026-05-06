"""
스웨그키 (swagkey.kr) 2-tier 풀 크롤러 v2 (5-H D2 후속).

발견된 사이트 구조 (3-tier):
  /{cate_id}                       카테고리 페이지 (예: /109 Keyboards)
    ├─ /{prd_no}                   브랜드 hub (예: /1816928659 Swagkeys)
    │    └─ /{prd_no}/?idx={N}     진짜 상품 detail (예: ?idx=1785 Smurve80)
    └─ /{cate_id}/?idx={N}         직접 노출 상품 (예: /109/?idx=1747 NEO75)

진짜 상품 = /{anything}/?idx={N} 형식 (idx 가 있어야 진짜).

크롤 전략:
  Tier 1) /109 카테고리 → href 수집:
            (a) /{N자리}            → brand hub set 에 추가
            (b) /{cate}/?idx={N}    → product set 에 직접 추가
  Tier 2) brand hub 각각 → /{brand_no}/?idx={N} 수집 → product set
  Tier 3) product set 각각 → detail 추출

source_id = swagkey_{prd_no}_{idx}  (unique)

면접 자산:
  "/109 listing 만 긁으면 126개 brand hub 가 잡혔지만 진짜 상품이 아니었다.
   각각이 시리즈 hub 페이지라 그 안에 다시 /{prd_no}/?idx={N} 형식의 진짜
   상품 22개씩 들어 있었음. 1-tier 가정이 깨져서 2-tier 크롤로 재설계."

D1 (5/2) 다중 이미지 패턴 그대로 재사용 (clean-replace).
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from datetime import datetime
from typing import Any, Optional

import httpx
from playwright.async_api import Page, async_playwright

logger = logging.getLogger(__name__)

# ── 환경 ─────────────────────────────────────────────────────────────────
BASE = "https://www.swagkey.kr"
SPRING_URL = os.getenv("SPRING_URL", "http://localhost:8080")
INTERNAL_KEY = os.getenv("INTERNAL_API_KEY", "keyboard-internal-secret-key")
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

# 카테고리 매핑 — 사용자 직접 확인한 6 카테고리
CATEGORIES: dict[str, dict[str, str]] = {
    "Keyboards":   {"cate_id": "109", "product_type": "KEYBOARD"},
    "Switches":    {"cate_id": "21",  "product_type": "SWITCH_PART"},
    "Keycaps":     {"cate_id": "23",  "product_type": "ACCESSORY"},
    "Accessories": {"cate_id": "24",  "product_type": "ACCESSORY"},
    "Lubricants":  {"cate_id": "26",  "product_type": "ACCESSORY"},
    "Deskpads":    {"cate_id": "25",  "product_type": "ACCESSORY"},
}

CHUNK_SIZE = 30  # batch upsert 청크 크기

# ── Tier 1: 카테고리 listing 분석 ───────────────────────────────────────

async def collect_from_listing(
    page: Page, cate_id: str
) -> tuple[set[str], set[tuple[str, str]]]:
    """
    카테고리 페이지에서 brand hub 와 직접 상품 분리 수집.

    Returns:
        (brand_hubs, direct_products)
        - brand_hubs: {"1816928659", "206892977", ...}  (Tier 2 진입할 prd_no 들)
        - direct_products: {("109", "1747"), ...}        (즉시 detail 추출할 (prd_no, idx) 페어)
    """
    url = f"{BASE}/{cate_id}"
    logger.info(f"[Tier 1] 카테고리 listing 진입: {url}")
    await page.goto(url, wait_until="domcontentloaded", timeout=20000)
    await page.wait_for_timeout(2500)

    brand_hubs: set[str] = set()
    direct_products: set[tuple[str, str]] = set()  # (prd_no, idx)

    # 모든 a 태그 href 수집
    hrefs: set[str] = set()
    for a in await page.locator("a").all():
        try:
            href = await a.get_attribute("href", timeout=300)
            if href:
                hrefs.add(href)
        except Exception:
            pass

    for href in hrefs:
        # /{prd_no}/?idx={N} 또는 /{cate_id}/?idx={N} 둘 다 매칭
        m_idx = re.match(r"^/(\d{2,})/?\?idx=(\d+)", href)
        if m_idx:
            direct_products.add((m_idx.group(1), m_idx.group(2)))
            continue
        # /{prd_no} (idx 없음, 6자리 이상) — brand hub 후보
        m_hub = re.match(r"^/(\d{6,})/?$", href)
        if m_hub:
            brand_hubs.add(m_hub.group(1))

    logger.info(
        f"[Tier 1] {url} → brand_hubs={len(brand_hubs)}, direct_products={len(direct_products)}"
    )
    return brand_hubs, direct_products


# ── Tier 2: brand hub 안의 진짜 상품 수집 ───────────────────────────────

async def collect_from_brand_hub(
    page: Page, brand_no: str
) -> set[tuple[str, str]]:
    """
    brand hub 페이지에서 /{brand_no}/?idx={N} 형식 진짜 상품 수집.

    Returns:
        {(brand_no, idx), ...}
    """
    url = f"{BASE}/{brand_no}"
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_timeout(2000)
    except Exception as e:
        logger.warning(f"  [Tier 2] hub 진입 실패 {brand_no}: {e}")
        return set()

    products: set[tuple[str, str]] = set()
    for a in await page.locator("a[href*='?idx=']").all():
        try:
            href = await a.get_attribute("href", timeout=300)
            if not href:
                continue
            # /{any_prd_no}/?idx={N}
            m = re.match(r"^/(\d+)/?\?idx=(\d+)", href)
            if m:
                products.add((m.group(1), m.group(2)))
        except Exception:
            pass

    return products


# ── Tier 3: 진짜 상품 detail 추출 ───────────────────────────────────────

SITE_NAME_TITLE = "스웨그키 공식 온라인 스토어"


async def extract_detail(
    page: Page, prd_no: str, idx: str, product_type: str
) -> Optional[dict[str, Any]]:
    """
    /{prd_no}/?idx={idx} detail 페이지 추출.

    - title: <title> 텍스트 ('xxx : 스웨그키 공식 온라인 스토어' 형식 → 앞 부분)
    - price: [class*='price'] 첫 번째
    - images: img[src*='swagkey']

    Returns:
        UpsertRequest dict 또는 None (404/파싱 실패)
    """
    detail_url = f"{BASE}/{prd_no}/?idx={idx}"
    try:
        await page.goto(detail_url, wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(2000)

        # 1) title 추출 — '상품명 : 스웨그키 공식 온라인 스토어' 형식
        title_raw = (await page.title() or "").strip()
        # 404 회피
        if "404" in title_raw or "Not Found" in title_raw or not title_raw:
            logger.warning(f"  [Tier 3] 404 skip: {detail_url}")
            return None
        # ' : 스웨그키 공식 온라인 스토어' suffix 제거
        if " : " in title_raw:
            name = title_raw.split(" : ")[0].strip()
        else:
            name = title_raw
        # 사이트명만 그대로면 skip (h1 fallback 시도)
        if name == SITE_NAME_TITLE or name.startswith(SITE_NAME_TITLE):
            try:
                h1 = (await page.locator("h1").first.text_content(timeout=500) or "").strip()
                if h1 and h1 != "404":
                    name = h1
                else:
                    logger.warning(f"  [Tier 3] name 추출 실패 skip: {detail_url}")
                    return None
            except Exception:
                logger.warning(f"  [Tier 3] name 추출 실패 skip: {detail_url}")
                return None

        if not name or len(name) < 2:
            return None

        # 2) price 추출
        price = 0
        for sel in [
            "[class*='price']",
            "[id*='price']",
            "strong.price",
            ".sale_price",
        ]:
            try:
                if await page.locator(sel).count() > 0:
                    txt = (
                        await page.locator(sel).first.text_content(timeout=500)
                    ) or ""
                    # '29,000원' → 29000
                    digits = re.sub(r"[^\d]", "", txt)
                    if digits:
                        price = int(digits)
                        break
            except Exception:
                pass

        # 3) images 수집 — img[src*='swagkey'] 또는 img[src*='/cdn/']
        image_urls: list[str] = []
        seen_imgs: set[str] = set()
        img_selectors = [
            "img[src*='swagkey']",
            "img[src*='cdn']",
            "img[src*='product']",
            "img[src*='upload']",
        ]
        for sel in img_selectors:
            try:
                imgs = await page.locator(sel).all()
                for img in imgs:
                    src = await img.get_attribute("src", timeout=300)
                    if not src:
                        continue
                    # 정규화
                    if src.startswith("//"):
                        src = "https:" + src
                    elif src.startswith("/"):
                        src = BASE + src
                    elif not src.startswith("http"):
                        continue
                    # 중복 제거 + 흔한 logo/icon 제외
                    if src in seen_imgs:
                        continue
                    if any(
                        k in src.lower()
                        for k in ["logo", "icon", "favicon", "btn", "blank.gif"]
                    ):
                        continue
                    seen_imgs.add(src)
                    image_urls.append(src)
                if image_urls:
                    break  # 한 selector 에서 충분히 찾았으면 stop
            except Exception:
                pass

        if not image_urls:
            logger.warning(f"  [Tier 3] image 0장 skip: {detail_url}")
            return None

        return {
            "source_id": f"swagkey_{prd_no}_{idx}",
            "name": name[:200],
            "image_urls": image_urls[:10],  # 최대 10장
            "price": price,
            "product_type": product_type,
            "detail_url": detail_url,
        }

    except Exception as e:
        logger.warning(f"  [Tier 3] 추출 실패 {detail_url}: {e}")
        return None


# ── Spring 적재 ──────────────────────────────────────────────────────────

async def upsert_to_spring(products: list[dict[str, Any]]) -> dict[str, Any]:
    """
    /api/internal/crawler/upsert-batch 청크 분할 적재.
    """
    if not products:
        return {
            "totalCreated": 0,
            "totalUpdated": 0,
            "totalFailed": 0,
            "totalImages": 0,
            "chunks": [],
        }

    chunks = [
        products[i : i + CHUNK_SIZE] for i in range(0, len(products), CHUNK_SIZE)
    ]
    summary = {
        "totalCreated": 0,
        "totalUpdated": 0,
        "totalFailed": 0,
        "totalImages": 0,
        "chunks": [],
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        for idx, chunk in enumerate(chunks):
            chunk_label = f"{idx + 1}/{len(chunks)}"
            payload = {
                "siteName": "swagkey",
                "siteUrl": BASE,
                "products": [
                    {
                        "sourceId": p["source_id"],
                        "name": p["name"],
                        "imageUrls": p["image_urls"],
                        "price": p.get("price", 0),
                        "productType": p.get("product_type", "UNCLASSIFIED"),
                        "productUrl": p.get("detail_url"),
                    }
                    for p in chunk
                ],
            }
            try:
                logger.info(f"[upsert {chunk_label}] {len(chunk)}개 전송")
                res = await client.post(
                    f"{SPRING_URL}/api/internal/crawler/upsert-batch",
                    headers={"X-Internal-Key": INTERNAL_KEY},
                    json=payload,
                )
                res.raise_for_status()
                data = res.json()
                summary["totalCreated"] += data.get("created", 0)
                summary["totalUpdated"] += data.get("updated", 0)
                summary["totalFailed"] += data.get("failed", 0)
                summary["totalImages"] += data.get("totalImages", 0)
                summary["chunks"].append(
                    {
                        "chunk": chunk_label,
                        "size": len(chunk),
                        "created": data.get("created", 0),
                        "updated": data.get("updated", 0),
                        "totalImages": data.get("totalImages", 0),
                    }
                )
                logger.info(
                    f"  → 성공: created={data.get('created', 0)}, "
                    f"updated={data.get('updated', 0)}, "
                    f"images={data.get('totalImages', 0)}"
                )
            except httpx.HTTPStatusError as e:
                logger.warning(
                    f"  청크 {chunk_label} HTTP 실패: {e.response.status_code}"
                )
                summary["totalFailed"] += len(chunk)
                summary["chunks"].append(
                    {
                        "chunk": chunk_label,
                        "size": len(chunk),
                        "error": f"HTTP {e.response.status_code}",
                    }
                )
            except Exception as e:
                logger.warning(f"  → 예외 {chunk_label}: {e}")
                summary["totalFailed"] += len(chunk)
                summary["chunks"].append(
                    {
                        "chunk": chunk_label,
                        "size": len(chunk),
                        "error": str(e)[:100],
                    }
                )

    return summary


# ── 메인 진입점 ──────────────────────────────────────────────────────────

async def run_swagkey_crawl(
    sample_per_category: Optional[int] = None,
    target_categories: Optional[list[str]] = None,
    max_brand_hubs: Optional[int] = None,
    headless: bool = True,
    delay_seconds: float = 1.5,
) -> dict[str, Any]:
    """
    스웨그키 2-tier 풀 크롤 메인.

    Args:
        sample_per_category: 카테고리당 최대 추출 상품 수 (테스트용 None=전체)
        target_categories: 처리할 카테고리 이름 리스트 (None=전체)
        max_brand_hubs: brand hub 최대 진입 수 (테스트용 None=전체)
        headless: Playwright headless 모드
        delay_seconds: detail 사이 sleep
    """
    started_at = datetime.now()
    cats = target_categories or list(CATEGORIES.keys())
    logger.info(f"[swagkey v2] 시작 — categories={cats}, sample={sample_per_category}")

    # ── 수집 단계 ────────────────────────────────────────────
    # (prd_no, idx, product_type) 통합 set
    all_products: set[tuple[str, str, str]] = set()
    tier_stats = {
        "categories": {},
        "brand_hubs_total": 0,
        "direct_products_total": 0,
        "hub_products_total": 0,
    }

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=headless)
        context = await browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1280, "height": 800},
        )
        page = await context.new_page()

        # ── Tier 1 + Tier 2 수집 ───────────────────────────────
        for cat_name in cats:
            if cat_name not in CATEGORIES:
                logger.warning(f"  unknown category {cat_name}, skip")
                continue

            cate_id = CATEGORIES[cat_name]["cate_id"]
            product_type = CATEGORIES[cat_name]["product_type"]

            # Tier 1
            brand_hubs, direct_products = await collect_from_listing(page, cate_id)

            cat_stats = {
                "brand_hubs": len(brand_hubs),
                "direct_products": len(direct_products),
                "hub_products": 0,
            }
            tier_stats["brand_hubs_total"] += len(brand_hubs)
            tier_stats["direct_products_total"] += len(direct_products)

            # 직접 상품들 add
            for prd_no, idx in direct_products:
                all_products.add((prd_no, idx, product_type))

            # Tier 2: brand hub 들 진입
            hubs_to_crawl = list(brand_hubs)
            if max_brand_hubs is not None:
                hubs_to_crawl = hubs_to_crawl[:max_brand_hubs]

            for hi, brand_no in enumerate(hubs_to_crawl):
                hub_products = await collect_from_brand_hub(page, brand_no)
                cat_stats["hub_products"] += len(hub_products)
                tier_stats["hub_products_total"] += len(hub_products)
                for prd_no, idx in hub_products:
                    all_products.add((prd_no, idx, product_type))

                if (hi + 1) % 10 == 0:
                    logger.info(
                        f"  [Tier 2] {cat_name}: {hi + 1}/{len(hubs_to_crawl)} hub 처리"
                    )

                await asyncio.sleep(delay_seconds * 0.5)

            tier_stats["categories"][cat_name] = cat_stats
            logger.info(
                f"[{cat_name}] hubs={cat_stats['brand_hubs']}, "
                f"direct={cat_stats['direct_products']}, "
                f"hub_products={cat_stats['hub_products']}"
            )

        # ── Tier 3: detail 추출 ──────────────────────────────
        product_list = list(all_products)

        # 카테고리별 sample_per_category 적용
        if sample_per_category is not None:
            sampled: list[tuple[str, str, str]] = []
            seen_per_cat: dict[str, int] = {}
            for prd_no, idx, ptype in product_list:
                cnt = seen_per_cat.get(ptype, 0)
                if cnt < sample_per_category:
                    sampled.append((prd_no, idx, ptype))
                    seen_per_cat[ptype] = cnt + 1
            product_list = sampled

        logger.info(
            f"[Tier 3] 추출 시작 — 총 {len(product_list)}개 product "
            f"(distinct prd_no+idx)"
        )

        extracted: list[dict[str, Any]] = []
        success = 0
        fail = 0
        total_images = 0

        for ti, (prd_no, idx, ptype) in enumerate(product_list):
            detail = await extract_detail(page, prd_no, idx, ptype)
            if detail:
                extracted.append(detail)
                success += 1
                total_images += len(detail["image_urls"])
            else:
                fail += 1

            if (ti + 1) % 10 == 0:
                logger.info(
                    f"  [Tier 3] 진행 {ti + 1}/{len(product_list)} — "
                    f"성공 {success}, 실패 {fail}"
                )

            await asyncio.sleep(delay_seconds)

        await browser.close()

    logger.info(
        f"[Tier 3] 완료 — 성공 {success}, 실패 {fail}, 총 이미지 {total_images}장"
    )

    # ── 적재 단계 ────────────────────────────────────────────
    spring_summary = await upsert_to_spring(extracted)
    ended_at = datetime.now()

    return {
        "mode": "swagkey_2tier_crawl_v2",
        "started_at": started_at.isoformat(),
        "ended_at": ended_at.isoformat(),
        "elapsed_seconds": (ended_at - started_at).total_seconds(),
        "categories": cats,
        "tier_stats": tier_stats,
        "extract_stats": {
            "total_products_unique": len(product_list),
            "success": success,
            "failed": fail,
            "total_images": total_images,
        },
        "spring_summary": spring_summary,
    }
