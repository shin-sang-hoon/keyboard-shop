from fastapi import FastAPI, HTTPException, Header
from dotenv import load_dotenv
import httpx
import os

load_dotenv()

app = FastAPI(title="Keyboard Shop AI API", version="1.0.0")

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")
SPRING_API_URL = os.getenv("SPRING_INTERNAL_API_URL")

def verify_internal_key(x_internal_key: str = Header(None)):
    if x_internal_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid internal API key")

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "keyboard-fastapi"}

@app.get("/products")
async def get_products():
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{SPRING_API_URL}/api/products")
        return response.json()
