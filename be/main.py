from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from config import BASE_URL, STORAGE_PATH, ensure_storage_dirs
from services.pokemon_chopper import PokemonChopper

app = FastAPI(title="Sandbox API")

ensure_storage_dirs()

app.mount("/files", StaticFiles(directory=str(STORAGE_PATH)), name="files")

chopper = PokemonChopper()


@app.get("/")
def read_root() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/pokemon/chop")
async def chop_pokemon_image(
    file: UploadFile = File(...),
    intensity: int = Query(default=5, ge=1, le=10),
) -> JSONResponse:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        content = await file.read()
        
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size must be less than 10MB")

        result = await chopper.chop_pokemon(content, intensity)

        return JSONResponse(
            content={
                "original_path": result["original_path"],
                "processed_path": result["processed_path"],
                "original_url": f"{BASE_URL}/files/original/{result['original_filename']}",
                "processed_url": f"{BASE_URL}/files/processed/{result['processed_filename']}",
            }
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
