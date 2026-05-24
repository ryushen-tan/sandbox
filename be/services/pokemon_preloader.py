import asyncio
import json
import urllib.request
from io import BytesIO
from pathlib import Path

import google.generativeai as genai
from PIL import Image

from config import GEMINI_API_KEY, STORAGE_PATH


class PokemonPreloader:
    POKEAPI_BASE = "https://pokeapi.co/api/v2"
    PRELOADED_PATH = STORAGE_PATH / "preloaded"

    def __init__(self):
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY environment variable is not set")
        genai.configure(api_key=GEMINI_API_KEY)
        self.model = genai.GenerativeModel("gemini-2.0-flash-exp")
        self.PRELOADED_PATH.mkdir(parents=True, exist_ok=True)

    def fetch_json(self, url: str) -> dict:
        """Fetch JSON from URL"""
        req = urllib.request.Request(url, headers={'User-Agent': 'Pokemon-Preloader/1.0'})
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read())

    async def fetch_pokemon_list(self, limit: int = 10) -> list[dict]:
        """Fetch the first N Pokemon from PokeAPI"""
        url = f"{self.POKEAPI_BASE}/pokemon?limit={limit}"
        data = await asyncio.to_thread(self.fetch_json, url)
        return data["results"]

    async def fetch_pokemon_sprite(self, pokemon_url: str) -> tuple[str, str]:
        """Fetch Pokemon sprite URL and name"""
        data = await asyncio.to_thread(self.fetch_json, pokemon_url)
        name = data["name"]
        sprite_url = data["sprites"]["other"]["home"]["front_default"]
        if not sprite_url:
            sprite_url = data["sprites"]["front_default"]
        return name, sprite_url

    async def download_image(self, url: str) -> bytes:
        """Download image from URL"""
        req = urllib.request.Request(url, headers={'User-Agent': 'Pokemon-Preloader/1.0'})
        with urllib.request.urlopen(req) as response:
            return response.read()
        
    async def download_image_async(self, url: str) -> bytes:
        """Download image from URL asynchronously"""
        return await asyncio.to_thread(self.download_image, url)

    async def generate_face_image(self, name: str, image_bytes: bytes) -> str:
        """Generate a face-focused image using Gemini"""
        image = Image.open(BytesIO(image_bytes))

        prompt = (
            f"Generate a clear, front-facing portrait image of {name.capitalize()}'s face. "
            f"Focus on just the Pokemon's face and head, making it prominent and centered. "
            f"Keep the original art style but zoom in on the facial features. "
            f"The image should be clean and suitable as a profile picture."
        )

        response = self.model.generate_content([prompt, image])

        if not response.parts:
            raise ValueError(f"No image generated for {name}")

        output_path = self.PRELOADED_PATH / f"{name}.png"
        image_data = response.parts[0].inline_data.data

        with open(output_path, "wb") as f:
            f.write(image_data)

        return str(output_path.relative_to(STORAGE_PATH.parent))

    async def preload_pokemon(self, pokemon_id: int, pokemon_url: str):
        """Preload a single Pokemon face image"""
        try:
            print(f"Processing Pokemon #{pokemon_id}...")

            name, sprite_url = await self.fetch_pokemon_sprite(pokemon_url)
            print(f"  -> {name.capitalize()}: Downloading sprite...")

            image_bytes = await self.download_image_async(sprite_url)
            print(f"  -> {name.capitalize()}: Generating face image...")

            output_path = await self.generate_face_image(name, image_bytes)
            print(f"  -> {name.capitalize()}: Saved to {output_path}")

            return {"id": pokemon_id, "name": name, "path": output_path, "success": True}

        except Exception as e:
            print(f"  -> Error processing Pokemon #{pokemon_id}: {str(e)}")
            return {"id": pokemon_id, "error": str(e), "success": False}

    async def preload_all(self, limit: int = 10):
        """Preload face images for the first N Pokemon"""
        print(f"Starting preload of {limit} Pokemon faces...")
        print("=" * 60)

        pokemon_list = await self.fetch_pokemon_list(limit)
        print(f"Fetched {len(pokemon_list)} Pokemon from PokeAPI\n")

        tasks = []
        for idx, pokemon in enumerate(pokemon_list, start=1):
            tasks.append(self.preload_pokemon(idx, pokemon["url"]))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        print("\n" + "=" * 60)
        print("Preload Summary:")
        success_count = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
        print(f"  Successful: {success_count}/{len(pokemon_list)}")
        print(f"  Failed: {len(pokemon_list) - success_count}/{len(pokemon_list)}")
        print(f"  Images saved to: {self.PRELOADED_PATH}")
        print("=" * 60)

        return results


async def main():
    preloader = PokemonPreloader()
    await preloader.preload_all(limit=10)


if __name__ == "__main__":
    asyncio.run(main())
