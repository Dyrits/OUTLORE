"""Renames the app Iskios to Outlore, and the assistant to Chronicler, in the tracked code files.

Usage: python3 -I /tmp/outlore-rename/rename.py <repo> <file-list-file>
Prints each changed file. Protected tokens (the Iskios theme, storage keys, the app scheme, the relay, GitHub URLs,
a recorded migration id, absolute local paths) are swapped for placeholders first and restored last.
"""

import re
import sys
from pathlib import Path

repo = Path(sys.argv[1])
files = Path(sys.argv[2]).read_text().split("\n")

PROTECT = [
    r"iskios\.(?:theme|colorScheme|place|resume)\b",
    r"iskios:assistant-open",
    r"iskios:comments:",
    r"iskios-app",
    r"[A-Za-z0-9-]*iskios-relay[A-Za-z0-9.-]*",
    r"Dyrits/ISKIOS[A-Za-z0-9./_-]*",
    r"0041_assistant_renamed_iskios",
    r"/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS",
    r"documentation/readme/iskios\.gif",
]

ASSISTANT_LINE = re.compile(r"Guildmaster|guildmaster|assistant|Iskios, the|Iskios's (?:conversation|own conversation|card|panel|button|own thread|Companion|realm tools|settings tools|thread tools)|talks? with Iskios|Ask Iskios|Tell Iskios|role of Iskios|Iskios named|Iskios proposes|Iskios never") if "--strict" in sys.argv else re.compile(
    r"Guildmaster|guildmaster|assistant|Iskios['’]s (?:conversation|panel|column|button|tab|chat|reply|words|own|Companion|card|hat|event|dock|messag|prompt|instruction|realm|thread|name|journal|quest|picker|backup)"
    r"|Only Iskios|\b(?:to|ask|message|with|from|tell|of|Ask|Fold) Iskios\b|Iskios (?:proposes|makes|renames|reads|answers|calls|acts|may|must|never|does|asks|should|opens|writes|replies|hears|says|ask|is open|is docked|fills|is working|is thinking|is waiting|reads)"
    r"|You are Iskios|Iskios, the|Iskios Companion|Iskios (?:panel|conversation|button|launcher|column|chat)|Iskios\)|\(Iskios"
)


def convert(text: str, assistant_file: bool) -> str:
    kept: list[str] = []

    def hold(match: re.Match[str]) -> str:
        kept.append(match.group(0))
        return f"\u0000{len(kept) - 1}\u0000"

    for pattern in PROTECT:
        text = re.sub(pattern, hold, text)

    # Identifiers that name the assistant.
    text = re.sub(r"\biskios(?=[A-Z])", "chronicler", text)
    text = re.sub(r"(?<=[a-z])Iskios(?=[A-Z]|\b)(?!['’]s )", "Chronicler", text)
    text = re.sub(r"\bIskios(?=[A-Z])", "Chronicler", text)

    # The app.
    text = text.replace("@iskios/", "@outlore/")
    text = text.replace("ISKIOS_", "OUTLORE_")
    text = text.replace("__ISKIOS_", "__OUTLORE_")
    text = re.sub(r"\bwindow\.iskios\b", "window.outlore", text)
    text = text.replace('exposeInMainWorld("iskios"', 'exposeInMainWorld("outlore"')
    text = re.sub(r'(["`\'])iskios:', r"\1outlore:", text)
    text = text.replace("iskios.sqlite", "outlore.sqlite")
    text = text.replace("mcp__iskios__", "mcp__outlore__")
    text = text.replace("mcp_servers.iskios", "mcp_servers.outlore")
    text = text.replace("mcpServers.iskios", "mcpServers.outlore")
    text = text.replace("servers.iskios", "servers.outlore")
    text = re.sub(r"\biskios/(?=[A-Z])", "outlore/", text)
    text = text.replace("app.iskios.", "app.outlore.")
    text = text.replace("x-iskios-", "x-outlore-")
    text = re.sub(r"\biskios(?=\d*-)", "outlore", text)
    text = re.sub(r"\bISKIOS\d*(?=-)", lambda m: m.group(0).replace("ISKIOS", "OUTLORE"), text)
    text = re.sub(r"\bIskios(?=-|\.app|\.dmg|\.old|/Contents|/\$|/\d)", "Outlore", text)
    text = text.replace("Iskios Dev", "Outlore Dev")
    text = text.replace("/MacOS/Iskios", "/MacOS/Outlore")
    text = text.replace("Applications/Iskios", "Applications/Outlore")

    # Prose: the assistant on lines that speak of it, the app everywhere else.
    out = []
    for line in text.split("\n"):
        if "Iskios" in line:
            name = "Chronicler" if (assistant_file or ASSISTANT_LINE.search(line)) else "Outlore"
            line = line.replace("Iskios", name)
        out.append(line)
    text = "\n".join(out)
    text = re.sub(r"\b([aA]) Outlore", lambda m: f"{m.group(1)}n Outlore", text)

    return re.sub(r"\u0000(\d+)\u0000", lambda m: kept[int(m.group(1))], text)


for name in files:
    if not name:
        continue
    path = repo / name
    before = path.read_text()
    after = convert(before, False)
    if after != before:
        path.write_text(after)
        print(name)
