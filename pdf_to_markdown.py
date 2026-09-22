# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "pymupdf4llm",
# ]
# ///

import argparse
from pathlib import Path
import pymupdf4llm


def convert_pdf_to_markdown(pdf_path: str, output_path: str | None = None) -> Path:
    """Converts a PDF document to Markdown while preserving columns and tables."""
    input_file = Path(pdf_path)

    if not input_file.is_file():
        raise FileNotFoundError(f"Source file not found: {input_file}")

    output_file = Path(output_path) if output_path else input_file.with_suffix(".md")

    print(f"Reading: {input_file}")
    markdown_content = pymupdf4llm.to_markdown(str(input_file))

    output_file.write_text(markdown_content, encoding="utf-8")
    print(f"Success: Markdown saved to {output_file}")

    return output_file


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Convert any PDF document to Markdown."
    )
    parser.add_argument("pdf_path", type=str, help="Path to the PDF file")
    parser.add_argument(
        "-o",
        "--output",
        type=str,
        default=None,
        help="Custom output .md path (optional)",
    )

    args = parser.parse_args()
    convert_pdf_to_markdown(args.pdf_path, args.output)