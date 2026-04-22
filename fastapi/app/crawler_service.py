import httpx
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

SPRING_URL = os.getenv("SPRING_INTERNAL_API_URL", "http://localhost:8080")
INTERNAL_KEY = os.getenv("INTERNAL_API_KEY", "keyboard-internal-secret-key")
NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET")

NAVER_SHOP_URL = "https://openapi.naver.com/v1/search/shop.json"


async def search_naver_products(query: str, display: int = 100, start: int = 1):
    headers = {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    }
    params = {
        "query": query,
        "display": display,
        "start": start,
        "sort": "sim",
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(NAVER_SHOP_URL, headers=headers, params=params)
        response.raise_for_status()
        return response.json()


def normalize_product(item: dict) -> dict:
    import re
    name = re.sub(r"<[^>]+>", "", item.get("title", ""))
    price = int(item.get("lprice", 0))
    image_url = item.get("image", "")
    product_url = item.get("link", "")
    source_id = f"naver_{item.get('productId', '')}"
    brand_name = item.get("brand", "Keychron")

    return {
        "sourceId": source_id,
        "name": name,
        "brandName": brand_name if brand_name else "Keychron",
        "imageUrl": image_url,
        "price": price,
        "productUrl": product_url,
        "layout": None,
        "switchType": None,
        "mountingType": None,
        "connectionType": None,
    }


async def upsert_to_spring(product: dict) -> dict:
    headers = {
        "X-Internal-Key": INTERNAL_KEY,
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SPRING_URL}/api/internal/crawler/upsert",
            json=product,
            headers=headers,
        )
        response.raise_for_status()
        return response.json()


async def run_crawler():
    queries = ["키크론 키보드", "Keychron keyboard"]
    results = []

    for query in queries:
        data = await search_naver_products(query)
        items = data.get("items", [])
        for item in items:
            product = normalize_product(item)
            result = await upsert_to_spring(product)
            results.append(result)

    return {
        "crawled_at": datetime.now().isoformat(),
        "total": len(results),
        "results": results,
    }