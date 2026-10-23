# YUTRA Data Extraction Plan
## Phase 2: Systematic Data Capture & Validation

**Objective:** Extract historical traffic observations from the YUTRA Final Report Volume II (12182739_02.pdf) into machine-readable, traceable datasets ready for geospatial matching and integration.

---

## 1. Overview: Tables to Extract

| Priority | Table/Section | Content | Output Format | Status |
|----------|---------------|---------|----------------|--------|
| 1 | Table 2.3.6 | Vehicle PCU factors | `vehicle_pcu_factors.json` | Pending |
| 1 | Table 2.4.1–2.4.2 | Road capacity & max speed | `road_speed_capacity.csv` | Pending |
| 1 | Section 2.3.8 | BPR congestion model parameters | `traffic_model_parameters.json` | Pending |
| 2 | Table 5.2.2.1 | Intersection traffic volume | `intersection_volume.csv` | Pending |
| 2 | Section 5.2.2 | Intersection congestion levels | `intersection_congestion.csv` | Pending |
| 3 | Section 5.5 | Signal delay observations | `signal_delay_observations.csv` | Pending |
| 3 | Section 5.3 | Turn movement profiles | `turn_movement_profiles.csv` | Pending |

---

## 2. Extraction Rules & Standards

### 2.1 Provenance Fields (Required for Every Record)

Every extracted row **must** include:

```json
{
  "data_element": "...",
  "source": "YUTRA Volume II",
  "survey_year": 2013,
  "source_page": "X-Y",
  "table_id": "2.4.2 or 5.2.2.1",
  "data_type": "observed | modeled | assumed",
  "confidence": "verified | estimated | interpolated",
  "unit": "km/h | veh/hour | seconds",
  "geographic_scope": "Yangon city | specific township(s)",
  "notes": "..."
}
```

### 2.2 Do Not Fabricate, Interpolate, or Assume

**ALLOWED:**
- Copy exact values from tables
- Mark missing data as `null`
- Record confidence level as reported

**NOT ALLOWED:**
- Fill missing hourly data from 16-hour totals
- Guess coordinates for unspecified locations
- Assume symmetric directional splits
- Invent vehicle types not in the report

### 2.3 Preserve Original Units & Place Names

**Always:**
- Keep original unit (km/h, veh/hour, seconds)
- Record Burmese and English road names separately
- Note any unit conversions in the `notes` field

**Normalize Later:** Create separate `name_normalized` field after validation.

### 2.4 Date & Survey Validity

**Critical:** The report may cite data from multiple survey periods:
- Do NOT assume all tables are from 2013
- Check each section for survey date explicitly
- Record survey_period_start and survey_period_end if ranges are given

---

## 3. Table-by-Table Extraction Specifications

### 3.1 Table 2.3.6: Vehicle PCU Factors

**Purpose:** Convert vehicle types to Passenger Car Units (PCU) for capacity modeling.

**Source:** Section 2.3, typically a simple lookup table.

**Output: `vehicle_pcu_factors.json`**

```json
{
  "extracted_at": "2026-10-23T16:05:30+06:30",
  "source_page": "2-X",
  "table_id": "2.3.6",
  "pcu_factors": [
    {
      "vehicle_type": "Motorcycle",
      "vehicle_type_burmese": "စက်ဘီး",
      "pcu_factor": 0.5,
      "data_type": "standardized",
      "confidence": "verified",
      "source": "YUTRA standardized classification"
    },
    {
      "vehicle_type": "Car / Sedan",
      "vehicle_type_burmese": "ကား",
      "pcu_factor": 1.0,
      "data_type": "standardized",
      "confidence": "verified",
      "source": "YUTRA standardized classification"
    },
    {
      "vehicle_type": "Van / Pickup",
      "vehicle_type_burmese": "ကားနံ / အကျီခွင့်",
      "pcu_factor": 1.5,
      "data_type": "observed",
      "confidence": "verified",
      "source": "YUTRA field survey"
    },
    {
      "vehicle_type": "Truck (2-axle)",
      "vehicle_type_burmese": "ထရပ်ကာ (၂-ခြင်း)",
      "pcu_factor": 2.0,
      "data_type": "observed",
      "confidence": "verified",
      "source": "YUTRA field survey"
    }
  ],
  "provenance": {
    "source": "YUTRA Volume II",
    "survey_year": 2013,
    "table_id": "2.3.6",
    "unit": "PCU per vehicle",
    "geographic_scope": "Yangon",
    "notes": "PCU is used in BPR model for capacity estimation. Factors may vary by road type; check Section 2.3 for detailed breakdown."
  }
}
```

