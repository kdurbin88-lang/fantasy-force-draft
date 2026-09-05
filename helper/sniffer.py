"""
Passive ESPN draft sniffer.
Attaches to Edge on port 9222 — you click picks in ESPN, we listen.

PowerShell (close Edge first):
  Start-Process "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" `
    -ArgumentList "--remote-debugging-port=9222","--user-data-dir=$env:TEMP\\edge-draft-profile"

Then log into ESPN, open the draft room, and run:
  python helper/sniffer.py
"""

from __future__ import annotations

import json
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

LEAGUE = "296381258"
ENDPOINTS = [
    "http://127.0.0.1:8080/api/draft/stream-picks",
    "http://localhost:3000/api/draft/stream-picks",
    "http://localhost:3001/api/draft/stream-picks",
]
CDP = "http://127.0.0.1:9222"


def extract_names(payload: object) -> list[str]:
    names: list[str] = []
    if not isinstance(payload, dict):
        return names
    picks = (payload.get("draftDetail") or {}).get("picks") or []
    for pick in picks:
        if not isinstance(pick, dict):
            continue
        pool = pick.get("playerPoolEntry") or {}
        player = (pool.get("player") if isinstance(pool, dict) else None) or pick.get("player") or {}
        name = ""
        if isinstance(player, dict):
            name = player.get("fullName") or ""
        if name:
            names.append(name)
    return names


def post_names(names: list[str]) -> None:
    body = json.dumps({"names": names}).encode()
    last_err = None
    for url in ENDPOINTS:
        try:
            req = urllib.request.Request(
                url,
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=3) as res:
                print(f"  synced {len(names)} names -> {url} ({res.status})")
                return
        except Exception as exc:  # noqa: BLE001
            last_err = exc
    print(f"  could not reach draft app: {last_err}")


def interesting(url: str) -> bool:
    u = url.lower()
    return LEAGUE in u and (
        "mdraftdetail" in u
        or "view=mdraft" in u
        or "draftdetail" in u
        or "kona_playercard" in u
    ) or ("/leagues/" + LEAGUE in u and "view=" in u)


def main() -> None:
    print("Connecting to Edge on 9222...")
    with sync_playwright() as p:
        try:
            browser = p.chromium.connect_over_cdp(CDP)
        except Exception as exc:  # noqa: BLE001
            print("Could not attach. Start Edge with --remote-debugging-port=9222")
            print(exc)
            sys.exit(1)
        context = browser.contexts[0] if browser.contexts else None
        if context is None:
            print("No Edge windows. Open ESPN in that debug Edge.")
            sys.exit(1)
        page = context.pages[0] if context.pages else None
        print(f"Attached. Tab: {page.url if page else '(none)'}")
        print("Open the ESPN draft room. Listening... Ctrl+C to stop (Edge stays open).")
        last_key = ""

        def on_response(response) -> None:
            nonlocal last_key
            url = response.url
            if not interesting(url):
                return
            try:
                payload = response.json()
            except Exception:
                return
            names = extract_names(payload)
            if not names:
                return
            key = "|".join(names)
            if key == last_key:
                return
            last_key = key
            print(f"[{time.strftime('%H:%M:%S')}] {len(names)} picks from ESPN")
            post_names(names)

        context.on("response", on_response)
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("Stopped. Edge left running.")


if __name__ == "__main__":
    main()
