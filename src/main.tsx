import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DumpProvider } from '@/lib/fcb/DumpProvider';
import { MidiProvider } from '@/lib/midi/MidiProvider';
import { routeTree } from './routeTree.gen';
import './index.css';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MidiProvider>
      <DumpProvider>
        <RouterProvider router={router} />
      </DumpProvider>
    </MidiProvider>
  </StrictMode>,
);
