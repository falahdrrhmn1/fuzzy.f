#!/usr/bin/env python3
"""
Prepare product images from WhatsApp screenshots.
Crops UI areas, saves full-size (max 900px) and thumbnail (480px) versions.
Logo (image #3) is cropped to a centered circle.
"""

import os
import re
from pathlib import Path
from PIL import Image, ImageDraw
import sys

# Source and destination paths
SRC_DIR = Path(r"E:\fuzzy\gambar refrensi")
DST_PRODUCTS = Path(r"E:\fuzzy\fuzzy-flo-3d\public\products")
DST_BRAND = Path(r"E:\fuzzy\fuzzy-flo-3d\public\brand")

# Product mapping based on SPEC §0/§1 (sorted alphabetically by filename)
# Index 0-based, but file numbers are 1-based
PRODUCT_MAP = {
    1: ("pink-lily-tulip", "pink"),      # 1 (1).jpeg - pink
    2: ("pink-lily-tulip", "blue"),      # 1 (2).jpeg - blue variant
    3: ("logo", None),                    # logo
    4: ("sunflower-tulip", "main"),       # 1.31.11 PM.jpeg
    5: ("brown-lily-rose", "main"),       # 1.31.12 PM.jpeg
    6: ("pink-tulip-lily", "pink-main"),  # 1.31.14 PM.jpeg - pink main
    7: ("pink-tulip-lily", "purple-white"), # 1.31.15 (1).jpeg - purple/white variant
    8: ("pink-tulip-lily", "pink-alt1"),  # 1.31.15 (2).jpeg - pink alt
    9: ("pink-tulip-lily", "pink-alt2"),  # 1.31.15 PM.jpeg - pink alt
    10: ("jumbo-tulip-lights", "main"),   # 1.31.16 (1).jpeg
    11: ("garden-mix", "main"),           # 1.31.16 (2).jpeg
    12: ("jumbo-tulip-lights", "alt"),    # 1.31.16 PM.jpeg
    13: ("garden-mix", "alt"),            # 1.31.17 (1).jpeg
    14: ("tulip-daisy", "pink"),          # 1.31.17 (2).jpeg - pink
    15: ("tulip-daisy", "black"),         # 1.31.17 (3).jpeg - black variant (white tulip + deep red)
    16: ("garden-mix", "blue-pink"),      # 1.31.17 PM.jpeg - blue/pink variant
    17: ("tulip-daisy", "fuschia-nc"),    # 1.31.18 (1).jpeg - fuschia, no caption
    18: ("tulip-daisy", "lavender-nc"),   # 1.31.18 (2).jpeg - lavender, no caption
    19: ("tulip-daisy", "light-blue-nc"), # 1.31.18 PM.jpeg - light blue, no caption
}

# Expected image dimensions: 709x1600
# Product photo area approximately y=380..1260 (0-indexed)
CROP_TOP = 380
CROP_BOTTOM = 1260
CROP_LEFT = 0
CROP_RIGHT = 709

MAX_WIDTH = 900
THUMB_WIDTH = 480
JPEG_QUALITY = 82


