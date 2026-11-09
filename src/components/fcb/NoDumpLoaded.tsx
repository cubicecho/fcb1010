import { HardDriveDownload } from '@/components/app-icons';
import { EmptyState } from '@/components/empty-state';

/** What the Presets and Setup pages say before there is a patchdump to edit. */
export function NoDumpLoaded() {
  return (
    <EmptyState
      iconSlot={<HardDriveDownload />}
      title="No dump loaded"
      description={
        <>
          Presets and global settings are both part of the patchdump. Start a new setup (
          <span className="font-medium">New</span>), open a saved <span className="font-medium">.syx</span> file, or
          pull the current setup from the board: connect the FCB1010 over MIDI, pick its input and output on the Monitor
          page, then press <span className="font-medium">Receive from pedal</span>. Both UnO and stock firmware answer
          the request.
        </>
      }
    />
  );
}
