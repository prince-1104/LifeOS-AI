from PIL import Image

def process_image(filepath, make_square=False):
    try:
        img = Image.open(filepath)
        if make_square:
            # Need to pad to square
            width, height = img.size
            max_dim = max(width, height)
            # Create a transparent background image
            # Wait, since the original is jpg, it has no alpha. Let's make the background transparent or match edge color? Let's use transparent (RGBA)
            new_img = Image.new("RGBA", (max_dim, max_dim), (0, 0, 0, 0))
            paste_x = (max_dim - width) // 2
            paste_y = (max_dim - height) // 2
            # convert original to RGBA
            img_rgba = img.convert("RGBA")
            new_img.paste(img_rgba, (paste_x, paste_y))
            img_to_save = new_img
        else:
            img_to_save = img.convert("RGBA")
            
        # Save as valid PNG
        img_to_save.save(filepath, format="PNG")
        print(f"Fixed {filepath}")
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

if __name__ == "__main__":
    base_dir = "d:/Hopper/AI-Agents/TrackerAgent"
    # Files to make square AND true PNG
    square_files = [
        f"{base_dir}/frontend/public/icon.png",
        f"{base_dir}/mobile/assets/images/icon.png",
        f"{base_dir}/mobile/assets/images/adaptive-icon.png",
        f"{base_dir}/mobile/assets/images/favicon.png",
    ]
    # Files to just make true PNG
    png_files = [
        f"{base_dir}/frontend/public/logo.png",
        f"{base_dir}/mobile/assets/images/splash-icon.png",
    ]

    for f in square_files:
        process_image(f, make_square=True)
        
    for f in png_files:
        process_image(f, make_square=False)
