import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home.tsx';
import { Studio } from './pages/Studio.tsx';
import { QuizEditor } from './pages/QuizEditor.tsx';
import { HostArena } from './pages/HostArena.tsx';
import { PlayerArena } from './pages/PlayerArena.tsx';
import { SelfPaced } from './pages/SelfPaced.tsx';
import { Reports } from './pages/Reports.tsx';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/studio/:quizId" element={<QuizEditor />} />
        <Route path="/host/:quizId" element={<HostArena />} />
        <Route path="/play" element={<PlayerArena />} />
        <Route path="/self-paced/:quizId" element={<SelfPaced />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </BrowserRouter>
  );
};
