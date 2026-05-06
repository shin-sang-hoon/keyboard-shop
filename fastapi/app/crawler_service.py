"""
크롤러 서비스 — 2단계 구조 + 다중 이미지 추출 + DB 백필 (5-H D1) + Playwright 추출 (5-H D2).

  1단계: 네이버 쇼핑 오픈 API               → 상품명·가격·대표 이미지
  2단계: brand.naver.com 내부 API (httpx)  → Keychron 공식 상품 + 다중 이미지
  3단계: 다중 이미지 추출 (5-H D1)         → detail API 호출해서 갤러리 N장 보강
  --- 또는 ---
  백필:   DB 의 기존 2477 row 재활용         → stage1+2 skip + detail 만 호출 (5-H D1)
  Playwright: keychron_* 만 stealth 브라우저로 갤러리 추출 (5-H D2)

5-H D2 변경점 (외부 차단 우회):
  - smartstore detail API 차단 (HTTP 429/418) 발견
  - curl-cffi Chrome TLS 시뮬레이션도 차단
  - Playwright stealth 모드 → 200 응답 확인
  - keychron_* 만 brand.naver.com/keychron/products/{id} 페이지 작동
  - HTML 안 window.__PRELOADED_STATE__ 의 representativeImageUrl + optionalImageUrls 추출

5-H D1 변경점:
  - imageUrls: List[str] 필드 추가 (Spring DTO 확장 반영)
  - source_id 패턴별 detail API 분기 (keychron_* / naver_*)
  - rate limit 회피: 0.7초 딜레이 + 실패 시 imageUrl 1장 fallback
  - sample_limit / use_db_backfill 옵션으로 부분 실행 가능
"""

import asyncio
import re
from datetime import datetime
from typing import Optional

import httpx
from dotenv import load_dotenv
import os

load_dotenv()

SPRING_URL          = os.getenv("SPRING_INTERNAL_API_URL", "http://localhost:8080")
INTERNAL_KEY        = os.getenv("INTERNAL_API_KEY", "keyboard-internal-secret-key")
NAVER_CLIENT_ID     = os.getenv("NAVER_CLIENT_ID")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET")

NAVER_SHOP_URL      = "https://openapi.naver.com/v1/search/shop.json"

# Keychron 브랜드 스토어 채널 ID (brand.naver.com/keychron)
KEYCHRON_CHANNEL_ID  = "2sWDw1c6bldrOqZFkyltv"
KEYCHRON_BRAND_URL   = "https://brand.naver.com/keychron"
KEYCHRON_API_BASE    = f"https://brand.naver.com/n/v2/channels/{KEYCHRON_CHANNEL_ID}"

# 5-H D1: rate limit 회피용 detail 호출 딜레이 (초)
DETAIL_FETCH_DELAY = 0.7

# 5-H D1: 한 product 당 최대 갤러리 이미지 수 (적당히 제한)
MAX_IMAGES_PER_PRODUCT = 10

# 5-H D2: 청크 사이즈 — Spring 트랜잭션 시간 제한 회피
DEFAULT_CHUNK_SIZE = 100

# brand.naver.com API 공통 헤더 (실제 브라우저처럼)
BRAND_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "https://brand.naver.com/keychron/products",
    "Accept": "application/json, text/plain, */*",
}

# 5-H D1: 스마트스토어 detail API 헤더
SMARTSTORE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
}

# ── 1단계: 네이버 쇼핑 오픈 API ─────────────────────────────────────────────

async def search_naver_products(query: str, display: int = 100, start: int = 1) -> list:
    """
    .env 의 NAVER_CLIENT_ID/SECRET 가 없으면 [] 반환.
    백필 모드 (use_db_backfill=True) 에서는 호출 안 됨.
    """
    if not NAVER_CLIENT_ID or not NAVER_CLIENT_SECRET:
        return []
    headers = {
        "X-Naver-Client-Id":     NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    }
    params = {"query": query, "display": display, "start": start, "sort": "sim"}
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(NAVER_SHOP_URL, headers=headers, params=params)
        res.raise_for_status()
        return res.json().get("items", [])


