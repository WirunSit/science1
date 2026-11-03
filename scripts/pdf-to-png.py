"""Render each page of a PDF to <name>-p<N>.png next to it (for checking slides/worksheets by eye)."""
import sys
from pathlib import Path

import pypdfium2 as pdfium

for arg in sys.argv[1:]:
    pdf_path = Path(arg)
    doc = pdfium.PdfDocument(str(pdf_path))
    for i, page in enumerate(doc, start=1):
        image = page.render(scale=1.5).to_pil()
        out = pdf_path.with_name(f"{pdf_path.stem}-p{i}.png")
        image.save(out)
    print(f"PNG: {len(doc)} page(s) from {pdf_path.name}")
