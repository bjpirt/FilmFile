# U9a Record a roll's camera

**Status:** done · **Built in:** U: The Option A interface

## What was built

Cameras as equipment records (`equipment/cameras/<slug>.json`, the slug made from the name; D28), listed and added through `GET`/`POST /api/equipment/cameras`. The new roll page and Edit details have a Camera field that offers the archive's cameras and adds a new one when a new name is typed; a roll keeps its camera's slug in `meta.camera`. Shown in the roll page's details row, on cards ("Nikon FE · Sep 2026") and as a List column.
