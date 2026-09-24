# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "pymupdf",
# ]
# ///

import argparse
import glob
from pathlib import Path
import fitz  # PyMuPDF


def parse_page_selection(page_spec: str | None, max_pages: int) -> set[int]:
    """
    Parses a 1-based string spec (e.g. "1,3,5-8,12") into 0-based indices.
    If page_spec is None or empty, returns all pages.
    """
    if not page_spec:
        return set(range(max_pages))

    selected_pages = set()
    parts = [p.strip() for p in page_spec.split(",") if p.strip()]

    for part in parts:
        if "-" in part:
            start_s, end_s = part.split("-", 1)
            try:
                start = int(start_s)
                end = int(end_s)
            except ValueError:
                raise ValueError(f"Invalid range syntax: '{part}'")

            # Handle 1-based index and boundary clamping
            for p in range(max(1, start), min(max_pages, end) + 1):
                selected_pages.add(p - 1)
        else:
            try:
                p = int(part)
            except ValueError:
                raise ValueError(f"Invalid page number: '{part}'")

            if 1 <= p <= max_pages:
                selected_pages.add(p - 1)

    return selected_pages


def extract_pdf_pages_to_png(
    pdf_path: Path,
    output_folder: Path,
    dpi: int = 300,
    page_spec: str | None = None,
) -> None:
    target_dir = output_folder / pdf_path.stem
    target_dir.mkdir(parents=True, exist_ok=True)

    zoom = dpi / 72.0
    matrix = fitz.Matrix(zoom, zoom)

    doc = fitz.open(pdf_path)
    total_pages = len(doc)

    try:
        pages_to_extract = parse_page_selection(page_spec, total_pages)
    except ValueError as e:
        print(f"Error parsing pages for '{pdf_path.name}': {e}")
        doc.close()
        return

    if not pages_to_extract:
        print(f"No valid pages selected for '{pdf_path.name}' (Total pages: {total_pages}).")
        doc.close()
        return

    print(
        f"Processing '{pdf_path.name}' ({len(pages_to_extract)}/{total_pages} pages) "
        f"at {dpi} DPI..."
    )

    for page_idx in sorted(pages_to_extract):
        page = doc.load_page(page_idx)
        pixmap = page.get_pixmap(matrix=matrix, alpha=False)
        out_filename = target_dir / f"page_{page_idx + 1:03d}.png"
        pixmap.save(out_filename)

    doc.close()
    print(f"Saved {len(pages_to_extract)} pages -> '{target_dir}'")


def resolve_inputs(patterns: list[str]) -> list[Path]:
    matched_files: set[Path] = set()

    for pattern in patterns:
        path = Path(pattern)
        if path.is_file() and path.suffix.lower() == ".pdf":
            matched_files.add(path.resolve())
            continue

        glob_matches = [Path(p).resolve() for p in glob.glob(pattern, recursive=True)]
        for match in glob_matches:
            if match.is_file() and match.suffix.lower() == ".pdf":
                matched_files.add(match)

    return sorted(matched_files)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract PDF pages as high-resolution PNGs."
    )
    parser.add_argument(
        "inputs",
        nargs="+",
        help="Path(s) or glob pattern(s) targeting PDF files (e.g. ./docs/*.pdf)",
    )
    parser.add_argument(
        "-p",
        "--pages",
        type=str,
        default=None,
        help="Pages to extract (1-based), e.g. '1,3,5-8'. Defaults to all pages.",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="extracted_pngs",
        help="Base directory for output images (default: extracted_pngs)",
    )
    parser.add_argument(
        "--dpi",
        type=int,
        default=300,
        help="DPI resolution for rendering (default: 300)",
    )

    args = parser.parse_args()
    pdf_files = resolve_inputs(args.inputs)
    output_dir = Path(args.output)

    if not pdf_files:
        print("No matching PDF files found.")
        return

    print(f"Found {len(pdf_files)} PDF(s) to process.\n")
    for pdf in pdf_files:
        extract_pdf_pages_to_png(
            pdf,
            output_dir,
            dpi=args.dpi,
            page_spec=args.pages,
        )
        print("-" * 50)


if __name__ == "__main__":
    main()