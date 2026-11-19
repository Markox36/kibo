import clsx from 'clsx';

interface Props {
  size?: number;
  className?: string;
  withText?: boolean;
  textClassName?: string;
}

export function Logo({ size = 24, className, withText, textClassName }: Props) {
  return (
    <span className={clsx('inline-flex items-center gap-2', className)}>
      <img
        src="/kibo_logo.svg"
        alt="Kibo"
        width={size}
        height={size}
        className="rounded-md shrink-0"
        draggable={false}
      />
      {withText && (
        <span className={clsx('font-semibold tracking-tight', textClassName)}>Kibo</span>
      )}
    </span>
  );
}
