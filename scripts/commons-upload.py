#!/usr/bin/env python3
"""Noninteractive Wikimedia Commons upload used by the reviewed publisher."""

from __future__ import annotations

import argparse
from pathlib import Path

import pywikibot
from pywikibot.specialbots import UploadRobot


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("--filename", required=True)
    parser.add_argument("--mode", choices=("new", "new-version"), default="new")
    parser.add_argument("--description-file")
    parser.add_argument("--replacement-comment")
    args = parser.parse_args()

    source = Path(args.source).expanduser().resolve()
    if not source.is_file():
        raise SystemExit(f"Source photograph does not exist: {source}")

    site = pywikibot.Site("commons", "commons")
    site.login()

    if args.mode == "new-version":
        if not args.replacement_comment:
            raise SystemExit("--replacement-comment is required for new-version mode")
        file_page = pywikibot.FilePage(site, args.filename)
        if not file_page.exists():
            raise SystemExit(f"Commons replacement target does not exist: {file_page.title()}")
        if not file_page.has_permission():
            raise SystemExit(f"Authenticated account cannot replace: {file_page.title()}")
        uploaded = file_page.upload(
            str(source),
            comment=args.replacement_comment,
            ignore_warnings=["exists"],
        )
        if not uploaded:
            raise SystemExit(f"Commons new-version upload failed: {file_page.title()}")
        return

    if not args.description_file:
        raise SystemExit("--description-file is required for new-file uploads")
    description_path = Path(args.description_file).expanduser().resolve()
    if not description_path.is_file():
        raise SystemExit(f"Description file does not exist: {description_path}")

    bot = UploadRobot(
        str(source),
        description=description_path.read_text(encoding="utf-8"),
        use_filename=args.filename,
        target_site=site,
        aborts=True,
        always=True,
        summary="Uploaded by Jay Dixit through his reviewed local photo publication workflow",
    )
    bot.run()


if __name__ == "__main__":
    main()
