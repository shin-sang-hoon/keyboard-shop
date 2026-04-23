"""
Keyboard Shop — FastAPI 메인
APScheduler: 매일 03:00 (Asia/Seoul) 자동 크롤링
"""

from contextlib import asynccontextmanager
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
        result = await run_crawler(enable_playwright=True)
        logger.info(f"[APScheduler] 완료: total={result.get('total')}")
    except Exception as e:
        logger.error(f"[APScheduler] 오류: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 서버 시작 시 스케줄러 등록
    scheduler.add_job(
        scheduled_crawl,
        trigger=CronTrigger(hour=3, minute=0),  # 매일 03:00 (Asia/Seoul)
        id="daily_crawler",
        replace_existing=True,
        misfire_grace_time=3600,  # 1시간 내 놓친 job 허용
    )
    scheduler.start()
    logger.info("[APScheduler] 스케줄러 시작 — 매일 03:00 크롤링 예약됨")
    yield
    # 서버 종료 시 스케줄러 정지
    scheduler.shutdown()
    logger.info("[APScheduler] 스케줄러 종료")


# ── FastAPI 앱 ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Keyboard Shop AI API",
    version="1.0.0",
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
async def run_crawler_endpoint(enable_playwright: bool = True):
    """수동 크롤링 트리거 (관리자용)"""
    result = await run_crawler(enable_playwright=enable_playwright)
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
