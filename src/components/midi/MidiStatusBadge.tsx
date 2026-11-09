import { CircleDashed } from '@/components/app-icons';
import { Badge } from '@/components/ui/badge';
import { CircleAlert, CircleCheck, LoaderCircle } from '@/components/ui/icons';
import { useMidi } from '@/lib/midi/MidiProvider';

export function MidiStatusBadge() {
  const { status, inputs } = useMidi();

  switch (status) {
    case 'pending':
      return (
        <Badge variant="secondary">
          <LoaderCircle className="animate-spin" />
          Requesting MIDI…
        </Badge>
      );
    case 'enabled':
      return (
        <Badge variant={inputs.length > 0 ? 'default' : 'secondary'}>
          <CircleCheck />
          MIDI · {inputs.length} input{inputs.length === 1 ? '' : 's'}
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="destructive">
          <CircleAlert />
          MIDI error
        </Badge>
      );
    case 'unsupported':
      return (
        <Badge variant="destructive">
          <CircleDashed />
          MIDI unsupported
        </Badge>
      );
  }
}
