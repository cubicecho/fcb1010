import { ClipboardPaste, Eraser } from '@/components/app-icons';
import { CardLayout } from '@/components/card-layout';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Copy } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useDump } from '@/lib/fcb/DumpProvider';
import { createEmptyPreset, type FcbPreset, getPreset, presetLabel, setPreset } from '@/lib/fcb/model';
import { CC_PICKER_ITEMS, NOTE_PICKER_ITEMS } from '@/lib/midi/names';
import { MidiNumberInput } from './MidiNumberInput';
import { MidiValuePicker } from './MidiValuePicker';

interface SlotRowProps {
  id: string;
  label: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  children?: React.ReactNode;
}

function SlotRow({ id, label, enabled, onEnabledChange, children }: SlotRowProps) {
  return (
    <div className="flex min-h-10 items-center gap-3 border-foreground/10 border-b py-1.5 last:border-b-0">
      <Switch id={id} checked={enabled} onCheckedChange={onEnabledChange} />
      <Label htmlFor={id} className="w-24 shrink-0">
        {label}
      </Label>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">{children}</div>
    </div>
  );
}

/** Inputs inside carry their own aria-label; this text is visual only. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-foreground/60 text-xs">
      {label}
      {children}
    </span>
  );
}

interface PresetEditorProps {
  presetIndex: number;
  /** Copy/paste buffer, held by the page so it survives switching presets. */
  clipboard: FcbPreset | null;
  onClipboardChange: (preset: FcbPreset) => void;
}

export function PresetEditor({ presetIndex, clipboard, onClipboardChange }: PresetEditorProps) {
  const { dump, updateMemory, presetNames, setPresetName } = useDump();
  if (!dump) return null;

  const preset = getPreset(dump.memory, presetIndex);

  const apply = (change: (draft: FcbPreset) => void) => {
    updateMemory((memory) => {
      const draft = getPreset(memory, presetIndex);
      change(draft);
      setPreset(memory, presetIndex, draft);
    });
  };

  return (
    <CardLayout
      level={2}
      title={`Preset ${presetLabel(presetIndex)}`}
      actionSlot={
        <>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onClipboardChange(getPreset(dump.memory, presetIndex))}
            aria-label="Copy preset"
            iconSlot={<Copy />}
          />
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!clipboard}
            onClick={() => clipboard && updateMemory((memory) => setPreset(memory, presetIndex, clipboard))}
            aria-label="Paste preset"
            hint={clipboard ? undefined : 'Copy a preset first'}
            iconSlot={<ClipboardPaste />}
          />
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => updateMemory((memory) => setPreset(memory, presetIndex, createEmptyPreset()))}
            aria-label="Clear preset"
            hint="Clear preset (switch every function off)"
            iconSlot={<Eraser />}
          />
        </>
      }
      contentSlot={
        <>
          <FormField
            label="Name"
            description="Kept in this browser, not on the pedal."
            controlSlot={
              <Input
                value={presetNames[presetIndex]}
                onChange={(event) => setPresetName(presetIndex, event.target.value)}
                className="max-w-64"
              />
            }
          />
          <div className="flex flex-col">
            {preset.pc.map((slot, i) => (
              <SlotRow
                // biome-ignore lint/suspicious/noArrayIndexKey: PC slots are fixed positions
                key={i}
                id={`pc${i + 1}`}
                label={`PC ${i + 1}`}
                enabled={slot.enabled}
                onEnabledChange={(enabled) =>
                  apply((d) => {
                    d.pc[i].enabled = enabled;
                  })
                }
              >
                <Field label="Program">
                  <MidiNumberInput
                    value={slot.program}
                    disabled={!slot.enabled}
                    onChange={(program) =>
                      apply((d) => {
                        d.pc[i].program = program;
                      })
                    }
                    aria-label={`PC ${i + 1} program`}
                  />
                </Field>
              </SlotRow>
            ))}

            {(['cc1', 'cc2'] as const).map((key, i) => {
              const slot = preset[key];
              return (
                <SlotRow
                  key={key}
                  id={key}
                  label={`CC ${i + 1}`}
                  enabled={slot.enabled}
                  onEnabledChange={(enabled) =>
                    apply((d) => {
                      d[key].enabled = enabled;
                    })
                  }
                >
                  <Field label="Controller">
                    <MidiValuePicker
                      value={slot.controller}
                      items={CC_PICKER_ITEMS}
                      disabled={!slot.enabled}
                      onChange={(controller) =>
                        apply((d) => {
                          d[key].controller = controller;
                        })
                      }
                      aria-label={`CC ${i + 1} controller`}
                    />
                  </Field>
                  <Field label="Value">
                    <MidiNumberInput
                      value={slot.value}
                      disabled={!slot.enabled}
                      onChange={(value) =>
                        apply((d) => {
                          d[key].value = value;
                        })
                      }
                      aria-label={`CC ${i + 1} value`}
                    />
                  </Field>
                </SlotRow>
              );
            })}

            {(['expA', 'expB'] as const).map((key) => {
              const slot = preset[key];
              const name = key === 'expA' ? 'Expr A' : 'Expr B';
              return (
                <SlotRow
                  key={key}
                  id={key}
                  label={name}
                  enabled={slot.enabled}
                  onEnabledChange={(enabled) =>
                    apply((d) => {
                      d[key].enabled = enabled;
                    })
                  }
                >
                  <Field label="Controller">
                    <MidiValuePicker
                      value={slot.controller}
                      items={CC_PICKER_ITEMS}
                      disabled={!slot.enabled}
                      onChange={(controller) =>
                        apply((d) => {
                          d[key].controller = controller;
                        })
                      }
                      aria-label={`${name} controller`}
                    />
                  </Field>
                  <Field label="Min">
                    <MidiNumberInput
                      value={slot.min}
                      disabled={!slot.enabled}
                      onChange={(min) =>
                        apply((d) => {
                          d[key].min = min;
                        })
                      }
                      aria-label={`${name} min`}
                    />
                  </Field>
                  <Field label="Max">
                    <MidiNumberInput
                      value={slot.max}
                      disabled={!slot.enabled}
                      onChange={(max) =>
                        apply((d) => {
                          d[key].max = max;
                        })
                      }
                      aria-label={`${name} max`}
                    />
                  </Field>
                </SlotRow>
              );
            })}

            <SlotRow
              id="note"
              label="Note"
              enabled={preset.note.enabled}
              onEnabledChange={(enabled) =>
                apply((d) => {
                  d.note.enabled = enabled;
                })
              }
            >
              <Field label="Value">
                <MidiValuePicker
                  value={preset.note.value}
                  items={NOTE_PICKER_ITEMS}
                  disabled={!preset.note.enabled}
                  onChange={(value) =>
                    apply((d) => {
                      d.note.value = value;
                    })
                  }
                  aria-label="Note value"
                />
              </Field>
            </SlotRow>

            <SlotRow
              id="switch1"
              label="Switch 1"
              enabled={preset.switch1}
              onEnabledChange={(switch1) =>
                apply((d) => {
                  d.switch1 = switch1;
                })
              }
            />
            <SlotRow
              id="switch2"
              label="Switch 2"
              enabled={preset.switch2}
              onEnabledChange={(switch2) =>
                apply((d) => {
                  d.switch2 = switch2;
                })
              }
            />
          </div>
        </>
      }
    />
  );
}
