from fastapi import FastAPI
from app.crawler_service import run_crawler
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Keyboard Shop AI API", version="1.0.0")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "keyboard-fastapi"}


@app.get("/products")
async def get_products():
    return {"products": []}


@app.post("/crawler/run")
async def run_crawler_endpoint():
    result = await run_crawler()
    return result