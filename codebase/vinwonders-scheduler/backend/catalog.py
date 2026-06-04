import json
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT_DIR / "src" / "data" / "vinwondersCatalog.json"


def _load_catalog() -> dict[str, Any]:
    with CATALOG_PATH.open(encoding="utf-8") as catalog_file:
        return json.load(catalog_file)


CATALOG = _load_catalog()
ATTRACTIONS: list[dict[str, Any]] = CATALOG["attractions"]
ZONES_BY_ID: dict[str, dict[str, Any]] = {
    zone["id"]: zone for zone in [CATALOG["entrance"], *CATALOG["zones"]]
}
ATTRACTIONS_BY_ID: dict[str, dict[str, Any]] = {
    attraction["id"]: attraction for attraction in ATTRACTIONS
}


def build_menu() -> str:
    lines: list[str] = []
    for attraction in ATTRACTIONS:
        zone_name = ZONES_BY_ID[attraction["zoneId"]]["name"]
        kid_text = "hợp trẻ em" if attraction["kidFriendly"] else "không hợp trẻ nhỏ"
        lines.append(
            f'{attraction["id"]} — {attraction["name"]} — {zone_name} — '
            f'{attraction["kind"]} — {attraction["durationMin"]}p — '
            f'cường độ {attraction["intensity"]} — {kid_text}'
        )
    return "\n".join(lines)