def normalize_naver_item(item: dict) -> dict:
    name = re.sub(r"<[^>]+>", "", item.get("title", ""))
    brand_name = item.get("brand", "") or "Keychron"
    image = item.get("image", "")
    return {
        "sourceId":       f"naver_{item.get('productId', '')}",
        "name":           name,
        "brandName":      brand_name,
        "imageUrl":       image,
        "imageUrls":      [image] if image else [],
        "price":          int(item.get("lprice", 0)),
        "productUrl":     item.get("link", ""),
        "layout":         _extract_layout(name),
        "switchType":     _extract_switch_type(name),
        "mountingType":   None,
        "connectionType": _extract_connection(name),
    }

# ── 2단계: brand.naver.com 내부 API (httpx 직접 호출) ───────────────────────

async def fetch_keychron_brand_products() -> list:
    """
    brand.naver.com/keychron 공식 스토어 상품 수집.
    1) best/new/all 상품 ID 목록 수집
    2) simple-products API → 상품 상세 정보 + 다중 이미지 추출
    """
    async with httpx.AsyncClient(timeout=20, headers=BRAND_HEADERS) as client:

        product_ids = []

        try:
            res = await client.get(f"{KEYCHRON_API_BASE}/bs-product-collection/best-products")
            if res.status_code == 200:
                ids = res.json()
                if isinstance(ids, list):
                    product_ids.extend(ids)
                    print(f"  [2단계] 베스트 상품 ID {len(ids)}개 수집")
        except Exception as e:
            print(f"  [2단계] 베스트 상품 오류: {e}")

        try:
            res = await client.get(f"{KEYCHRON_API_BASE}/bs-product-collection/new-products")
            if res.status_code == 200:
                ids = res.json()
                if isinstance(ids, list) and ids:
                    product_ids.extend(ids)
                    print(f"  [2단계] 신상품 ID {len(ids)}개 수집")
        except Exception as e:
            print(f"  [2단계] 신상품 오류: {e}")

        page = 1
        while True:
            try:
                res = await client.get(
                    f"{KEYCHRON_API_BASE}/products",
                    params={"page": page, "pageSize": 100, "sort": "POPULAR"}
                )
                if res.status_code != 200:
                    break
                data = res.json()
                items = data.get("products", data) if isinstance(data, dict) else data
                if not isinstance(items, list) or not items:
                    break
                ids = [item.get("id") or item.get("productId") for item in items if item.get("id") or item.get("productId")]
                if not ids:
                    break
                product_ids.extend(ids)
                print(f"  [2단계] 전체상품 {page}페이지 → {len(ids)}개")
                if len(ids) < 100:
                    break
                page += 1
                await asyncio.sleep(0.5)
            except Exception as e:
                print(f"  [2단계] 전체상품 페이지 오류: {e}")
                break

        product_ids = list(dict.fromkeys(product_ids))
        print(f"  [2단계] 총 ID {len(product_ids)}개 (중복 제거 후)")

        if not product_ids:
            return []

        products = []
        batch_size = 50
        for i in range(0, len(product_ids), batch_size):
            batch = product_ids[i:i + batch_size]
            ids_param = ",".join(str(pid) for pid in batch)
            url = (
                f"{KEYCHRON_API_BASE}/simple-products"
                f"?ids[]={ids_param}"
                f"&excludeAuthBlind=false&excludeDisplayableFilter=false&forceOrder=true"
            )
            try:
                res = await client.get(url)
                if res.status_code == 200:
                    items = res.json()
                    for item in items:
                        p = normalize_brand_item(item)
                        if p:
                            products.append(p)
                await asyncio.sleep(0.5)
            except Exception as e:
                print(f"  [2단계] 상품 상세 오류 (batch {i}): {e}")

        print(f"  [2단계] 상품 상세 {len(products)}개 파싱 완료")
        return products


