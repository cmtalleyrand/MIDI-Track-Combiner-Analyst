import { Midi, Track } from '@tonejs/midi';
import { ConversionOptions, MidiEventType, PianoRollTrackData } from '../../types';
import { quantizeNotes, performInversion, performModalConversion, pruneOverlaps, performMelodicInversion, cropToRange } from './midiTransform';
import { distributeToVoices } from './midiVoices';

interface TempoTransformContext {
    ppqRatio: number;
    tickScale: number;
    tempoScale: number;
    isGlobalInversion: boolean;
    maxTick: number;
    cropEnabled: boolean;
    cropStartTick: number;
    cropEndTick: number;
}

function transformEventTicks(ticks: number, context: TempoTransformContext): number | null {
    let transformedTicks = Math.round(ticks * context.ppqRatio);
    transformedTicks = Math.round(transformedTicks * context.tickScale);

    if (context.isGlobalInversion) {
        transformedTicks = context.maxTick - transformedTicks;
    }

    if (context.cropEnabled) {
        if (transformedTicks < context.cropStartTick || transformedTicks > context.cropEndTick) {
            return null;
        }
        transformedTicks -= context.cropStartTick;
    }

    return transformedTicks;
}

function getTempoScale(options: ConversionOptions): number {
    if (options.originalTempo <= 0 || options.tempo <= 0) return 1;
    return options.tempo / options.originalTempo;
}

function buildTransformedTempoEvents(
    sourceMidi: Midi,
    destinationHeader: Midi['header'],
    context: TempoTransformContext
): Array<{ ticks: number; bpm: number; time?: number }> {
    const sourceTempoEvents = sourceMidi.header.tempos;
    if (!sourceTempoEvents || sourceTempoEvents.length === 0) {
        return [{ ticks: 0, bpm: Math.max(1, destinationHeader.tempos[0]?.bpm || 120), time: 0 }];
    }

    const transformed = sourceTempoEvents
        .map((event) => {
            const ticks = transformEventTicks(event.ticks, context);
            if (ticks === null) return null;
            const bpm = Math.max(1, event.bpm * context.tempoScale);
            return { ticks, bpm };
        })
        .filter((event): event is { ticks: number; bpm: number; time?: number } => event !== null)
        .sort((a, b) => a.ticks - b.ticks);

    if (transformed.length === 0 || transformed[0].ticks > 0) {
        const fallbackBpm = Math.max(1, (sourceTempoEvents[0]?.bpm || 120) * context.tempoScale);
        transformed.unshift({ ticks: 0, bpm: fallbackBpm });
    }

    const deduped: Array<{ ticks: number; bpm: number; time?: number }> = [];
    transformed.forEach((event) => {
        const existingIndex = deduped.findIndex((candidate) => candidate.ticks === event.ticks);
        if (existingIndex >= 0) deduped[existingIndex] = event;
        else deduped.push(event);
    });

    return deduped;
}

function applyTempoEvents(destinationHeader: Midi['header'], tempoEvents: Array<{ ticks: number; bpm: number; time?: number }>) {
    destinationHeader.tempos = tempoEvents.map((event) => ({ ...event }));
    destinationHeader.update();
}

