"""
크롤러 서비스 — 2단계 구조 + 다중 이미지 추출 (5-H D1).

  1단계: 네이버 쇼핑 오픈 API               → 상품명·가격·대표 이미지
  2단계: brand.naver.com 내부 API (httpx)  → Keychron 공식 상품 + 스펙 정규화
  3단계: 다중 이미지 추출 (5-H D1 신규)     → detail API 호출해서 갤러리 이미지 N장 수집

5-H D1 변경점:
  - 각 product 의 imageUrls: List[str] 필드 추가 (Spring DTO 확장 반영)
  - source_id 패턴별 detail API 분기 호출:
      keychron_* → brand.naver.com detail API
      naver_*    → smartstore.naver.com detail API
  - rate limit 회피: 0.7초 딜레이 + 실패 시 imageUrl 1장 fallback
  - dry_run / sample_limit 옵션으로 부분 실행 가능 (디버깅용)
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
        "imageUrl":       image,                 # 후방 호환 (Spring DTO 의 단일 필드)
        "imageUrls":      [image] if image else [],  # 5-H D1: 1장 시작 (detail 단계에서 보강)
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
    2) simple-products API → 상품 상세 정보 + 이미지 추출
    """
    async with httpx.AsyncClient(timeout=20, headers=BRAND_HEADERS) as client:

        # ── ID 목록 수집 ──────────────────────────────────────────────────────
        product_ids = []

        # 베스트 상품 ID
        try:
            res = await client.get(f"{KEYCHRON_API_BASE}/bs-product-collection/best-products")
            if res.status_code == 200:
                ids = res.json()
                if isinstance(ids, list):
                    product_ids.extend(ids)
                    print(f"  [2단계] 베스트 상품 ID {len(ids)}개 수집")
        except Exception as e:
            print(f"  [2단계] 베스트 상품 오류: {e}")

        # 신상품 ID
        try:
            res = await client.get(f"{KEYCHRON_API_BASE}/bs-product-collection/new-products")
            if res.status_code == 200:
                ids = res.json()
                if isinstance(ids, list) and ids:
                    product_ids.extend(ids)
                    print(f"  [2단계] 신상품 ID {len(ids)}개 수집")
        except Exception as e:
            print(f"  [2단계] 신상품 오류: {e}")

        # 전체 상품 페이지네이션
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

        product_ids = list(dict.fromkeys(product_ids))  # 중복 제거
        print(f"  [2단계] 총 ID {len(product_ids)}개 (중복 제거 후)")

        if not product_ids:
            return []

        # ── 상품 상세 정보 조회 (50개씩 배치) ────────────────────────────────
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
    """brand.naver.com simple-products 응답 → 통합 상품 포맷"""
    name = item.get("name", "")
    if not name:
        return None

    product_id = item.get("id", "")
    source_id  = f"keychron_{product_id}"

    # 가격
    price = (
        item.get("salePrice")
        or item.get("representativePrice", {}).get("salePrice")
        or item.get("price", {}).get("salePrice")
        or 0
    )
    if isinstance(price, dict):
        price = price.get("salePrice", 0)

    # 5-H D1: simple-products 응답에서 가능한 한 많은 이미지 추출
    image_urls = _extract_images_from_brand_response(item)
    image_url = image_urls[0] if image_urls else ""

    # 카테고리명
    category_name = (
        item.get("category", {}).get("wholeCategoryName", "")
        or item.get("category", {}).get("categoryName", "")
    )

    return {
        "sourceId":       source_id,
        "name":           name,
        "brandName":      "Keychron",
        "imageUrl":       image_url,
        "imageUrls":      image_urls,    # 5-H D1: 다중 이미지
        "price":          int(price) if price else 0,
        "productUrl":     f"https://smartstore.naver.com/keychron/products/{product_id}",
        "layout":         _extract_layout(name),
        "switchType":     _extract_switch_type(name),
        "mountingType":   None,
        "connectionType": _extract_connection_from_category(category_name) or _extract_connection(name),
    }


