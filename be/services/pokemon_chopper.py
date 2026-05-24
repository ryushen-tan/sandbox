import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path

import google.generativeai as genai
from PIL import Image

from config import GEMINI_API_KEY, ORIGINAL_PATH, PROCESSED_PATH


class PokemonChopper:
    def __init__(self):
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY environment variable is not set")
        genai.configure(api_key=GEMINI_API_KEY)
        self.model = genai.GenerativeModel("gemini-2.0-flash-exp")

    def _generate_filename(self, extension: str, suffix: str = "") -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        return f"{timestamp}_{unique_id}{suffix}.{extension}"

    def _get_image_format(self, image: Image.Image) -> str:
        return image.format.lower() if image.format else "png"

    async def chop_pokemon(
        self, file_content: bytes, intensity: int = 5
    ) -> dict[str, str]:
        try:
            image = Image.open(BytesIO(file_content))
            image_format = self._get_image_format(image)
            
            original_filename = self._generate_filename(image_format)
            original_path = ORIGINAL_PATH / original_filename
            image.save(original_path)

            prompt = (
                f"Transform this pokemon image to look more chopped, degraded, and uglier. "
                f"Intensity level: {intensity}/10. "
                f"The higher the intensity, the more degraded and uglier it should look."
            )

            response = self.model.generate_content([prompt, image])
            
            if not response.parts:
                raise ValueError("No image generated from Gemini API")

            processed_filename = self._generate_filename(image_format, "_chopped")
            processed_path = PROCESSED_PATH / processed_filename

            processed_image_data = response.parts[0].inline_data.data
            with open(processed_path, "wb") as f:
                f.write(processed_image_data)

            return {
                "original_path": str(original_path.relative_to(original_path.parents[2])),
                "processed_path": str(processed_path.relative_to(processed_path.parents[2])),
                "original_filename": original_filename,
                "processed_filename": processed_filename,
            }

        except Exception as e:
            raise RuntimeError(f"Failed to process pokemon image: {str(e)}") from e
