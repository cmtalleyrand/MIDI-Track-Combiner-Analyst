
import React from 'react';
import { MidiEventCounts, MidiEventType, TempoChangeMode, InversionMode, OutputStrategy, RhythmRule, MelodicInversionOptions, ExportRangeOptions, InversionStats } from '../types';
import TempoTimeSettings from './settings/TempoTimeSettings';
import TransformSettings from './settings/TransformSettings';
import VoiceSettings from './settings/VoiceSettings';
import KeyModeSettings from './settings/KeyModeSettings';
import QuantizationSettings from './settings/QuantizationSettings';
import FilterSettings from './settings/FilterSettings';

interface ConversionSettingsProps {
    settings: {
        originalTempo: number | null;
        newTempo: string;
        originalTimeSignature: { numerator: number, denominator: number } | null;
        newTimeSignature: { numerator: string, denominator: string };
        tempoChangeMode: TempoChangeMode;
        originalDuration: number | null;
        newDuration: number | null;
        transpositionSemitones: string;
        transpositionOctaves: string;
        noteTimeScale: string;
        
        inversionMode: InversionMode;
        melodicInversion: MelodicInversionOptions;
        exportRange: ExportRangeOptions;
        
        primaryRhythm: RhythmRule;
        secondaryRhythm: RhythmRule;
        quantizationValue: string; // legacy

        quantizeDurationMin: string;
        shiftToMeasure: boolean;
        detectOrnaments: boolean;
        removeShortNotesThresholdIndex: number;
        pruneOverlaps: boolean;
        pruneThresholdIndex: number;
        softOverlapToleranceIndex: number;
        pitchBias: number;
        maxVoices: number;
        disableChords: boolean;
        outputStrategy: OutputStrategy;
        isModalConversionEnabled: boolean;
        modalRoot: number;
        modalModeName: string;
        modalMappings: Record<number, number>;
        keySignatureSpelling: 'auto' | 'sharp' | 'flat';
        eventsToDelete: Set<MidiEventType>;
    };
    setters: {
        setNewTempo: (val: string) => void;
        setNewTimeSignature: (val: { numerator: string, denominator: string }) => void;
        setTempoChangeMode: (val: TempoChangeMode) => void;
        setTranspositionSemitones: (val: string) => void;
        setTranspositionOctaves: (val: string) => void;
        setNoteTimeScale: (val: string) => void;
        
        setInversionMode: (val: InversionMode) => void;
        setMelodicInversion: (val: MelodicInversionOptions) => void;
        setExportRange: (val: ExportRangeOptions) => void;
        
        setPrimaryRhythm: (val: RhythmRule) => void;
        setSecondaryRhythm: (val: RhythmRule) => void;
        setQuantizationValue: (val: string) => void; // legacy
        
        setQuantizeDurationMin: (val: string) => void;
        setShiftToMeasure: (val: boolean) => void;
        setDetectOrnaments: (val: boolean) => void;
        setRemoveShortNotesThresholdIndex: (val: number) => void;
        setPruneOverlaps: (val: boolean) => void;
        setPruneThresholdIndex: (val: number) => void;
        setSoftOverlapToleranceIndex: (val: number) => void;
        setPitchBias: (val: number) => void;
        setMaxVoices: (val: number) => void;
        setDisableChords: (val: boolean) => void;
        setOutputStrategy: (val: OutputStrategy) => void;
        setIsModalConversionEnabled: (val: boolean) => void;
        setModalRoot: (val: number) => void;
        setModalModeName: (val: string) => void;
        setModalMappings: (val: Record<number, number>) => void;
        setKeySignatureSpelling: (val: 'auto' | 'sharp' | 'flat') => void;
    };
    eventCounts: MidiEventCounts | null;
    onEventFilterToggle: (eventType: MidiEventType) => void;
    quantizationWarning?: { message: string, details: string[] } | null;
    inversionStats?: InversionStats | null;
}

