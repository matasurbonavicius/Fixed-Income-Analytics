#!/usr/bin/env python3
"""
Generate financial calendar JSON from QuantLib
Run quarterly or semi-annually to update holiday calendars
"""

import json
from datetime import datetime, date
import QuantLib as ql
from pathlib import Path

def generate_calendars(start_year: int, end_year: int) -> dict:
    """Generate holiday calendars for major financial centers"""
    
    calendars = {
        "NYSE": ql.UnitedStates(ql.UnitedStates.NYSE),
        "USGS": ql.UnitedStates(ql.UnitedStates.GovernmentBond),  # US Government Securities
        "SOFR": ql.UnitedStates(ql.UnitedStates.SOFR),
        "TARGET": ql.TARGET(),  # Euro system
        "LSE": ql.UnitedKingdom(ql.UnitedKingdom.Exchange),
        "EUREX": ql.Germany(ql.Germany.Eurex),
        "TSE": ql.Japan(),
        "WEEKEND_ONLY": ql.WeekendsOnly(),
    }
    
    result = {
        "version": f"{datetime.now().year}.{(datetime.now().month-1)//3 + 1}",  # Year.Quarter
        "generated": datetime.now().isoformat() + "Z",
        "calendars": {}
    }
    
    for cal_name, calendar in calendars.items():
        result["calendars"][cal_name] = {
            "holidays": {},
            "weekendDays": []
        }
        
        # Determine weekend days for this calendar
        # Check which days are consistently non-business days
        test_monday = ql.Date(4, 1, 2021)  # A Monday
        for day_offset in range(7):
            test_date = test_monday + day_offset
            if not calendar.isBusinessDay(test_date):
                # Convert QuantLib weekday (1=Sunday) to JS weekday (0=Sunday)
                js_weekday = (test_date.weekday() % 7)
                result["calendars"][cal_name]["weekendDays"].append(js_weekday)
        
        # Generate holidays for each year
        for year in range(start_year, end_year + 1):
            holidays = []
            
            # Check every day in the year
            start_date = ql.Date(1, 1, year)
            end_date = ql.Date(31, 12, year)
            
            current_date = start_date
            while current_date <= end_date:
                # Skip weekends when checking for holidays
                is_weekend = current_date.weekday() in [ql.Saturday, ql.Sunday]
                
                # If it's not a business day and not a regular weekend, it's a holiday
                if not calendar.isBusinessDay(current_date):
                    # For most calendars, we want to exclude regular weekends from the holiday list
                    # But include them if this calendar has different weekend days
                    if cal_name == "WEEKEND_ONLY":
                        # Skip - this calendar only has weekends
                        pass
                    elif not is_weekend:
                        # Convert QuantLib date to ISO string
                        holidays.append(date(year, current_date.month(), current_date.dayOfMonth()).isoformat())
                
                current_date += 1
            
            result["calendars"][cal_name]["holidays"][str(year)] = holidays
    
    return result

def generate_common_schedules(start_year: int, end_year: int) -> dict:
    """Generate common bond payment schedules"""
    
    schedules = {
        "IMM": [],  # International Money Market dates (3rd Wednesday of Mar/Jun/Sep/Dec)
        "QUARTERLY_END": [],  # End of quarter dates
        "MONTHLY_END": []  # End of month dates
    }
    
    calendar = ql.TARGET()  # Use TARGET calendar for adjustments
    
    for year in range(start_year, end_year + 1):
        # IMM dates
        for month in [3, 6, 9, 12]:
            imm_date = ql.IMM.nextDate(ql.Date(1, month, year))
            schedules["IMM"].append(
                date(imm_date.year(), imm_date.month(), imm_date.dayOfMonth()).isoformat()
            )
        
        # Quarterly end dates
        for month in [3, 6, 9, 12]:
            end_date = ql.Date.endOfMonth(ql.Date(15, month, year))
            schedules["QUARTERLY_END"].append(
                date(end_date.year(), end_date.month(), end_date.dayOfMonth()).isoformat()
            )
        
        # Monthly end dates
        for month in range(1, 13):
            end_date = ql.Date.endOfMonth(ql.Date(15, month, year))
            schedules["MONTHLY_END"].append(
                date(end_date.year(), end_date.month(), end_date.dayOfMonth()).isoformat()
            )
    
    return schedules

def main():
    """Generate calendar JSON file"""
    
    # Generate calendars for next 5 years
    current_year = datetime.now().year
    start_year = current_year
    end_year = current_year + 5
    
    print(f"Generating financial calendars for {start_year}-{end_year}...")
    
    # Generate holiday calendars
    calendar_data = generate_calendars(start_year, end_year)
    
    # Add common schedules
    calendar_data["commonSchedules"] = generate_common_schedules(start_year, end_year)
    
    # Add metadata
    calendar_data["metadata"] = {
        "startYear": start_year,
        "endYear": end_year,
        "description": "Financial market holiday calendars generated from QuantLib",
        "calendarDescriptions": {
            "NYSE": "New York Stock Exchange",
            "USGS": "US Government Securities",
            "SOFR": "Secured Overnight Financing Rate calendar",
            "TARGET": "Trans-European Automated Real-time Gross Settlement",
            "LSE": "London Stock Exchange", 
            "EUREX": "Eurex Exchange (Germany)",
            "TSE": "Tokyo Stock Exchange",
            "WEEKEND_ONLY": "Only weekends are holidays"
        }
    }
    
    # Write into the package's calendar data directory (repo-relative to this script)
    output_dir = Path(__file__).resolve().parent.parent / "src" / "calendars"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Save to file
    output_file = output_dir / "financial_calendars.json"
    with open(output_file, 'w') as f:
        json.dump(calendar_data, f, indent=2, sort_keys=True)
    
    print(f"✅ Generated {output_file}")
    print(f"   - {len(calendar_data['calendars'])} calendars")
    print(f"   - Years: {start_year} to {end_year}")
    print(f"   - Version: {calendar_data['version']}")
    
    # Print summary
    for cal_name, cal_data in calendar_data['calendars'].items():
        total_holidays = sum(len(holidays) for holidays in cal_data['holidays'].values())
        print(f"   - {cal_name}: {total_holidays} holidays, weekends: {cal_data['weekendDays']}")

if __name__ == "__main__":
    main()