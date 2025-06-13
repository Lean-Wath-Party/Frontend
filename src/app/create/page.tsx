'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function CreatePage() {
  const [sourceType, setSourceType] = useState('youtube');
  const [inputValue, setInputValue] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // FormData is required for sending files (multipart/form-data)
      const formData = new FormData();
      formData.append('sourceType', sourceType);

      if (sourceType === 'local') {
        if (!selectedFile) throw new Error('Please select a video file to upload.');
        formData.append('videoFile', selectedFile);
      } else {
        if (!inputValue.trim()) throw new Error('Please enter a YouTube URL.');
        formData.append('urlOrFileName', inputValue);
      }

      // We do NOT set the 'Content-Type' header when using FormData.
      // The browser sets it automatically with the correct multipart boundary.
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/rooms`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to create room.');
      }

      const room = await response.json();
      router.push(`/watch/${room.id}`);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderInput = () => {
    if (sourceType === 'youtube') {
      return (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Paste a YouTube URL"
          style={{ padding: '0.8rem', width: '100%', boxSizing: 'border-box' }}
          required
        />
      );
    } else {
      return (
        <input
          type="file"
          onChange={handleFileChange}
          accept="video/mp4"
          style={{ padding: '0.8rem', width: '100%', boxSizing: 'border-box' }}
          required
        />
      );
    }
  };

  return (
    <main style={{ fontFamily: 'sans-serif', textAlign: 'center', margin: '5rem auto', maxWidth: '500px' }}>
      <h1>Create a New Watch Room</h1>
      <p>Choose your video source and let's get started.</p>

      <div style={{ margin: '2rem 0' }}>
        <label>
          <input type="radio" value="youtube" checked={sourceType === 'youtube'} onChange={() => setSourceType('youtube')} />
          YouTube URL
        </label>
        <label style={{ marginLeft: '1rem' }}>
          <input type="radio" value="local" checked={sourceType === 'local'} onChange={() => setSourceType('local')} />
          Upload Local File
        </label>
      </div>

      <form onSubmit={handleCreateRoom}>
        <div style={{ marginBottom: '1rem' }}>
          {renderInput()}
        </div>
        <button type="submit" disabled={isLoading} style={{ padding: '0.8rem 1.5rem', width: '100%', cursor: 'pointer' }}>
          {isLoading ? 'Creating...' : 'Create Room & Start Streaming'}
        </button>
      </form>
      {error && <p style={{ color: 'red', marginTop: '1rem', fontWeight: 'bold' }}>{error}</p>}
    </main>
  );
}