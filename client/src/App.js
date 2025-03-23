import React, { useState } from 'react';
import { extractAudio } from './services/api';
import ConverterForm from './components/ConverterForm';
import ProgressBar from './components/ProgressBar';
import DownloadButton from './components/DownloadButton';
import ErrorMessage from './components/ErrorMessage';
import './App.css';

function App() {
  const [videoUrl, setVideoUrl] = useState('');
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [error, setError] = useState('');
  const [videoTitle, setVideoTitle] = useState('');

  const handleConvert = async (e) => {
    e.preventDefault();
    setError('');
    setConverting(true);
    setProgress(0);
    setDownloadUrl('');
    
    try {
      const result = await extractAudio(videoUrl, (progressEvent) => {
        setProgress(progressEvent.progress);
      });
      
      setDownloadUrl(result.downloadUrl);
      setVideoTitle(result.title);
      setConverting(false);
    } catch (err) {
      setError(err.response?.data?.message || '转换失败，请重试');
      setConverting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-center mb-8">YouTube 转 MP3</h1>
      
      <ConverterForm 
        videoUrl={videoUrl}
        setVideoUrl={setVideoUrl}
        handleConvert={handleConvert}
        converting={converting}
      />
      
      {converting && <ProgressBar progress={progress} />}
      
      {error && <ErrorMessage message={error} />}
      
      {downloadUrl && (
        <DownloadButton 
          downloadUrl={downloadUrl} 
          fileName={`${videoTitle || 'youtube-audio'}.mp3`} 
        />
      )}
    </div>
  );
}

export default App; 