def normalize_brand_item(item: dict) -> Optional[dict]:
    """brand.naver.com simple-products 응답 → 통합 상품 포맷 (5-H D1 키 fix)"""
    name = item.get("name", "")
    if not name:
        return None

    product_id = item.get("id", "")
    source_id  = f"keychron_{product_id}"

    # 가격
    price = (
        item.get("salePrice")
        or item.get("dispSalePrice")
        or 0
    )
    if isinstance(price, dict):
        price = price.get("salePrice", 0)

    # 5-H D1 fix: 실제 응답 키 사용
    #   - representativeImageUrl (단일 string)
    #   - optionalImageUrls (리스트)
    image_urls = _extract_images_from_brand_response(item)
    image_url = image_urls[0] if image_urls else ""

    category_name = (
        item.get("category", {}).get("wholeCategoryName", "")
        or item.get("category", {}).get("categoryName", "")
    )

    return {
        "sourceId":       source_id,
        "name":           name,
        "brandName":      "Keychron",
        "imageUrl":       image_url,
        "imageUrls":      image_urls,
        "price":          int(price) if price else 0,
        "productUrl":     f"https://smartstore.naver.com/keychron/products/{product_id}",
        "layout":         _extract_layout(name),
        "switchType":     _extract_switch_type(name),
        "mountingType":   None,
        "connectionType": _extract_connection_from_category(category_name) or _extract_connection(name),
    }


def _extract_images_from_brand_response(item: dict) -> list:
    """
    brand.naver.com simple-products 응답에서 다중 이미지 URL 추출 (5-H D1).

    실제 응답 키 (2026-05 검증):
      - representativeImageUrl: "https://..."  (대표, 단일 string)
      - optionalImageWidth/Height: ...
      - optionalImageUrls: ["https://...", ...]  (추가, 리스트)

    반환: 대표 + 추가 모두 합친 리스트 (중복 제거, MAX 적용)
    """
    urls = []

    # 대표 이미지 (단일 string)
    rep = item.get("representativeImageUrl")
    if rep and isinstance(rep, str):
        urls.append(rep)

    # 추가 이미지 (리스트)
    optional = item.get("optionalImageUrls")
    if isinstance(optional, list):
        for url in optional:
            if isinstance(url, str) and url:
                urls.append(url)

    # 중복 제거 + 최대 개수 제한
    return list(dict.fromkeys(urls))[:MAX_IMAGES_PER_PRODUCT]


# ── 5-H D1: 다중 이미지 추출 (상세 단계) ─────────────────────────────────────

async def fetch_keychron_detail_images(product_id: str, client: httpx.AsyncClient) -> list:
    """
    Keychron brand 의 단일 productId → simple-products API 호출해서 다중 이미지 추출 (5-H D1).
    DB 백필 모드에서 사용 (이미 적재된 keychron_* product 갱신용).
    """
    url = (
        f"{KEYCHRON_API_BASE}/simple-products"
        f"?ids[]={product_id}"
        f"&excludeAuthBlind=false&excludeDisplayableFilter=false&forceOrder=true"
    )
    try:
        res = await client.get(url, headers=BRAND_HEADERS, timeout=10)
        if res.status_code != 200:
            return []
        data = res.json()
        if isinstance(data, list) and data:
            return _extract_images_from_brand_response(data[0])
    except Exception:
        pass
    return []


async def fetch_smartstore_detail_images(product_id: str, client: httpx.AsyncClient) -> list:
    """
    네이버 스마트스토어 일반 productId → detail API → 다중 이미지 (5-H D1).
    여러 후보 endpoint 시도. 성공 시 즉시 반환.
    실패 시 빈 리스트 (호출자가 imageUrl 1장 fallback).
    """
    candidates = [
        f"https://smartstore.naver.com/i/v1/products/{product_id}",
        f"https://smartstore.naver.com/i/v2/products/{product_id}",
    ]

    for url in candidates:
        try:
            res = await client.get(url, headers=SMARTSTORE_HEADERS, timeout=8)
            if res.status_code != 200:
                continue
            data = res.json()
            urls = _extract_images_from_brand_response(data)
            if urls:
                return urls
        except Exception:
            continue
    return []


