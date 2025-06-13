'use client';
import { useState } from 'react';
import { Socket } from 'socket.io-client';

interface PollOption { text: string; votes: number; }
interface Poll { question: string; options: PollOption[]; }

interface PollProps {
  socket: Socket | null;
  roomId: string;
  activePoll: Poll | null;
}

export default function Poll({ socket, roomId, activePoll }: PollProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']); // Start with two empty options

  const handleAddOption = () => {
    setOptions([...options, '']);
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleCreatePoll = (e: React.FormEvent) => {
    e.preventDefault();
    const filteredOptions = options.filter(opt => opt.trim() !== '');
    if (question.trim() && filteredOptions.length >= 2 && socket) {
      socket.emit('createPoll', { roomId, poll: { question, options: filteredOptions } });
      setShowCreateForm(false);
      setQuestion('');
      setOptions(['', '']);
    }
  };

  const handleVote = (optionIndex: number) => {
    if (socket) {
      socket.emit('vote', { roomId, optionIndex });
    }
  };

  const renderCreateForm = () => (
    <form onSubmit={handleCreatePoll}>
      <h4>Create a New Poll</h4>
      <input
        type="text"
        placeholder="Poll Question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', boxSizing: 'border-box' }}
        required
      />
      {options.map((opt, index) => (
        <input
          key={index}
          type="text"
          placeholder={`Option ${index + 1}`}
          value={opt}
          onChange={(e) => handleOptionChange(index, e.target.value)}
          style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', boxSizing: 'border-box' }}
        />
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" onClick={handleAddOption}>Add Option</button>
        <button type="submit">Start Poll</button>
      </div>
      <button type="button" onClick={() => setShowCreateForm(false)} style={{ marginTop: '0.5rem', width: '100%' }}>Cancel</button>
    </form>
  );

  const renderActivePoll = () => {
    const totalVotes = activePoll!.options.reduce((sum, opt) => sum + opt.votes, 0) || 1;
    return (
      <div>
        <h4>{activePoll!.question}</h4>
        {activePoll!.options.map((option, index) => (
          <div key={index} style={{ marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{option.text}</span>
              <button onClick={() => handleVote(index)} style={{ fontSize: '0.8rem' }}>Vote ({option.votes})</button>
            </div>
            <div style={{ background: '#e9ecef', borderRadius: '4px', height: '20px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(option.votes / totalVotes) * 100}%`,
                  background: '#007bff',
                  height: '100%',
                  transition: 'width 0.3s ease-in-out'
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '0.8rem' }}>
      <h3 style={{ textAlign: 'center', margin: '0 0 1rem 0' }}>Polls</h3>
      {activePoll ? renderActivePoll() :
        showCreateForm ? renderCreateForm() :
          <button onClick={() => setShowCreateForm(true)} style={{ width: '100%' }}>Create New Poll</button>
      }
    </div>
  );
}