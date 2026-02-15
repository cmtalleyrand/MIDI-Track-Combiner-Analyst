
import { RawNote, ConversionOptions } from '../../types';

const getMidi = (n: any | RawNote) => 'midi' in n ? n.midi : (n as any).midi;
const getTicks = (n: any | RawNote) => 'ticks' in n ? n.ticks : (n as any).ticks;
const getDuration = (n: any | RawNote) => 'durationTicks' in n ? n.durationTicks : (n as any).durationTicks;
const getEnd = (n: any | RawNote) => getTicks(n) + getDuration(n);

export function getVoiceLabel(index: number, total: number): string {
    if (index === -1) return 'Orphan';
    if (total === 1) return 'Melody';
    if (total === 2) return index === 0 ? 'Soprano' : 'Bass';
    if (total === 3) return ['Soprano', 'Tenor', 'Bass'][index] || `Voice ${index + 1}`;
    if (total === 4) return ['Soprano', 'Alto', 'Tenor', 'Bass'][index] || `Voice ${index + 1}`;
    return `Voice ${index + 1}`;
}

interface DensityArea {
    startTick: number;
    endTick: number;
    density: number;
    slices: any[];
}

/**
 * Structural Analysis based on Density and Sustain criteria.
 */
export function distributeToVoices(notes: any[] | RawNote[], options?: ConversionOptions, ppq: number = 480): (any | RawNote)[][] {
    if (notes.length === 0) return [];

    const TS_NUM = options?.timeSignature?.numerator || 4;
    const TS_DEN = options?.timeSignature?.denominator || 4;
    const TICKS_PER_MEASURE = ppq * TS_NUM * (4 / TS_DEN);
    const EIGHTH_GAP = ppq / 2;
    const strictMonophony = options?.voiceSeparationDisableChords === true;

    const sortedNotes = [...notes].sort((a, b) => getTicks(a) - getTicks(b));
    const allEvents = new Set<number>();
    sortedNotes.forEach(n => { 
        allEvents.add(getTicks(n)); 
        allEvents.add(getEnd(n)); 
    });
    const sortedTimeline = Array.from(allEvents).sort((a,b) => a - b);
    
    // Create slices of the timeline
    const slices: { start: number, end: number, activeNotes: (any | RawNote)[] }[] = [];
    let maxGlobalDensity = 0;
    
    for (let i = 0; i < sortedTimeline.length - 1; i++) {
        const start = sortedTimeline[i];
        const end = sortedTimeline[i+1];
        const mid = (start + end) / 2;
        const active = sortedNotes.filter(n => getTicks(n) <= mid && getEnd(n) > mid);
        if (active.length > maxGlobalDensity) maxGlobalDensity = active.length;
        slices.push({ start, end, activeNotes: active });
    }

    if (maxGlobalDensity === 0) return [sortedNotes];

    const totalTicks = sortedTimeline[sortedTimeline.length - 1] - sortedTimeline[0];

    /**
     * Finds contiguous areas of specific density with gap tolerance.
     */
    const findAreasAtDensity = (targetDensity: number) => {
        const areas: DensityArea[] = [];
        let currentArea: DensityArea | null = null;

        slices.forEach((slice) => {
            if (slice.activeNotes.length >= targetDensity) {
                if (!currentArea) {
                    currentArea = { startTick: slice.start, endTick: slice.end, density: targetDensity, slices: [slice] };
                } else {
                    const gap = slice.start - currentArea.endTick;
                    if (gap <= EIGHTH_GAP) {
                        currentArea.endTick = slice.end;
                        currentArea.slices.push(slice);
                    } else {
                        areas.push(currentArea);
                        currentArea = { startTick: slice.start, endTick: slice.end, density: targetDensity, slices: [slice] };
                    }
                }
            }
        });
        if (currentArea) areas.push(currentArea);
        return areas;
    };

    /**
     * Checks if an area meets sustain criteria (1 measure or 1/5 total length).
     */
    const checkSustain = (area: DensityArea) => {
        const len = area.endTick - area.startTick;
        return len >= TICKS_PER_MEASURE || len >= totalTicks / 5;
    };

    // Determine final polyphony target based on structural sustain
    let d = maxGlobalDensity;
    let sustainedAreas: DensityArea[] = [];
    while (d >= 1) {
        const areas = findAreasAtDensity(d);
        sustainedAreas = areas.filter(checkSustain);
        if (sustainedAreas.length > 0) break;
        d--;
    }

    // Fallback logic: if no sustained areas found at max, use max-1 if possible.
    let finalPolyphony = d;
    if (finalPolyphony === 0) finalPolyphony = Math.max(1, maxGlobalDensity - 1);

    const voiceTracks: (any | RawNote)[][] = Array.from({ length: finalPolyphony }, () => []);
    const assignedNotes = new Set<any | RawNote>();

    // 1. Assign notes in structural sustained areas first (Top-Down)
    sustainedAreas.forEach(area => {
        area.slices.forEach(slice => {
            const unassigned = slice.activeNotes
                .filter(n => !assignedNotes.has(n))
                .sort((a, b) => getMidi(b) - getMidi(a)); // Pitch descending
            
            for (let v = 0; v < finalPolyphony && unassigned.length > 0; v++) {
                const note = unassigned.shift()!;
                voiceTracks[v].push(note);
                assignedNotes.add(note);
                (note as any).voiceIndex = v;
            }
        });
    });

    // 2. Iteratively solve gaps and connect start/ends
    const remainingNotes = sortedNotes.filter(n => !assignedNotes.has(n));
    remainingNotes.forEach(note => {
        let bestV = -1;
        let minPitchDiff = Infinity;
        const nPitch = getMidi(note);

        for (let v = 0; v < finalPolyphony; v++) {
            const track = voiceTracks[v];
            const prev = track.filter(n => getTicks(n) < getTicks(note)).sort((a,b) => getTicks(b) - getTicks(a))[0];
            const next = track.filter(n => getTicks(n) > getTicks(note)).sort((a,b) => getTicks(a) - getTicks(b))[0];
            
            const overlap = track.some(n => getTicks(n) < getEnd(note) && getEnd(n) > getTicks(note));
            
            // If checking strict monophony (disable chords), we cannot allow overlap
            if (overlap && strictMonophony) continue;
            
            // Score suitability
            let diff = 0;
            if (prev) diff += Math.abs(getMidi(prev) - nPitch);
            if (next) diff += Math.abs(getMidi(next) - nPitch);
            if (!prev && !next) diff = Math.abs(60 - nPitch);

            if (diff < minPitchDiff) {
                minPitchDiff = diff;
                bestV = v;
            }
        }
        
        // If we found a valid voice, assign it.
        // If strictMonophony is on and bestV is -1 (meaning all voices overlapped), 
        // we DROP the note (it creates a chord we don't want).
        // If strictMonophony is off, we force it into Voice 0 if all else fails (legacy behavior).
        
        if (bestV === -1 && !strictMonophony) {
             bestV = 0; 
        }

        if (bestV !== -1) {
            voiceTracks[bestV].push(note);
            assignedNotes.add(note);
            (note as any).voiceIndex = bestV;
        }
    });

    voiceTracks.forEach(t => t.sort((a,b) => getTicks(a) - getTicks(b)));
    return voiceTracks;
}
