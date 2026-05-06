"""
Keyboard Shop — FastAPI 메인
APScheduler: 매일 03:00 (Asia/Seoul) 자동 크롤링

5-H D1 변경:
  - /crawler/run 에 sample_limit + enrich_images + use_db_backfill 파라미터 추가
  - use_db_backfill=true 면 신규 크롤 skip + DB 의 기존 row 재사용 (.env 없어도 OK)

5-H D2 추가:
  - /crawler/keychron-playwright: keychron_* Playwright stealth detail 추출
  - /crawler/swagkey: swagkey.kr 자체 솔루션 풀 크롤 (네이버 차단 우회 path)

5-H D2 후속 (5/6 v2):
  - /crawler/swagkey 에 max_brand_hubs 파라미터 추가 (2-tier 풀 크롤)
"""

from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.crawler_service import run_crawler
from dotenv import load_dotenv
import logging

load_dotenv()
logger = logging.getLogger("keyboard.scheduler")

scheduler = AsyncIOScheduler(timezone="Asia/Seoul")


async def scheduled_crawl():
    """매일 03:00에 실행되는 크롤링 작업"""
    logger.info("[APScheduler] 자동 크롤링 시작")
    try:
        result = await run_crawler(enrich_images=True)
        total = result.get("total_unique")
        spring_result = result.get("spring_result", {})
        enrich_stats = result.get("enrich_stats", {})
        logger.info(
            f"[APScheduler] 완료: total={total}, "
            f"created={spring_result.get('created')}, "
            f"updated={spring_result.get('updated')}, "
            f"totalImages={spring_result.get('totalImages')}, "
            f"enriched={enrich_stats.get('enriched') if enrich_stats else 0}"
        )
    except Exception as e:
        logger.error(f"[APScheduler] 오류: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(
        scheduled_crawl,
        trigger=CronTrigger(hour=3, minute=0),
        id="daily_crawler",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.start()
    logger.info("[APScheduler] 스케줄러 시작 — 매일 03:00 크롤링 예약됨")
    yield
    scheduler.shutdown()
    logger.info("[APScheduler] 스케줄러 종료")


app = FastAPI(
    title="Keyboard Shop AI API",
    version="1.2.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health_check():
    job = scheduler.get_job("daily_crawler")
    next_run = job.next_run_time.isoformat() if job and job.next_run_time else None
    return {
        "status": "ok",
        "service": "keyboard-fastapi",
        "scheduler": "running" if scheduler.running else "stopped",
        "next_crawl": next_run,
    }


@app.get("/products")
async def get_products():
    return {"products": []}


@app.post("/crawler/run")
async def run_crawler_endpoint(
    enable_playwright: bool = True,
    enrich_images: bool = True,
    sample_limit: Optional[int] = None,
    use_db_backfill: bool = False,    # 5-H D1: DB 기존 row 재사용 모드
    chunk_size: int = 100,             # 5-H D2: Spring upsert 청크 사이즈
    skip_offset: int = 0,              # 5-H D2: 처음 N 개 skip (resume)
):
    """
    수동 크롤링 트리거 (관리자용).

    파라미터:
      - enrich_images:    detail API 호출해서 다중 이미지 추출 (기본 True)
      - sample_limit:     N 개만 처리. 디버깅용
      - use_db_backfill:  True 면 신규 크롤 skip + DB 의 기존 product 활용 (.env 없어도 OK)
      - chunk_size:       Spring 으로 한 번에 보내는 청크 사이즈 (기본 100)
      - skip_offset:      처음 N 개 건너뛰기 (중간 실패 후 resume 시 활용)

    예시:
      # 작은 검증 (DB 백필, 5개)
      POST /crawler/run?use_db_backfill=true&sample_limit=5

      # 전체 백필 (D2 본 실행, 100개씩 청크 분할)
      POST /crawler/run?use_db_backfill=true&chunk_size=100

      # 중간에 실패한 경우 resume (offset=500 부터)
      POST /crawler/run?use_db_backfill=true&skip_offset=500&chunk_size=100

      # 신규 크롤 (.env 있을 때만)
      POST /crawler/run?sample_limit=10
    """
    result = await run_crawler(
        enable_playwright=enable_playwright,
        enrich_images=enrich_images,
        sample_limit=sample_limit,
        use_db_backfill=use_db_backfill,
        chunk_size=chunk_size,
        skip_offset=skip_offset,
    )
    return result


@app.post("/crawler/keychron-playwright")
async def run_keychron_playwright_endpoint(
    sample_limit: Optional[int] = None,
    delay_seconds: float = 2.0,
    chunk_size: int = 50,
):
    """
    5-H D2: keychron_* product 만 Playwright stealth 로 detail 갤러리 다중 이미지 추출.

    네이버 외부 자동화 차단 (HTTP 429/418, WCPT 봇 챌린지) 우회용.
    brand.naver.com/keychron/products/{id} 페이지의 PRELOADED_STATE 에서
    representativeImageUrl + optionalImageUrls 추출.

    naver_* 일반 product 는 별도 path 필요 (window-products 페이지가 봇 챌린지 적용).

    파라미터:
      - sample_limit:    N 개만 처리 (디버깅용, None 이면 전체)
      - delay_seconds:   각 product 사이 딜레이 (기본 2초, 봇 감지 회피)
      - chunk_size:      Spring upsert 청크 사이즈 (기본 50)

    예시:
      # 작은 검증 (5개)
      POST /crawler/keychron-playwright?sample_limit=5&delay_seconds=1.5

      # 전체 keychron 본 실행
      POST /crawler/keychron-playwright
    """
    from app.crawler_service import run_keychron_playwright_backfill
    result = await run_keychron_playwright_backfill(
        sample_limit=sample_limit,
        delay_seconds=delay_seconds,
        chunk_size=chunk_size,
    )
    return result


@app.post("/crawler/swagkey")
async def run_swagkey_crawl_endpoint(
    sample_per_category: Optional[int] = None,
    delay_seconds: float = 1.0,
    headless: bool = True,
    target_categories: Optional[str] = None,  # 콤마 분리 "Keyboards,Switches"
    max_brand_hubs: Optional[int] = None,     # 5/6 v2: brand hub 진입 최대 수 (None=전체)
):
    """
    5-H D2 후속 v2: swagkey.kr (자체 솔루션) 2-tier 풀 크롤.

    네이버 검색 API 차단으로 path 전환:
    - 메인 카드 + 다중 이미지 = swagkey 데이터 (신규)
    - 3D 미리보기 = keychron_* (이미 적재됨, 16개 84장)
    - naver_* 2462개 INACTIVE (DB 보존, ProductList hide)

    사이트 구조 (3-tier):
      /{cate_id}                          카테고리 (예: /109 Keyboards)
        ├─ /{prd_no}                      brand hub (예: /1816928659 Swagkeys)
        │    └─ /{prd_no}/?idx={N}        진짜 상품 detail
        └─ /{cate_id}/?idx={N}            직접 노출 상품

    카테고리 6개:
    - Keyboards   (109)  → KEYBOARD
    - Switches    (21)   → SWITCH_PART
    - Keycaps     (23)   → ACCESSORY
    - Accessories (24)   → ACCESSORY
    - Lubricants  (26)   → ACCESSORY
    - Deskpads    (25)   → ACCESSORY

    파라미터:
      - sample_per_category: 카테고리별 detail 추출 최대 N 개 (None=전체)
      - delay_seconds:       각 detail page 사이 딜레이 (기본 1초)
      - headless:            브라우저 화면 안 보이게 (기본 True)
      - target_categories:   특정 카테고리만 콤마분리 "Keyboards,Switches"
      - max_brand_hubs:      brand hub 진입 최대 수 (테스트용, None=전체)

    예시:
      # 빠른 spike — Keyboards 만 brand hub 2개 진입 + 5개 detail (화면 보면서)
      POST /crawler/swagkey?target_categories=Keyboards&max_brand_hubs=2&sample_per_category=5&headless=false

      # Keyboards 전체 본 실행 (모든 brand hub 진입)
      POST /crawler/swagkey?target_categories=Keyboards

      # 전체 6 카테고리 본 실행 (수백~수천 상품, 1~2시간)
      POST /crawler/swagkey
    """
    from app.swagkey_crawler import run_swagkey_crawl

    target_list = None
    if target_categories:
        target_list = [c.strip() for c in target_categories.split(",") if c.strip()]

    result = await run_swagkey_crawl(
        sample_per_category=sample_per_category,
        target_categories=target_list,
        max_brand_hubs=max_brand_hubs,
        headless=headless,
        delay_seconds=delay_seconds,
    )
    return result


@app.get("/crawler/schedule")
async def get_schedule():
    """다음 크롤링 예정 시간 조회"""
    job = scheduler.get_job("daily_crawler")
    if not job:
        return {"error": "스케줄 없음"}
    return {
        "job_id": job.id,
        "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
        "timezone": "Asia/Seoul",
    }