export default function ConversionSettings({ settings, setters, eventCounts, onEventFilterToggle, quantizationWarning, inversionStats }: ConversionSettingsProps) {
  return (
    <div className="w-full bg-gray-dark p-6 rounded-2xl shadow-2xl border border-gray-medium mt-6 animate-slide-up">
        <div className="border-b border-gray-medium pb-4 mb-4">
            <h2 className="text-xl font-bold text-gray-light">Configuration</h2>
        </div>

        <div className="space-y-6">
            <TempoTimeSettings 
                originalTempo={settings.originalTempo}
                newTempo={settings.newTempo}
                setNewTempo={setters.setNewTempo}
                originalTimeSignature={settings.originalTimeSignature}
                newTimeSignature={settings.newTimeSignature}
                setNewTimeSignature={setters.setNewTimeSignature}
                tempoChangeMode={settings.tempoChangeMode}
                setTempoChangeMode={setters.setTempoChangeMode}
                originalDuration={settings.originalDuration}
                newDuration={settings.newDuration}
                exportRange={settings.exportRange}
                setExportRange={setters.setExportRange}
            />

            <TransformSettings 
                transpositionSemitones={settings.transpositionSemitones}
                setTranspositionSemitones={setters.setTranspositionSemitones}
                transpositionOctaves={settings.transpositionOctaves}
                setTranspositionOctaves={setters.setTranspositionOctaves}
                noteTimeScale={settings.noteTimeScale}
                setNoteTimeScale={setters.setNoteTimeScale}
                inversionMode={settings.inversionMode}
                setInversionMode={setters.setInversionMode}
                melodicInversion={settings.melodicInversion}
                setMelodicInversion={setters.setMelodicInversion}
                inversionStats={inversionStats}
                detectOrnaments={settings.detectOrnaments}
                setDetectOrnaments={setters.setDetectOrnaments}
                removeShortNotesThresholdIndex={settings.removeShortNotesThresholdIndex}
                setRemoveShortNotesThresholdIndex={setters.setRemoveShortNotesThresholdIndex}
            />

            <VoiceSettings 
                softOverlapToleranceIndex={settings.softOverlapToleranceIndex}
                setSoftOverlapToleranceIndex={setters.setSoftOverlapToleranceIndex}
                pitchBias={settings.pitchBias}
                setPitchBias={setters.setPitchBias}
                maxVoices={settings.maxVoices}
                setMaxVoices={setters.setMaxVoices}
                disableChords={settings.disableChords}
                setDisableChords={setters.setDisableChords}
                outputStrategy={settings.outputStrategy}
                setOutputStrategy={setters.setOutputStrategy}
            />

            <KeyModeSettings 
                modalRoot={settings.modalRoot}
                setModalRoot={setters.setModalRoot}
                modalModeName={settings.modalModeName}
                setModalModeName={setters.setModalModeName}
                isModalConversionEnabled={settings.isModalConversionEnabled}
                setIsModalConversionEnabled={setters.setIsModalConversionEnabled}
                modalMappings={settings.modalMappings}
                setModalMappings={setters.setModalMappings}
                keySignatureSpelling={settings.keySignatureSpelling}
                setKeySignatureSpelling={setters.setKeySignatureSpelling}
            />

            <QuantizationSettings 
                primaryRhythm={settings.primaryRhythm}
                setPrimaryRhythm={setters.setPrimaryRhythm}
                secondaryRhythm={settings.secondaryRhythm}
                setSecondaryRhythm={setters.setSecondaryRhythm}
                
                quantizeDurationMin={settings.quantizeDurationMin}
                setQuantizeDurationMin={setters.setQuantizeDurationMin}
                shiftToMeasure={settings.shiftToMeasure}
                setShiftToMeasure={setters.setShiftToMeasure}
                pruneOverlaps={settings.pruneOverlaps}
                setPruneOverlaps={setters.setPruneOverlaps}
                pruneThresholdIndex={settings.pruneThresholdIndex}
                setPruneThresholdIndex={setters.setPruneThresholdIndex}
                quantizationWarning={quantizationWarning}
            />

            <FilterSettings 
                eventCounts={eventCounts}
                eventsToDelete={settings.eventsToDelete}
                onEventFilterToggle={onEventFilterToggle}
            />
        </div>
    </div>
  );
}
