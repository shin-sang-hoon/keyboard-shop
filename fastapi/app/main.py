"""
Keyboard Shop — FastAPI 메인
APScheduler: 매일 03:00 (Asia/Seoul) 자동 크롤링

5-H D1 변경:
  - /crawler/run 에 sample_limit + enrich_images 쿼리 파라미터 추가
  - 부분 실행 (디버깅) + 다중 이미지 추출 토글 가능
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

# ── APScheduler 설정 ─────────────────────────────────────────────────────────

scheduler = AsyncIOScheduler(timezone="Asia/Seoul")


async def scheduled_crawl():
    """매일 03:00에 실행되는 크롤링 작업"""
    logger.info("[APScheduler] 자동 크롤링 시작")
    try:
        # 5-H D1: 자동 실행 시에도 다중 이미지 추출
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


# ── FastAPI 앱 ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Keyboard Shop AI API",
    version="1.1.0",   # 5-H D1
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
    enable_playwright: bool = True,        # legacy (현재 미사용)
    enrich_images: bool = True,            # 5-H D1: 다중 이미지 추출 토글
    sample_limit: Optional[int] = None,    # 5-H D1: 부분 실행 (디버깅)
):
    """
    수동 크롤링 트리거 (관리자용).

    파라미터:
      - enrich_images: 기본 True. False 면 detail API 호출 없이 stage1+2 만 (빠름)
      - sample_limit:  N 개만 처리. 디버깅용. None 이면 전체.

    예시:
      POST /crawler/run                              # 전체 + 다중 이미지
      POST /crawler/run?sample_limit=10              # 10개만 (테스트)
      POST /crawler/run?enrich_images=false          # 다중 이미지 추출 끄고 빠르게
      POST /crawler/run?sample_limit=5&enrich_images=true  # 5개로 D1 검증
    """
    result = await run_crawler(
        enable_playwright=enable_playwright,
        enrich_images=enrich_images,
        sample_limit=sample_limit,
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
