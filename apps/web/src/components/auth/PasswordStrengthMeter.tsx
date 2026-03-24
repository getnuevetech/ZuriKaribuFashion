import { evaluatePasswordSecurity } from '../../utils/passwordSecurity';

type Props = {
  password: string;
  showMessage?: boolean;
  className?: string;
};

const levelStyleMap = {
  'very-weak': {
    bar: 'bg-red-500',
    text: 'text-red-700',
    label: 'Very weak',
  },
  weak: {
    bar: 'bg-orange-500',
    text: 'text-orange-700',
    label: 'Weak',
  },
  fair: {
    bar: 'bg-amber-500',
    text: 'text-amber-700',
    label: 'Fair',
  },
  good: {
    bar: 'bg-lime-500',
    text: 'text-lime-700',
    label: 'Good',
  },
  strong: {
    bar: 'bg-emerald-600',
    text: 'text-emerald-700',
    label: 'Strong',
  },
} as const;

export default function PasswordStrengthMeter({ password, showMessage = true, className = '' }: Props) {
  const state = evaluatePasswordSecurity(password);
  const widthPercent = Math.max(8, Math.round((state.score / state.maxScore) * 100));
  const levelStyle = levelStyleMap[state.level];

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${levelStyle.bar}`}
          style={{ width: `${widthPercent}%` }}
          aria-hidden
        />
      </div>
      <p className={`text-sm font-semibold transition-colors duration-300 ${levelStyle.text}`}>
        Password strength: {levelStyle.label}
      </p>
      <ul className="grid gap-1.5 text-sm text-gray-600 sm:grid-cols-2">
        {state.rules.map((rule) => (
          <li key={rule.key} className={rule.met ? 'text-emerald-700' : 'text-gray-500'}>
            {rule.met ? '✓' : '•'} {rule.label}
          </li>
        ))}
      </ul>
      {showMessage && password ? (
        <p className={`text-sm ${state.isValid ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</p>
      ) : null}
    </div>
  );
}
