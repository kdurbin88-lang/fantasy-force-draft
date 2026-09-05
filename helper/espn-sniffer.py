"""
Stand-alone ESPN draft sniffer. No project folder required.

1. Close ALL Edge windows.
2. PowerShell:

   Start-Process "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" `
     -ArgumentList "--remote-debugging-port=9222","--user-data-dir=$env:TEMP\\edge-draft-profile"

3. In THAT Edge: log into ESPN, open the draft room.
4. PowerShell:

   python $HOME\\espn-sniffer.py

5. In the Draft Command tab click ARM ESPN (clipboard + sniffer).
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
import urllib.request

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Installing playwright…")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright"])
    subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
    from playwright.sync_api import sync_playwright

LEAGUE = "296381258"
CDP = "http://127.0.0.1:9222"
ENDPOINTS = [
    "http://127.0.0.1:8080/api/draft/stream-picks",
    "http://localhost:3000/api/draft/stream-picks",
    "http://localhost:3001/api/draft/stream-picks",
]


def set_clip(text: str) -> None:
    try:
        subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "Set-Clipboard -Value ([Console]::In.ReadToEnd())",
            ],
            input=text.encode("utf-8"),
            check=False,
            timeout=5,
        )
    except Exception as exc:  # noqa: BLE001
        print("clipboard failed:", exc)


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
    for url in ENDPOINTS:
        try:
            req = urllib.request.Request(
                url,
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=2) as res:
                print(f"  posted {len(names)} -> {url} ({res.status})")
                return
        except Exception:
            continue


def interesting(url: str) -> bool:
    u = url.lower()
    return LEAGUE in u and (
        "mdraftdetail" in u
        or "view=mdraft" in u
        or "draftdetail" in u
        or "kona_playercard" in u
        or "view=" in u
    )


def main() -> None:
    print("Connecting to Edge on 9222…")
    with sync_playwright() as p:
        try:
            browser = p.chromium.connect_over_cdp(CDP)
        except Exception as exc:  # noqa: BLE001
            print("Could not attach. Close every Edge window, then start Edge with port 9222.")
            print(exc)
            sys.exit(1)
        context = browser.contexts[0] if browser.contexts else None
        if context is None:
            print("No Edge windows in the debug profile. Open ESPN there.")
            sys.exit(1)
        page = context.pages[0] if context.pages else None
        print(f"Attached. Tab: {page.url if page else '(none)'}")
        print("Leave the draft room in this Edge. Listening. Ctrl+C stops (Edge stays up).")
        last_key = ""
        last_clip = ""

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
            print(f"[{time.strftime('%H:%M:%S')}] ESPN wire · {len(names)} picks")
            block = "\n".join(names)
            set_clip(block)
            post_names(names)

        context.on("response", on_response)

        try:
            while True:
                time.sleep(2)
                if page is None:
                    continue
                try:
                    text = page.inner_text("body")
                except Exception:
                    continue
                low = text.lower()
                if text != last_clip and ("on the clock" in low or "pick history" in low or "drafted" in low):
                    last_clip = text
                    set_clip(text)
                    print(f"[{time.strftime('%H:%M:%S')}] page snapshot copied ({len(text)} chars)")
        except KeyboardInterrupt:
            print("Stopped. Edge left running.")


if __name__ == "__main__":
    main()
