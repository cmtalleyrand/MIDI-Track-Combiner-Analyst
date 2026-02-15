import React from 'react';
import { MusicNoteIcon } from './Icons';

export default function Header() {
  return (
    <header className="w-full max-w-4xl mx-auto text-center mb-8">
      <div className="flex items-center justify-center gap-4">
        <div className="bg-brand-primary p-3 rounded-full shadow-lg">
           <MusicNoteIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-light to-brand-primary">
          MIDI Track Combiner
        </h1>
      </div>
      <p className="mt-4 text-lg text-gray-400">
        Upload a MIDI file, select the tracks you want, and combine them into one.
      </p>
    </header>
  );
}