def _extract_images_from_brand_response(item: dict) -> list:
    """
    brand.naver.com simple-products 응답에서 가능한 한 많은 이미지 URL 추출 (5-H D1).
    응답 구조가 다양해서 여러 키 시도:
      - images.representativeImage.url
      - images.optionalImages[].url
      - images: [...] (리스트인 경우)
      - representativeImageUrl (단순 문자열)
    """
    urls = []
    images = item.get("images")

    if isinstance(images, dict):
        # 대표 이미지
        rep = images.get("representativeImage")
        if isinstance(rep, dict) and rep.get("url"):
            urls.append(rep["url"])
        elif isinstance(rep, str):
            urls.append(rep)
        # 추가 이미지 (optionalImages / others)
        for key in ("optionalImages", "others", "additionalImages"):
            extras = images.get(key, [])
            if isinstance(extras, list):
                for img in extras:
                    if isinstance(img, dict) and img.get("url"):
                        urls.append(img["url"])
                    elif isinstance(img, str):
                        urls.append(img)
    elif isinstance(images, list):
        for img in images:
            if isinstance(img, dict) and img.get("url"):
                urls.append(img["url"])
            elif isinstance(img, str):
                urls.append(img)

    # fallback: representativeImageUrl 단순 문자열 필드
    if not urls:
        single = item.get("representativeImageUrl") or item.get("imageUrl")
        if single:
            urls.append(single)

    # 중복 제거 + 최대 개수 제한
    return list(dict.fromkeys(urls))[:MAX_IMAGES_PER_PRODUCT]


# ── 5-H D1: 다중 이미지 추출 (상세 단계) ─────────────────────────────────────

