import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function PresetsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Presets</CardTitle>
        <CardDescription>
          Preset editing for UNO firmware is coming next: read the full sysex dump from the FCB1010, edit banks,
          presets, stompboxes, and expression pedals, then write it back.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">Nothing here yet.</CardContent>
    </Card>
  );
}

export const Route = createFileRoute('/presets')({
  component: PresetsPage,
});
