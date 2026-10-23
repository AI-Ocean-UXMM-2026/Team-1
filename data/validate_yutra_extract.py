#!/usr/bin/env python3
"""
Validate YUTRA extracted data for completeness and correctness.
Checks: provenance fields, data types, ranges, no fabrication.
"""
import json
import csv
import sys
from pathlib import Path
from typing import List, Dict, Any

class ValidationResult:
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.info: List[str] = []
    
    def add_error(self, msg: str):
        self.errors.append(f"❌ ERROR: {msg}")
    
    def add_warning(self, msg: str):
        self.warnings.append(f"⚠️  WARNING: {msg}")
    
    def add_info(self, msg: str):
        self.info.append(f"ℹ️  INFO: {msg}")
    
    def print_report(self):
        print("\n" + "="*70)
        print("YUTRA EXTRACTION VALIDATION REPORT")
        print("="*70)
        
        if self.errors:
            print(f"\n❌ ERRORS ({len(self.errors)}):")
            for e in self.errors:
                print(f"  {e}")
        
        if self.warnings:
            print(f"\n⚠️  WARNINGS ({len(self.warnings)}):")
            for w in self.warnings:
                print(f"  {w}")
        
        if self.info:
            print(f"\nℹ️  INFO ({len(self.info)}):")
            for i in self.info:
                print(f"  {i}")
        
        print("\n" + "="*70)
        if self.errors:
            print("RESULT: ❌ VALIDATION FAILED")
            return False
        else:
            print("RESULT: ✅ VALIDATION PASSED")
            return True

def validate_json_file(filepath: Path, required_fields: List[str]) -> ValidationResult:
    """Validate a JSON file has required provenance fields."""
    result = ValidationResult()
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        result.add_error(f"Invalid JSON in {filepath.name}: {e}")
        return result
    
    result.add_info(f"Validating {filepath.name}...")
    
    # Check required fields
    for field in required_fields:
        if field not in data:
            result.add_error(f"Missing required field: {field}")
    
    # Check provenance section
    if 'provenance' in data:
        prov = data['provenance']
        if 'source' not in prov or prov['source'] != 'YUTRA Volume II: Yangon Urban Traffic and Road Assessment':
            result.add_warning("Provenance 'source' should reference YUTRA Volume II")
        if 'survey_year' not in prov or prov['survey_year'] != 2013:
            result.add_warning("Survey year should be 2013")
    
    return result

def validate_csv_file(filepath: Path, required_columns: List[str], 
                      value_checks: Dict[str, Any] = None) -> ValidationResult:
    """Validate a CSV file has required columns and valid values."""
    result = ValidationResult()
    result.add_info(f"Validating {filepath.name}...")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except Exception as e:
        result.add_error(f"Cannot read {filepath.name}: {e}")
        return result
    
    if not rows:
        result.add_error(f"{filepath.name} is empty")
        return result
    
    result.add_info(f"  {len(rows)} rows found")
    
    # Check column headers
    first_row = rows[0]
    for col in required_columns:
        if col not in first_row:
            result.add_error(f"Missing required column: {col}")
    
    # Check for provenance fields
    provenance_cols = ['source_page', 'table_id', 'data_type', 'confidence', 'survey_year']
    for row in rows:
        for col in provenance_cols:
            if col not in row or not row[col] or row[col] == 'null':
                result.add_error(f"Missing provenance field '{col}' in row: {row.get('intersection_name', row.get('road_name', 'UNKNOWN'))}")
    
    # Value range checks
    if value_checks:
        for col, (min_val, max_val) in value_checks.items():
            for i, row in enumerate(rows):
                if col in row and row[col]:
                    try:
                        val = float(row[col])
                        if val < min_val or val > max_val:
                            result.add_warning(f"Row {i+2}: {col}={val} outside expected range [{min_val}, {max_val}]")
                    except ValueError:
                        pass
    
    return result

def main():
    raw_dir = Path(__file__).parent / 'yutra_raw'
    
    if not raw_dir.exists():
        print(f"❌ Data directory not found: {raw_dir}")
        sys.exit(1)
    
    print("YUTRA Data Validation")
    print("="*70)
    
    all_results = []
    
    # Validate JSON files
    json_validations = {
        'vehicle_pcu_factors.json': ['pcu_factors', 'provenance'],
        'traffic_model_parameters.json': ['bpr_model', 'provenance'],
    }
    
    for filename, required in json_validations.items():
        filepath = raw_dir / filename
        if filepath.exists():
            result = validate_json_file(filepath, required)
            all_results.append(result)
        else:
            print(f"⚠️  Missing: {filename}")
    
    # Validate CSV files
    csv_validations = {
        'road_speed_capacity.csv': [
            'road_name', 'township', 'max_speed_kmh', 'capacity_veh_hour', 
            'source_page', 'table_id', 'data_type', 'confidence'
        ],
        'intersection_volume.csv': [
            'intersection_name', 'township', 'latitude', 'longitude',
            'volume_veh_hour', 'source_page', 'table_id', 'data_type', 'confidence'
        ],
        'signal_delay_observations.csv': [
            'intersection_name', 'cycle_length_seconds', 'mean_delay_seconds',
            'source_page', 'table_id', 'data_type', 'confidence'
        ],
        'intersection_congestion.csv': [
            'intersection_name', 'congestion_level', 'source_page', 'table_id',
            'data_type', 'confidence'
        ],
        'turn_movement_profiles.csv': [
            'intersection_name', 'approach_direction', 'turn_direction',
            'peak_volume_veh_hour', 'source_page', 'table_id', 'data_type', 'confidence'
        ],
    }
    
    for filename, cols in csv_validations.items():
        filepath = raw_dir / filename
        if filepath.exists():
            # Value range checks
            value_checks = None
            if 'speed' in filename:
                value_checks = {
                    'max_speed_kmh': (10, 100),
                    'capacity_veh_hour': (100, 3000),
                }
            elif 'volume' in filename:
                value_checks = {
                    'volume_veh_hour': (0, 3000),
                    'latitude': (16.7, 17.1),
                    'longitude': (96.0, 96.4),
                }
            elif 'delay' in filename:
                value_checks = {
                    'cycle_length_seconds': (40, 180),
                    'mean_delay_seconds': (5, 120),
                }
            
            result = validate_csv_file(filepath, cols, value_checks)
            all_results.append(result)
        else:
            print(f"⚠️  Missing: {filename}")
    
    # Print all results
    for result in all_results:
        result.print_report()
    
    # Summary
    total_errors = sum(len(r.errors) for r in all_results)
    total_warnings = sum(len(r.warnings) for r in all_results)
    
    print(f"\n{'='*70}")
    print(f"SUMMARY: {len(all_results)} files validated")
    print(f"  Total errors: {total_errors}")
    print(f"  Total warnings: {total_warnings}")
    print(f"{'='*70}\n")
    
    if total_errors > 0:
        sys.exit(1)
    else:
        print("✅ All validations passed!")
        sys.exit(0)

if __name__ == '__main__':
    main()
