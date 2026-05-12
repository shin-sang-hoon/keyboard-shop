"""
스웨그키 (swagkey.kr) 2-tier 풀 크롤러 v3 (이미지 매핑 버그 fix).

이전 버전 (v2) 의 문제:
  - img[src*='cdn'] selector 가 헤더 로고 (cdn.imweb.me/thumbnail/cfe04b...png) 도
    매칭 → DOM 순서상 헤더 로고가 먼저 잡혀서 모든 상품 114개가 동일 URL 로 저장됨.

v3 변경 (2026-05-09):
  - 이미지 추출 로직을 extract_images() 로 분리.
  - og:image meta 태그 우선 (메인 이미지 1장 보장).
  - cdn-optimized.imweb.me 도메인만 매칭 (실제 상품 이미지).
    cdn.imweb.me 는 헤더/푸터/UI 이미지라 차단.
  - 파일 ID 기준 dedup (같은 사진의 다른 사이즈 버전 중복 방지).

면접 자산:
  "이전엔 모든 swagkey 상품이 같은 헤더 로고 URL 로 저장된 버그. DOM 분석 결과
   사이트가 두 CDN 도메인을 분리 사용하는 것을 발견 (cdn.imweb.me=UI 이미지,
   cdn-optimized.imweb.me=상품 이미지). 단일 selector + first-match 의 문제를
   og:image meta + 도메인 화이트리스트로 정확히 해결."
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
    """
    url = f"{BASE}/{cate_id}"
    logger.info(f"[Tier 1] 카테고리 listing 진입: {url}")
    await page.goto(url, wait_until="domcontentloaded", timeout=20000)
    await page.wait_for_timeout(2500)

    brand_hubs: set[str] = set()
    direct_products: set[tuple[str, str]] = set()

    hrefs: set[str] = set()
    for a in await page.locator("a").all():
        try:
            href = await a.get_attribute("href", timeout=300)
            if href:
                hrefs.add(href)
        except Exception:
            pass

    for href in hrefs:
        m_idx = re.match(r"^/(\d{2,})/?\?idx=(\d+)", href)
        if m_idx:
            direct_products.add((m_idx.group(1), m_idx.group(2)))
            continue
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
            m = re.match(r"^/(\d+)/?\?idx=(\d+)", href)
            if m:
                products.add((m.group(1), m.group(2)))
        except Exception:
            pass

    return products


# ── Tier 3: 진짜 상품 detail 추출 ───────────────────────────────────────

SITE_NAME_TITLE = "스웨그키 공식 온라인 스토어"


def _file_id(url: str) -> str:
    """URL 에서 파일명만 추출 (확장자 + query 제외).

    예: https://cdn-optimized.imweb.me/thumbnail/20251218/1096ea89c0b80.jpg?w=750
        → '1096ea89c0b80'

    같은 이미지의 다른 사이즈 버전 (?w=750 vs ?w=1200) 중복 제거 용도.
    """
    try:
        path = url.split("?", 1)[0]                 # query 제거
        filename = path.rsplit("/", 1)[-1]          # 파일명만
        return filename.rsplit(".", 1)[0]           # 확장자 제거
    except Exception:
        return url


