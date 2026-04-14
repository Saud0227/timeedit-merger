# import asyncio
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse
from icalendar import Calendar, Event

# get version from config.json

app = FastAPI(title="TimeEdit Merger", version="0.0.1")

_FEEDS_CACHE: Dict[str, str] = {}
_LAST_REFRESH: Optional[str] = None
_LAST_ERROR: Optional[str] = None
_PARSING_PATTERN = re.compile(r"^.*?Aktivitet:\s*(?P<activity>.+?)\s*,\s*Lokalnamn:\s*(?P<room>.+?)(?:\.\s*|$).*$")

# -------------------
# Link to settings.py
# -------------------

def get_dynamic():
    # get the current dynamic state
    pass

# -----------------------------------
# Calendar import, filter and parsing
# -----------------------------------

def load_ics(url: str) -> Optional[Calendar]:
    try:
        response = httpx.get(url, timeout=10)
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

def handle_event(ev: Event, source_info: dict, allowed_categories: List[str], lookahead: int) -> Tuple[bool, bool]:
    if ev.name != "VEVENT":
        return False, False
    if not event_in_lookahead(ev, lookahead):
        return False, False
    info = extract_event_info(ev)

    out1 = source_info["output1"]["enabled"]
    if out1:
        out1 = category_filter(info["activity"], source_info["output1"]["allowed"], allowed_categories)
    out2 = source_info["output2"]["enabled"]
    if out2:
        out2 = category_filter(info["activity"], source_info["output2"]["allowed"], allowed_categories)

    if not out1 and not out2:
        return False, False

    format_event(ev, info, source_info["name"])

    return out1, out2

def extract_event_info(event: Event) -> Dict[str, Any]:
    global _PARSING_PATTERN
    summary = str(event.get("summary", ""))
    match = _PARSING_PATTERN.match(summary)
    if match:
        return match.groupdict()
    return {}

def format_event(event: Event, info: Dict[str, str], calendar_name: str):
    event['location'] = info.get("room", "")
    event['summary'] = f"{info.get('activity', '')} ({calendar_name})"

def reload_cached_feeds():
    global _FEEDS_CACHE, _LAST_REFRESH, _LAST_ERROR
    # load dyn data to get sources, currently load an example source
    # options = get_options()
    options: Dict[str, Any] = {
        "output1": {"name": "Private", "salt": "_PLACEHOLDER_SALT_TOKEN", "enabled": True},
        "output2": {"name": "Public", "salt": "_PLACEHOLDER_SALT_TOKEN", "enabled": True},
        "lookahead_days": 30,
        "categories": ["Föreläsning", "Handledning", "Räkneövning", "Seminarium"]
    }

    # sources = get_dynamic().get("sources", {})
    source_by_id: Dict[str, Any] = {
        "amS292CyHJkiRecx": {
            "name": "Mat Stat",
            "url": "https://cloud.timeedit.net/chalmers/web/student/ri6Y58b4yZ55Q9Q56dQQZ319Z151Q0jQ38nZ0nZ511585enu892t64BZC16987E6o82Fj90C1tl637F0FB3600FECk6Q4EB8F0.ics",
            "output1": {"enabled": True, "allowed": ["Föreläsning", "Handledning"]},
            "output2": {"enabled": True, "allowed": ["*"]}
        }
    }

    _FEEDS_CACHE = {}
    if options["output1"]["enabled"]:
        _FEEDS_CACHE[options["output1"]["salt"]]=''
    if options["output2"]["enabled"]:
        _FEEDS_CACHE[options["output2"]["salt"]]=''

    output1_events = []
    output2_events = []

    for source_id, source in source_by_id.items():
        # output1 or output2 enabled?
        if not (source.get("output1", {}).get("enabled") or source.get("output2", {}).get("enabled")):
            continue

        url = source.get("url")
        if not url:
            continue

        cal: Optional[Calendar] = load_ics(url)
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
        _FEEDS_CACHE[options["output1"]["salt"]] = build_ics(output1_events)
    if options["output2"]["enabled"]:
        _FEEDS_CACHE[options["output2"]["salt"]] = build_ics(output2_events)

    _LAST_REFRESH = utc_now().isoformat()
    _LAST_ERROR = None

def build_ics(events: List[Event]) -> str:
    cal = Calendar()
    cal.add("prodid", "-//timeedit-merger//")
    cal.add("version", "2.0")
    for ev in events:
        cal.add_component(ev)
    return cal.to_ical().decode("utf-8", errors="replace")

# -------
# Startup
# -------

@app.on_event("startup")
async def startup_event():
    # ensure settings files exist

    # reload dyn

    # start background refresh task
    pass

# ----------
# Ingress UI
# ----------


@app.get("/", response_class=HTMLResponse)
async def index():
    path = os.path.join(os.path.dirname(__file__), "..", "web", "index.html")
    path = os.abspath(path)
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
    # _FEEDS_CACHE.clear()
    return {"status": "ok"}

@app.put("/api/dynamic")
async def put_dynamic_api(data: Dict[str, Any], authorization: Optional[str] = Header(None)):
    # check_admin(None, authorization)
    # validate data
    # save_dynamic(data)
    return {"status": "ok"}



# -------------
# Feed endpoint
# -------------

@app.get("/feed/{feed_salt}.ics", response_class=PlainTextResponse)
async def feed(feed_salt: str, authorization: Optional[str] = Header(None)):
    # check_feed_token(feed_salt, authorization)

    # Get feed based on salt

    # For now, just return a placeholder
    return PlainTextResponse(content=f"Feed for salt: {feed_salt}", status_code=200)

