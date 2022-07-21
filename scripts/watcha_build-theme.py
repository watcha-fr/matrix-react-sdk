#!/usr/bin/env python3

from pathlib import Path
import re

CSS_PREFIX = "_watcha-"
VAR_PREFIX = "$dark-"
DEST = "res/themes/watcha/css"
DARK_CSS_PATH = "res/themes/dark/css/_dark.scss"
CSS_PATHS = [
    "res/css/structures/_LeftPanel.scss",
    "res/css/structures/_SpacePanel.scss",
    "res/css/views/avatars/_DecoratedRoomAvatar.scss",
    "res/css/views/rooms/_NotificationBadge.scss",
    "res/css/views/rooms/_RoomList.scss",
    "res/css/views/rooms/_RoomListHeader.scss",
    "res/css/views/rooms/_RoomSublist.scss",
    "res/css/views/rooms/_RoomTile.scss",
    "res/css/views/rooms/_VideoRoomSummary.scss",
]
VAR_PATTERN = r"\$[a-z1-9\-]+"


def get_dest(str_path):
    path = Path(str_path)
    name = CSS_PREFIX + path.name[1:]
    return Path(DEST, name)


def replace_var(line):
    match = re.search(f"(?!^){VAR_PATTERN}", line)
    if match is not None:
        var = match.group(0)
        if var in dark_vars:
            dark_name = VAR_PREFIX + var[1:]
            line = line.replace(var, dark_name)
    return line


dark_vars = []

with get_dest(DARK_CSS_PATH).open("w") as f:
    for line in open(DARK_CSS_PATH):

        match = re.search(f"^{VAR_PATTERN}", line)
        if match is not None:
            assigned_var = match.group(0)
            dark_vars.append(assigned_var)
            dark_name = VAR_PREFIX + assigned_var[1:]
            line = line.replace(assigned_var, dark_name)

        line = replace_var(line)
        f.write(line)

for path in CSS_PATHS:
    with get_dest(path).open("w") as f:
        for line in open(path):
            line = replace_var(line)
            f.write(line)
