import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ALL_INPUTS, NO_OUTPUT, useMidi } from '@/lib/midi/MidiProvider';

export function PortSelectors() {
  const { inputs, outputs, selectedInputId, selectedOutputId, setSelectedInputId, setSelectedOutputId } = useMidi();

  const inputValue =
    selectedInputId === ALL_INPUTS || inputs.some((port) => port.id === selectedInputId) ? selectedInputId : ALL_INPUTS;
  const outputValue =
    selectedOutputId === NO_OUTPUT || outputs.some((port) => port.id === selectedOutputId)
      ? selectedOutputId
      : NO_OUTPUT;

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">MIDI Input</span>
        <Select value={inputValue} onValueChange={setSelectedInputId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select input" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_INPUTS}>All inputs</SelectItem>
            {inputs.map((port) => (
              <SelectItem key={port.id} value={port.id}>
                {port.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">MIDI Output</span>
        <Select value={outputValue} onValueChange={setSelectedOutputId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select output" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_OUTPUT}>No output</SelectItem>
            {outputs.map((port) => (
              <SelectItem key={port.id} value={port.id}>
                {port.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
