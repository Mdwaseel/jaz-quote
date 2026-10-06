"""India states / union territories and their districts (catalog/data/india_districts.json).

The quotation form's State → District dropdowns read Country / State / City rows;
City holds the district name.
"""
import json
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parent / "data" / "india_districts.json"


def load():
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def sync(Country, State, City, prune=False):
    """Create any missing state / district. With ``prune``, also remove districts that
    are not in the dataset for the states it covers (e.g. old sample cities)."""
    data = load()
    country, _ = Country.objects.get_or_create(name=data["country"])
    for state_name, districts in data["states"].items():
        state, _ = State.objects.get_or_create(country=country, name=state_name)
        existing = set(City.objects.filter(state=state).values_list("name", flat=True))
        City.objects.bulk_create([City(state=state, name=d) for d in districts if d not in existing])
        if prune:
            City.objects.filter(state=state).exclude(name__in=districts).delete()
