# -*- coding: utf-8 -*-
"""
Extrae imagenes de los PDFs Ficha Tecnica para el catalogo Isuzu.
Usa PyMuPDF para renderizar la primera pagina (portada con foto).
Guarda en frontend/public/images/ y actualiza model_images.json

Uso:
  1. pip install PyMuPDF   (o: py -3 -m pip install PyMuPDF)
  2. py -3 scripts/extract_images_from_pdf.py
"""

import json
import re
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Instala PyMuPDF: pip install PyMuPDF")
    raise SystemExit(1)

# Mapeo: nombre base del archivo PNG -> lista de modelos del catálogo que lo usan
# Se usa la primera página del PDF (portada) como imagen principal
PDF_TO_MODELOS = {
    "ELF 100E": ["ELF 100E"],
    "ELF 200 & 300": ["ELF 200E", "ELF 300E", "ELF 300H"],
    "ELF 350": ["ELF 350F", "ELF 350H", "ELF 350K"],
    "ELF 400 - 500 - 600": ["ELF 400F", "ELF 400H", "ELF 400K", "ELF 500F", "ELF 500H", "ELF 500K", "ELF 500M", "ELF 500M+", "ELF 600H", "ELF 600K", "ELF 600M", "ELF 600M+"],
    "FORWARD 800": ["FORWARD 800K", "FORWARD 800M"],
    "FORWARD 1100": ["FORWARD 1100L", "FORWARD 1100M", "FORWARD 1100Q"],
    "FORWARD 1400": ["FORWARD 1400K", "FORWARD 1400M", "FORWARD 1400Q"],
    "FORWARD 1800 & 2000": [],  # No hay en catálogo actual
}

def find_pdf_for_key(base_dir: Path, key: str) -> Path | None:
    """Encuentra el PDF Ficha Técnica que corresponde a una clave del mapeo."""
    key_lower = key.lower().replace("  ", " ")
    for f in base_dir.glob("*.pdf"):
        name = f.stem.replace(" (1)", "")
        n_lower = name.lower()
        if "sistema" in n_lower or "frenos" in n_lower or "suspensi" in n_lower or "dpd" in n_lower:
            continue
        if "ficha" not in n_lower and "te" not in n_lower:
            continue
        # Match por contenido de la clave
        if "100e" in key_lower and "100" in n_lower and "elf" in n_lower:
            return f
        if "200" in key_lower and "300" in key_lower and "200" in n_lower and "300" in n_lower and "elf" in n_lower:
            return f
        if "350" in key_lower and "350" in n_lower and "elf" in n_lower:
            return f
        if "400" in key_lower and "400" in n_lower and "elf" in n_lower:
            return f
        if "800" in key_lower and "800" in n_lower and "forward" in n_lower:
            return f
        if "1100" in key_lower and "1100" in n_lower:
            return f
        if "1400" in key_lower and "1400" in n_lower:
            return f
        if "1800" in key_lower and "1800" in n_lower:
            return f
    return None


def extract_first_page_image(pdf_path: Path, out_path: Path, dpi: int = 200, crop_top_pct: float = 0.65) -> bool:
    """Renderiza la primera pagina del PDF como PNG (parte superior = foto del camion)."""
    doc = fitz.open(str(pdf_path))
    if len(doc) == 0:
        doc.close()
        return False

    page = doc[0]
    # Renderizar a mayor resolución para buena calidad
    zoom = dpi / 72
    mat = fitz.Matrix(zoom, zoom)
    rect = page.rect
    # Recortar la parte superior (portada con foto del camión)
    clip = fitz.Rect(0, 0, rect.width, rect.height * crop_top_pct)
    pix = page.get_pixmap(matrix=mat, clip=clip, alpha=False)
    pix.save(str(out_path))
    doc.close()
    return True


def main():
    base = Path(__file__).resolve().parent.parent
    pdf_dir = base
    out_dir = base / "frontend" / "public" / "images"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Diccionario: slug del archivo -> modelos que usan esta imagen
    image_to_modelos: dict[str, list[str]] = {}

    for key, modelos in PDF_TO_MODELOS.items():
        if not modelos:
            continue
        pdf_path = find_pdf_for_key(pdf_dir, key)
        if not pdf_path:
            print("No se encontro PDF para: " + key)
            continue

        slug = re.sub(r"[^a-zA-Z0-9]+", "_", key).strip("_")
        out_path = out_dir / f"{slug}.png"
        if extract_first_page_image(pdf_path, out_path):
            print(f"OK: {out_path.name}")
            # Guardar ruta relativa para el frontend: /images/slug.png
            rel = f"/images/{slug}.png"
            for m in modelos:
                image_to_modelos[m] = rel
        else:
            print("Error extrayendo: " + str(pdf_path.name))

    # Mapeo modelo -> ruta imagen para el frontend
    map_path = base / "frontend" / "public" / "model_images.json"
    with open(map_path, "w", encoding="utf-8") as f:
        json.dump(image_to_modelos, f, indent=2, ensure_ascii=False)
    print(f"\nMapeo guardado: {map_path}")


if __name__ == "__main__":
    main()
