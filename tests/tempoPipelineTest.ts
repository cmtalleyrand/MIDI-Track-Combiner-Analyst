import { strict as assert } from 'node:assert';
import { Midi } from '@tonejs/midi';
import { createPreviewMidi } from '../components/services/midiPipeline';
import { ConversionOptions } from '../types';

function createBaseOptions(): ConversionOptions {
  const mappings: Record<number, number> = {};
  for (let i = 0; i < 12; i += 1) mappings[i] = i;

  return {
    tempo: 200,
    timeSignature: { numerator: 4, denominator: 4 },
    tempoChangeMode: 'speed',
    originalTempo: 100,
    transposition: 0,
    noteTimeScale: 1,
    inversionMode: 'off',
    melodicInversion: { enabled: false, startMeasure: 1, endMeasure: 1 },
    exportRange: { enabled: false, startMeasure: 1, endMeasure: 2 },
    primaryRhythm: { enabled: false, family: 'Simple', minNoteValue: '1/16' },
    secondaryRhythm: { enabled: false, family: 'Triple', minNoteValue: '1/8t' },
    quantizationValue: 'off',
    quantizeDurationMin: 'off',
    shiftToMeasure: false,
    detectOrnaments: false,
    modalConversion: { enabled: false, root: 0, modeName: 'Major', mappings },
    removeShortNotesThreshold: 0,
    pruneOverlaps: false,
    pruneThresholdIndex: 0,
    voiceSeparationOverlapTolerance: 0.25,
    voiceSeparationPitchBias: 50,
    voiceSeparationMaxVoices: 0,
    voiceSeparationDisableChords: false,
    outputStrategy: 'combine',
    keySignatureSpelling: 'auto'
  };
}

const midi = new Midi();
midi.header.setTempo(100);
midi.header.tempos.push({ ticks: 480, bpm: 150, time: 0 });
midi.header.update();

const track = midi.addTrack();
track.addNote({ midi: 60, ticks: 0, durationTicks: 480, velocity: 0.8, time: 0, duration: 0.5 });

const speedPreview = createPreviewMidi(midi, 0, new Set(), createBaseOptions());
assert.equal(speedPreview.header.tempos.length, 2, 'tempo changes should be preserved');
assert.equal(Math.round(speedPreview.header.tempos[0].bpm), 200, 'base tempo should be scaled to user-selected tempo');
assert.equal(Math.round(speedPreview.header.tempos[1].bpm), 300, 'relative tempo differences should be preserved');

const timeOptions = createBaseOptions();
timeOptions.tempoChangeMode = 'time';
const timePreview = createPreviewMidi(midi, 0, new Set(), timeOptions);
assert.equal(timePreview.tracks[0].notes[0].durationTicks, 800, 'time-preserving mode should rescale note durations by tempo factor');

console.log('tempoPipelineTest passed');
