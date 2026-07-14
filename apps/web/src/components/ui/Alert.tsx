import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertVariant = 'error' | 'success' | 'warning' | 'info';

const config: Record<AlertVariant, { className: string; Icon: typeof AlertCircle }> = {
  error: { className: 'alert-error', Icon: AlertCircle },
  success: { className: 'alert-success', Icon: CheckCircle2 },
  warning: { className: 'alert-warning', Icon: AlertTriangle },
  info: { className: 'alert-info', Icon: Info },
};

interface AlertProps {
  variant?: AlertVariant;
  children: React.ReactNode;
  className?: string;
  role?: 'alert' | 'status';
}

export function Alert({ variant = 'info', children, className, role = 'alert' }: AlertProps) {
  const { className: variantClass, Icon } = config[variant];
  return (
    <div role={role} className={cn(variantClass, className)}>
      <Icon size={18} className="shrink-0 mt-0.5" aria-hidden />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
