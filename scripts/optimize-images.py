"""Convert large PNG screenshots in public/landing/ to optimized WebP images.

Usage: python scripts/optimize-images.py
"""

import os
import sys
from PIL import Image

LANDING_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "landing")

# Target max width for desktop screenshots (hero UI mockups)
MAX_WIDTH = 1200
# WebP quality (0-100). 80 is a great balance for screenshots
QUALITY = 80

def optimize_image(filepath: str) -> tuple[str, int, int]:
    """Convert a PNG to optimized WebP. Returns (webp_path, original_size, new_size)."""
    original_size = os.path.getsize(filepath)
    
    img = Image.open(filepath).convert("RGB")
    
    # Downscale if wider than MAX_WIDTH
    if img.width > MAX_WIDTH:
        ratio = MAX_WIDTH / img.width
        new_height = int(img.height * ratio)
        img = img.resize((MAX_WIDTH, new_height), Image.LANCZOS)
    
    webp_path = os.path.splitext(filepath)[0] + ".webp"
    img.save(webp_path, "WEBP", quality=QUALITY, method=6)
    
    new_size = os.path.getsize(webp_path)
    return webp_path, original_size, new_size


def main():
    if not os.path.isdir(LANDING_DIR):
        print(f"Error: {LANDING_DIR} not found")
        sys.exit(1)
    
    png_files = sorted(f for f in os.listdir(LANDING_DIR) if f.lower().endswith(".png"))
    
    if not png_files:
        print("No PNG files found in public/landing/")
        return
    
    total_original = 0
    total_new = 0
    
    print(f"{'File':<40} {'Original':>12} {'Optimized':>12} {'Savings':>10}")
    print("-" * 76)
    
    for png_file in png_files:
        png_path = os.path.join(LANDING_DIR, png_file)
        webp_path, original_size, new_size = optimize_image(png_path)
        
        savings_pct = (1 - new_size / original_size) * 100
        total_original += original_size
        total_new += new_size
        
        original_mb = original_size / (1024 * 1024)
        new_mb = new_size / (1024 * 1024)
        
        print(f"{png_file:<40} {original_mb:>8.2f}MB {new_mb:>8.2f}MB {savings_pct:>7.1f}%")
    
    total_original_mb = total_original / (1024 * 1024)
    total_new_mb = total_new / (1024 * 1024)
    total_savings = (1 - total_new / total_original) * 100
    
    print("-" * 76)
    print(f"{'TOTAL':<40} {total_original_mb:>8.2f}MB {total_new_mb:>8.2f}MB {total_savings:>7.1f}%")
    print(f"\n✅ Converted {len(png_files)} images to WebP. Original PNGs were kept in place.")


if __name__ == "__main__":
    main()
