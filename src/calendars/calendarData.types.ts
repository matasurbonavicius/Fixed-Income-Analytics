export type CalendarCode = 
  | "NYSE"
  | "USGS" 
  | "SOFR"
  | "TARGET"
  | "LSE"
  | "EUREX"
  | "TSE"
  | "WEEKEND_ONLY";

export interface CalendarData {
  version: string;
  generated: string;
  calendars: {
    [key in CalendarCode]: {
      holidays: {
        [year: string]: string[];  // ISO date strings
      };
      weekendDays: number[];  // 0=Sunday, 6=Saturday
    };
  };
  commonSchedules?: {
    IMM: string[];
    QUARTERLY_END: string[];
    MONTHLY_END: string[];
  };
  metadata: {
    startYear: number;
    endYear: number;
    description?: string;
    calendarDescriptions?: {
      [key in CalendarCode]?: string;
    };
  };
}