async def fetch_smartstore_detail_images(product_id: str, client: httpx.AsyncClient) -> list:
    """
    네이버 스마트스토어 detail API → 다중 이미지 추출 (5-H D1).
    여러 후보 endpoint 순차 시도, 성공 시 즉시 반환.

    productId 만으로 호출 가능한 패턴:
      1) https://smartstore.naver.com/i/v1/products/{productId}
      2) https://smartstore.naver.com/i/v2/products/{productId}

    응답 구조 예 (추정):
      {
        "productImages": [{ "url": "...", "order": 1 }, ...]
        또는
        "images": { "representativeImage": {...}, "optionalImages": [...] }
      }

    실패 시 빈 리스트 반환 (호출자가 imageUrl 1장 fallback 처리).
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
            urls = []

            # productImages 배열 (가장 흔한 패턴)
            for img in data.get("productImages", []) or []:
                if isinstance(img, dict) and img.get("url"):
                    urls.append(img["url"])
                elif isinstance(img, str):
                    urls.append(img)

            # images dict (brand.naver.com 동일 구조)
            if not urls:
                urls = _extract_images_from_brand_response(data)

            if urls:
                return list(dict.fromkeys(urls))[:MAX_IMAGES_PER_PRODUCT]
        except Exception:
            continue

    return []


async def enrich_with_multi_images(products: list) -> dict:
    """
    products 리스트의 각 상품에 imageUrls[] 보강 (5-H D1).

    - source_id 패턴별 detail API 분기 호출
    - 이미 imageUrls 가 2장 이상 있으면 skip (brand 응답에서 충분히 추출됨)
    - 실패 시 기존 imageUrls 유지 (보통 1장)
    - 0.7초 딜레이 (rate limit 회피)

    Returns:
      통계 dict { tried, enriched, skipped, failed, total_images }
    """
    stats = {"tried": 0, "enriched": 0, "skipped": 0, "failed": 0, "total_images": 0}

    print(f"[3단계] 다중 이미지 추출 시작 — 대상 {len(products)}개")

    async with httpx.AsyncClient() as client:
        for idx, p in enumerate(products):
            existing = p.get("imageUrls", [])
            # 이미 2장 이상이면 skip (충분)
            if len(existing) >= 2:
                stats["skipped"] += 1
                stats["total_images"] += len(existing)
                continue

            stats["tried"] += 1
            source_id = p.get("sourceId", "")
            product_id = source_id.split("_", 1)[1] if "_" in source_id else None

            if not product_id:
                stats["failed"] += 1
                continue

            try:
                urls = await fetch_smartstore_detail_images(product_id, client)
                if urls and len(urls) > len(existing):
                    p["imageUrls"] = urls
                    # 첫 번째 이미지를 imageUrl 로도 동기화 (Spring 의 primaryImageUrl)
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

            # rate limit 회피
            await asyncio.sleep(DETAIL_FETCH_DELAY)

            # 진행 상황 로그 (50개마다)
            if (idx + 1) % 50 == 0:
                print(f"  [3단계] 진행 {idx+1}/{len(products)} — enriched={stats['enriched']}, "
                      f"failed={stats['failed']}, skipped={stats['skipped']}")

    print(f"[3단계] 완료: tried={stats['tried']}, enriched={stats['enriched']}, "
          f"skipped={stats['skipped']}, failed={stats['failed']}, "
          f"total_images={stats['total_images']}")
    return stats


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
    """
    배치 upsert. 5-H D1 부터 imageUrls[] 도 함께 전송.
    Spring 의 InternalCrawlerService 가 imageUrls 우선, 없으면 imageUrl 1장 fallback.
    """
    headers = {"X-Internal-Key": INTERNAL_KEY, "Content-Type": "application/json"}
    payload  = {"siteName": site_name, "siteUrl": site_url, "products": products}
    async with httpx.AsyncClient(timeout=60) as client:  # D1: 60초로 확장 (다중 이미지 적재 시간)
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

# ── 메인 실행 ────────────────────────────────────────────────────────────────

async def run_crawler(
    enable_playwright: bool = True,
    enrich_images: bool = True,    # 5-H D1: 다중 이미지 추출 켜기/끄기
    sample_limit: Optional[int] = None,  # 5-H D1: 부분 실행 (디버깅)
) -> dict:
    """
    1단계: 네이버 쇼핑 API  → 기본 상품 수집 + 상품명 기반 스펙 추출
    2단계: brand.naver.com API (httpx) → 공식 스토어 상품 + 스펙 보완
    3단계 (5-H D1): 다중 이미지 추출 → detail API 호출

    Args:
        enable_playwright: 미사용 (legacy, APScheduler 호환용)
        enrich_images: True 면 3단계 다중 이미지 추출 실행
        sample_limit: 정수면 unique[:N] 만 처리 (디버깅용 부분 실행)
    """
    print(f"[크롤러] 시작 — {datetime.now().isoformat()}")

    # ── 1단계 ─────────────────────────────────────────────────────────────────
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

    seen = set()
    unique: list = []
    for p in stage1_products:
        if p["sourceId"] not in seen:
            seen.add(p["sourceId"])
            unique.append(p)
    print(f"[1단계] 중복 제거 후 {len(unique)}개")

    # ── 2단계: brand.naver.com API ────────────────────────────────────────────
    stage2_products: list = []
    print("[2단계] brand.naver.com 공식 API 크롤링 시작")
    try:
        stage2_products = await fetch_keychron_brand_products()
        for p in stage2_products:
            if p["sourceId"] not in seen:
                seen.add(p["sourceId"])
                unique.append(p)
            else:
                # 1단계 상품에 스펙 + 이미지 보완
                for u in unique:
                    if u.get("name", "").replace(" ", "") == p.get("name", "").replace(" ", ""):
                        for k in ["layout", "switchType", "mountingType", "connectionType"]:
                            if p.get(k) and not u.get(k):
                                u[k] = p[k]
                        # 5-H D1: imageUrls 도 brand 응답이 더 풍부하면 덮어쓰기
                        brand_imgs = p.get("imageUrls", [])
                        if len(brand_imgs) > len(u.get("imageUrls", [])):
                            u["imageUrls"] = brand_imgs
                            if brand_imgs:
                                u["imageUrl"] = brand_imgs[0]
                        break
    except Exception as e:
        print(f"[2단계] 오류: {e}")

    # ── 5-H D1: sample_limit 적용 (디버깅용) ──────────────────────────────────
    if sample_limit is not None and sample_limit > 0:
        unique = unique[:sample_limit]
        print(f"[D1] sample_limit={sample_limit} 적용 — {len(unique)}개로 축소")

    # ── 3단계 (5-H D1): 다중 이미지 추출 ──────────────────────────────────────
    enrich_stats = None
    if enrich_images:
        try:
            enrich_stats = await enrich_with_multi_images(unique)
        except Exception as e:
            print(f"[3단계] 이미지 보강 전체 실패: {e}")

    print(f"[크롤러] 최종 {len(unique)}개 → Spring Boot 전송")

    # ── 배치 upsert ───────────────────────────────────────────────────────────
    try:
        result = await batch_upsert_to_spring(
            unique,
            site_name="naver_shopping+keychron_brand",
            site_url=KEYCHRON_BRAND_URL,
        )
        print(f"[배치 upsert] 성공: {result}")
    except Exception as e:
        print(f"[배치 upsert] 실패 ({e}) → 단건 폴백")
        result = await _fallback_single_upsert(unique)

    return {
        "crawled_at":    datetime.now().isoformat(),
        "stage1_count":  len(stage1_products),
        "stage2_count":  len(stage2_products),
        "total_unique":  len(unique),
        "enrich_stats":  enrich_stats,   # 5-H D1
        "spring_result": result,
    }