export function copyAndTransformTrackEvents(
    sourceTrack: Track, 
    destinationTrack: Track, 
    options: ConversionOptions, 
    eventsToDelete: Set<MidiEventType>, 
    destinationHeader: Midi['header'], 
    sourcePPQ: number
) {
    const destPPQ = destinationHeader.ppq;
    const ppqRatio = destPPQ / sourcePPQ;

    const tempoScale = getTempoScale(options);
    let tickScale = options.noteTimeScale;
    if (options.tempoChangeMode === 'time') {
        tickScale *= tempoScale;
    }

    // 1. Initial Copy, Transposition & PPQ Normalization
    let transformedNotes: any[] = sourceTrack.notes.map((note: any) => {
        let newMidi = note.midi + options.transposition;
        newMidi = Math.max(0, Math.min(127, newMidi));
        
        const { name, ...rest } = note;

        // Normalize ticks to destination PPQ immediately
        const normalizedTicks = Math.round(note.ticks * ppqRatio);
        const normalizedDuration = Math.round(note.durationTicks * ppqRatio);

        return { 
            ...rest, 
            midi: newMidi, 
            ticks: normalizedTicks, 
            durationTicks: normalizedDuration,
            velocity: note.velocity,
        } as any;
    });

    const scaledThreshold = Math.round(options.removeShortNotesThreshold * ppqRatio);
    if (scaledThreshold > 0) {
        transformedNotes = transformedNotes.filter(n => n.durationTicks >= scaledThreshold);
    }

    transformedNotes = quantizeNotes(transformedNotes, options, destPPQ);

    if (tickScale !== 1) {
        transformedNotes = transformedNotes.map(n => ({
            ...n,
            ticks: Math.round(n.ticks * tickScale),
            durationTicks: Math.round(n.durationTicks * tickScale)
        }));
    }

    const maxTick = transformedNotes.length > 0 ? Math.max(...transformedNotes.map(n => n.ticks + n.durationTicks)) : 0;
    
    transformedNotes = performInversion(transformedNotes, options.inversionMode, destPPQ, options.timeSignature, maxTick);
    transformedNotes = performMelodicInversion(transformedNotes, options.melodicInversion, destPPQ, options.timeSignature);
    transformedNotes = performModalConversion(transformedNotes, options);

    const cropEnabled = options.exportRange.enabled;
    let cropStartTick = 0;
    let cropEndTick = Infinity;
    
    if (cropEnabled) {
        const ticksPerMeasure = destPPQ * 4 * (options.timeSignature.numerator / options.timeSignature.denominator);
        cropStartTick = (options.exportRange.startMeasure - 1) * ticksPerMeasure;
        cropEndTick = options.exportRange.endMeasure * ticksPerMeasure;
        
        transformedNotes = cropToRange(transformedNotes, options, destPPQ);
    }

    const tempoAtZero = destinationHeader.tempos[0]?.bpm || options.tempo;
    const secondsPerTick = (60 / tempoAtZero) / destPPQ;
    transformedNotes = transformedNotes.map(n => ({ ...n, time: n.ticks * secondsPerTick, duration: n.durationTicks * secondsPerTick }));
    transformedNotes.forEach(note => destinationTrack.addNote(note));
    
    const isGlobalInversion = options.inversionMode === 'global';
    
    const transformEvent = (e: any) => {
        const transformedTicks = transformEventTicks(e.ticks, {
            ppqRatio,
            tickScale,
            tempoScale,
            isGlobalInversion,
            maxTick,
            cropEnabled,
            cropStartTick,
            cropEndTick
        });

        if (transformedTicks === null) return null;
        return { ...e, ticks: transformedTicks, time: transformedTicks * secondsPerTick };
    };

    if (!eventsToDelete.has('controlChange')) {
        Object.values(sourceTrack.controlChanges).flat().forEach((cc: any) => { 
            const t = transformEvent(cc); 
            if (t) destinationTrack.addCC(t); 
        });
    }
    if (!eventsToDelete.has('pitchBend')) {
        (sourceTrack.pitchBends || []).forEach((pb: any) => { 
            const t = transformEvent(pb);
            if (t) destinationTrack.addPitchBend(t); 
        });
    }
    if (!eventsToDelete.has('programChange')) {
        ((sourceTrack as any).programChanges || []).forEach((pc: any) => { 
            const t = transformEvent(pc); 
            if (t) (destinationTrack as any).addProgramChange(pc.number, t.time); 
        });
    }
}

export function createPreviewMidi(originalMidi: Midi, trackId: number, eventsToDelete: Set<MidiEventType>, options: ConversionOptions): Midi {
    if (trackId < 0 || trackId >= originalMidi.tracks.length) throw new Error(`Track ${trackId} not found.`);
    
    const newMidi = new Midi();
    if (originalMidi.header.name) newMidi.header.name = originalMidi.header.name;

    const tempoContext: TempoTransformContext = {
        ppqRatio: 1,
        tickScale: options.tempoChangeMode === 'time' ? options.noteTimeScale * getTempoScale(options) : options.noteTimeScale,
        tempoScale: getTempoScale(options),
        isGlobalInversion: false,
        maxTick: 0,
        cropEnabled: false,
        cropStartTick: 0,
        cropEndTick: Infinity
    };
    applyTempoEvents(newMidi.header, buildTransformedTempoEvents(originalMidi, newMidi.header, tempoContext));
    newMidi.header.timeSignatures = [{ ticks: 0, timeSignature: [options.timeSignature.numerator, options.timeSignature.denominator] }];

    const originalTrack = originalMidi.tracks[trackId];
    const newTrack = newMidi.addTrack();
    newTrack.name = originalTrack.name;
    newTrack.instrument.number = originalTrack.instrument.number;
    newTrack.instrument.name = originalTrack.instrument.name;
    
    copyAndTransformTrackEvents(originalTrack, newTrack, options, eventsToDelete, newMidi.header, originalMidi.header.ppq);
    return newMidi;
}

export function getTransformedTrackDataForPianoRoll(originalMidi: Midi, trackId: number, options: ConversionOptions): PianoRollTrackData {
    const newMidi = new Midi();
    applyTempoEvents(newMidi.header, buildTransformedTempoEvents(originalMidi, newMidi.header, {
        ppqRatio: 1,
        tickScale: options.tempoChangeMode === 'time' ? options.noteTimeScale * getTempoScale(options) : options.noteTimeScale,
        tempoScale: getTempoScale(options),
        isGlobalInversion: false,
        maxTick: 0,
        cropEnabled: false,
        cropStartTick: 0,
        cropEndTick: Infinity
    }));
    newMidi.header.timeSignatures = [{ ticks: 0, timeSignature: [options.timeSignature.numerator, options.timeSignature.denominator] }];

    const originalTrack = originalMidi.tracks[trackId];
    const newTrack = newMidi.addTrack();
    newTrack.name = originalTrack.name;
    
    copyAndTransformTrackEvents(originalTrack, newTrack, options, new Set(), newMidi.header, originalMidi.header.ppq);
    
    const voices = distributeToVoices(newTrack.notes, options) as any[][];
    const noteVoiceMap = new Map<any, number>();
    voices.forEach((voiceNotes, voiceIdx) => { voiceNotes.forEach(n => noteVoiceMap.set(n, voiceIdx)); });
    
    return {
        notes: newTrack.notes.map(n => ({ midi: n.midi, ticks: n.ticks, durationTicks: n.durationTicks, velocity: n.velocity, name: n.name, voiceIndex: noteVoiceMap.get(n), isOrnament: (n as any).isOrnament })),
        name: newTrack.name,
        ppq: newMidi.header.ppq,
        timeSignature: options.timeSignature
    };
}

