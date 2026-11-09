import { Combobox } from '@/components/combobox';
import { FormField } from '@/components/form-field';
import { ALL_INPUTS, NO_OUTPUT, useMidi } from '@/lib/midi/MidiProvider';

export function PortSelectors() {
  const { inputs, outputs, selectedInputId, selectedOutputId, setSelectedInputId, setSelectedOutputId } = useMidi();

  const inputValue =
    selectedInputId === ALL_INPUTS || inputs.some((port) => port.id === selectedInputId) ? selectedInputId : ALL_INPUTS;
  const outputValue =
    selectedOutputId === NO_OUTPUT || outputs.some((port) => port.id === selectedOutputId)
      ? selectedOutputId
      : NO_OUTPUT;

  const inputOptions = [
    { value: ALL_INPUTS, label: 'All inputs' },
    ...inputs.map((port) => ({ value: port.id, label: port.name })),
  ];
  const outputOptions = [
    { value: NO_OUTPUT, label: 'No output' },
    ...outputs.map((port) => ({ value: port.id, label: port.name })),
  ];

  return (
    <div className="flex flex-wrap items-start gap-4">
      <FormField
        label="MIDI input"
        className="w-56"
        controlSlot={
          <Combobox
            options={inputOptions}
            value={inputValue}
            onValueChange={(value: string) => setSelectedInputId(value)}
          />
        }
      />
      <FormField
        label="MIDI output"
        className="w-56"
        controlSlot={
          <Combobox
            options={outputOptions}
            value={outputValue}
            onValueChange={(value: string) => setSelectedOutputId(value)}
          />
        }
      />
    </div>
  );
}
