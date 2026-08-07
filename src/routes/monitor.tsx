import { createFileRoute } from '@tanstack/react-router';
import { Pause, Play, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PortSelectors } from '@/components/midi/PortSelectors';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { kindLabel, toHex } from '@/lib/midi/decode';
import { useMidi } from '@/lib/midi/MidiProvider';
import { type MidiMessageKind, type MonitorEntry, NOISY_KINDS } from '@/lib/midi/types';

const MAX_ENTRIES = 1000;
const FLUSH_INTERVAL_MS = 100;
const MAX_HEX_BYTES = 24;

type DirectionFilter = 'all' | 'in' | 'out';

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
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>MIDI Monitor</CardTitle>
          <CardDescription>
            Watch incoming MIDI from your FCB1010. Press a footswitch or move an expression pedal to verify the
            connection.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end justify-between gap-4">
          <PortSelectors />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <label htmlFor="show-noisy" className="flex items-center gap-2 text-sm">
              <Switch id="show-noisy" checked={showNoisy} onCheckedChange={setShowNoisy} />
              Show clock / active sensing
            </label>
            <Select value={directionFilter} onValueChange={(value) => setDirectionFilter(value as DirectionFilter)}>
              <SelectTrigger size="sm" className="w-28" aria-label="Direction filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">In + out</SelectItem>
                <SelectItem value="in">In only</SelectItem>
                <SelectItem value="out">Out only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
              <SelectTrigger size="sm" className="w-40" aria-label="Message type filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setPaused((value) => !value)}>
              {paused ? <Play /> : <Pause />}
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Button variant="outline" size="sm" onClick={clear}>
              <Trash2 />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {status === 'error' && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">MIDI access failed</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={retry}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {status === 'unsupported' && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Web MIDI unsupported</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card className="gap-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Messages</CardTitle>
          <span className="text-xs text-muted-foreground">
            {paused && <span className="mr-2 font-medium text-foreground">paused</span>}
            {visible.length} shown · {totalReceived} received
          </span>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {entries.length === 0
                ? 'No messages yet. Connect your FCB1010 and press a footswitch.'
                : 'No messages match the current filters.'}
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
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
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatTime(entry.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={entry.direction === 'out' ? 'default' : 'outline'} className="text-xs">
                          {entry.direction === 'out' ? '→ out' : 'in'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-44 truncate text-xs" title={entry.portName}>
                        {entry.portName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{kindLabel(entry.message.kind)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry.message.channel ?? '–'}</TableCell>
                      <TableCell className="text-sm">{entry.message.summary}</TableCell>
                      <TableCell
                        className="text-right font-mono text-xs text-muted-foreground"
                        title={entry.message.data.length > MAX_HEX_BYTES ? toHex(entry.message.data) : undefined}
                      >
                        {formatHex(entry.message.data)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute('/monitor')({
  component: MonitorPage,
});