### 3.2 Table 2.4.1 & 2.4.2: Road Capacity & Maximum Speed

**Purpose:** Free-flow speed and design capacity for each road type/class.

**Source:** Section 2.4 — typically a matrix: (road_class, direction) → (max_speed_kmh, capacity_veh_hour).

**Output: `road_speed_capacity.csv`**

```csv
road_name,road_name_burmese,road_class,direction,max_speed_kmh,capacity_veh_hour,design_capacity_type,data_type,confidence,survey_year,source_page,table_id,notes
Pyay Road,ပြည်သူ့အဆင့်အတန်း လမ်း,Main Road,Both,60,1800,Design,observed,verified,2013,2-45,2.4.2,Standard urban arterial
Pyay Road,ပြည်သူ့အဆင့်အတန်း လမ်း,Main Road,North-South,60,900,Directional,observed,verified,2013,2-45,2.4.2,Directional split not symmetric
Ahlone Road,အလုံလမ်း,Main Road,Both,50,1500,Design,observed,verified,2013,2-46,2.4.2,Downtown segment; lower speed due to signals
...
```

**Key Columns:**
- `road_name`, `road_name_burmese`: Original names from report
- `road_class`: Classification (Main, Secondary, Local, etc.)
- `direction`: "Both", "North", "South", "East", "West", or directional code
- `max_speed_kmh`: Free-flow speed (km/h)
- `capacity_veh_hour`: Capacity (vehicles per hour), or `null` if not specified
- `design_capacity_type`: "Design" (total) or "Directional" (one direction)
- `confidence`: "verified" (measured), "estimated" (modeled)
- `notes`: Qualifications (e.g., "includes intersection delay", "peak hour only")

### 3.3 Section 2.3.8: BPR Congestion Model Parameters

**Purpose:** Calibration constants for the BPR model: `t = t₀ [1 + 3(v/c)⁴]`

**Output: `traffic_model_parameters.json`**

```json
{
  "extracted_at": "2026-10-23T16:05:30+06:30",
  "source_page": "2-X",
  "section": "2.3.8",
  "bpr_model": {
    "formula": "t = t₀ * [1 + α * (v/c)^β]",
    "parameters": {
      "alpha": {
        "value": 3.0,
        "description": "Shape parameter; controls congestion sensitivity",
        "data_type": "standardized",
        "confidence": "assumed",
        "notes": "Standard value in BPR model; YUTRA may use alternative calibration"
      },
      "beta": {
        "value": 4.0,
        "description": "Power exponent; higher β = steeper congestion response",
        "data_type": "standardized",
        "confidence": "assumed",
        "notes": "Standard BPR exponent"
      }
    },
    "definitions": {
      "t": "Travel time (minutes)",
      "t0": "Free-flow travel time (minutes)",
      "v": "Volume (vehicles per hour)",
      "c": "Capacity (vehicles per hour)"
    },
    "application": "Road segments where volume and capacity are known",
    "assumptions": [
      "v and c are in equivalent vehicle units (PCU)",
      "t₀ is based on max speed and segment distance",
      "Model is valid for v/c ratio 0.0–1.2 (beyond 1.0 is oversaturation)"
    ]
  },
  "calibration_notes": "Check if YUTRA adjusts α or β for Yangon conditions (e.g., traffic behavior, enforcement patterns)",
  "provenance": {
    "source": "YUTRA Volume II",
    "survey_year": 2013,
    "section": "2.3.8",
    "geographic_scope": "Yangon",
    "notes": "BPR model is standard in traffic engineering; YUTRA likely uses standard parameters unless explicitly stated otherwise"
  }
}
```

### 3.4 Table 5.2.2.1: Intersection Traffic Volume

**Purpose:** Observed traffic counts at key intersections (peak and off-peak periods).

