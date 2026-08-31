import asyncio
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from icalendar import Calendar, Event

from app.settings import SNAPSHOT, reload_if_changed, save_dynamic, validate_dynamic_config, ensure_files_exist, generate_secure_token

_FEEDS_CACHE: Dict[str, str] = {}
_LAST_REFRESH: Optional[str] = None
_LAST_ERROR: Optional[str] = None
_PARSING_PATTERN = re.compile(
    r"(?s)"
    r"(?=.*?\bAktivitet:\s*(?P<activity>[^\r\n]+))"
    r"(?=.*?\bLokalnamn:\s*(?P<room>[^.\r\n]+))"
)

# -------------------
# Link to settings.py
# -------------------

def get_dynamic():
    reload_if_changed()
    return SNAPSHOT.dynamic or {}

def get_options():
    reload_if_changed()
    return SNAPSHOT.options or {}

# -----------------------------------
# Calendar import, filter and parsing
# -----------------------------------

async def load_ics(url: str, timeout: int) -> Optional[Calendar]:
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=timeout, follow_redirects=True)
            response.raise_for_status()
            return Calendar.from_ical(response.content)
        except Exception as e:
            print(f"Error loading ICS from {url}: {e}")
            return None

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

def set_to_utc(dt: datetime) -> Optional[datetime]:
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    return None

def event_in_lookahead(event: Event, lookahead_days: int) -> bool:
    now = utc_now()
    lookahead_limit = now + timedelta(days=lookahead_days)
    start = set_to_utc(event.get("dtstart").dt)
    end = set_to_utc(event.get("dtend").dt)
    if start and end:
        return (now <= start <= lookahead_limit) or (now <= end <= lookahead_limit)
    return False

def category_filter(activity: str, allowed: List[str], base: List[str]) -> bool:
    if len(allowed) == 1 and allowed[0] == "*":
        return True
    elif activity in allowed:
        return True
    elif "?" in allowed and activity not in base:
        return True
    return False

def handle_event(event, source_info: dict, allowed_categories: List[str], lookahead: int) -> Tuple[bool, bool]:
    if event.name != "VEVENT":
        return False, False
    if not event_in_lookahead(event, lookahead):
        return False, False
    info = extract_event_info(event)

    out1 = source_info["output1"]["enabled"]
    if out1:
        out1 = category_filter(info["activity"].lower(), source_info["output1"]["allowed"], allowed_categories)
    out2 = source_info["output2"]["enabled"]
    if out2:
        out2 = category_filter(info["activity"].lower(), source_info["output2"]["allowed"], allowed_categories)

    if not out1 and not out2:
        return False, False

    format_event(event, info, source_info["name"])

    return out1, out2

def extract_event_info(event: Event) -> Dict[str, Any]:
    global _PARSING_PATTERN
    summary = str(event.get("LOCATION", ""))
    match = _PARSING_PATTERN.match(summary)
    if match:
        # for all named groups, strip whitespace
        clean = {k: v.strip() for k, v in match.groupdict().items() if v is not None}
        return clean
    raise ValueError(f"Could not parse event summary: {summary}")

def format_event(event: Event, info: Dict[str, str], calendar_name: str):
    event['location'] = info.get("room", "")
    event['summary'] = f"{calendar_name}: {info.get('activity', '').capitalize()}"
    event["description"] = event["url"]

async def reload_cached_feeds():
    global _FEEDS_CACHE, _LAST_REFRESH, _LAST_ERROR

    options = get_options()

    source_by_id = get_dynamic().get("sources", {})

    _FEEDS_CACHE = {}
    if options["output1"]["enabled"]:
        _FEEDS_CACHE[options["output1"]["salt"]]=''
    if options["output2"]["enabled"]:
        _FEEDS_CACHE[options["output2"]["salt"]]=''

    output1_events = []
    output2_events = []

    for _, source in source_by_id.items():
        # output1 or output2 enabled?
        if not (source.get("output1", {}).get("enabled") or source.get("output2", {}).get("enabled")):
            continue

        url: Optional[str] = source.get("url")
        if not url:
            continue

        cal: Optional[Calendar] = await load_ics(url, options.get("timeout_seconds", 20))
        if not cal:
            continue

        for component in cal.walk():
            out1, out2 = handle_event(component, source, options.get("categories", []), options.get("lookahead_days", 30))

            if out1:
                output1_events.append(component)
            if out2:
                output2_events.append(component)

    # build ics files for each output

    if options["output1"]["enabled"]:
        _FEEDS_CACHE[options["output1"]["salt"]] = build_ics(output1_events, options["output1"]["name"])
    if options["output2"]["enabled"]:
        _FEEDS_CACHE[options["output2"]["salt"]] = build_ics(output2_events, options["output2"]["name"])

    _LAST_REFRESH = utc_now().isoformat()
    _LAST_ERROR = None

