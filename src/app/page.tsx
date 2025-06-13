'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function GreetingPage() {
  const [name, setName] = useState('');
  const [roomToJoin, setRoomToJoin] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  // A helper function to validate the name and store it.
  // This avoids repeating code.
  const validateAndStoreName = (): boolean => {
    if (!name.trim()) {
      setError('Please enter your name first.');
      return false;
    }
    sessionStorage.setItem('userName', name);
    return true;
  };
  
  // Handler for the "Create" button.
  const handleCreate = () => {
    if (validateAndStoreName()) {
      router.push('/create');
    }
  };

  // Handler for the "Join" form submission.
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault(); // Prevent the form from causing a page reload
    if (!validateAndStoreName()) {
      return; // Stop if the name is invalid
    }
    if (!roomToJoin.trim()) {
      setError('Please enter a room code to join.');
      return;
    }
    router.push(`/watch/${roomToJoin}`);
  };

  return (
    <main style={{ fontFamily: 'sans-serif', textAlign: 'center', margin: '5rem auto', maxWidth: '500px' }}>
      <h1>Welcome to WatchParty!</h1>
      <p>Choose your name to get started.</p>
      
      {/* Common input for the user's name */}
      <div style={{ marginBottom: '2rem' }}>
        <label htmlFor="name-input" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Your Name</label>
        <input
          id="name-input"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(''); // Clear error when user starts typing
          }}
          placeholder="Enter your name"
          style={{ padding: '0.8rem', width: '100%', boxSizing: 'border-box' }}
        />
      </div>
      
      {/* Section for Creating a Room */}
      <div style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
        <h2>Stream & Create a Room</h2>
        <p>You will get a code to share with friends.</p>
        <button onClick={handleCreate} style={{ padding: '0.8rem 1.5rem', width: '100%', cursor: 'pointer' }}>
          Create a New Room
        </button>
      </div>

      {/* Section for Joining a Room (as a proper form) */}
      <form onSubmit={handleJoin} style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px' }}>
        <h2>Join a Room</h2>
        <label htmlFor="room-code-input" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Room Code</label>
        <input
          id="room-code-input"
          type="text"
          value={roomToJoin}
          onChange={(e) => {
            setRoomToJoin(e.target.value);
            if (error) setError(''); // Clear error when user starts typing
          }}
          placeholder="Enter room code"
          style={{ padding: '0.8rem', width: '100%', boxSizing: 'border-box', marginBottom: '1rem' }}
        />
        <button type="submit" style={{ padding: '0.8rem 1.5rem', width: '100%', cursor: 'pointer' }}>
          Join Room
        </button>
      </form>

      {/* Display error messages at the bottom */}
      {error && <p style={{ color: 'red', marginTop: '1rem', fontWeight: 'bold' }}>{error}</p>}
    </main>
  );
}