from __future__ import annotations

from pathlib import Path

from PIL import Image


def main() -> None:
    root = Path(__file__).resolve().parents[1] / "src" / "data" / "pic"
    steps = [root / f"step{i}.png" for i in range(1, 6)]

    print(f"[optimize-guide-images] root={root}")
    missing = [p for p in steps if not p.exists()]
    if missing:
        raise SystemExit(f"Missing files: {', '.join(str(p) for p in missing)}")

    for p in steps:
        img = Image.open(p)
        needs_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
        out_img = img.convert("RGBA" if needs_alpha else "RGB")
        out = p.with_suffix(".webp")
        # For UI screenshots/text, WebP quality ~80 is usually visually lossless with big size wins.
        out_img.save(out, format="WEBP", quality=80, method=6)

    print("[optimize-guide-images] done. sizes:")
    for i in range(1, 6):
        png = root / f"step{i}.png"
        webp = root / f"step{i}.webp"
        print(
            f"step{i}: png={png.stat().st_size/1024:.1f}KB  webp={webp.stat().st_size/1024:.1f}KB"
        )


if __name__ == "__main__":
    main()


