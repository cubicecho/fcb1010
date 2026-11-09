import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFirmware } from '@/lib/fcb/FirmwareProvider';

/** Last detected pedal firmware, shown in the header once detection has succeeded. */
export function FirmwareBadge() {
  const { firmware } = useFirmware();
  if (!firmware) return null;

  const detectedOn = new Date(firmware.detectedAt).toLocaleDateString();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary">
          {firmware.info.firmware} v{firmware.info.version}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Detected {detectedOn} via “Detect firmware”</TooltipContent>
    </Tooltip>
  );
}
