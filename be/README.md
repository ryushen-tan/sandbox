# Pokemon Chopper API

Backend service that transforms Pokemon images to look "chopped" using AI.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

3. Run the server:
```bash
uvicorn main:app --reload
```

## API Endpoints

### POST /pokemon/chop

Transforms a Pokemon image to look degraded and uglier using AI.

**Parameters:**
- `file` (form-data): Image file (PNG/JPG, max 10MB)
- `intensity` (query, optional): Degradation intensity 1-10 (default: 5)

**Example:**
```bash
curl -X POST "http://localhost:8000/pokemon/chop?intensity=7" \
  -F "file=@pikachu.png"
```

**Response:**
```json
{
  "original_path": "storage/pokemon/original/20260524_123456_abc12345.png",
  "processed_path": "storage/pokemon/processed/20260524_123456_abc12345_chopped.png",
  "original_url": "http://localhost:8000/files/original/20260524_123456_abc12345.png",
  "processed_url": "http://localhost:8000/files/processed/20260524_123456_abc12345_chopped.png"
}
```

## Storage

Images are stored in:
- `storage/pokemon/original/` - Original uploaded images
- `storage/pokemon/processed/` - AI-transformed images

Access via `/files` endpoint.
