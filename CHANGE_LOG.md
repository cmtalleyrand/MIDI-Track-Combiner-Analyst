
# Change Log

## [Current] - Key Spelling Fix
- **Fix:** Fixed issue where F# Major was incorrectly spelled as Gb Major (Auto-Enharmonic). The system now STRICTLY respects the note name visible in the "Key Root" dropdown. If the user selects "F#", the system enforces Sharp spelling. If "Eb", Flat spelling.
- **Refactor:** `KeyModeSettings` now imports key names directly from `musicTheory` to ensure the UI and Logic are always synchronized.

## [Previous] - Music Theory Enhancements
- **Refactor:** Completely rewrote `analyzeScale` in `musicTheory.ts`.
- **Fix:** Removed hardcoded `FLAT_BIASED_ROOTS`. Key spelling now dynamically minimizes accidentals.
- **Fix:** Enharmonic Tie-breaking now respects the UI's note naming convention (e.g., F# selects Sharps, Eb selects Flats) unless overridden by the user.

## [Previous] - ABC Export Fixes
- **Fix:** Fixed critical bug where rests at the start of a track (before the first note) were omitted in ABC export. Updated `abcUtils.ts` to always enforce `0` as the timeline start.

## [Previous] - Architecture Refactor (SoC)
- **Refactor:** Split `midiAbc.ts` into `musicTheory.ts` (Theory Logic) and `abcUtils.ts` (Formatting Logic).
- **Refactor:** Extracted `useConversionSettings` from `useMidiController` to isolate configuration management from application flow.
- **Maintenance:** Verified Enharmonic Spelling logic is preserved in the new `musicTheory.ts` module.
