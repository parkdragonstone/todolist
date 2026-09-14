"""Design Ref: §5.5 — PWA 아이콘 생성 (다크 배경 + 코랄 레드 원 + 흰 체크).

favicon.svg와 같은 도형을 4배 크기로 그린 뒤 축소해 안티앨리어싱한다.
실행: python3 scripts/make_icons.py  (Pillow 필요)
"""

from pathlib import Path

from PIL import Image, ImageDraw

BG = (17, 18, 20, 255)
PRIMARY = (242, 61, 82, 255)
WHITE = (255, 255, 255, 255)
SUPERSAMPLE = 4
BASE_CIRCLE = 352 / 512  # favicon.svg 원 지름 비율
CHECK_POINTS = [(168, 262), (228, 322), (344, 194)]  # favicon.svg path (512 viewBox)
CHECK_WIDTH = 44
OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "icons"


def render(size: int, *, full_bleed: bool, circle: float = BASE_CIRCLE) -> Image.Image:
    s = size * SUPERSAMPLE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if full_bleed:
        draw.rectangle([0, 0, s, s], fill=BG)
    else:
        draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 112 / 512), fill=BG)

    center = s / 2
    radius = s * circle / 2
    draw.ellipse([center - radius, center - radius, center + radius, center + radius], fill=PRIMARY)

    scale = circle / BASE_CIRCLE

    def point(x: float, y: float) -> tuple[float, float]:
        return (center + (x - 256) / 512 * s * scale, center + (y - 256) / 512 * s * scale)

    width = CHECK_WIDTH / 512 * s * scale
    points = [point(x, y) for x, y in CHECK_POINTS]
    draw.line(points, fill=WHITE, width=round(width), joint="curve")
    for px, py in (points[0], points[-1]):  # round line caps
        draw.ellipse([px - width / 2, py - width / 2, px + width / 2, py + width / 2], fill=WHITE)

    return img.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    render(192, full_bleed=False).save(OUT_DIR / "icon-192.png")
    render(512, full_bleed=False).save(OUT_DIR / "icon-512.png")
    # maskable: 전체를 배경으로 채우고 원을 안전 영역(지름 80%) 안에 둔다
    render(512, full_bleed=True, circle=0.6).convert("RGB").save(OUT_DIR / "maskable-512.png")
    # iOS는 모서리를 직접 둥글게 자르므로 투명 영역 없이 채운다
    render(180, full_bleed=True).convert("RGB").save(OUT_DIR / "apple-touch-icon.png")
    print(f"icons written to {OUT_DIR}")


if __name__ == "__main__":
    main()