**Output: `intersection_volume.csv`**

```csv
intersection_name,intersection_name_burmese,township,latitude,longitude,latitude_source,longitude_source,time_period,vehicles_counted,volume_veh_hour,data_type,confidence,survey_date,survey_year,count_duration_minutes,source_page,table_id,notes
Sule Square / Bogyoke Rd,စုလေ広場 / ဗိုလ်ချုပ်အောင်ဆန်းလမ်း,Kyauktada,16.8661,96.1951,manual_verification,manual_verification,Peak (07:30-09:30),2847,948,observed,verified,2013-03-15,2013,120,5-XX,5.2.2.1,Peak hour 08:00–09:00; both directions
Sule Square / Bogyoke Rd,စုလေ広場 / ဗိုလ်ချုပ်အောင်ဆန်းလမ်း,Kyauktada,16.8661,96.1951,manual_verification,manual_verification,Off-peak (14:00-16:00),1512,504,observed,verified,2013-03-15,2013,120,5-XX,5.2.2.1,Off-peak; both directions
...
```

**Critical Columns:**
- `latitude`, `longitude`: Exact location; **use `null` if not precisely specified**
- `latitude_source`, `longitude_source`: "GPS_verified", "manual_verification", "estimated", null
- `time_period`: "Peak (HH:MM-HH:MM)", "Off-peak (HH:MM-HH:MM)", "24-hour", etc.
- `vehicles_counted`: Raw count during observation period
- `volume_veh_hour`: Converted to equivalent hourly volume (vehicles/hour)
- `count_duration_minutes`: How long the count lasted (e.g., 120 for 2 hours)
- `confidence`: "verified" (manual count), "estimated" (derived), "interpolated" (if calculated)

**Important:** If the intersection name is not in the report with coordinates, do **not** invent them. Mark as `null` and create an entry in an "unmatched intersections" review queue.

### 3.5 Section 5.2.2: Intersection Congestion

**Purpose:** Qualitative congestion assessment by intersection and time period.

**Output: `intersection_congestion.csv`**

```csv
intersection_name,intersection_name_burmese,township,time_period,congestion_level,description,contributing_factors,data_type,confidence,survey_year,source_page,notes
Sule Square / Bogyoke Rd,စုလေ広場 / ဗိုလ်ချုပ်အောင်ဆန်းလမ်း,Kyauktada,Peak (07:30-09:30),High,Heavy congestion; queues extend 150m on all approaches,Signal timing suboptimal; heavy commercial traffic,modeled,estimated,2013,5-YY,Based on volume count and signal timing analysis
...
```

### 3.6 Section 5.5: Signal Delay Observations

**Purpose:** Measured or estimated delay (red light time, queue wait) at signalized intersections.

**Output: `signal_delay_observations.csv`**

```csv
signal_id,intersection_name,intersection_name_burmese,township,latitude,longitude,signal_type,cycle_length_seconds,green_time_seconds,red_time_seconds,mean_delay_seconds,data_type,confidence,survey_year,source_page,notes
1,Sule Square / Bogyoke Rd,စုလေ広場 / ဗိုလ်ချုပ်အောင်ဆန်းလမ်း,Kyauktada,16.8661,96.1951,Fixed Timing,90,45,45,22,observed,verified,2013,5-ZZ,Manual count; both directions averaged
...
```

**Key Columns:**
- `cycle_length_seconds`: Total signal cycle (green + red)
- `green_time_seconds`, `red_time_seconds`: Timing split
- `mean_delay_seconds`: Average wait time per vehicle
- `confidence`: "verified" (measured), "assumed" (from signal controller), "estimated" (modeled)

### 3.7 Section 5.3: Turn Movement Profiles

**Purpose:** Traffic flow split by turning direction at major intersections.

**Output: `turn_movement_profiles.csv`**