export async function combineAndDownload(originalMidi: Midi, trackIds: number[], newFileName: string, eventsToDelete: Set<MidiEventType>, options: ConversionOptions): Promise<void> {
    if (trackIds.length < 1) throw new Error("At least one track must be selected.");
    
    const newMidi = new Midi();
    if (originalMidi.header.name) newMidi.header.name = originalMidi.header.name;

    const baseTickScale = options.tempoChangeMode === 'time' ? options.noteTimeScale * getTempoScale(options) : options.noteTimeScale;
    const tempoEvents = buildTransformedTempoEvents(originalMidi, newMidi.header, {
        ppqRatio: newMidi.header.ppq / originalMidi.header.ppq,
        tickScale: baseTickScale,
        tempoScale: getTempoScale(options),
        isGlobalInversion: false,
        maxTick: 0,
        cropEnabled: options.exportRange.enabled,
        cropStartTick: options.exportRange.enabled ? (options.exportRange.startMeasure - 1) * (newMidi.header.ppq * 4 * (options.timeSignature.numerator / options.timeSignature.denominator)) : 0,
        cropEndTick: options.exportRange.enabled ? options.exportRange.endMeasure * (newMidi.header.ppq * 4 * (options.timeSignature.numerator / options.timeSignature.denominator)) : Infinity
    });
    applyTempoEvents(newMidi.header, tempoEvents);
    newMidi.header.timeSignatures = [{ ticks: 0, timeSignature: [options.timeSignature.numerator, options.timeSignature.denominator] }];

    const selectedTrackIds = new Set(trackIds);

    if (options.outputStrategy === 'separate_tracks') {
        originalMidi.tracks.forEach((track, index) => {
            if (selectedTrackIds.has(index)) {
                const newTrack = newMidi.addTrack();
                newTrack.name = track.name;
                newTrack.instrument.number = track.instrument.number;
                newTrack.instrument.name = track.instrument.name;
                copyAndTransformTrackEvents(track, newTrack, options, eventsToDelete, newMidi.header, originalMidi.header.ppq);
                
                if (options.pruneOverlaps) {
                    const multipliers: number[] = [0, 0.03125, 0.0416, 0.0625, 0.0833, 0.125, 0.1666, 0.25, 0.3333, 0.5, 1.0];
                    const pruneThresholdTicks = Math.round(newMidi.header.ppq * multipliers[options.pruneThresholdIndex]);
                    newTrack.notes = pruneOverlaps(newTrack.notes, pruneThresholdTicks);
                }
            }
        });
    } 
    else {
        const combinedTrack = newMidi.addTrack();
        const first = originalMidi.tracks.find((_, index) => selectedTrackIds.has(index));
        if (first) { 
            combinedTrack.instrument.number = first.instrument.number; 
            combinedTrack.instrument.name = first.instrument.name; 
            combinedTrack.name = trackIds.length === 1 ? first.name : "Ensemble";
        }

        originalMidi.tracks.forEach((track, index) => {
            if (selectedTrackIds.has(index)) {
                copyAndTransformTrackEvents(track, combinedTrack, options, eventsToDelete, newMidi.header, originalMidi.header.ppq);
            }
        });

        if (options.pruneOverlaps) {
            const multipliers: number[] = [0, 0.03125, 0.0416, 0.0625, 0.0833, 0.125, 0.1666, 0.25, 0.3333, 0.5, 1.0];
            const pruneThresholdTicks = Math.round(newMidi.header.ppq * multipliers[options.pruneThresholdIndex]);
            combinedTrack.notes = pruneOverlaps(combinedTrack.notes, pruneThresholdTicks);
        }

        if (options.outputStrategy === 'separate_voices') {
            const voices = distributeToVoices(combinedTrack.notes, options) as any[][];
            newMidi.tracks.pop();
            voices.forEach((vNotes, idx) => {
                const voiceTrack = newMidi.addTrack();
                voiceTrack.name = `${combinedTrack.name} - Voice ${idx + 1}`;
                voiceTrack.instrument = combinedTrack.instrument;
                vNotes.forEach(n => voiceTrack.addNote(n));
            });
        }
    }

    const midiBytes = newMidi.toArray();
    const blob = new Blob([midiBytes], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = newFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
