"""
Migration script: Convert Pickle face encodings to JSON
Run this once to migrate from .p files to .json files
"""

import os
import json
import pickle
import numpy as np

def migrate_pickle_to_json():
    print("=" * 50)
    print("MIGRATION: Pickle (.p) -> JSON (.json)")
    print("=" * 50)
    
    # Migrate Resident encodings
    pickle_file = "EncodeFile.p"
    json_file = "EncodeFile.json"
    
    if os.path.exists(pickle_file):
        print(f"\n[1] Migrating residents: {pickle_file} -> {json_file}")
        try:
            with open(pickle_file, "rb") as f:
                data = pickle.load(f)
            
            # Convert to JSON-serializable format
            json_data = {}
            if isinstance(data, dict):
                for pid, enc in data.items():
                    if isinstance(enc, np.ndarray):
                        json_data[str(pid)] = enc.tolist()
                    elif isinstance(enc, list):
                        json_data[str(pid)] = enc
            
            with open(json_file, "w", encoding="utf-8") as f:
                json.dump(json_data, f)
            
            print(f"    -> Migrated {len(json_data)} resident encodings")
            
            # Backup original
            backup_file = pickle_file + ".backup"
            os.rename(pickle_file, backup_file)
            print(f"    -> Original backed up as: {backup_file}")
            
        except Exception as e:
            print(f"    -> ERROR: {e}")
    else:
        print(f"\n[1] {pickle_file} not found, skipping...")
        # Create empty JSON file
        with open(json_file, "w", encoding="utf-8") as f:
            json.dump({}, f)
    
    # Migrate Tamu encodings
    pickle_file = "EncodeFileTamu.p"
    json_file = "datatamu_encodings.json"
    
    if os.path.exists(pickle_file):
        print(f"\n[2] Migrating tamu: {pickle_file} -> {json_file}")
        try:
            with open(pickle_file, "rb") as f:
                data = pickle.load(f)
            
            # Convert to JSON-serializable format
            json_data = {}
            if isinstance(data, list):
                for tamu_id, enc in data:
                    if isinstance(enc, np.ndarray):
                        json_data[str(tamu_id)] = enc.tolist()
                    elif isinstance(enc, list):
                        json_data[str(tamu_id)] = enc
            
            with open(json_file, "w", encoding="utf-8") as f:
                json.dump(json_data, f)
            
            print(f"    -> Migrated {len(json_data)} tamu encodings")
            
            # Backup original
            backup_file = pickle_file + ".backup"
            os.rename(pickle_file, backup_file)
            print(f"    -> Original backed up as: {backup_file}")
            
        except Exception as e:
            print(f"    -> ERROR: {e}")
    else:
        print(f"\n[2] {pickle_file} not found, skipping...")
        # Create empty JSON file
        with open(json_file, "w", encoding="utf-8") as f:
            json.dump({}, f)
    
    # Ensure data_temporary.json exists
    json_file = "data_temporary.json"
    if not os.path.exists(json_file):
        with open(json_file, "w", encoding="utf-8") as f:
            json.dump({"temporary_users": {}, "history": []}, f)
        print(f"\n[3] Created: {json_file}")
    
    print("\n" + "=" * 50)
    print("MIGRATION COMPLETE")
    print("=" * 50)
    print("\nTo remove backup files after verifying:")
    print("  rm EncodeFile.p.backup")
    print("  rm EncodeFileTamu.p.backup")


if __name__ == "__main__":
    migrate_pickle_to_json()
