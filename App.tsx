
import React from 'react';
import { AppState } from './types';
import { useMidiController } from './hooks/useMidiController';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import TrackList from './components/TrackList';
import Modal from './components/Modal';
import PianoRoll from './components/PianoRoll';
import TrackAnalysis from './components/TrackAnalysis';
import Notification from './components/Notification';
import ConversionSettings from './components/ConversionSettings';
import ActionPanel from './components/ActionPanel';

export default function App() {
  const { state, settings, setters, actions } = useMidiController();
  const { 
    appState, errorMessage, successMessage, fileName, trackInfo, selectedTracks, 
    playingTrackId, isExportingAbc, eventCounts, quantizationWarning,
    isPianoRollVisible, pianoRollTrackData, isAnalysisVisible, analysisData, isLoadedState
  } = state;

  return (
    <>
      <div className="min-h-screen bg-gray-darker flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans">
        <Header />
        <main className="w-full max-w-4xl mx-auto flex-grow flex flex-col items-center justify-center">
          {!isLoadedState ? (
              <div className="w-full max-w-lg text-center">
                  <FileUpload onFileUpload={actions.handleFileUpload} isLoading={appState === AppState.LOADING} />
                  {appState === AppState.ERROR && (
                      <div className="mt-4 p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-lg animate-fade-in">
                      <p className="font-bold">An Error Occurred</p>
                      <p>{errorMessage}</p>
                      </div>
                  )}
              </div>
          ) : (
            <div className="w-full animate-fade-in pb-12">
              <TrackList
                tracks={trackInfo}
                selectedTracks={selectedTracks}
                onTrackSelect={actions.handleTrackSelect}
                onSelectAll={actions.handleSelectAllTracks}
                onReset={() => actions.handleReset(true)}
                fileName={fileName}
                playingTrackId={playingTrackId}
                onPreviewTrack={actions.handlePreviewTrack}
                onShowPianoRoll={actions.handleShowPianoRoll}
                onAnalyzeTrack={actions.handleAnalyzeTrack}
              />
              
              <ConversionSettings 
                settings={settings}
                setters={setters}
                eventCounts={eventCounts}
                onEventFilterToggle={actions.handleEventFilterToggle}
                quantizationWarning={quantizationWarning}
              />

              {(successMessage || errorMessage) && (
                  <div className="my-4">
                    <Notification 
                        message={successMessage || errorMessage || ''} 
                        type={successMessage ? 'success' : 'error'} 
                        onDismiss={actions.clearMessages} 
                    />
                  </div>
              )}

              <ActionPanel 
                 onCombine={actions.handleCombine}
                 onExportAbc={actions.handleExportAbc}
                 onAnalyzeSelection={actions.handleAnalyzeSelection}
                 isCombining={appState === AppState.COMBINING}
                 isExportingAbc={isExportingAbc}
                 canProcess={selectedTracks.size >= 1}
                 selectedCount={selectedTracks.size}
              />
            </div>
          )}
        </main>
        <footer className="w-full max-w-4xl mx-auto text-center py-4 mt-8 border-t border-gray-medium text-gray-medium">
          <p>Built with React, Tailwind CSS, and @tonejs/midi</p>
        </footer>
      </div>

      {/* Modals */}
      {isPianoRollVisible && pianoRollTrackData && (
        <Modal
          isOpen={isPianoRollVisible}
          onClose={() => setters.setIsPianoRollVisible(false)}
          title={`Piano Roll: ${pianoRollTrackData.name}`}
        >
          <PianoRoll trackData={pianoRollTrackData} />
        </Modal>
      )}
      {isAnalysisVisible && analysisData && (
        <Modal
          isOpen={isAnalysisVisible}
          onClose={() => setters.setIsAnalysisVisible(false)}
          title={`Analysis: ${analysisData.trackName}`}
        >
           <TrackAnalysis data={analysisData} />
        </Modal>
      )}
    </>
  );
}
