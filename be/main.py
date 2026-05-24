from fastapi import FastAPI

app = FastAPI(title="Sandbox API")


@app.get("/")
def read_root() -> dict[str, str]:
    return {"status": "ok"}