async def enrich_with_multi_images(products: list) -> dict:
    """
    products 리스트의 각 상품에 imageUrls[] 보강 (5-H D1).

    - source_id 패턴별 detail API 분기 호출
      * keychron_* → brand.naver.com simple-products
      * naver_*    → smartstore.naver.com detail (실패 가능성 높음)
    - 이미 imageUrls 가 2장 이상 있으면 skip
    - 0.7초 딜레이 (rate limit 회피)
    """
    stats = {"tried": 0, "enriched": 0, "skipped": 0, "failed": 0, "total_images": 0}
    print(f"[3단계] 다중 이미지 추출 시작 — 대상 {len(products)}개")

    async with httpx.AsyncClient() as client:
        for idx, p in enumerate(products):
            existing = p.get("imageUrls", [])
            if len(existing) >= 2:
                stats["skipped"] += 1
                stats["total_images"] += len(existing)
                continue

            stats["tried"] += 1
            source_id = p.get("sourceId", "")

            try:
                if source_id.startswith("keychron_"):
                    product_id = source_id[len("keychron_"):]
                    urls = await fetch_keychron_detail_images(product_id, client)
                elif source_id.startswith("naver_"):
                    product_id = source_id[len("naver_"):]
                    urls = await fetch_smartstore_detail_images(product_id, client)
                else:
                    urls = []

                if urls and len(urls) > len(existing):
                    p["imageUrls"] = urls
                    p["imageUrl"] = urls[0]
                    stats["enriched"] += 1
                    stats["total_images"] += len(urls)
                else:
                    stats["failed"] += 1
                    stats["total_images"] += len(existing)
            except Exception as e:
                stats["failed"] += 1
                stats["total_images"] += len(existing)
                print(f"  [3단계] {source_id} detail 실패: {e}")

            await asyncio.sleep(DETAIL_FETCH_DELAY)

            if (idx + 1) % 50 == 0:
                print(f"  [3단계] 진행 {idx+1}/{len(products)} — enriched={stats['enriched']}, "
                      f"failed={stats['failed']}, skipped={stats['skipped']}")

    print(f"[3단계] 완료: tried={stats['tried']}, enriched={stats['enriched']}, "
          f"skipped={stats['skipped']}, failed={stats['failed']}, "
          f"total_images={stats['total_images']}")
    return stats


# ── 5-H D1: DB 백필 path (.env 없어도 OK) ────────────────────────────────────

async def fetch_existing_products_from_spring(limit: Optional[int] = None) -> list:
    """
    Spring 의 GET /api/products 페이지네이션해서 모든 product 가져오기 (5-H D1 백필용).
    Returns: [{"sourceId": ..., "name": ..., "brandName": ..., "imageUrl": ..., ...}, ...]
    """
    products = []
    page = 0
    page_size = 100
    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            try:
                res = await client.get(
                    f"{SPRING_URL}/api/products",
                    params={"page": page, "size": page_size}
                )
                res.raise_for_status()
                data = res.json()
                content = data.get("content", [])
                if not content:
                    break

                for item in content:
                    source_id = item.get("sourceId")
                    if not source_id:
                        continue
                    image_url = item.get("imageUrl") or ""
                    products.append({
                        "sourceId":       source_id,
                        "name":           item.get("name", ""),
                        "brandName":      (item.get("brand") or {}).get("name") or "Keychron",
                        "imageUrl":       image_url,
                        "imageUrls":      [image_url] if image_url else [],
                        "price":          item.get("price"),
                        "productUrl":     None,  # DB 의 product_url 컬럼 없음
                        "layout":         item.get("layout"),
                        "switchType":     item.get("switchType"),
                        "mountingType":   item.get("mountingType"),
                        "connectionType": item.get("connectionType"),
                    })

                if data.get("last"):
                    break
                if limit is not None and len(products) >= limit:
                    products = products[:limit]
                    break
                page += 1
            except Exception as e:
                print(f"[백필] DB 조회 페이지 {page} 오류: {e}")
                break

    print(f"[백필] DB 에서 {len(products)}개 product 조회 완료")
    return products


# ── 스펙 정규화 (상품명 기반) ────────────────────────────────────────────────

