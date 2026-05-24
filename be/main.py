import random
import string

import socketio
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from config import BASE_URL, STORAGE_PATH, ensure_storage_dirs
from services.pokemon_chopper import PokemonChopper

# ── Socket.io ────────────────────────────────────────────────────────────────

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

# rooms: code → {players: [sid, ...], host: sid}
rooms: dict[str, dict] = {}
# reverse map: sid → room code
sid_room: dict[str, str] = {}


def _generate_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=4))


def _opponent(code: str, sid: str) -> str | None:
    room = rooms.get(code)
    if not room:
        return None
    for p in room["players"]:
        if p != sid:
            return p
    return None


@sio.event
async def connect(sid, environ):  # noqa: ARG001
    pass


@sio.event
async def disconnect(sid):
    code = sid_room.pop(sid, None)
    if not code:
        return
    opp = _opponent(code, sid)
    if opp:
        await sio.emit("opponent-disconnected", to=opp)
        sid_room.pop(opp, None)
    rooms.pop(code, None)


@sio.on("create-room")
async def create_room(sid):
    code = _generate_code()
    while code in rooms:
        code = _generate_code()
    rooms[code] = {"players": [sid], "host": sid}
    sid_room[sid] = code
    await sio.emit("room-created", {"code": code}, to=sid)


@sio.on("join-room")
async def join_room(sid, data):
    code = str(data.get("code", "")).upper()
    room = rooms.get(code)
    if not room:
        await sio.emit("join-error", {"message": "Room not found"}, to=sid)
        return
    if len(room["players"]) >= 2:
        await sio.emit("join-error", {"message": "Room is full"}, to=sid)
        return
    room["players"].append(sid)
    sid_room[sid] = code
    await sio.emit("match-ready", {"isHost": True}, to=room["host"])
    await sio.emit("match-ready", {"isHost": False}, to=sid)


# ── WebRTC signalling relay ──────────────────────────────────────────────────

@sio.event
async def offer(sid, data):
    code = sid_room.get(sid)
    opp = _opponent(code, sid) if code else None
    if opp:
        await sio.emit("offer", data, to=opp)


@sio.event
async def answer(sid, data):
    code = sid_room.get(sid)
    opp = _opponent(code, sid) if code else None
    if opp:
        await sio.emit("answer", data, to=opp)


@sio.on("ice-candidate")
async def ice_candidate(sid, data):
    code = sid_room.get(sid)
    opp = _opponent(code, sid) if code else None
    if opp:
        await sio.emit("ice-candidate", data, to=opp)


# ── Game events ──────────────────────────────────────────────────────────────

@sio.on("health-update")
async def health_update(sid, data):
    code = sid_room.get(sid)
    opp = _opponent(code, sid) if code else None
    if opp:
        await sio.emit("opponent-health", data, to=opp)


@sio.on("player-defeated")
async def player_defeated(sid):
    code = sid_room.get(sid)
    if not code:
        return
    opp = _opponent(code, sid)
    await sio.emit("match-ended", {"won": False}, to=sid)
    if opp:
        await sio.emit("match-ended", {"won": True}, to=opp)
    for p in list(rooms.get(code, {}).get("players", [])):
        sid_room.pop(p, None)
    rooms.pop(code, None)


# ── FastAPI ──────────────────────────────────────────────────────────────────

_api = FastAPI(title="Sandbox API")

_api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ensure_storage_dirs()
_api.mount("/files", StaticFiles(directory=str(STORAGE_PATH)), name="files")

# Lazy — only initialised when the endpoint is actually called
_chopper: PokemonChopper | None = None

def _get_chopper() -> PokemonChopper:
    global _chopper
    if _chopper is None:
        _chopper = PokemonChopper()
    return _chopper


@_api.get("/")
def read_root() -> dict[str, str]:
    return {"status": "ok"}


@_api.post("/pokemon/chop")
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
        result = await _get_chopper().chop_pokemon(content, intensity)
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


# ── Combined ASGI app — run with: uvicorn main:app ───────────────────────────

app = socketio.ASGIApp(sio, _api)