def detect_photo_area(img: Image.Image) -> tuple:
    """
    Auto-detect the largest non-dark horizontal band in the image.
    Returns (top, bottom) pixel coordinates.
    """
    # Convert to grayscale for analysis
    gray = img.convert('L')
    width, height = gray.size
    
    # Sample horizontal bands to find the brightest contiguous region
    # typical UI: dark header (top ~80px), dark footer (bottom ~80px)
    band_height = 20
    bands = []
    
    for y in range(0, height - band_height, band_height):
        band = gray.crop((0, y, width, y + band_height))
        avg_brightness = sum(band.getdata()) / (width * band_height)
        bands.append((y, avg_brightness))
    
    # Find the longest contiguous sequence of bright bands
    # Threshold: significantly brighter than top/bottom
    top_avg = sum(b[1] for b in bands[:5]) / 5
    bottom_avg = sum(b[1] for b in bands[-5:]) / 5
    ui_threshold = max(top_avg, bottom_avg) + 10
    
    best_start = CROP_TOP
    best_end = CROP_BOTTOM
    best_length = 0
    
    current_start = None
    for y, brightness in bands:
        if brightness > ui_threshold:
            if current_start is None:
                current_start = y
        else:
            if current_start is not None:
                length = y - current_start
                if length > best_length:
                    best_length = length
                    best_start = current_start
                    best_end = y
                current_start = None
    
    # Check if we ended on a bright band
    if current_start is not None:
        length = bands[-1][0] + band_height - current_start
        if length > best_length:
            best_start = current_start
            best_end = bands[-1][0] + band_height
    
    # Fallback to defaults if detection fails
    if best_length < 200:
        return CROP_TOP, CROP_BOTTOM
    
    # Clamp to reasonable bounds
    best_start = max(0, min(best_start, height // 2))
    best_end = max(best_start + 200, min(best_end, height))
    
    return best_start, best_end


def crop_and_save(img: Image.Image, dst_path: Path, max_width: int, quality: int):
    """Resize if needed and save as JPEG."""
    if img.width > max_width:
        ratio = max_width / img.width
        new_height = int(img.height * ratio)
        img = img.resize((max_width, new_height), Image.LANCZOS)
    
    # Ensure RGB mode for JPEG
    if img.mode in ('RGBA', 'LA', 'P'):
        bg = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        bg.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
        img = bg
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst_path, 'JPEG', quality=quality, optimize=True)


def crop_to_circle(img: Image.Image, dst_path: Path, size: int = 512):
    """Crop image to a centered circle and save as PNG."""
    # Make square first
    min_dim = min(img.width, img.height)
    left = (img.width - min_dim) // 2
    top = (img.height - min_dim) // 2
    img = img.crop((left, top, left + min_dim, top + min_dim))
    
    # Resize to target size
    img = img.resize((size, size), Image.LANCZOS)
    
    # Create circular mask
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size, size), fill=255)
    
    # Apply mask
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    img.putalpha(mask)
    
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst_path, 'PNG')


def get_sorted_files():
    """Get all .jpeg files sorted alphabetically (Python's sorted)."""
    files = list(SRC_DIR.glob("*.jpeg"))
    files.sort(key=lambda p: p.name)
    return files


def main():
    print(f"Source: {SRC_DIR}")
    print(f"Dest products: {DST_PRODUCTS}")
    print(f"Dest brand: {DST_BRAND}")
    
    files = get_sorted_files()
    print(f"\nFound {len(files)} JPEG files:")
    for i, f in enumerate(files, 1):
        print(f"  {i}: {f.name}")
    
    if len(files) != 19:
        print(f"WARNING: Expected 19 files, got {len(files)}")
    
    for idx, src_file in enumerate(files, 1):
        print(f"\nProcessing #{idx}: {src_file.name}")
        
        try:
            img = Image.open(src_file)
            print(f"  Original size: {img.width}x{img.height}")
            
            if idx == 3:  # Logo
                crop_to_circle(img, DST_BRAND / "logo.png", size=512)
                print(f"  -> Saved logo to {DST_BRAND / 'logo.png'}")
                continue
            
            # Auto-detect crop area for product photos
            crop_top, crop_bottom = detect_photo_area(img)
            print(f"  Detected crop area: y={crop_top}..{crop_bottom}")
            
            # Crop the photo area
            cropped = img.crop((CROP_LEFT, crop_top, CROP_RIGHT, crop_bottom))
            print(f"  Cropped size: {cropped.width}x{cropped.height}")
            
            # Get product mapping
            if idx in PRODUCT_MAP:
                product_id, variant = PRODUCT_MAP[idx]
            else:
                print(f"  WARNING: No mapping for index {idx}, skipping")
                continue
            
            if product_id == "logo":
                continue
            
            # Determine output filename
            # Count existing files for this product to assign sequential numbers
            product_dir = DST_PRODUCTS / product_id
            existing = list(product_dir.glob("*.jpg")) if product_dir.exists() else []
            # Only count non-thumb files
            existing_nums = []
            for f in existing:
                m = re.match(r'^(\d+)\.jpg$', f.name)
                if m:
                    existing_nums.append(int(m.group(1)))
            next_num = max(existing_nums, default=0) + 1
            
            # Save full size
            full_path = product_dir / f"{next_num}.jpg"
            crop_and_save(cropped, full_path, MAX_WIDTH, JPEG_QUALITY)
            print(f"  -> Saved full: {full_path}")
            
            # Save thumbnail
            thumb_path = product_dir / f"{next_num}-thumb.jpg"
            crop_and_save(cropped, thumb_path, THUMB_WIDTH, JPEG_QUALITY)
            print(f"  -> Saved thumb: {thumb_path}")
            
        except Exception as e:
            print(f"  ERROR: {e}")
            import traceback
            traceback.print_exc()
    
    print("\nDone!")


if __name__ == "__main__":
    main()