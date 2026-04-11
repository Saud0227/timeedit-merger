# import json
# import os
import secrets
# from dataclasses import dataclass
from typing import Any, Dict

_PLACEHOLDER_ADMIN_TOKEN = "REPLACE_WITH_SECURE_ADMIN_TOKEN"
_PLACEHOLDER_FEED_TOKEN = "REPLACE_WITH_SECURE_FEED_TOKEN"
_PLACEHOLDER_SALT_TOKEN = "REPLACE_WITH_SECURE_SALT_TOKEN"

def generate_secure_token() -> str:
    return secrets.token_urlsafe(32)


DEFAULT_OPTIONSS: Dict[str, Any] = {
    "admin_token": _PLACEHOLDER_ADMIN_TOKEN,
    "feed_token": _PLACEHOLDER_FEED_TOKEN,
    "refresh_minutes": 5,
    "timeout_seconds": 10,
    "lookahead_days": 30,
    "categories": ["Föreläsning", "Handledning", "Räkneövning", "Seminarium"],
    "output1": {"name": "Private", "salt": _PLACEHOLDER_SALT_TOKEN, "enabled": True},
    "output2": {"name": "Public", "salt": _PLACEHOLDER_SALT_TOKEN, "enabled": True}
}






DEFAULT_DYNAMIC: Dict[str, Any] = {
    "sources": {
        # "SALT_32": {
        #    "name": "Calendar Name",
        #    "url": "https://example.com/calendar.ics",
        #    "output1": {"enabled": true, "allowed": ["lectures", "exams", "seminars"]},
        #    "output2": {"enabled": true, "allowed": ["*"]}
        # }
    },
}