def _extract_layout(name: str) -> Optional[str]:
    n = name.upper()
    if "TKL" in n or "80%" in n:   return "TKL"
    if "75%" in n or " 75 " in n or "EX75" in n or "V3" in n.upper():  return "75"
    if "65%" in n or " 65 " in n:  return "65"
    if "60%" in n or " 60 " in n:  return "60"
    if "40%" in n or " 40 " in n:  return "40"
    if "100%" in n or "FULL" in n: return "FULL"
    m = re.search(r'\bK(\d+)\b', name, re.IGNORECASE)
    if m:
        num = int(m.group(1))
        if num in (1, 2, 7, 3):  return "75"
        if num in (6, 14):        return "65"
        if num in (8, 9, 17):     return "TKL"
        if num in (10, 4):        return "FULL"
    m = re.search(r'\bB(\d+)\b', name, re.IGNORECASE)
    if m:
        num = int(m.group(1))
        if num in (1,):   return "75"
        if num in (6,):   return "FULL"
    m = re.search(r'\bV(\d+)\b', name, re.IGNORECASE)
    if m:
        num = int(m.group(1))
        if num in (3, 6): return "TKL"
        if num in (10,):  return "FULL"
    m = re.search(r'\bC(\d+)\b', name, re.IGNORECASE)
    if m:
        num = int(m.group(1))
        if num in (2,):   return "FULL"
    return None

def _extract_switch_type(name: str) -> Optional[str]:
    n = name.upper()
    if "LINEAR"  in n: return "LINEAR"
    if "TACTILE" in n: return "TACTILE"
    if "CLICKY"  in n: return "CLICKY"
    if "리니어" in name: return "LINEAR"
    if "택타일" in name: return "TACTILE"
    if "클리키" in name: return "CLICKY"
    if any(k in name for k in ["적축", "레드축", "RED축"]):   return "LINEAR"
    if any(k in name for k in ["갈축", "브라운축", "BROWN축"]): return "TACTILE"
    if any(k in name for k in ["청축", "블루축", "BLUE축"]):   return "CLICKY"
    if "바나나축" in name: return "LINEAR"
    if "민트축"   in name: return "TACTILE"
    if "라벤더축" in name: return "LINEAR"
    if "자석축" in name: return "LINEAR"
    if "팬터그래프" in name or "팬타그래프" in name or "Pantograph" in name:
        return "LINEAR"
    return None

def _extract_connection(name: str) -> Optional[str]:
    n = name.upper()
    if any(k in name for k in ["무선", "블루투스", "블루트스"]) \
            or "WIRELESS" in n or "2.4G" in n or "BT5" in n:
        return "WIRELESS"
    if "유선" in name or "WIRED" in n:
        return "WIRED"
    if re.search(r'\b(K|V|B)\d+\s+PRO\s+(MAX|SE)', name, re.IGNORECASE):
        return "WIRELESS"
    return None

def _extract_connection_from_category(category: str) -> Optional[str]:
    if "무선" in category: return "WIRELESS"
    if "유선" in category: return "WIRED"
    return None

# ── Spring Boot API 연동 ─────────────────────────────────────────────────────

async def batch_upsert_to_spring(products: list, site_name: str, site_url: str) -> dict:
    """배치 upsert. 5-H D1 부터 imageUrls[] 도 함께 전송."""
    headers = {"X-Internal-Key": INTERNAL_KEY, "Content-Type": "application/json"}
    payload  = {"siteName": site_name, "siteUrl": site_url, "products": products}
    async with httpx.AsyncClient(timeout=120) as client:  # D1: 백필 시 시간 길어질 수 있음
        res = await client.post(
            f"{SPRING_URL}/api/internal/crawler/upsert-batch",
            json=payload, headers=headers,
        )
        res.raise_for_status()
        return res.json()


async def _fallback_single_upsert(products: list) -> dict:
    print("[폴백] 단건 upsert 모드로 전환")
    headers = {"X-Internal-Key": INTERNAL_KEY, "Content-Type": "application/json"}
    created = updated = failed = 0
    async with httpx.AsyncClient(timeout=15) as client:
        for p in products:
            try:
                res = await client.post(
                    f"{SPRING_URL}/api/internal/crawler/upsert",
                    json=p, headers=headers,
                )
                res.raise_for_status()
                if res.json().get("status") == "created": created += 1
                else: updated += 1
            except Exception as e:
                print(f"  단건 실패: {p.get('sourceId')} — {e}")
                failed += 1
            await asyncio.sleep(0.05)
    return {"crawlLogId": None, "created": created, "updated": updated, "failed": failed}

# ── 5-H D2: Playwright 백필 path (keychron 만) ──────────────────────────────

