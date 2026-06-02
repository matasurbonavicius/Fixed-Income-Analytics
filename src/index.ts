/**
 * Fixed Income Analytics — a dependency-free TypeScript engine for fixed-income math.
 *
 * Public entry point. Re-exports the domain model (value objects, entities,
 * formulas, market-data structures) and the application layer (calculation
 * services and the formula engine).
 *
 * @packageDocumentation
 */
export * from "./domain";
export * from "./application";
export * as calendars from "./calendars";
