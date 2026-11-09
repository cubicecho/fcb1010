import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { CardLayout } from '@/components/card-layout';
import { Combobox } from '@/components/combobox';
import { EmptyState } from '@/components/empty-state';
import { FormField } from '@/components/form-field';
import { PortSelectors } from '@/components/midi/PortSelectors';
import { PageLayout } from '@/components/page-layout';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pause, Play, Trash2 } from '@/components/ui/icons';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { kindLabel, toHex } from '@/lib/midi/decode';
import { useMidi } from '@/lib/midi/MidiProvider';
import { type MidiMessageKind, type MonitorEntry, NOISY_KINDS } from '@/lib/midi/types';

const MAX_ENTRIES = 1000;
const FLUSH_INTERVAL_MS = 100;
const MAX_HEX_BYTES = 24;

type DirectionFilter = 'all' | 'in' | 'out';

const DIRECTION_OPTIONS = [
  { value: 'all', label: 'In + out' },
  { value: 'in', label: 'In only' },
  { value: 'out', label: 'Out only' },
] as const;

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'programchange', label: 'Program Change' },
  { value: 'controlchange', label: 'Control Change' },
  { value: 'note', label: 'Notes' },
  { value: 'sysex', label: 'SysEx' },
  { value: 'other', label: 'Other' },
] as const;
type TypeFilter = (typeof TYPE_FILTER_OPTIONS)[number]['value'];

function matchesType(kind: MidiMessageKind, filter: TypeFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'note':
      return kind === 'noteon' || kind === 'noteoff';
    case 'other':
      return !['programchange', 'controlchange', 'noteon', 'noteoff', 'sysex'].includes(kind);
    default:
      return kind === filter;
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(performance.timeOrigin + timestamp);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function formatHex(data: readonly number[]): string {
  if (data.length <= MAX_HEX_BYTES) return toHex(data);
  return `${toHex(data.slice(0, MAX_HEX_BYTES))} … (${data.length} bytes)`;
}

function MonitorPage() {
  const { status, error, subscribe, retry } = useMidi();
  const [entries, setEntries] = useState<MonitorEntry[]>([]);
  const [totalReceived, setTotalReceived] = useState(0);
  const [showNoisy, setShowNoisy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const bufferRef = useRef<MonitorEntry[]>([]);
  const showNoisyRef = useRef(showNoisy);
  showNoisyRef.current = showNoisy;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const unsubscribe = subscribe((entry) => {
      if (pausedRef.current) return;
      if (!showNoisyRef.current && NOISY_KINDS.has(entry.message.kind)) return;
      bufferRef.current.push(entry);
    });

    const interval = setInterval(() => {
      if (bufferRef.current.length === 0) return;
      const incoming = bufferRef.current;
      bufferRef.current = [];
      setTotalReceived((count) => count + incoming.length);
      setEntries((current) => [...incoming.reverse(), ...current].slice(0, MAX_ENTRIES));
    }, FLUSH_INTERVAL_MS);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [subscribe]);

  const clear = () => {
    bufferRef.current = [];
    setEntries([]);
    setTotalReceived(0);
  };

  // Filters apply to the display only — captured history stays intact.
  const visible = entries.filter(
    (entry) =>
      (directionFilter === 'all' || entry.direction === directionFilter) && matchesType(entry.message.kind, typeFilter),
  );

  return (
    <PageLayout
      title="MIDI Monitor"
      description="Watch incoming MIDI from your FCB1010. Press a footswitch or move an expression pedal to verify the connection."
      contentSlot={
        <div className="flex flex-col gap-4">
          {status === 'error' && (
            <Alert
              variant="destructive"
              title="MIDI access failed"
              description={error}
              actionSlot={<Button variant="outline" size="sm" onClick={retry} content="Retry" />}
            />
          )}

          {status === 'unsupported' && <Alert variant="destructive" title="Web MIDI unsupported" description={error} />}

          <CardLayout
            level={2}
            title="Ports and filters"
            description="Filters change what is shown, not what is captured."
            contentClassName="flex-row flex-wrap items-start gap-4"
            contentSlot={
              <>
                <PortSelectors />
                <FormField
                  label="Direction"
                  className="w-32"
                  controlSlot={
                    <Combobox
                      options={DIRECTION_OPTIONS}
                      value={directionFilter}
                      onValueChange={(value: string) => setDirectionFilter(value as DirectionFilter)}
                    />
                  }
                />
                <FormField
                  label="Message type"
                  className="w-44"
                  controlSlot={
                    <Combobox
                      options={TYPE_FILTER_OPTIONS}
                      value={typeFilter}
                      onValueChange={(value: string) => setTypeFilter(value as TypeFilter)}
                    />
                  }
                />
                <FormField
                  label="Show clock / active sensing"
                  orientation="horizontal"
                  className="self-center"
                  controlSlot={<Switch checked={showNoisy} onCheckedChange={setShowNoisy} />}
                />
              </>
            }
          />

          <CardLayout
            level={2}
            title="Messages"
            description={`${paused ? 'Paused · ' : ''}${visible.length} shown · ${totalReceived} received`}
            actionSlot={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaused((value) => !value)}
                  iconSlot={paused ? <Play /> : <Pause />}
                  content={paused ? 'Resume' : 'Pause'}
                />
                <Button variant="outline" size="sm" onClick={clear} iconSlot={<Trash2 />} content="Clear" />
              </>
            }
            emptySlot={
              <EmptyState
                compact
                title={
                  entries.length === 0
                    ? 'No messages yet. Connect your FCB1010 and press a footswitch.'
                    : 'No messages match the current filters.'
                }
              />
            }
            contentSlot={
              visible.length === 0 ? null : (
                <Table maxHeight="lg">
                  <TableCaption className="sr-only">MIDI messages, newest first</TableCaption>
                  <TableHeader className="bg-secondary">
                    <TableRow>
                      <TableHead className="w-28">Time</TableHead>
                      <TableHead className="w-12">Dir</TableHead>
                      <TableHead className="w-44">Port</TableHead>
                      <TableHead className="w-24">Type</TableHead>
                      <TableHead className="w-12">Ch</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead className="text-right font-mono">Raw</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap font-mono text-muted-foreground text-xs">
                          {formatTime(entry.timestamp)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={entry.direction === 'out' ? 'default' : 'outline'}>
                            {entry.direction === 'out' ? '→ out' : 'in'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-44 truncate text-xs" title={entry.portName}>
                          {entry.portName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{kindLabel(entry.message.kind)}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{entry.message.channel ?? '–'}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{entry.message.summary}</TableCell>
                        <TableCell
                          className="whitespace-nowrap text-right font-mono text-muted-foreground text-xs"
                          title={entry.message.data.length > MAX_HEX_BYTES ? toHex(entry.message.data) : undefined}
                        >
                          {formatHex(entry.message.data)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            }
          />
        </div>
      }
    />
  );
}

export const Route = createFileRoute('/monitor')({
  component: MonitorPage,
});
