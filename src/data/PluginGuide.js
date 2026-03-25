/*
 * Rudra GNOME Extension
 * Copyright (C) 2026 NarkAgni
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

export const PLUGIN_GUIDE_TEXT = `
<span weight="bold" size="large" color="#bb9af7">Rudra Plugin Guide</span>

Plugins let you extend Rudra with your own scripts. You write a small Bash or Python script, and Rudra runs it when you type a command, then shows the results as clickable cards — just like any other search result.

This guide explains everything from scratch. No prior experience with Rudra plugins is required.

<span weight="bold" color="#7aa2f7">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
What is a Plugin, Exactly?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span>
A plugin is just a plain text file — either a <b>Bash script</b> (.sh) or a <b>Python script</b> (.py) — that you place in a special folder on your computer. When you type the right command in Rudra, it runs that file and displays whatever the script outputs.

You do not need to install anything extra. Bash is already on every Linux system. Python 3 is available on most systems as well.

<span weight="bold" color="#7aa2f7">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Where do Plugins Live?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span>
All plugin files go in this folder:

<span font_family="monospace" color="#a9b1d6">~/.config/rudra@narkagni/plugins/</span>

Rudra creates this folder automatically the first time you use it. You can also open a terminal and go there manually:

<span font_family="monospace" color="#a9b1d6">cd ~/.config/rudra@narkagni/plugins/</span>

Any <span foreground="#ff9e64" font_family="monospace">.sh</span> or <span foreground="#ff9e64" font_family="monospace">.py</span> file you place here becomes a plugin. The filename (without the extension) is the name you use to call it from Rudra.

<span weight="bold" color="#7aa2f7">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
How to Call a Plugin
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span>
Open Rudra and type:

<span font_family="monospace" color="#a9b1d6">p script_name your_input_here</span>

The <span foreground="#ff9e64" font_family="monospace">p</span> at the start tells Rudra you want to run a plugin. Then you write the script name (without .sh or .py), and then whatever text you want to pass to the script.

For example, if you have a file called <span foreground="#ff9e64" font_family="monospace">weather.sh</span>, you would type:

<span font_family="monospace" color="#a9b1d6">p weather Delhi</span>

Rudra will run <span foreground="#ff9e64" font_family="monospace">weather.sh</span> and pass the word <span foreground="#ff9e64" font_family="monospace">Delhi</span> to it as input.

<span weight="bold" color="#7aa2f7">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
What Your Script Must Do
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span>
Your script must print a <b>JSON Array</b> to the terminal (stdout). That is the only rule. Rudra reads that output and turns each item in the array into a result card.

A JSON Array looks like this:

<span font_family="monospace" color="#a9b1d6">[
  {
    "name": "The title shown on the card",
    "description": "A smaller subtitle below the title"
  }
]</span>

The square brackets <span foreground="#ff9e64" font_family="monospace">[ ]</span> wrap the whole thing. Each item inside is wrapped in curly braces <span foreground="#ff9e64" font_family="monospace">{ }</span>. Multiple results are separated by commas.

<span weight="bold" color="#7aa2f7">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
All Supported Fields
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span>
Each result card can have the following fields. Only <span foreground="#ff9e64" font_family="monospace">"name"</span> is required. All others are optional.

<span foreground="#ff9e64" font_family="monospace">"name"</span>
  The main title shown on the result card. This is the only required field.
  Example: <span foreground="#9ece6a" font_family="monospace">"name": "Weather in Delhi"</span>

<span foreground="#ff9e64" font_family="monospace">"description"</span>
  A shorter line of text shown below the title in a smaller, dimmer font.
  Example: <span foreground="#9ece6a" font_family="monospace">"description": "32 C, Partly Cloudy"</span>

<span foreground="#ff9e64" font_family="monospace">"icon"</span>
  The name of a GNOME symbolic icon to show on the left side of the card.
  You can browse available icons inside Rudra by typing <span foreground="#a9b1d6" font_family="monospace">ic </span> or selecting to Icons tab from dropdown menu.
  Example: <span foreground="#9ece6a" font_family="monospace">"icon": "weather-clear-symbolic"</span>

<span foreground="#ff9e64" font_family="monospace">"clipboard"</span>
  When the user clicks the card, this text gets copied to their clipboard.
  Useful for things like passwords, addresses, or any text you want to paste elsewhere.
  Example: <span foreground="#9ece6a" font_family="monospace">"clipboard": "32 C in Delhi"</span>

<span foreground="#ff9e64" font_family="monospace">"action"</span>
  A shell command that runs when the user clicks the card.
  Use this to open websites, launch apps, or run any command.
  Example: <span foreground="#9ece6a" font_family="monospace">"action": "xdg-open https://github.com"</span>

<span foreground="#ff9e64" font_family="monospace">"refreshable"</span>
  Set this to <span foreground="#f7768e" font_family="monospace">true</span> to show a small refresh button on the card.
  When clicked, it re-runs the plugin so you get fresh results.
  Useful for live data like weather or stock prices.
  Example: <span foreground="#9ece6a" font_family="monospace">"refreshable": true</span>

<b>Note:</b> If you set both <span foreground="#ff9e64" font_family="monospace">"action"</span> and <span foreground="#ff9e64" font_family="monospace">"clipboard"</span>, clicking the card will run the action AND copy the clipboard text at the same time.

<span weight="bold" color="#9ece6a">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your First Plugin (Python) — Step by Step
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span>
This is the simplest possible plugin. It takes a name as input and shows a greeting card.

<b>Step 1.</b> Open a text editor and paste this:

<span font_family="monospace" color="#a9b1d6">import sys
import json

# sys.argv[1] is whatever the user typed after "p hello"
# If they typed nothing, we fall back to "friend"
name = sys.argv[1].strip() if len(sys.argv) &gt; 1 else "friend"

results = [
    {
        "name": "Hello, " + name,
        "description": "Click to copy this greeting",
        "icon": "face-smile-symbolic",
        "clipboard": "Hello, " + name
    }
]

print(json.dumps(results))</span>

<b>Step 2.</b> Save the file as <span foreground="#ff9e64" font_family="monospace">hello.py</span> inside:
<span font_family="monospace" color="#a9b1d6">~/.config/rudra@narkagni/plugins/</span>

<b>Step 3.</b> Test it in your terminal first to make sure it works:
<span font_family="monospace" color="#a9b1d6">python3 ~/.config/rudra@narkagni/plugins/hello.py Rudra</span>

You should see this printed:
<span font_family="monospace" color="#a9b1d6">[{"name": "Hello, Rudra", "description": "Click to copy this greeting", ...}]</span>

<b>Step 4.</b> Open Rudra and type:
<span font_family="monospace" color="#a9b1d6">p hello Rudra</span>

A card should appear showing "Hello, Rudra". Click it to copy the text.

<span weight="bold" color="#f7768e">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your First Plugin (Bash) — Step by Step
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span>
Prefer Bash? Here is the same greeting plugin written as a shell script.

<b>Step 1.</b> Create the file:
<span font_family="monospace" color="#a9b1d6">nano ~/.config/rudra@narkagni/plugins/hello.sh</span>

<b>Step 2.</b> Paste this content:

<span font_family="monospace" color="#a9b1d6">#!/bin/bash

# $1 is whatever the user typed after "p hello"
NAME="$&#123;1:-friend&#125;"

echo "[{\"name\": \"Hello, $NAME\", \"description\": \"Click to copy\", \"clipboard\": \"Hello, $NAME\"}]"</span>

<b>Step 3.</b> Make it executable. This step is required for Bash scripts or they will not run:
<span font_family="monospace" color="#a9b1d6">chmod +x ~/.config/rudra@narkagni/plugins/hello.sh</span>

<b>Step 4.</b> Test it in terminal:
<span font_family="monospace" color="#a9b1d6">bash ~/.config/rudra@narkagni/plugins/hello.sh Rudra</span>

<b>Step 5.</b> Open Rudra and type <span foreground="#a9b1d6" font_family="monospace">p hello Rudra</span>

<span weight="bold" color="#e0af68">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Example — Live Weather (Bash)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span>
This plugin fetches live weather data using the free wttr.in service. No API key needed.

Save as <span foreground="#ff9e64" font_family="monospace">weather.sh</span>, then call with <span foreground="#a9b1d6" font_family="monospace">p weather Delhi</span>

<span font_family="monospace" color="#a9b1d6">#!/bin/bash

CITY="$&#123;1:-London&#125;"

# curl fetches the weather. --max-time 3 ensures it stops after 3 seconds
# if there is no internet. The || part gives a fallback if curl fails.
TEMP=$(curl -s --max-time 3 "wttr.in/$&#123;CITY&#125;?format=%t+%C" || echo "Unavailable")

cat &lt;&lt;EOF
[{
  "name": "Weather in $CITY",
  "description": "$TEMP",
  "icon": "weather-few-clouds-symbolic",
  "clipboard": "$TEMP in $CITY",
  "refreshable": true
}]
EOF</span>

The <span foreground="#ff9e64" font_family="monospace">"refreshable": true</span> field adds a refresh button so you can update the weather without retyping.

<span weight="bold" color="#7dcfff">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Example — Calculator (Python)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span>
This plugin returns multiple result cards for a given number — its square, square root, and double.

Save as <span foreground="#ff9e64" font_family="monospace">calc.py</span>, then call with <span foreground="#a9b1d6" font_family="monospace">p calc 9</span>

<span font_family="monospace" color="#a9b1d6">import sys, json, math

n = float(sys.argv[1]) if len(sys.argv) &gt; 1 else 0

results = [
    {
        "name": "Square: " + str(n ** 2),
        "icon": "accessories-calculator-symbolic",
        "clipboard": str(n ** 2)
    },
    {
        "name": "Square Root: " + str(round(math.sqrt(abs(n)), 4)),
        "icon": "accessories-calculator-symbolic",
        "clipboard": str(round(math.sqrt(abs(n)), 4))
    },
    {
        "name": "Double: " + str(n * 2),
        "icon": "accessories-calculator-symbolic",
        "clipboard": str(n * 2)
    }
]

print(json.dumps(results))</span>

<span weight="bold" color="#bb9af7">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Example — Quick Bookmark Opener (Bash)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span>
This plugin stores a list of websites and lets you search and open them by keyword.

Save as <span foreground="#ff9e64" font_family="monospace">bm.sh</span>, then call with <span foreground="#a9b1d6" font_family="monospace">p bm github</span>

<span font_family="monospace" color="#a9b1d6">#!/bin/bash

QUERY="$&#123;1:-&#125;"

# Add your own bookmarks here in the format ["keyword"]="url"
declare -A BOOKMARKS=(
  ["github"]="https://github.com"
  ["mail"]="https://mail.google.com"
  ["docs"]="https://docs.google.com"
  ["youtube"]="https://youtube.com"
)

RESULTS="["
FIRST=true

for KEY in "$&#123;!BOOKMARKS[@]&#125;"; do
  # Skip bookmarks that do not match the search query
  [[ "$KEY" != *"$QUERY"* ]] &amp;&amp; continue
  URL="$&#123;BOOKMARKS[$KEY]&#125;"
  $FIRST || RESULTS+=","
  RESULTS+="{\"name\":\"$KEY\",\"description\":\"$URL\",\"icon\":\"user-bookmarks-symbolic\",\"action\":\"xdg-open $URL\"}"
  FIRST=false
done

RESULTS+="]"
echo "$RESULTS"</span>

<span weight="bold" color="#bb9af7">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Testing and Debugging
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span>
<b>Always test in the terminal before using in Rudra.</b>

If your script has an error, Rudra will silently show no results. Testing in the terminal lets you see the actual error message.

<span font_family="monospace" color="#a9b1d6">bash ~/.config/rudra@narkagni/plugins/weather.sh Delhi
python3 ~/.config/rudra@narkagni/plugins/calc.py 16</span>

<b>The output must be valid JSON.</b> If your script prints anything other than a JSON array — even a single extra line or a warning message — Rudra will fail to parse it and show nothing. To check if your output is valid JSON, you can pipe it through <span foreground="#ff9e64" font_family="monospace">jq</span>:

<span font_family="monospace" color="#a9b1d6">bash ~/.config/rudra@narkagni/plugins/weather.sh Delhi | jq</span>

If <span foreground="#ff9e64" font_family="monospace">jq</span> shows nicely formatted output, your JSON is correct. If it shows an error, something is wrong with your script's output.

<b>Print debug messages to stderr, not stdout.</b> Anything printed to stdout goes to Rudra and must be JSON. Use stderr for debug messages so they appear in your terminal but do not break Rudra:

<span font_family="monospace" color="#a9b1d6">echo "debug: city is $CITY" &gt;&amp;2    # Bash — goes to terminal only
print("debug info", file=sys.stderr)  # Python — goes to terminal only</span>

<b>If your script hangs, Rudra cancels it after 5 seconds.</b> For any network calls, always set a timeout so your script does not block:

<span font_family="monospace" color="#a9b1d6">curl -s --max-time 3 "https://..."    # Bash
requests.get(url, timeout=3)          # Python</span>

<b>Return an empty array if there are no results.</b> Never print nothing at all — that will cause a parsing error. If there is nothing to show, print:

<span font_family="monospace" color="#a9b1d6">echo "[]"    # Bash
print("[]")  # Python</span>

<span weight="bold" color="#f7768e">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Common Mistakes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span>
<b>Printing extra text around the JSON.</b>
If your script prints a message like "Fetching data..." before the JSON, Rudra cannot parse it. Only the JSON array should go to stdout.

<b>Returning a JSON object instead of a JSON array.</b>
Wrong: <span foreground="#f7768e" font_family="monospace">{"name": "result"}</span>
Correct: <span foreground="#9ece6a" font_family="monospace">[{"name": "result"}]</span>
The outer square brackets are required even if you only have one result.

<b>Forgetting chmod +x on a Bash script.</b>
Bash scripts must be made executable before Rudra can run them. Python scripts do not need this.
Fix: <span foreground="#ff9e64" font_family="monospace">chmod +x ~/.config/rudra@narkagni/plugins/myscript.sh</span>

<b>No internet fallback on network scripts.</b>
If the network is slow or unavailable, your script will hang and Rudra will wait up to 5 seconds before cancelling. Always add a timeout and a fallback value.

<b>Using the wrong Python version.</b>
Rudra runs scripts with <span foreground="#ff9e64" font_family="monospace">python3</span>. If your system only has <span foreground="#ff9e64" font_family="monospace">python</span>, the script will not run. Check with:
<span font_family="monospace" color="#a9b1d6">python3 --version</span>

<span weight="bold" color="#7aa2f7">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quick Reference
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span>
Plugins folder:   <span foreground="#a9b1d6" font_family="monospace">~/.config/rudra@narkagni/plugins/</span>
Call a plugin:    <span foreground="#a9b1d6" font_family="monospace">p script_name your_input</span>
Required output:  A JSON array printed to stdout
Required field:   <span foreground="#ff9e64" font_family="monospace">"name"</span> in each result object
Bash scripts:     Must be made executable with <span foreground="#ff9e64" font_family="monospace">chmod +x</span>
Timeout:          Rudra cancels scripts that run longer than 5 seconds
Icon browser:     Type <span foreground="#a9b1d6" font_family="monospace">ic </span> it will open the Icons tab or just select Icons in dropdown menu
`.trim();