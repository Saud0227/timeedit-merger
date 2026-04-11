# import asyncio
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse
from icalendar import Calendar, Event

# get version from config.json

app = FastAPI(title="TimeEdit Merger", version="0.0.1")

_FEEDS_CACHE: Dict[str, str] = {}
_LAST_REFRESH: Optional[str] = None
_LAST_ERROR: Optional[str] = None
_OUTPUT_NAMES: List[str] = ["output1", "output2"]
_PARSING_PATTERN = re.compile(r"^.*?Aktivitet:\s*(?P<activity>.+?)\s*,\s*Lokalnamn:\s*(?P<room>.+?)(?:\.\s*|$).*$")

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


def generate_events(cal: Calendar, lookahead: int) -> List[Dict[str, Any]]:
    events = []
    for component in cal.walk():
        if component.name != "VEVENT":
            continue
        if not event_in_lookahead(component, lookahead):
            continue
        info = extract_event_info(component)
        info["ev"] = component
        events.append(info)
    return events

def extract_event_info(event: Event) -> Dict[str, str]:
    global _PARSING_PATTERN
    summary = str(event.get("summary", ""))
    match = _PARSING_PATTERN.match(summary)
    if match:
        return match.groupdict()
    return {}

def format_event(event: Event, info: Dict[str, str], calendar_name: str) -> Event:
    event['location'] = info.get("room", "")
    event['summary'] = f"{info.get('activity', '')} ({calendar_name})"
    return event


def reload_cached_feeds():
    # load dyn data to get sources, currently load an example source
    # options = get_options()
    options: Dict[str, Any] = {
        ### ....
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

    events_by_id: Dict[str, Dict[str, Any]] = {}

    for source_id, source in source_by_id.items():
        # output1 or output2 enabled?
        if not (source.get("output1", {}).get("enabled") or source.get("output2", {}).get("enabled")):
            continue

        url = source.get("url")
        if not url:
            continue

        cal = load_ics(url)
        if not cal:
            continue

        events_by_id[source_id] = generate_events(cal, options.get("lookahead_days", 30))















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