def build_ics(events: List[Event], name: str) -> str:
    cal = Calendar()
    cal.add("prodid", "-//timeedit-merger//")
    cal.add("version", "2.0")

    cal.add("X-WR-CALNAME", f'HA: {name}')
    for ev in events:
        cal.add_component(ev)
    return cal.to_ical().decode("utf-8", errors="replace")

# ------------
# Refresh loop
# ------------

async def refresh_loop():
    global _LAST_ERROR
    await reload_cached_feeds()
    while True:
        opt = get_options()
        minutes = max(1, int(opt.get("refresh_minutes", 5)))
        await asyncio.sleep(minutes * 60)
        try:
            await reload_cached_feeds()
        except Exception as e:
            _LAST_ERROR = f"Error during refresh: {e}"
            print(_LAST_ERROR)


# -------
# Startup
# -------

@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_files_exist()
    reload_if_changed()
    asyncio.create_task(refresh_loop())
    yield

    # Any shutdown logic

app = FastAPI(title="TimeEdit Merger", version="0.1.2", lifespan=lifespan)

# Mount static files
static_dir = os.path.join(os.path.dirname(__file__), "..", "web", "public")
static_dir = os.path.abspath(static_dir)
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

# ----------
# Ingress UI
# ----------

@app.get("/", response_class=HTMLResponse)
async def index():
    path = os.path.join(os.path.dirname(__file__), "..", "web", "index.html")
    path = os.path.abspath(path)
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()
    return HTMLResponse(content=html, status_code=200)

# ---------
# Admin API
# ---------

@app.get("/api/dynamic")
async def get_dynamic_api(authorization: Optional[str] = Header(None)):
    # check_admin(None, authorization)
    return get_dynamic()

@app.post("/api/refresh")
async def refresh_api(authorization: Optional[str] = Header(None)):
    # check_admin(None, authorization)
    # force refresh feeds
    await reload_cached_feeds()

    return {"status": "ok"}

@app.get("/api/categories")
async def get_categories_api(authorization: Optional[str] = Header(None)):
    # check_admin(None, authorization)
    opt = get_options()
    return {"categories": opt.get("categories", [])}

@app.get("/api/salt")
async def get_new_salt_api(authorization: Optional[str] = Header(None)):
    # check_admin(None, authorization)
    return {"salt": generate_secure_token()}

@app.get("/api/status")
async def get_status_api():
    reload_if_changed()
    opt = get_options()
    dyn = get_dynamic()
    return {
        "last_refresh": _LAST_REFRESH,
        "last_error": _LAST_ERROR,
        "options_path": os.getenv("OPTIONS_PATH", "/data/options.json"),
        "dynamic_path": os.getenv("DYNAMIC_PATH", "/data/dynamic.json"),
        "refresh_minutes": opt.get("refresh_minutes"),
        "output1_enabled": opt.get("output1", {}).get("enabled", False),
        "output2_enabled": opt.get("output2", {}).get("enabled", False),
        "output1_url": f"/feed/{opt.get('output1', {}).get('salt')}.ics" if opt.get("output1", {}).get("enabled") else None,
        "output2_url": f"/feed/{opt.get('output2', {}).get('salt')}.ics" if opt.get("output2", {}).get("enabled") else None,
        "output1_name": opt.get("output1", {}).get("name"),
        "output2_name": opt.get("output2", {}).get("name"),
        "sources_count": len(dyn.get("sources", {})),
        "external_url": opt.get("external_url", ""),
    }

@app.put("/api/dynamic")
async def put_dynamic_api(data: Dict[str, Any], authorization: Optional[str] = Header(None)):
    # check_admin(None, authorization)
    try:
        validate_dynamic_config(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    save_dynamic(data)
    return {"status": "ok"}

@app.put("/api/dynamic/validate")
async def validate_dynamic_api(data: Dict[str, Any], authorization: Optional[str] = Header(None)):
    # check_admin(None, authorization)
    try:
        validate_dynamic_config(data)
        for data_item in data["sources"].values():
            res = await load_ics(data_item["url"], get_options().get("timeout_seconds", 20))
            if res is None:
                raise ValueError(f"Could not load ICS from {data_item['url']}")
        return {"status": "ok"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# -------------
# Feed endpoint
# -------------

@app.get("/feed/{feed_salt}.ics", response_class=PlainTextResponse)
async def feed(feed_salt: str, authorization: Optional[str] = Header(None)):
    # check_feed_token(feed_salt, authorization)

    # Get feed based on salt
    if feed_salt not in _FEEDS_CACHE:
        await reload_cached_feeds()

    ics = _FEEDS_CACHE.get(feed_salt)
    if not ics:
        raise HTTPException(status_code=404, detail=f"Unknown feed: {feed_salt}")

    return PlainTextResponse(
        content=ics,
        media_type="text/calendar; charset=utf-8",
        headers={"Cache-Control": "no-store"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)