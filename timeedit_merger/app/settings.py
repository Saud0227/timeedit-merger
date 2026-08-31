import json
import os
import secrets
from dataclasses import dataclass
# from dataclasses import dataclass
from typing import Any, Dict, Tuple

DATA_DIR = os.getenv("DATA_DIR", "/data")
OPTIONS_PATH = os.getenv("OPTIONS_PATH", os.path.join(DATA_DIR, "options.json"))
DYNAMIC_PATH = os.getenv("DYNAMIC_PATH", os.path.join(DATA_DIR, "dynamic.json"))

_PLACEHOLDER_ADMIN_TOKEN = "REPLACE_WITH_SECURE_ADMIN_TOKEN"
_PLACEHOLDER_FEED_TOKEN = "REPLACE_WITH_SECURE_FEED_TOKEN"
_PLACEHOLDER_SALT_TOKEN = "REPLACE_WITH_SECURE_SALT_TOKEN"

def _read_json(path: str) -> Tuple[Dict[str, Any], float]:
    if not os.path.exists(path):
        return {}, 0.0
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f), os.path.getmtime(path)


def _atomic_write(path: str, data: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)

def generate_secure_token() -> str:
    return secrets.token_urlsafe(32)

def _initial_options() -> Dict[str, Any]:
    opts: Dict[str, Any] = {
        **DEFAULT_OPTIONS,
        "output1": dict(DEFAULT_OPTIONS["output1"]),
        "output2": dict(DEFAULT_OPTIONS["output2"]),
        "admin_token": generate_secure_token(),
        "feed_token": generate_secure_token(),
    }
    opts["output1"]["salt"] = generate_secure_token()
    opts["output2"]["salt"] = generate_secure_token()
    return opts

def _normalize_options(data: Dict[str, Any]) -> Tuple[Dict[str, Any], bool]:
    opts: Dict[str, Any] = {
        **DEFAULT_OPTIONS
    }
    if isinstance(data, dict):
        opts.update(data)

    changed = False

    admin_token = opts.get("admin_token")
    if not isinstance(admin_token, str) or not admin_token.strip() or admin_token == _PLACEHOLDER_ADMIN_TOKEN:
        opts["admin_token"] = generate_secure_token()
        changed = True

    feed_token = opts.get("feed_token")
    if not isinstance(feed_token, str) or not feed_token.strip() or feed_token == _PLACEHOLDER_FEED_TOKEN:
        opts["feed_token"] = generate_secure_token()
        changed = True

    categories = opts.get("categories")
    if not isinstance(categories, list):
        opts["categories"] = DEFAULT_OPTIONS["categories"]
        changed = True
    for i, category in enumerate(opts["categories"]):
        if not isinstance(category, str):
            opts["categories"][i] = str(category)
            changed = True
        if category.lower() != category:
            opts["categories"][i] = category.lower()
            changed = True

    for output_key in ["output1", "output2"]:
        output = opts.get(output_key)
        if isinstance(output, dict):
            salt = output.get("salt")
            if not isinstance(salt, str) or not salt.strip() or salt == _PLACEHOLDER_SALT_TOKEN:
                output["salt"] = generate_secure_token()
                changed = True

    return opts, changed

DEFAULT_OPTIONS: Dict[str, Any] = {
    "admin_token": _PLACEHOLDER_ADMIN_TOKEN,
    "feed_token": _PLACEHOLDER_FEED_TOKEN,
    "refresh_minutes": 5,
    "timeout_seconds": 10,
    "lookahead_days": 30,
    "categories": ["föreläsning", "handledning", "räkneövning", "seminarium", "datorlaboration"],
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

@dataclass
class SettingsSnapshot:
    options: Dict[str, Any]
    dynamic: Dict[str, Any]
    options_mtime: float
    dynamic_mtime: float

SNAPSHOT = SettingsSnapshot(options={}, dynamic={}, options_mtime=0.0, dynamic_mtime=0.0)

def ensure_files_exist() -> None:
    os.makedirs(os.path.dirname(OPTIONS_PATH), exist_ok=True)

    if not os.path.exists(OPTIONS_PATH):
        _atomic_write(OPTIONS_PATH, _initial_options())

    if not os.path.exists(DYNAMIC_PATH):
        _atomic_write(DYNAMIC_PATH, DEFAULT_DYNAMIC)

def reload_if_changed() -> bool:
    ensure_files_exist()

    opt, opt_m = _read_json(OPTIONS_PATH)

    opt, opt_changed = _normalize_options(opt)
    if opt_changed:
        _atomic_write(OPTIONS_PATH, opt)
        opt_m = os.path.getmtime(OPTIONS_PATH)

    dyn, dyn_m = _read_json(DYNAMIC_PATH)

    changed = opt_changed or (opt_m > SNAPSHOT.options_mtime) or (dyn_m > SNAPSHOT.dynamic_mtime) or not SNAPSHOT.options or not SNAPSHOT.dynamic

    if changed:
        SNAPSHOT.options = opt
        SNAPSHOT.dynamic = dyn
        SNAPSHOT.options_mtime = opt_m
        SNAPSHOT.dynamic_mtime = dyn_m

    return changed

def validate_dynamic_config(new_dyn: Dict[str, Any]) -> None:

    if not isinstance(new_dyn, dict):
        raise ValueError("Dynamic config must be a JSON object")

    sources = new_dyn.get("sources")
    if not isinstance(sources, dict):
        raise ValueError("Dynamic config 'sources' must be an object/dictionary")

    for key, source in sources.items():
        if not isinstance(source, dict):
            raise ValueError(f"Source '{key}' must be an object/dictionary")
        url = source.get("url")
        if not isinstance(url, str) or not url.strip():
            raise ValueError(f"Source '{key}' must have a non-empty 'url' string")
        for output_key in ("output1", "output2"):
            output_cfg = source.get(output_key)
            if not isinstance(output_cfg, dict):
                raise ValueError(f"Source '{key}' output '{output_key}' must be an object/dictionary")
            enabled = output_cfg.get("enabled")
            if not isinstance(enabled, bool):
                raise ValueError(f"Source '{key}' output '{output_key}' must have a boolean 'enabled' field")
            allowed = output_cfg.get("allowed", [])
            if enabled and not isinstance(allowed, list):
                raise ValueError(f"Source '{key}' output '{output_key}' is enabled but 'allowed' is not a list")
            if enabled:
                allowed_categories = set(SNAPSHOT.options.get("categories", []) + ["*", "?"])
                for cat in allowed:
                    if cat not in allowed_categories:
                        raise ValueError(f"Source '{key}' output '{output_key}' has invalid category '{cat}' not in options or '*' or '?'")

def save_dynamic(new_dyn: Dict[str, Any]) -> None:
    ensure_files_exist()

    validate_dynamic_config(new_dyn)

    # Validation passed, save the dynamic config

    _atomic_write(DYNAMIC_PATH, new_dyn)
    reload_if_changed()