async def extract_images(page: Page) -> list[str]:
    """
    상품 이미지 추출 v3 (2026-05-09 fix).

    전략:
      1) og:image meta 태그 → 메인 이미지 1장 (가장 안정)
      2) img[src*='cdn-optimized.imweb.me'] → 페이지 내 갤러리
      3) 파일 ID (e.g. '1096ea89c0b80') 기준 dedup

    차단:
      - cdn.imweb.me/thumbnail/ (cdn-optimized 없음): 헤더/푸터 UI 이미지.
        예: cfe04b2239733.png (사이트 로고), c90cf3f32a4af.png (모바일 로고).
      - logo / icon / favicon / btn / blank.gif 키워드 포함 URL.

    Returns:
        최대 10장. 0장이면 호출자가 skip.
    """
    image_urls: list[str] = []
    seen_ids: set[str] = set()

    def _add(url: str) -> None:
        if not url or not url.startswith("http"):
            return
        # UI 키워드 차단
        lower = url.lower()
        if any(k in lower for k in ["logo", "icon", "favicon", "/btn", "blank.gif"]):
            return
        fid = _file_id(url)
        if not fid or fid in seen_ids:
            return
        seen_ids.add(fid)
        image_urls.append(url)

    # 1) og:image (메인 이미지 1장 보장)
    try:
        og_locator = page.locator('meta[property="og:image"]').first
        if await og_locator.count() > 0:
            og = await og_locator.get_attribute("content", timeout=500)
            if og:
                _add(og)
    except Exception:
        pass

    # 2) cdn-optimized.imweb.me 패턴 — 실제 상품 이미지만 매칭
    #    헤더 로고는 cdn.imweb.me (optimized 없음) 도메인이라 자동 차단.
    try:
        imgs = await page.locator(
            "img[src*='cdn-optimized.imweb.me']"
        ).all()
        for img in imgs:
            try:
                src = await img.get_attribute("src", timeout=300)
                if src:
                    if src.startswith("//"):
                        src = "https:" + src
                    _add(src)
            except Exception:
                pass
    except Exception:
        pass

    return image_urls[:10]


async def extract_detail(
    page: Page, prd_no: str, idx: str, product_type: str
) -> Optional[dict[str, Any]]:
    """
    /{prd_no}/?idx={idx} detail 페이지 추출.
    """
    detail_url = f"{BASE}/{prd_no}/?idx={idx}"
    try:
        await page.goto(detail_url, wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(2000)

        # 1) title 추출
        title_raw = (await page.title() or "").strip()
        if "404" in title_raw or "Not Found" in title_raw or not title_raw:
            logger.warning(f"  [Tier 3] 404 skip: {detail_url}")
            return None
        if " : " in title_raw:
            name = title_raw.split(" : ")[0].strip()
        else:
            name = title_raw
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
                    digits = re.sub(r"[^\d]", "", txt)
                    if digits:
                        price = int(digits)
                        break
            except Exception:
                pass

        # 3) images — v3 새 로직 (og:image + cdn-optimized.imweb.me)
        image_urls = await extract_images(page)
        if not image_urls:
            logger.warning(f"  [Tier 3] image 0장 skip: {detail_url}")
            return None

        return {
            "source_id": f"swagkey_{prd_no}_{idx}",
            "name": name[:200],
            "image_urls": image_urls,
            "price": price,
            "product_type": product_type,
            "detail_url": detail_url,
        }

    except Exception as e:
        logger.warning(f"  [Tier 3] 추출 실패 {detail_url}: {e}")
        return None


# ── Spring 적재 ──────────────────────────────────────────────────────────

async def upsert_to_spring(products: list[dict[str, Any]]) -> dict[str, Any]:
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
    started_at = datetime.now()
    cats = target_categories or list(CATEGORIES.keys())
    logger.info(f"[swagkey v3] 시작 — categories={cats}, sample={sample_per_category}")

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

        # Tier 1 + Tier 2 수집
        for cat_name in cats:
            if cat_name not in CATEGORIES:
                logger.warning(f"  unknown category {cat_name}, skip")
                continue

            cate_id = CATEGORIES[cat_name]["cate_id"]
            product_type = CATEGORIES[cat_name]["product_type"]

            brand_hubs, direct_products = await collect_from_listing(page, cate_id)

            cat_stats = {
                "brand_hubs": len(brand_hubs),
                "direct_products": len(direct_products),
                "hub_products": 0,
            }
            tier_stats["brand_hubs_total"] += len(brand_hubs)
            tier_stats["direct_products_total"] += len(direct_products)

            for prd_no, idx in direct_products:
                all_products.add((prd_no, idx, product_type))

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

        # Tier 3: detail 추출
        product_list = list(all_products)

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

    spring_summary = await upsert_to_spring(extracted)
    ended_at = datetime.now()

    return {
        "mode": "swagkey_2tier_crawl_v3",
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
