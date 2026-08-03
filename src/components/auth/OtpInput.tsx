import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

interface OtpInputProps {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
}

/** Shared 6-digit TOTP entry field. */
export function OtpInput({ value, onChange, onComplete, disabled }: OtpInputProps) {
  return (
    <InputOTP
      maxLength={6}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      containerClassName="justify-center"
    >
      <InputOTPGroup className="gap-2">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <InputOTPSlot
            key={i}
            index={i}
            className="h-12 w-11 rounded-xl border border-border bg-card/80 text-base font-semibold shadow-sm first:rounded-xl last:rounded-xl"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
