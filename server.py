"""
Travel Planner backend.
Run with:  python server.py
Then open: http://localhost:5000
"""

import json
import re
from datetime import datetime

import requests
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

# ----------------------------------------------------------------------
#  Config
# ----------------------------------------------------------------------
POE_API_KEY  = "YOUR_API_KEY_HERE"
POE_ENDPOINT = "https://api.poe.com/v1/chat/completions"
POE_MODEL    = "gpt-5-nano"
REQUEST_TIMEOUT = 60

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)

# ----------------------------------------------------------------------
#  Prompt construction
# ----------------------------------------------------------------------
SYSTEM_PROMPT = (
    "You are an expert travel planning assistant. You respond with ONLY valid JSON. "
    "No markdown code fences, no explanations, no surrounding text. "
    "Your output is parsed by software, so any extra characters will break the application."
)

def build_user_prompt(location: str, start_date: str, end_date: str) -> str:
    return f"""Generate a complete travel plan for the destination "{location}" from {start_date} to {end_date}.

Return ONLY this exact JSON structure, populated with accurate, real-world data:

{{
  "city": "Full City Name, Country",
  "wiki_title": "<exact English Wikipedia article title for the city>",
  "coords": {{ "lat": <number>, "lon": <number> }},
  "attractions": [
    {{
      "name": "<real attraction>",
      "type": "Landmark|Museum|Historic|Nature|Cultural|Theme Park|Zoo",
      "description": "<1-2 accurate sentences>",
      "wiki_title": "<exact English Wikipedia article title for this attraction>"
    }}
  ],
  "hotels": [
    {{
      "name": "<real hotel>",
      "stars": <3-5>,
      "features": ["<amenity>"],
      "price": <USD per night>,
      "wiki_title": "<exact English Wikipedia article title if this hotel has its own article, omit field otherwise>"
    }}
  ],
  "weather": {{
    "avg": <avg temp C>,
    "high": <high C>,
    "low": <low C>,
    "rain": "<mm as string>",
    "wind": <km/h>,
    "condition": "<short description>",
    "icon": "<single weather emoji>",
    "days": [
      {{ "date": "YYYY-MM-DD", "high": <C>, "low": <C>, "icon": "<single emoji>" }}
    ]
  }}
}}

REQUIREMENTS
1. Use only REAL, well-known attractions and hotels at this destination.
2. Provide exactly 6 attractions spanning diverse types.
3. Provide exactly 6 hotels: at least one luxury (>= $700), some mid-range ($150-$400), and one budget (< $150).
4. PREFER famous, historic, or notable hotels that have their own English Wikipedia article (e.g. "The Ritz Paris", "Hotel del Coronado", "Burj Al Arab", "The Plaza Hotel"). Include "wiki_title" only when you are confident the article exists.
5. Weather must reflect typical climate normals for that destination on those dates.
6. Include one "days" entry for every day in the range, max 14 days.
7. For "wiki_title", provide the EXACT English Wikipedia article title. This is critical: it is used by the browser to fetch reference images. If unsure, omit the field rather than guess.
8. If the destination is unrecognised or invalid, return: {{"error": "Unknown destination"}}"""

# ----------------------------------------------------------------------
#  Validation
# ----------------------------------------------------------------------
def validate_dates(start: str, end: str) -> dict:
    errors = {}
    if not start: errors["startDate"] = "Start date is required"
    if not end:   errors["endDate"]   = "End date is required"
    if errors: return errors

    try:
        s = datetime.strptime(start, "%Y-%m-%d").date()
    except ValueError:
        errors["startDate"] = "Invalid start date"
        return errors
    try:
        e = datetime.strptime(end, "%Y-%m-%d").date()
    except ValueError:
        errors["endDate"] = "Invalid end date"
        return errors

    today = datetime.now().date()
    if s < today:  errors["startDate"] = "Start date cannot be in the past"
    if e <= s:     errors["endDate"]   = "End date must be after start date"
    if (e - s).days > 60:
        errors["endDate"] = "Trip cannot exceed 60 days"
    return errors

# ----------------------------------------------------------------------
#  LLM helper
# ----------------------------------------------------------------------
def call_llm(location: str, start_date: str, end_date: str) -> dict:
    resp = requests.post(
        POE_ENDPOINT,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {POE_API_KEY}",
        },
        json={
            "model": POE_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": build_user_prompt(location, start_date, end_date)},
            ],
            "temperature": 0.4,
        },
        timeout=REQUEST_TIMEOUT,
    )

    if resp.status_code == 401:
        raise RuntimeError("Authentication failed - the Poe API key is invalid or revoked.")
    if resp.status_code == 403:
        raise RuntimeError("Access forbidden - this key may not have permission for the chat endpoint.")
    if resp.status_code == 429:
        raise RuntimeError("Rate limit hit - try again in a minute.")
    if resp.status_code >= 500:
        raise RuntimeError(f"Upstream service error ({resp.status_code}). Try again shortly.")
    if not resp.ok:
        raise RuntimeError(f"API error {resp.status_code}: {resp.text[:200]}")

    body = resp.json()
    content = (
        body.get("choices", [{}])[0]
            .get("message", {})
            .get("content")
    )
    if not content:
        raise RuntimeError("Empty response from the LLM.")

    raw = content.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"\s*```\s*$", "", raw)

    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        raise RuntimeError("LLM response was not valid JSON.")

    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Failed to parse LLM response as JSON: {exc}")

    if parsed.get("error"):
        raise ValueError(parsed["error"])

    return parsed

# ----------------------------------------------------------------------
#  Routes
# ----------------------------------------------------------------------
@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/plan", methods=["POST"])
def plan():
    data = request.get_json(silent=True) or {}
    location   = (data.get("location")  or "").strip()
    start_date = (data.get("startDate") or "").strip()
    end_date   = (data.get("endDate")   or "").strip()

    field_errors = {}
    if not location:
        field_errors["location"] = "Please enter a destination"
    field_errors.update(validate_dates(start_date, end_date))
    if field_errors:
        return jsonify({"fieldErrors": field_errors}), 400

    try:
        result = call_llm(location, start_date, end_date)
        return jsonify(result)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except requests.exceptions.Timeout:
        return jsonify({"error": "The LLM took too long to respond. Try again."}), 504
    except requests.exceptions.RequestException as exc:
        return jsonify({"error": f"Could not reach LLM provider: {exc}"}), 502
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502
    except Exception as exc:
        return jsonify({"error": f"Unexpected server error: {exc}"}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
