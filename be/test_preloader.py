"""
Simple test to verify PokeAPI connectivity and data structure
Run this to test without needing all dependencies
"""
import json
import urllib.request


def fetch_url(url):
    """Fetch URL with proper headers"""
    req = urllib.request.Request(url, headers={'User-Agent': 'Pokemon-Preloader/1.0'})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read())


def test_pokeapi():
    print("Testing PokeAPI connectivity...")
    print("=" * 60)
    
    # Test 1: Fetch Pokemon list
    print("\n1. Fetching first 10 Pokemon...")
    url = "https://pokeapi.co/api/v2/pokemon?limit=10"
    data = fetch_url(url)
    
    print(f"   Found {len(data['results'])} Pokemon:")
    for pokemon in data['results']:
        print(f"   - {pokemon['name'].capitalize()}")
    
    # Test 2: Fetch detailed info for first Pokemon
    print("\n2. Fetching details for Bulbasaur...")
    bulbasaur = fetch_url(data['results'][0]['url'])
    
    print(f"   Name: {bulbasaur['name'].capitalize()}")
    print(f"   ID: {bulbasaur['id']}")
    print(f"   Height: {bulbasaur['height']}")
    print(f"   Weight: {bulbasaur['weight']}")
    
    # Test 3: Check sprite URLs
    print("\n3. Available sprite URLs:")
    sprites = bulbasaur['sprites']
    print(f"   Front Default: {sprites['front_default']}")
    print(f"   High Quality (Home): {sprites['other']['home']['front_default']}")
    
    # Test 4: Download a sprite
    print("\n4. Testing sprite download...")
    sprite_url = sprites['other']['home']['front_default']
    req = urllib.request.Request(sprite_url, headers={'User-Agent': 'Pokemon-Preloader/1.0'})
    with urllib.request.urlopen(req) as response:
        image_data = response.read()
    print(f"   Downloaded {len(image_data)} bytes")
    
    print("\n" + "=" * 60)
    print("✓ All tests passed! PokeAPI is accessible.")
    print("\nYou can now run the full preloader once dependencies are installed:")
    print("  python3 -m services.pokemon_preloader")
    

if __name__ == "__main__":
    test_pokeapi()