```csv
intersection_name,intersection_name_burmese,township,approach_direction,turn_direction,peak_volume_veh_hour,off_peak_volume_veh_hour,percentage_of_approach_traffic,data_type,confidence,survey_year,source_page,notes
Sule Square / Bogyoke Rd,စုလေ広場 / ဗိုလ်ချုပ်အောင်ဆန်းလမ်း,Kyauktada,From North,Straight,420,180,58%,observed,verified,2013,5-AA,Peak hour 08:00-09:00; Straight movement dominant
Sule Square / Bogyoke Rd,စုလေ広場 / ဗိုလ်ချုပ်အောင်ဆန်းလမ်း,Kyauktada,From North,Left Turn,204,98,28%,observed,verified,2013,5-AA,Left turn significant due to proximity to main retail
Sule Square / Bogyoke Rd,စုလေ広場 / ဗိုလ်ချုပ်အောင်ဆန်းလမ်း,Kyauktada,From North,Right Turn,102,54,14%,observed,verified,2013,5-AA,Right turn lower; one-way restriction on outbound
...
```

---

## 4. Geospatial Matching Strategy

After extraction, each road and intersection must be matched to OpenStreetMap entities.

### 4.1 Matching Confidence Scoring

**Workflow:**
1. **Name matching:** YUTRA road name → OSM way name or node name
   - Exact match (e.g., "Pyay Road" = `name:en="Pyay Road"`)
   - Partial match with suffix (e.g., "Pyay Rd" ≈ "Pyay Road")
   - Fuzzy match (Levenshtein distance < 3)
   - Burmese-to-English translation matching

2. **Geospatial proximity:** If coordinates are given:
   - OSM entity within 50 m → confidence +0.20
   - OSM entity within 100 m → confidence +0.10
   - OSM entity > 100 m away → confidence -0.10

3. **Segment direction consistency:**
   - OSM way carries the same direction → confidence +0.15
   - OSM way is bidirectional → confidence 0
   - OSM way is opposite direction → confidence -0.15

4. **Reference matching:**
   - YUTRA mention of intersecting street matches OSM intersection → confidence +0.10

**Final Score Calculation:**
```
confidence_score = 
  0.5 (baseline for any match)
  + name_match_points (0–0.35)
  + proximity_points (-0.10 to 0.20)
  + direction_points (-0.15 to 0.15)
  + reference_points (0 to 0.10)
```

**Acceptance Threshold:**
- confidence_score ≥ 0.65: Accept match, use for historical estimates
- confidence_score 0.50–0.64: Mark for manual review
- confidence_score < 0.50: Reject, unmatched queue

### 4.2 Handling Unmatched Intersections

Create `unmatched_intersections.json`:

```json
{
  "intersection_name": "Road name from YUTRA",
  "intersection_name_burmese": "လမ်းအမည်",
  "latitude": null,
  "longitude": null,
  "latitude_source": "not_specified",
  "longitude_source": "not_specified",
  "township": "estimated from context",
  "confidence_score": 0.45,
  "reason": "No exact name match in OSM; proximity estimate only.",
  "candidate_osm_ids": [
    { "osm_id": 12345, "name": "Pyay Road North", "distance_m": 150, "score": 0.55 }
  ],
  "action_required": "Manual geocoding; consult 2013 maps or Yangon reference atlas",
  "source_page": "5-XX"
}
```

**Manual Review Process:**
- Load unmatched list into QGIS with Yangon basemap
- Cross-reference against historical satellite imagery or street-level photos
- Assign OSM identifiers or coordinates
- Update confidence scores
- Re-run matching pipeline

---

## 5. Data Validation Checklist

### Before Publishing Extracted Data

- [ ] All provenance fields present (source, page, table_id, data_type, confidence)
- [ ] No fabricated values; `null` used for missing data
- [ ] Original units preserved; conversions noted in `notes`
- [ ] Burmese and English names both recorded
- [ ] Date/survey period explicitly stated for each table
- [ ] Confidence level is conservative (err on side of "low")
- [ ] Geospatial matches scored ≥ 0.65 or in unmatched queue
- [ ] Sample spot-checked against PDF source
- [ ] CSV format validated (proper escaping, encoding UTF-8)
- [ ] JSON formatted and validated with schema

### Automated Checks

Create a validator script (`validate_yutra_extract.py`):

