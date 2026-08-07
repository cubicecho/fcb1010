import { Badge } from '@/components/ui/badge';
import { useFirmware } from '@/lib/fcb/FirmwareProvider';

/** Last detected pedal firmware, shown in the header once detection has succeeded. */
export function FirmwareBadge() {
  const { firmware } = useFirmware();
  if (!firmware) return null;

  const detectedOn = new Date(firmware.detectedAt).toLocaleDateString();
  return (
    <Badge variant="secondary" title={`Detected ${detectedOn} via “Detect firmware”`}>
      {firmware.info.firmware} v{firmware.info.version}
    </Badge>
  );
}
