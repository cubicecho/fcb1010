import { createFileRoute } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PortSelectors } from '@/components/midi/PortSelectors';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { kindLabel, toHex } from '@/lib/midi/decode';
import { useMidi } from '@/lib/midi/MidiProvider';
import { type MonitorEntry, NOISY_KINDS } from '@/lib/midi/types';

const MAX_ENTRIES = 1000;
const FLUSH_INTERVAL_MS = 100;
const MAX_HEX_BYTES = 24;

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

  const bufferRef = useRef<MonitorEntry[]>([]);
  const showNoisyRef = useRef(showNoisy);
  showNoisyRef.current = showNoisy;

  useEffect(() => {
    const unsubscribe = subscribe((entry) => {
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
          <div className="flex items-center gap-6">
            <label htmlFor="show-noisy" className="flex items-center gap-2 text-sm">
              <Switch id="show-noisy" checked={showNoisy} onCheckedChange={setShowNoisy} />
              Show clock / active sensing
            </label>
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
            {entries.length} shown · {totalReceived} received
          </span>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No messages yet. Connect your FCB1010 and press a footswitch.
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="w-28">Time</TableHead>
                    <TableHead className="w-44">Port</TableHead>
                    <TableHead className="w-24">Type</TableHead>
                    <TableHead className="w-12">Ch</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="text-right font-mono">Raw</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatTime(entry.timestamp)}
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
