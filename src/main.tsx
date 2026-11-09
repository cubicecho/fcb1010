import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfirmProvider } from '@/components/ui/confirm';
import { DumpProvider } from '@/lib/fcb/DumpProvider';
import { FirmwareProvider } from '@/lib/fcb/FirmwareProvider';
import { MidiProvider } from '@/lib/midi/MidiProvider';
import { routeTree } from './routeTree.gen';
import './index.css';

const router = createRouter({ routeTree, basepath: import.meta.env.BASE_URL });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MidiProvider>
      <FirmwareProvider>
        <DumpProvider>
          <ConfirmProvider>
            <RouterProvider router={router} />
          </ConfirmProvider>
        </DumpProvider>
      </FirmwareProvider>
    </MidiProvider>
  </StrictMode>,
);
