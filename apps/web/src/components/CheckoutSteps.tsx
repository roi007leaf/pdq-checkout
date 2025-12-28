interface Props {
  current: 'cart' | 'shipping' | 'payment' | 'confirmation';
}

const steps = [
  { id: 'cart', label: 'Cart' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'payment', label: 'Payment' },
  { id: 'confirmation', label: 'Confirmation' },
];

export function CheckoutSteps({ current }: Props) {
  const currentIndex = steps.findIndex((s) => s.id === current);

  return (
    <div className="steps">
      {steps.map((step, index) => (
        <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
          <div
            className={`step ${
              index === currentIndex
                ? 'active'
                : index < currentIndex
                  ? 'completed'
                  : ''
            }`}
          >
            <span className="step-number">
              {index < currentIndex ? '✓' : index + 1}
            </span>
            <span>{step.label}</span>
          </div>
          {index < steps.length - 1 && <div className="step-connector" />}
        </div>
      ))}
    </div>
  );
}
