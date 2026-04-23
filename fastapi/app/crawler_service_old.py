"""
크롤러 서비스 — 2단계 구조
  1단계: 네이버 쇼핑 오픈 API  → 상품명·가격·이미지 수집
  2단계: Playwright            → brand.naver.com/keychron 상세 스펙 수집
"""

import asyncio
import re
import time
import urllib.robotparser
from datetime import datetime
from typing import Optional

import httpx
from dotenv import load_dotenv
import os

load_dotenv()

SPRING_URL = os.getenv("SPRING_INTERNAL_API_URL", "http://localhost:8080")
INTERNAL_KEY = os.getenv("INTERNAL_API_KEY", "keyboard-internal-secret-key")
NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET")

NAVER_SHOP_URL = "https://openapi.naver.com/v1/search/shop.json"
KEYCHRON_BRAND_URL = "https://brand.naver.com/keychron"

# ── robots.txt 캐시 ──────────────────────────────────────────────────────────

_robots_cache: dict[str, urllib.robotparser.RobotFileParser] = {}

def _get_robots(base_url: str) -> urllib.robotparser.RobotFileParser:
    if base_url not in _robots_cache:
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(f"{base_url}/robots.txt")
        try:
            rp.read()
        except Exception:
            pass  # robots.txt 없으면 허용으로 간주
        _robots_cache[base_url] = rp
    return _robots_cache[base_url]

def can_fetch(url: str) -> bool:
    """robots.txt 규칙 확인 (허용 여부)"""
    base = "/".join(url.split("/")[:3])
    rp = _get_robots(base)
    return rp.can_fetch("*", url)

# ── 1단계: 네이버 쇼핑 오픈 API ─────────────────────────────────────────────

async def search_naver_products(query: str, display: int = 100, start: int = 1) -> dict:
    headers = {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    }
    params = {"query": query, "display": display, "start": start, "sort": "sim"}
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(NAVER_SHOP_URL, headers=headers, params=params)
        response.raise_for_status()
        return response.json()


def normalize_product(item: dict) -> dict:
    name = re.sub(r"<[^>]+>", "", item.get("title", ""))
    price = int(item.get("lprice", 0))
    source_id = f"naver_{item.get('productId', '')}"
    brand_name = item.get("brand", "") or "Keychron"

    return {
        "sourceId": source_id,
        "name": name,
        "brandName": brand_name,
        "imageUrl": item.get("image", ""),
        "price": price,
        "productUrl": item.get("link", ""),
        "layout": None,
        "switchType": None,
        "mountingType": None,
        "connectionType": None,
    }

# ── 2단계: Playwright → Keychron 상세 스펙 ──────────────────────────────────

