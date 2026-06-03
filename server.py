"""
Travel Planner backend.
Run with:  python server.py
Then open: http://localhost:5000

Requires in .env:
    API_KEY      = <Poe API key>
    WEATHER_API  = <WeatherAPI.com key>   # free tier supports future.json up to 300 days
    WIKI_KEY     = <optional user-agent string for Wikipedia>
"""
import os
import json
import re
from datetime import datetime, timedelta, date

import requests
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import find_dotenv, load_dotenv

# ----------------------------------------------------------------------
#  Config
# ----------------------------------------------------------------------
path = find_dotenv()

load_dotenv(path, override=True)
api_key     = os.getenv("API_KEY")
wiki_key    = os.getenv("WIKI_KEY") or "TravelPlanner/1.0 (contact@example.com)"
weather_key = os.getenv("WEATHER_API")

POE_API_KEY  = api_key
POE_ENDPOINT = "https://api.poe.com/v1/chat/completions"
POE_MODEL    = "gpt-5-nano"
REQUEST_TIMEOUT = 60

# Wikipedia
WIKI_ENDPOINT = "https://en.wikipedia.org/w/api.php"
WIKI_HEADERS  = {"User-Agent": wiki_key}

# WeatherAPI.com
WAPI_BASE     = "https://api.weatherapi.com/v1"
WAPI_FORECAST = f"{WAPI_BASE}/forecast.json"   # today .. today+14
WAPI_FUTURE   = f"{WAPI_BASE}/future.json"     # today+14 .. today+300 (one day per call)
WAPI_HISTORY  = f"{WAPI_BASE}/history.json"    # past dates

# Cap on per-day itinerary entries (to keep LLM responses fast & focused).
ITINERARY_MAX_DAYS = 14

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)

# ----------------------------------------------------------------------
#  Prompt construction (plan)
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
  ]
}}

REQUIREMENTS
1. Use only REAL, well-known attractions and hotels at this destination.
2. Provide exactly 6 attractions spanning diverse types.
3. Provide exactly 6 hotels: at least one luxury (>= $700), some mid-range ($150-$400), and one budget (< $150).
4. PREFER famous, historic, or notable hotels that have their own English Wikipedia article (e.g. "The Ritz Paris", "Hotel del Coronado", "Burj Al Arab", "The Plaza Hotel"). Include "wiki_title" only when you are confident the article exists.
5. Provide accurate "coords" (latitude/longitude) for the city - these are used to fetch real weather data.
6. For "wiki_title", provide the EXACT English Wikipedia article title. This is critical: it is used to fetch reference images. If unsure, omit the field rather than guess.
7. If the destination is unrecognised or invalid, return: {{"error": "Unknown destination"}}"""


# ----------------------------------------------------------------------
#  Prompt construction (itinerary)
# ----------------------------------------------------------------------
def build_itinerary_prompt(plan: dict, weather: dict, start_date: str, end_date: str,
                           dates_to_plan: list[str]) -> str:
    city = plan.get("city") or "the destination"

    # Compact weather table the LLM can reason about.
    weather_lines = []
    by_date = {}
    if weather and isinstance(weather.get("days"), list):
        for d in weather["days"]:
            if d.get("date"):
                by_date[d["date"]] = d

    for d in dates_to_plan:
        wd = by_date.get(d)
        if wd:
            weather_lines.append(
                f"  - {d}: high {wd.get('high')}°C, low {wd.get('low')}°C, {wd.get('icon','')}"
            )
        else:
            weather_lines.append(f"  - {d}: forecast unavailable")

    attractions = plan.get("attractions") or []
    attraction_lines = [
        f"  - {a.get('name','?')} ({a.get('type','')}): {a.get('description','').strip()}"
        for a in attractions
    ]

    hotels = plan.get("hotels") or []
    hotel_lines = [f"  - {h.get('name','?')}" for h in hotels[:6]]

    return f"""You are crafting a day-by-day travel itinerary for {city} from {start_date} to {end_date}.

WEATHER FORECAST (use this to shape each day):
{chr(10).join(weather_lines)}

