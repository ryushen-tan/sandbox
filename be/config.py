import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).parent
STORAGE_PATH = BASE_DIR / "storage" / "pokemon"
ORIGINAL_PATH = STORAGE_PATH / "original"
PROCESSED_PATH = STORAGE_PATH / "processed"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")

def ensure_storage_dirs():
    ORIGINAL_PATH.mkdir(parents=True, exist_ok=True)
    PROCESSED_PATH.mkdir(parents=True, exist_ok=True)
