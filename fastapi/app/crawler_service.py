"""
크롤러 서비스 — 2단계 구조 (Playwright 없이 순수 httpx)
  1단계: 네이버 쇼핑 오픈 API               → 상품명·가격·이미지
  2단계: brand.naver.com 내부 API (httpx)  → Keychron 공식 상품 + 스펙 정규화
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
    return {
        "sourceId":       f"naver_{item.get('productId', '')}",
        "name":           name,
        "brandName":      brand_name,
        "imageUrl":       item.get("image", ""),
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
    brand.naver.com/keychron 공식 스토어 상품 수집
    1) best-products API → 상품 ID 목록
    2) simple-products API → 상품 상세 정보
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
                # 응답 구조: {"products": [...]} 또는 리스트
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

        # 중복 제거
        product_ids = list(dict.fromkeys(product_ids))
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

    # 가격: salePrice or representativePrice or lowPrice
    price = (
        item.get("salePrice")
        or item.get("representativePrice", {}).get("salePrice")
        or item.get("price", {}).get("salePrice")
        or 0
    )
    if isinstance(price, dict):
        price = price.get("salePrice", 0)

    # 이미지
    images = item.get("images") or {}
    image_url = ""
    if isinstance(images, dict):
        image_url = (
            images.get("representativeImage", {}).get("url", "")
            or images.get("thumbnail", "")
        )
    elif isinstance(images, list) and images:
        image_url = images[0].get("url", "")

    # 카테고리명에서 연결방식 추출
    category_name = (
        item.get("category", {}).get("wholeCategoryName", "")
        or item.get("category", {}).get("categoryName", "")
    )

    return {
        "sourceId":       source_id,
        "name":           name,
        "brandName":      "Keychron",
        "imageUrl":       image_url,
        "price":          int(price) if price else 0,
        "productUrl":     f"https://smartstore.naver.com/keychron/products/{product_id}",
        "layout":         _extract_layout(name),
        "switchType":     _extract_switch_type(name),
        "mountingType":   None,
        "connectionType": _extract_connection_from_category(category_name) or _extract_connection(name),
    }

# ── 스펙 정규화 (상품명 기반) ────────────────────────────────────────────────

def _extract_layout(name: str) -> Optional[str]:
    n = name.upper()
    if "TKL" in n or "80%" in n:   return "TKL"
    if "75%" in n or " 75 " in n or "EX75" in n or "V3" in n.upper():  return "75"
    if "65%" in n or " 65 " in n:  return "65"
    if "60%" in n or " 60 " in n:  return "60"
    if "40%" in n or " 40 " in n:  return "40"
    if "100%" in n or "FULL" in n: return "FULL"
    # K-시리즈 모델명으로 추론
    m = re.search(r'\bK(\d+)\b', name, re.IGNORECASE)
    if m:
        num = int(m.group(1))
        if num in (1, 2, 7, 3):  return "75"
        if num in (6, 14):        return "65"
        if num in (8, 9, 17):     return "TKL"
        if num in (10, 4):        return "FULL"
    # B-시리즈
    m = re.search(r'\bB(\d+)\b', name, re.IGNORECASE)
    if m:
        num = int(m.group(1))
        if num in (1,):   return "75"
        if num in (6,):   return "FULL"
    # V-시리즈
    m = re.search(r'\bV(\d+)\b', name, re.IGNORECASE)
    if m:
        num = int(m.group(1))
        if num in (3, 6): return "TKL"
        if num in (10,):  return "FULL"
    # C-시리즈
    m = re.search(r'\bC(\d+)\b', name, re.IGNORECASE)
    if m:
        num = int(m.group(1))
        if num in (2,):   return "FULL"
    return None

def _extract_switch_type(name: str) -> Optional[str]:
    n = name.upper()
    # 영문 표기
    if "LINEAR"  in n: return "LINEAR"
    if "TACTILE" in n: return "TACTILE"
    if "CLICKY"  in n: return "CLICKY"
    # 한국어 표기
    if "리니어" in name: return "LINEAR"
    if "택타일" in name: return "TACTILE"
    if "클리키" in name: return "CLICKY"
    # 축 색상 표기 (적=RED=LINEAR, 갈=BROWN=TACTILE, 청=BLUE=CLICKY)
    if any(k in name for k in ["적축", "레드축", "RED축"]):   return "LINEAR"
    if any(k in name for k in ["갈축", "브라운축", "BROWN축"]): return "TACTILE"
    if any(k in name for k in ["청축", "블루축", "BLUE축"]):   return "CLICKY"
    # Keychron 전용 스위치명
    if "바나나축" in name: return "LINEAR"   # Keychron Banana = 저소음 리니어
    if "민트축"   in name: return "TACTILE"  # Keychron Mint   = 택타일
    if "라벤더축" in name: return "LINEAR"   # Keychron Lavender = 리니어
    if "자석축" in name: return "LINEAR"   # TMR 자석축 = 리니어 계열
    # 팬터그래프(저소음 가위식) → 별도 타입이지만 LINEAR에 가장 가까움
    if "팬터그래프" in name or "팬타그래프" in name or "Pantograph" in name:
        return "LINEAR"
    # 저소음 단독 표기 (스위치 타입 불명확 → 생략)
    return None

def _extract_connection(name: str) -> Optional[str]:
    n = name.upper()
    if any(k in name for k in ["무선", "블루투스", "블루트스"]) \
            or "WIRELESS" in n or "2.4G" in n or "BT5" in n:
        return "WIRELESS"
    if "유선" in name or "WIRED" in n:
        return "WIRED"
    # Keychron 모델명 기반 추론 (PRO MAX / PRO SE = 무선)
    if re.search(r'\b(K|V|B)\d+\s+PRO\s+(MAX|SE)', name, re.IGNORECASE):
        return "WIRELESS"
    return None

def _extract_connection_from_category(category: str) -> Optional[str]:
    if "무선" in category: return "WIRELESS"
    if "유선" in category: return "WIRED"
    return None

# ── Spring Boot API 연동 ─────────────────────────────────────────────────────

async def batch_upsert_to_spring(products: list, site_name: str, site_url: str) -> dict:
    headers = {"X-Internal-Key": INTERNAL_KEY, "Content-Type": "application/json"}
    payload  = {"siteName": site_name, "siteUrl": site_url, "products": products}
    async with httpx.AsyncClient(timeout=30) as client:
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

async def run_crawler(enable_playwright: bool = True) -> dict:
    """
    1단계: 네이버 쇼핑 API  → 기본 상품 수집 + 상품명 기반 스펙 추출
    2단계: brand.naver.com API (httpx) → 공식 스토어 상품 + 스펙 보완
    """
    print(f"[크롤러] 시작 — {datetime.now().isoformat()}")

    # ── 1단계 ─────────────────────────────────────────────────────────────────
    stage1_products: list = []
    queries = [
        # 브랜드 기본
        "키크론 키보드", "Keychron keyboard", "키크론",
        # 연결방식
        "키크론 무선 키보드", "키크론 블루투스 키보드", "키크론 유선 키보드",
        "keychron 무선", "keychron 블루투스", "keychron 유선",
        # 스위치
        "키크론 기계식 키보드", "키크론 저소음 키보드", "키크론 슬림 키보드",
        "keychron 기계식", "keychron 저소음",
        # 폼팩터
        "keychron 텐키리스", "keychron 풀배열", "keychron 75%",
        "키크론 텐키리스", "키크론 풀배열",
        # 시리즈
        "keychron K 시리즈", "keychron V 시리즈", "keychron Q 시리즈",
        "키크론 K2", "키크론 K8", "키크론 K10",
        "keychron 게이밍",
        # 주변기기
        "키크론 마우스", "키크론 키캡", "키크론 스위치",
        "keychron 키캡", "keychron 마우스",
    ]
    for query in queries:
        for start in [1, 101]:  # 1페이지 + 2페이지
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
                # 1단계 상품에 스펙 보완
                for u in unique:
                    if u.get("name", "").replace(" ", "") == p.get("name", "").replace(" ", ""):
                        for k in ["layout", "switchType", "mountingType", "connectionType"]:
                            if p.get(k) and not u.get(k):
                                u[k] = p[k]
                        break
    except Exception as e:
        print(f"[2단계] 오류: {e}")

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
        "spring_result": result,
    }