CURATED ATTRACTIONS (mix these across days, don't bunch them on day 1):
{chr(10).join(attraction_lines) if attraction_lines else '  (none)'}

NEARBY HOTELS (for context only):
{chr(10).join(hotel_lines) if hotel_lines else '  (none)'}

Return ONLY this exact JSON structure - one entry for EACH date listed in WEATHER FORECAST, in order:

{{
  "itinerary": [
    {{
      "date": "YYYY-MM-DD",
      "day_number": <1-based integer>,
      "title": "<evocative 2-5 word day title>",
      "vibe": "<one word: relaxed | adventurous | cultural | scenic | culinary | lively | cozy>",
      "weather_summary": "<1 short sentence describing the weather and how it shapes today>",
      "activities": [
        {{
          "time": "Morning",
          "icon": "<single emoji>",
          "title": "<activity name>",
          "location": "<specific named place or neighbourhood>",
          "description": "<1-2 sentence description; factor in the weather>",
          "duration": "<rough duration, e.g. '2h' or '90 min'>"
        }},
        {{ "time": "Afternoon", "icon": "...", "title": "...", "location": "...", "description": "...", "duration": "..." }},
        {{ "time": "Evening",   "icon": "...", "title": "...", "location": "...", "description": "...", "duration": "..." }}
      ],
      "tip": "<one short practical tip for this specific day (clothing, booking, timing, transport...)>"
    }}
  ]
}}

REQUIREMENTS
1. Produce EXACTLY {len(dates_to_plan)} day entries, one per listed date, in chronological order.
2. Each day MUST have exactly 3 activities: Morning, Afternoon, Evening (in that order).
3. ADAPT TO WEATHER:
   - Rainy / stormy / cold days -> prioritise museums, indoor markets, cafes, galleries, spas.
   - Sunny / mild days -> prioritise parks, viewpoints, walks, outdoor dining.
   - Very hot days -> outdoor activities in morning/evening, indoor escape midday.
   - Snowy days -> short outdoor moments + warm indoor venues.
4. Spread the curated attractions across the trip; do not repeat the same attraction on multiple days.
5. Vary the pace across the trip - mix high-energy days with relaxed ones.
6. Use REAL, specific named places (restaurants, neighbourhoods, parks, museums) at the destination.
7. Keep each description tight - max ~25 words.
8. Do NOT include markdown, comments, or text outside the JSON object."""


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
#  Wikipedia image lookup
# ----------------------------------------------------------------------
def fetch_wiki_image(title: str, thumb_size: int = 800) -> str | None:
    if not title:
        return None
    try:
        resp = requests.get(
            WIKI_ENDPOINT,
            params={
                "action": "query",
                "format": "json",
                "prop": "pageimages",
                "piprop": "thumbnail|original",
                "pithumbsize": thumb_size,
                "redirects": 1,
                "titles": title,
                "formatversion": 2,
            },
            headers=WIKI_HEADERS,
            timeout=15,
        )
        if not resp.ok:
            return None
        data = resp.json()
        pages = data.get("query", {}).get("pages", [])
        if not pages:
            return None
        page = pages[0]
        if "thumbnail" in page and page["thumbnail"].get("source"):
            return page["thumbnail"]["source"]
        if "original" in page and page["original"].get("source"):
            return page["original"]["source"]
        return None
    except requests.exceptions.RequestException:
        return None


def enrich_with_images(plan: dict) -> None:
    city_title = plan.get("wiki_title")
    if city_title:
        plan["image"] = fetch_wiki_image(city_title)

    for item in plan.get("attractions", []) or []:
        title = item.get("wiki_title")
        if title:
            item["image"] = fetch_wiki_image(title)

    for item in plan.get("hotels", []) or []:
        title = item.get("wiki_title")
        if title:
            item["image"] = fetch_wiki_image(title)

# ----------------------------------------------------------------------
#  Weather (WeatherAPI.com)
# ----------------------------------------------------------------------
def _icon_for(condition_text: str, is_day: int = 1) -> str:
    t = (condition_text or "").lower()
    if "thunder" in t or "storm" in t:                  return "⛈️"
    if "blizzard" in t or "heavy snow" in t:            return "❄️"
    if "snow" in t or "ice pellets" in t:               return "❄️"
    if "sleet" in t:                                    return "🌨️"
    if "freezing" in t:                                 return "🌨️"
    if "drizzle" in t or "rain" in t or "shower" in t:  return "🌧️"
    if "fog" in t or "mist" in t or "haze" in t:        return "🌫️"
    if "overcast" in t:                                 return "☁️"
    if "cloud" in t:                                    return "⛅"
    if "partly" in t:                                   return "⛅"
    if "clear" in t or "sunny" in t:
        return "☀️" if is_day else "🌙"
    return "🌤️"


def _wapi_get(url: str, params: dict) -> dict | None:
    try:
        resp = requests.get(url, params=params, timeout=20)
        if not resp.ok:
            return None
        return resp.json()
    except requests.exceptions.RequestException:
        return None


def _row_from_forecastday(fd: dict) -> dict | None:
    if not fd:
        return None
    day  = fd.get("day", {}) or {}
    cond = day.get("condition", {}) or {}
    return {
        "date":   fd.get("date"),
        "tmax":   day.get("maxtemp_c"),
        "tmin":   day.get("mintemp_c"),
        "tmean":  day.get("avgtemp_c"),
        "precip": day.get("totalprecip_mm") or 0,
        "wind":   day.get("maxwind_kph") or 0,
        "text":   cond.get("text") or "",
    }


def fetch_weather(coords: dict, city: str, start_date: str, end_date: str) -> dict:
    """
    Build the `weather` block using WeatherAPI.com.
    Supports forecasts up to ~300 days into the future via future.json.
    """
    if not weather_key:
        raise RuntimeError("Missing WEATHER_API key in environment.")
    if not (coords and "lat" in coords and "lon" in coords):
        raise RuntimeError("Missing coordinates for weather lookup.")

    lat = coords["lat"]
    lon = coords["lon"]
    q   = f"{lat},{lon}"

    s = datetime.strptime(start_date, "%Y-%m-%d").date()
    e = datetime.strptime(end_date,   "%Y-%m-%d").date()
    today = datetime.now().date()

    cap_end = min(e, s + timedelta(days=13))

    forecast_horizon = today + timedelta(days=14)
    future_horizon   = today + timedelta(days=300)

    combined: list[dict] = []

    # Past slice
    if s < today:
        past_end = min(cap_end, today - timedelta(days=1))
        if past_end >= s:
            data = _wapi_get(WAPI_HISTORY, {
                "key": weather_key, "q": q,
                "dt":  s.strftime("%Y-%m-%d"),
                "end_dt": past_end.strftime("%Y-%m-%d"),
            })
            if data:
                for fd in (data.get("forecast", {}).get("forecastday") or []):
                    row = _row_from_forecastday(fd)
                    if row: combined.append(row)

    # Near-term slice
    near_start = max(s, today)
    near_end   = min(cap_end, forecast_horizon)
    if near_end >= near_start:
        days_needed = (near_end - today).days + 1
        days_needed = max(1, min(14, days_needed))
        data = _wapi_get(WAPI_FORECAST, {
            "key": weather_key, "q": q,
            "days": days_needed, "aqi": "no", "alerts": "no",
        })
        if data:
            for fd in (data.get("forecast", {}).get("forecastday") or []):
                row = _row_from_forecastday(fd)
                if not row: continue
                try:
                    row_date = datetime.strptime(row["date"], "%Y-%m-%d").date()
                except (TypeError, ValueError):
                    continue
                if near_start <= row_date <= near_end:
                    combined.append(row)

    # Far-future slice
    far_start = max(s, forecast_horizon + timedelta(days=1))
    far_end   = min(cap_end, future_horizon)
    if far_end >= far_start:
        current = far_start
        while current <= far_end:
            data = _wapi_get(WAPI_FUTURE, {
                "key": weather_key, "q": q,
                "dt":  current.strftime("%Y-%m-%d"),
            })
            if data:
                fdays = data.get("forecast", {}).get("forecastday") or []
                if fdays:
                    row = _row_from_forecastday(fdays[0])
                    if row: combined.append(row)
            current += timedelta(days=1)

    if not combined:
        raise RuntimeError("WeatherAPI returned no usable data for this destination/date range.")

    by_date = {row["date"]: row for row in combined if row.get("date")}
    combined = [by_date[d] for d in sorted(by_date)]

    days_out, highs, lows, means, rains, winds = [], [], [], [], [], []
    for row in combined:
        icon = _icon_for(row["text"])
        if row["tmax"]  is not None: highs.append(row["tmax"])
        if row["tmin"]  is not None: lows.append(row["tmin"])
        if row["tmean"] is not None: means.append(row["tmean"])
        rains.append(row["precip"] or 0)
        winds.append(row["wind"] or 0)

        days_out.append({
            "date": row["date"],
            "high": round(row["tmax"]) if row["tmax"] is not None else None,
            "low":  round(row["tmin"]) if row["tmin"] is not None else None,
            "icon": icon,
            "condition": row["text"],
        })

    avg_high = sum(highs) / len(highs) if highs else 0
    avg_low  = sum(lows)  / len(lows)  if lows  else 0
    avg_temp = sum(means) / len(means) if means else (avg_high + avg_low) / 2
    total_rain = sum(rains)
    avg_wind = sum(winds) / len(winds) if winds else 0

    mid_row  = combined[len(combined) // 2]
    mid_icon = _icon_for(mid_row["text"])
    mid_label = (mid_row["text"] or "Mixed").strip()

    return {
        "avg":   round(avg_temp, 1),
        "high":  round(avg_high),
        "low":   round(avg_low),
        "rain":  f"{round(total_rain)}",
        "wind":  round(avg_wind),
        "condition": mid_label,
        "icon":  mid_icon,
        "unit":  "C",
        "days":  days_out,
    }

# ----------------------------------------------------------------------
#  LLM helpers
# ----------------------------------------------------------------------
def _strip_json_fence(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"\s*```\s*$", "", raw)
    return raw


def _call_llm_raw(system_prompt: str, user_prompt: str, temperature: float = 0.4,
                  timeout: int = REQUEST_TIMEOUT) -> str:
    resp = requests.post(
        POE_ENDPOINT,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {POE_API_KEY}",
        },
        json={
            "model": POE_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            "temperature": temperature,
        },
        timeout=timeout,
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
    return content


def call_llm(location: str, start_date: str, end_date: str) -> dict:
    content = _call_llm_raw(SYSTEM_PROMPT, build_user_prompt(location, start_date, end_date))
    raw = _strip_json_fence(content)

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


def generate_itinerary(plan: dict, weather: dict, start_date: str, end_date: str) -> list:
    """
    Build a day-by-day itinerary using the LLM, factoring in the weather forecast
    and the curated attractions.
    """
    s = datetime.strptime(start_date, "%Y-%m-%d").date()
    e = datetime.strptime(end_date,   "%Y-%m-%d").date()

    # Build the list of dates we want planned, capped for performance/quality.
    total_days = (e - s).days + 1
    planned_days = min(total_days, ITINERARY_MAX_DAYS)

    # Prefer dates we actually have weather data for.
    weather_dates = []
    if weather and isinstance(weather.get("days"), list):
        weather_dates = [d.get("date") for d in weather["days"] if d.get("date")]

    if weather_dates:
        dates_to_plan = weather_dates[:planned_days]
    else:
        dates_to_plan = [(s + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(planned_days)]

    if not dates_to_plan:
        return []

    user_prompt = build_itinerary_prompt(plan, weather, start_date, end_date, dates_to_plan)
    content = _call_llm_raw(SYSTEM_PROMPT, user_prompt, temperature=0.55)
    raw = _strip_json_fence(content)

    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        raise RuntimeError("Itinerary LLM response was not valid JSON.")
    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Failed to parse itinerary JSON: {exc}")

    items = parsed.get("itinerary") or []
    if not isinstance(items, list):
        return []

    # Attach weather snapshot to each itinerary day for the UI.
    weather_by_date = {}
    if weather and isinstance(weather.get("days"), list):
        for wd in weather["days"]:
            if wd.get("date"):
                weather_by_date[wd["date"]] = wd

    cleaned = []
    for idx, day in enumerate(items):
        if not isinstance(day, dict):
            continue
        d_date = day.get("date") or (dates_to_plan[idx] if idx < len(dates_to_plan) else None)
        wd = weather_by_date.get(d_date)
        if wd:
            day["weather"] = {
                "high": wd.get("high"),
                "low":  wd.get("low"),
                "icon": wd.get("icon"),
                "condition": wd.get("condition"),
            }
        if "day_number" not in day:
            day["day_number"] = idx + 1
        cleaned.append(day)

    return cleaned

# ----------------------------------------------------------------------
#  Routes
# ----------------------------------------------------------------------
@app.route("/")
def index():
    return send_from_directory(".", "frontend.html")


@app.route("/wiki-image", methods=["GET"])
def wiki_image():
    title = (request.args.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Missing 'title' query parameter"}), 400
    try:
        size = int(request.args.get("size", 800))
    except ValueError:
        size = 800
    url = fetch_wiki_image(title, thumb_size=size)
    return jsonify({"title": title, "image": url})


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

        # 1) Real weather from WeatherAPI.com.
        try:
            result["weather"] = fetch_weather(
                result.get("coords") or {},
                result.get("city") or location,
                start_date,
                end_date,
            )
        except RuntimeError as wexc:
            result["weather"] = {
                "error": str(wexc),
                "unit": "C",
                "days": [],
            }

        # 2) Attach Wikipedia images server-side.
        enrich_with_images(result)

        # 3) Generate the weather-aware day-by-day itinerary.
        try:
            result["itinerary"] = generate_itinerary(
                result,
                result.get("weather") or {},
                start_date,
                end_date,
            )
        except Exception as iexc:
            # Don't fail the whole plan if itinerary generation hiccups.
            result["itinerary"] = []
            result["itinerary_error"] = str(iexc)

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
