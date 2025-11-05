#!/usr/bin/env python3
"""
SQLite optimization script for WorkSync production deployment
This script optimizes SQLite database settings for better performance
"""

import os
import sys
import sqlite3
from pathlib import Path

def optimize_sqlite_database(db_path):
    """
    Apply performance optimizations to SQLite database
    """
    print(f"Optimizing SQLite database: {db_path}")
    
    if not os.path.exists(db_path):
        print(f"Error: Database file {db_path} not found")
        return False
    
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Apply performance optimizations
        optimizations = [
            # Enable WAL mode for better concurrency
            "PRAGMA journal_mode=WAL;",
            
            # Set synchronous to NORMAL for better performance
            "PRAGMA synchronous=NORMAL;",
            
            # Increase cache size (in KB)
            "PRAGMA cache_size=10000;",
            
            # Set temp store to memory
            "PRAGMA temp_store=MEMORY;",
            
            # Set mmap size (64MB)
            "PRAGMA mmap_size=67108864;",
            
            # Optimize database
            "PRAGMA optimize;",
            
            # Analyze database for query planner
            "ANALYZE;",
            
            # Vacuum database to reclaim space
            "VACUUM;",
        ]
        
        for pragma in optimizations:
            print(f"Executing: {pragma}")
            cursor.execute(pragma)
            
        # Commit changes
        conn.commit()
        
        # Verify optimizations
        print("\nCurrent SQLite settings:")
        settings_to_check = [
            "journal_mode",
            "synchronous", 
            "cache_size",
            "temp_store",
            "mmap_size"
        ]
        
        for setting in settings_to_check:
            cursor.execute(f"PRAGMA {setting};")
            result = cursor.fetchone()
            print(f"  {setting}: {result[0] if result else 'N/A'}")
        
        # Get database info
        cursor.execute("PRAGMA database_list;")
        db_info = cursor.fetchall()
        print(f"\nDatabase info: {db_info}")
        
        # Get table count
        cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
        table_count = cursor.fetchone()[0]
        print(f"Tables: {table_count}")
        
        conn.close()
        print(f"\nSQLite optimization completed successfully!")
        return True
        
    except sqlite3.Error as e:
        print(f"SQLite error: {e}")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False

def set_file_permissions(db_path):
    """
    Set proper file permissions for SQLite database
    """
    try:
        # Set file permissions (readable/writable by owner and group)
        os.chmod(db_path, 0o664)
        
        # Set directory permissions
        db_dir = os.path.dirname(db_path)
        os.chmod(db_dir, 0o755)
        
        print(f"File permissions set for {db_path}")
        return True
        
    except Exception as e:
        print(f"Error setting permissions: {e}")
        return False

def create_backup(db_path):
    """
    Create a backup of the database before optimization
    """
    try:
        backup_path = f"{db_path}.backup"
        
        # Copy database file
        import shutil
        shutil.copy2(db_path, backup_path)
        
        print(f"Backup created: {backup_path}")
        return True
        
    except Exception as e:
        print(f"Error creating backup: {e}")
        return False

def main():
    """
    Main function
    """
    # Default database path
    default_db_path = "/opt/worksync/backend/db.sqlite3"
    
    # Get database path from command line or use default
    if len(sys.argv) > 1:
        db_path = sys.argv[1]
    else:
        db_path = default_db_path
    
    print("WorkSync SQLite Optimization Script")
    print("=" * 40)
    print(f"Database path: {db_path}")
    
    # Check if database exists
    if not os.path.exists(db_path):
        print(f"Error: Database file {db_path} not found")
        print("Usage: python optimize_sqlite.py [database_path]")
        sys.exit(1)
    
    # Create backup
    print("\n1. Creating backup...")
    if not create_backup(db_path):
        print("Warning: Could not create backup, continuing anyway...")
    
    # Optimize database
    print("\n2. Optimizing database...")
    if not optimize_sqlite_database(db_path):
        print("Error: Database optimization failed")
        sys.exit(1)
    
    # Set permissions
    print("\n3. Setting file permissions...")
    if not set_file_permissions(db_path):
        print("Warning: Could not set file permissions")
    
    print("\n" + "=" * 40)
    print("SQLite optimization completed successfully!")
    print("\nRecommendations:")
    print("- Monitor database performance")
    print("- Run VACUUM periodically to reclaim space")
    print("- Consider database backup strategy")
    print("- Monitor WAL file growth")

if __name__ == "__main__":
    main()