```python
def validate_extraction(dataframe):
    checks = []
    
    # Provenance fields
    required = ['source', 'source_page', 'table_id', 'data_type', 'confidence']
    for col in required:
        if col not in dataframe.columns:
            checks.append(f"FAIL: Missing provenance field: {col}")
    
    # No null confidences
    if dataframe['confidence'].isna().any():
        checks.append("FAIL: null confidence found; must classify as verified|estimated|interpolated")
    
    # Date fields populated
    if 'survey_year' in dataframe.columns:
        if dataframe['survey_year'].isna().any():
            checks.append("FAIL: survey_year is null; check original table for date")
    
    # Reasonable values (bounds checking)
    if 'max_speed_kmh' in dataframe.columns:
        if (dataframe['max_speed_kmh'] > 100).any():
            checks.append("WARN: max_speed_kmh > 100; verify against source")
    
    if 'confidence_score' in dataframe.columns:
        if (dataframe['confidence_score'] < 0.65).any() and (dataframe['confidence_score'] > 0).any():
            checks.append(f"INFO: {(dataframe['confidence_score'] < 0.65).sum()} records < 0.65 threshold, in unmatched queue")
    
    return checks

# Usage
errors = validate_extraction(df)
if errors:
    for e in errors:
        print(e)
else:
    print("All validations passed")
```

---

## 6. File Organization & Naming

### Output Directory Structure

```
data/
├── yutra_raw/                    # Original extracted data with full provenance
│   ├── vehicle_pcu_factors.json
│   ├── road_speed_capacity.csv
│   ├── traffic_model_parameters.json
│   ├── intersection_volume.csv
│   ├── intersection_congestion.csv
│   ├── signal_delay_observations.csv
│   └── turn_movement_profiles.csv
│
├── yutra_matched/                # After geospatial matching
│   ├── roads_matched_osm.csv     # (osm_id, yutra_road_name, max_speed_kmh, capacity_veh_hour)
│   ├── intersections_matched_osm.csv
│   ├── unmatched_intersections.json
│   └── matching_report.md
│
├── yutra_processed/              # Ready for routing integration
│   ├── historical_arc_matrix.csv # (from_osm_id, to_osm_id, time_min, capacity, confidence)
│   ├── historical_signal_delays.csv
│   └── integration_metadata.json
│
└── yangon.osm.pbf               # (already in repo)
```

---

## 7. Extraction Workflow Summary

1. **Manually locate each YUTRA table** in the PDF (use table of contents)
2. **Extract data** to CSV/JSON with full provenance
3. **Validate** using automated checks
4. **Geospatial match** against OSM entities
5. **Confidence score** each match
6. **Separate matched vs. unmatched** records
7. **Manual review** of unmatched intersections
8. **Publish** matched data to `yutra_matched/`
9. **Process** into historical arc matrix for routing
10. **Integrate** into Oern dispatch system

---

## 8. Next Steps

**Immediate (Day 1–2):**
- Manually open YUTRA PDF
- Locate Table 2.3.6, Table 2.4.1–2.4.2, Section 2.3.8
- Extract PCU factors, road capacity, BPR parameters
- Create sample JSON/CSV files

**Week 1:**
- Complete extraction of all Priority 1 tables
- Run geospatial matching
- Generate unmatched queue
- Manual review of 50–100 critical intersections

**Week 2:**
- Extract Priority 2 & 3 tables
- Complete full geospatial matching
- Create historical arc matrix

---

## Appendix: UTF-8 Encoding for Burmese Text

All CSV files must use UTF-8 encoding. Sample Burmese road names:

| English | Burmese | Unicode Code Points |
|---------|---------|-------------------|
| Pyay Road | ပြည်သူ့အဆင့်အတန်း လမ်း | U+1010 U+101B... |
| Ahlone Road | အလုံလမ်း | U+1021 U+101C... |
| Sule Square | စုလေ広場 | U+1005 U+101C... |

**Python UTF-8 CSV Example:**

```python
import pandas as pd

# Create DataFrame with Burmese text
df = pd.DataFrame({
    'road_name': ['Pyay Road', 'Ahlone Road'],
    'road_name_burmese': ['ပြည်သူ့အဆင့်အတန်း လမ်း', 'အလုံလမ်း'],
    'max_speed_kmh': [60, 50]
})

# Save with UTF-8 encoding
df.to_csv('road_speed_capacity.csv', index=False, encoding='utf-8')
```