async def fetch_keychron_spec(product_url: str, delay_sec: float = 1.5) -> dict:
    """
    Playwright로 Keychron 제품 상세 페이지에서 스펙 추출.
    layout / switchType / mountingType / connectionType 반환.
    """
    if not can_fetch(product_url):
        print(f"[robots.txt] 크롤링 차단됨: {product_url}")
        return {}

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("[Playwright] playwright 미설치 — pip install playwright && playwright install chromium")
        return {}

    spec = {}
    await asyncio.sleep(delay_sec)  # 요청 간 딜레이 (1.5초)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            page = await browser.new_page(
                user_agent="Mozilla/5.0 (compatible; KeyboardShopBot/1.0)"
            )
            await page.goto(product_url, wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(2000)  # JS 렌더링 대기

            # 스펙 테이블 파싱 (네이버 스마트스토어 공통 패턴)
            rows = await page.query_selector_all("table.prod-attr-item")
            for row in rows:
                try:
                    label_el = await row.query_selector("th")
                    value_el = await row.query_selector("td")
                    if not label_el or not value_el:
                        continue
                    label = (await label_el.inner_text()).strip().lower()
                    value = (await value_el.inner_text()).strip()

                    if "레이아웃" in label or "layout" in label:
                        spec["layout"] = _normalize_layout(value)
                    elif "스위치" in label or "switch" in label:
                        spec["switchType"] = _normalize_switch_type(value)
                    elif "마운팅" in label or "mounting" in label:
                        spec["mountingType"] = value
                    elif "연결" in label or "connection" in label or "연결방식" in label:
                        spec["connectionType"] = _normalize_connection(value)
                except Exception:
                    continue
        except Exception as e:
            print(f"[Playwright] 페이지 로드 실패: {product_url} — {e}")
        finally:
            await browser.close()

    return spec


def _normalize_layout(raw: str) -> Optional[str]:
    raw = raw.upper()
    if "100" in raw or "FULL" in raw:
        return "FULL"
    if "TKL" in raw or "80" in raw or "텐키리스" in raw:
        return "TKL"
    if "75" in raw:
        return "75"
    if "65" in raw:
        return "65"
    if "60" in raw:
        return "60"
    if "40" in raw:
        return "40"
    return None


def _normalize_switch_type(raw: str) -> Optional[str]:
    raw_up = raw.upper()
    if "LINEAR" in raw_up or "리니어" in raw or "클릭리스" in raw:
        return "LINEAR"
    if "TACTILE" in raw_up or "택타일" in raw:
        return "TACTILE"
    if "CLICKY" in raw_up or "클리키" in raw:
        return "CLICKY"
    return None


def _normalize_connection(raw: str) -> Optional[str]:
    raw_up = raw.upper()
    if "WIRELESS" in raw_up or "무선" in raw or "블루투스" in raw:
        return "WIRELESS"
    if "WIRED" in raw_up or "유선" in raw:
        return "WIRED"
    if "2.4G" in raw_up:
        return "WIRELESS"
    return None

# ── Spring Boot 배치 API 연동 ────────────────────────────────────────────────

async def batch_upsert_to_spring(
    products: list[dict],
    site_name: str,
    site_url: str,
) -> dict:
    headers = {
        "X-Internal-Key": INTERNAL_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "siteName": site_name,
        "siteUrl": site_url,
        "products": products,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{SPRING_URL}/api/internal/crawler/upsert-batch",
            json=payload,
            headers=headers,
        )
        response.raise_for_status()
        return response.json()

# ── 단건 upsert (기존 호환) ──────────────────────────────────────────────────

async def upsert_to_spring(product: dict) -> dict:
    headers = {
        "X-Internal-Key": INTERNAL_KEY,
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            f"{SPRING_URL}/api/internal/crawler/upsert",
            json=product,
            headers=headers,
        )
        response.raise_for_status()
        return response.json()

# ── 메인 크롤러 실행 ─────────────────────────────────────────────────────────

async def run_crawler(enable_playwright: bool = True) -> dict:
    """
    1단계: 네이버 쇼핑 API 크롤링
    2단계: Playwright로 각 상품 상세 스펙 보완 (enable_playwright=True 시)
    """
    queries = ["키크론 키보드", "Keychron keyboard"]
    products: list[dict] = []

    print(f"[크롤러] 시작 — {datetime.now().isoformat()}")

    # ── 1단계 ────────────────────────────────────────────────────────────────
    for query in queries:
        try:
            data = await search_naver_products(query)
            items = data.get("items", [])
            print(f"[1단계] '{query}' → {len(items)}개 수집")
            for item in items:
                products.append(normalize_product(item))
            await asyncio.sleep(1.0)  # API 요청 간 딜레이
        except Exception as e:
            print(f"[1단계] 오류: {e}")

    # 중복 sourceId 제거
    seen = set()
    unique_products: list[dict] = []
    for p in products:
        if p["sourceId"] not in seen:
            seen.add(p["sourceId"])
            unique_products.append(p)
    print(f"[1단계] 중복 제거 후: {len(unique_products)}개")

    # ── 2단계: Playwright 상세 스펙 보완 ─────────────────────────────────────
    if enable_playwright:
        print("[2단계] Playwright 스펙 수집 시작")
        for p in unique_products:
            url = p.get("productUrl", "")
            if not url:
                continue
            try:
                spec = await fetch_keychron_spec(url, delay_sec=1.5)
                if spec:
                    p.update({k: v for k, v in spec.items() if v is not None})
                    print(f"  → 스펙 보완: {p['name'][:30]}... {spec}")
            except Exception as e:
                print(f"  → Playwright 실패: {e}")
    else:
        print("[2단계] Playwright 비활성화 (enable_playwright=False)")

    # ── Spring Boot 배치 upsert ───────────────────────────────────────────────
    try:
        result = await batch_upsert_to_spring(
            products=unique_products,
            site_name="naver_shopping",
            site_url=NAVER_SHOP_URL,
        )
        print(f"[배치 upsert] 완료: {result}")
    except Exception as e:
        print(f"[배치 upsert] 오류: {e}")
        result = {"error": str(e)}

    return {
        "crawled_at": datetime.now().isoformat(),
        "total": len(unique_products),
        "spring_result": result,
    }