async def run_keychron_playwright_backfill(
    sample_limit: Optional[int] = None,
    delay_seconds: float = 2.0,
    chunk_size: int = 50,
) -> dict:
    """
    keychron_* product 만 Playwright stealth 로 detail page 띄워서 다중 이미지 추출 (5-H D2).

    네이버 외부 자동화 차단 (curl/httpx/curl-cffi 모두 막힘) 우회용.
    brand.naver.com/keychron/products/{id} 페이지의 PRELOADED_STATE 에서
    representativeImageUrl + optionalImageUrls 추출.

    Returns:
        실행 통계 + Spring 적재 결과
    """
    # 지연 import (playwright_image_extractor 가 없는 환경에서도 다른 path 작동)
    from app.playwright_image_extractor import extract_brand_images_batch

    print(f"[D2 Playwright] 시작 — {datetime.now().isoformat()}, "
          f"sample={sample_limit}, delay={delay_seconds}s")

    # 1) DB 에서 keychron_* product 만 가져오기 (Spring API 페이지네이션)
    all_products = await fetch_existing_products_from_spring(limit=None)
    keychron_products = [p for p in all_products if p["sourceId"].startswith("keychron_")]
    print(f"[D2 Playwright] DB 의 keychron_* product {len(keychron_products)}개")

    if sample_limit is not None and sample_limit > 0:
        keychron_products = keychron_products[:sample_limit]
        print(f"[D2 Playwright] sample_limit={sample_limit} 적용 → {len(keychron_products)}개")

    if not keychron_products:
        return {
            "crawled_at": datetime.now().isoformat(),
            "mode": "playwright_keychron_backfill",
            "total_unique": 0,
            "extract_stats": {"tried": 0, "success": 0, "failed": 0, "total_images": 0},
        }

    # 2) Playwright 로 갤러리 이미지 추출
    source_ids = [p["sourceId"] for p in keychron_products]
    extract_results = await extract_brand_images_batch(
        source_ids,
        delay_seconds=delay_seconds,
    )
    extract_map = {r["sourceId"]: r for r in extract_results}

    # 3) keychron_products 의 imageUrls 갱신
    success_count = 0
    fail_count = 0
    total_images = 0

    for p in keychron_products:
        result = extract_map.get(p["sourceId"], {})
        urls = result.get("imageUrls", [])
        if result.get("ok") and urls:
            p["imageUrls"] = urls
            p["imageUrl"] = urls[0]
            success_count += 1
            total_images += len(urls)
        else:
            # 실패 시 기존 imageUrl 1장 유지
            existing = p.get("imageUrl")
            if existing:
                p["imageUrls"] = [existing]
                total_images += 1
            else:
                p["imageUrls"] = []
            fail_count += 1

    print(f"[D2 Playwright] 추출 완료 — 성공 {success_count} / 실패 {fail_count} / "
          f"총 이미지 {total_images}장")

    # 4) Spring 으로 청크 분할 upsert
    chunk_results = []
    spring_total = {
        "totalCreated": 0,
        "totalUpdated": 0,
        "totalFailed": 0,
        "totalImages": 0,
    }

    for chunk_idx, start in enumerate(range(0, len(keychron_products), chunk_size)):
        chunk = keychron_products[start:start + chunk_size]
        chunk_label = f"{chunk_idx + 1}/{(len(keychron_products) + chunk_size - 1) // chunk_size}"
        print(f"[D2 Playwright upsert {chunk_label}] {len(chunk)}개 전송")

        try:
            result = await batch_upsert_to_spring(
                chunk,
                site_name="d2_playwright_keychron",
                site_url="https://brand.naver.com/keychron",
            )
            spring_total["totalCreated"] += result.get("created", 0)
            spring_total["totalUpdated"] += result.get("updated", 0)
            spring_total["totalFailed"] += result.get("failed", 0)
            spring_total["totalImages"] += result.get("totalImages", 0)
            chunk_results.append({
                "chunk": chunk_label,
                "size": len(chunk),
                "created": result.get("created", 0),
                "updated": result.get("updated", 0),
                "totalImages": result.get("totalImages", 0),
            })
            print(f"  → 청크 성공: updated={result.get('updated')}, "
                  f"totalImages={result.get('totalImages')}")
        except Exception as e:
            print(f"  → 청크 {chunk_label} 실패 ({e})")
            spring_total["totalFailed"] += len(chunk)
            chunk_results.append({"chunk": chunk_label, "size": len(chunk), "error": str(e)})

    return {
        "crawled_at": datetime.now().isoformat(),
        "mode": "playwright_keychron_backfill",
        "total_unique": len(keychron_products),
        "extract_stats": {
            "tried": len(keychron_products),
            "success": success_count,
            "failed": fail_count,
            "total_images": total_images,
        },
        "spring_summary": {
            **spring_total,
            "chunks": chunk_results,
        },
    }


