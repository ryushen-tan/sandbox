# Pokemon Face Preloader

This script fetches the first 10 Pokemon from PokeAPI and pre-generates face-focused images using Google's Gemini AI.

## Purpose

Pre-generating Pokemon face images avoids delays when users first access the application. Instead of generating images on-demand (which can take 5-10 seconds per Pokemon), the images are ready to serve immediately.

## Prerequisites

1. **Python Environment**: Ensure all dependencies from `requirements.txt` are installed
2. **Gemini API Key**: Set `GEMINI_API_KEY` in your `.env` file

## Installation

```bash
# From the be/ directory
pip install -r requirements.txt
```

## Usage

Run the preloader script:

```bash
# From the be/ directory
python3 -m services.pokemon_preloader
```

This will:
1. Fetch the first 10 Pokemon from PokeAPI (Bulbasaur through Caterpie)
2. Download their official sprites
3. Use Gemini AI to generate face-focused portrait images
4. Save the images to `storage/pokemon/preloaded/`

## Output

The script creates files like:
- `storage/pokemon/preloaded/bulbasaur.png`
- `storage/pokemon/preloaded/charmander.png`
- `storage/pokemon/preloaded/squirtle.png`
- etc.

## Customization

To preload more or fewer Pokemon, modify the `limit` parameter in `main()`:

```python
async def main():
    preloader = PokemonPreloader()
    await preloader.preload_all(limit=25)  # Change 10 to any number
```

## Troubleshooting

### "ModuleNotFoundError"
Make sure all dependencies are installed: `pip install -r requirements.txt`

### "GEMINI_API_KEY environment variable is not set"
1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Add it to your `.env` file: `GEMINI_API_KEY=your_key_here`

### "Failed to process pokemon"
Check your internet connection and ensure the PokeAPI is accessible.

## Performance

- Each Pokemon takes approximately 5-10 seconds to process
- The script processes all Pokemon concurrently (in parallel)
- Total time for 10 Pokemon: ~10-15 seconds
- Total time for 25 Pokemon: ~15-25 seconds
