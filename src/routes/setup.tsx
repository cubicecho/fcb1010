import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function SetupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Setup</CardTitle>
        <CardDescription>
          Global device configuration (MIDI channels, switch/stompbox mode, expression pedal calibration) will live
          here. Both UNO 1.x and UNO2 are planned.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">Nothing here yet.</CardContent>
    </Card>
  );
}

export const Route = createFileRoute('/setup')({
  component: SetupPage,
});