# ── 메인 실행 ────────────────────────────────────────────────────────────────

async def run_crawler(
    enable_playwright: bool = True,
    enrich_images: bool = True,
    sample_limit: Optional[int] = None,
    use_db_backfill: bool = False,    # 5-H D1: DB 의 기존 row 재사용 (.env 없어도 OK)
    chunk_size: int = DEFAULT_CHUNK_SIZE,  # 5-H D2: 청크 분할 사이즈
    skip_offset: int = 0,             # 5-H D2: 처음 N 개 skip (재시도 / resume 용)
) -> dict:
    """
    크롤러 실행.

    use_db_backfill=False (기본):
        1단계 (네이버 search) + 2단계 (brand) → 새 크롤
    use_db_backfill=True:
        Spring 의 GET /api/products 로 기존 row 가져와서 detail 만 호출 (5-H D1)
        — .env 의 NAVER 키 없어도 작동. 백필 전용.

    enrich_images: detail API 호출해서 다중 이미지 추출 (5-H D1)
    sample_limit:  부분 실행 (디버깅)
    chunk_size:    Spring upsert 청크 단위 (5-H D2). 큰 배치 시 트랜잭션 시간 제한 회피
    skip_offset:   처음 N 개 건너뛰기 (5-H D2). 중간 실패 후 resume 시 활용
    """
    print(f"[크롤러] 시작 — {datetime.now().isoformat()}, "
          f"backfill={use_db_backfill}, enrich={enrich_images}, "
          f"sample={sample_limit}, chunk={chunk_size}, skip={skip_offset}")

    stage1_count = 0
    stage2_count = 0
    unique = []

    # ── 5-H D1: 백필 모드 ────────────────────────────────────────────────────
    if use_db_backfill:
        unique = await fetch_existing_products_from_spring(limit=sample_limit)
        # 5-H D2: skip_offset 적용 (중간 실패 후 resume)
        if skip_offset > 0:
            unique = unique[skip_offset:]
            print(f"[백필 모드] skip_offset={skip_offset} 적용 — {len(unique)}개로 축소")
        print(f"[백필 모드] 신규 크롤 skip — DB 의 {len(unique)}개 활용")

    # ── 일반 모드 (1+2단계) ──────────────────────────────────────────────────
    else:
        stage1_products: list = []
        queries = [
            "키크론 키보드", "Keychron keyboard", "키크론",
            "키크론 무선 키보드", "키크론 블루투스 키보드", "키크론 유선 키보드",
            "keychron 무선", "keychron 블루투스", "keychron 유선",
            "키크론 기계식 키보드", "키크론 저소음 키보드", "키크론 슬림 키보드",
            "keychron 기계식", "keychron 저소음",
            "keychron 텐키리스", "keychron 풀배열", "keychron 75%",
            "키크론 텐키리스", "키크론 풀배열",
            "keychron K 시리즈", "keychron V 시리즈", "keychron Q 시리즈",
            "키크론 K2", "키크론 K8", "키크론 K10",
            "keychron 게이밍",
            "키크론 마우스", "키크론 키캡", "키크론 스위치",
            "keychron 키캡", "keychron 마우스",
        ]
        for query in queries:
            for start in [1, 101]:
                try:
                    items = await search_naver_products(query, display=100, start=start)
                    if not items:
                        break
                    stage1_products.extend([normalize_naver_item(i) for i in items])
                    print(f"[1단계] '{query}' (start={start}) → {len(items)}개")
                    await asyncio.sleep(0.7)
                except Exception as e:
                    print(f"[1단계] 오류: {e}")
                    break
        stage1_count = len(stage1_products)

        seen = set()
        for p in stage1_products:
            if p["sourceId"] not in seen:
                seen.add(p["sourceId"])
                unique.append(p)
        print(f"[1단계] 중복 제거 후 {len(unique)}개")

        # 2단계: brand
        stage2_products: list = []
        print("[2단계] brand.naver.com 공식 API 크롤링 시작")
        try:
            stage2_products = await fetch_keychron_brand_products()
            for p in stage2_products:
                if p["sourceId"] not in seen:
                    seen.add(p["sourceId"])
                    unique.append(p)
                else:
                    for u in unique:
                        if u.get("name", "").replace(" ", "") == p.get("name", "").replace(" ", ""):
                            for k in ["layout", "switchType", "mountingType", "connectionType"]:
                                if p.get(k) and not u.get(k):
                                    u[k] = p[k]
                            brand_imgs = p.get("imageUrls", [])
                            if len(brand_imgs) > len(u.get("imageUrls", [])):
                                u["imageUrls"] = brand_imgs
                                if brand_imgs:
                                    u["imageUrl"] = brand_imgs[0]
                            break
        except Exception as e:
            print(f"[2단계] 오류: {e}")
        stage2_count = len(stage2_products)

        if sample_limit is not None and sample_limit > 0:
            unique = unique[:sample_limit]
            print(f"[D1] sample_limit={sample_limit} 적용 — {len(unique)}개로 축소")

    # ── 3단계 (5-H D1): 다중 이미지 추출 ──────────────────────────────────────
    enrich_stats = None
    if enrich_images and unique:
        try:
            enrich_stats = await enrich_with_multi_images(unique)
        except Exception as e:
            print(f"[3단계] 이미지 보강 전체 실패: {e}")

    print(f"[크롤러] 최종 {len(unique)}개 → Spring Boot 청크 분할 전송 (chunk_size={chunk_size})")

    # ── 5-H D2: 청크 분할 batch upsert ────────────────────────────────────────
    site_name = "db_backfill" if use_db_backfill else "naver_shopping+keychron_brand"
    chunk_results = []
    total_created = 0
    total_updated = 0
    total_failed = 0
    total_images_inserted = 0
    crawl_log_ids = []

    for chunk_idx, start in enumerate(range(0, len(unique), chunk_size)):
        chunk = unique[start:start + chunk_size]
        chunk_label = f"{chunk_idx + 1}/{(len(unique) + chunk_size - 1) // chunk_size}"
        print(f"[배치 upsert {chunk_label}] {len(chunk)}개 전송 (offset={start + skip_offset})")

        try:
            result = await batch_upsert_to_spring(
                chunk, site_name=site_name, site_url=KEYCHRON_BRAND_URL,
            )
            total_created += result.get("created", 0)
            total_updated += result.get("updated", 0)
            total_failed += result.get("failed", 0)
            total_images_inserted += result.get("totalImages", 0)
            if result.get("crawlLogId"):
                crawl_log_ids.append(result["crawlLogId"])
            chunk_results.append({
                "chunk": chunk_label,
                "size": len(chunk),
                "created": result.get("created", 0),
                "updated": result.get("updated", 0),
                "totalImages": result.get("totalImages", 0),
            })
            print(f"  → 청크 성공: created={result.get('created')}, "
                  f"updated={result.get('updated')}, totalImages={result.get('totalImages')}")
        except Exception as e:
            print(f"  → 청크 {chunk_label} 실패 ({e}) — skip 후 다음 청크 진행")
            total_failed += len(chunk)
            chunk_results.append({
                "chunk": chunk_label,
                "size": len(chunk),
                "error": str(e),
            })

    return {
        "crawled_at":    datetime.now().isoformat(),
        "mode":          "db_backfill" if use_db_backfill else "fresh_crawl",
        "stage1_count":  stage1_count,
        "stage2_count":  stage2_count,
        "skip_offset":   skip_offset,
        "chunk_size":    chunk_size,
        "total_unique":  len(unique),
        "enrich_stats":  enrich_stats,
        "spring_summary": {
            "totalCreated": total_created,
            "totalUpdated": total_updated,
            "totalFailed":  total_failed,
            "totalImages":  total_images_inserted,
            "crawlLogIds":  crawl_log_ids,
            "chunks":       chunk_results,
        },
    }
