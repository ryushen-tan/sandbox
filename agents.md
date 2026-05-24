# Agent Instructions

This document contains instructions for AI agents working with this codebase.

## Pokemon Face Preloader

### When to Run
Run the Pokemon face preloader in these situations:
- First time setting up the project
- After clearing the storage directory
- When deploying to a new environment
- When the `be/storage/pokemon/preloaded/` directory is empty or missing

### How to Run

1. **Check if preloading is needed:**
   ```bash
   ls be/storage/pokemon/preloaded/
   ```
   If the directory is empty or doesn't exist, proceed with preloading.

2. **Verify dependencies are installed:**
   ```bash
   cd be
   pip install -r requirements.txt
   ```

3. **Ensure GEMINI_API_KEY is set:**
   Check that `be/.env` file exists and contains:
   ```
   GEMINI_API_KEY=your_key_here
   ```

4. **Run the preloader:**
   ```bash
   cd be
   python3 -m services.pokemon_preloader
   ```

5. **Verify success:**
   Check that 10 Pokemon face images were created:
   ```bash
   ls -l be/storage/pokemon/preloaded/
   ```
   You should see files like: `bulbasaur.png`, `charmander.png`, `squirtle.png`, etc.

### What This Does
- Fetches the first 10 Pokemon from PokeAPI
- Downloads their official sprites
- Uses Gemini AI to generate face-focused portrait images
- Saves pre-generated images to avoid delays during user interactions
- Takes approximately 10-15 seconds to complete

### Troubleshooting

**If you get "ModuleNotFoundError":**
```bash
cd be
pip install -r requirements.txt
```

**If you get "GEMINI_API_KEY environment variable is not set":**
- Ensure the `.env` file exists in the `be/` directory
- Add your Gemini API key: `GEMINI_API_KEY=your_key_here`
- Get a key from: https://aistudio.google.com/apikey

**If you get HTTP 403 errors:**
- The script includes proper User-Agent headers
- Check internet connectivity
- Verify PokeAPI is accessible: https://pokeapi.co/

**To test API connectivity without full dependencies:**
```bash
cd be
python3 test_preloader.py
```

### Additional Information
See `be/PRELOAD_POKEMON.md` for detailed documentation about customizing the preloader (changing the number of Pokemon, understanding output format, etc.).
