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
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-purple-100/50 mb-8">
      <div className="flex justify-between items-center">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex items-center gap-3">
              <div
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center font-bold text-base border-2 transition-all duration-300
                  ${
                    index === currentIndex
                      ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white border-purple-600 shadow-lg shadow-purple-500/50 scale-110'
                      : index < currentIndex
                        ? 'bg-gradient-to-br from-green-500 to-emerald-500 text-white border-green-500 shadow-md'
                        : 'bg-white text-gray-400 border-gray-300'
                  }
                `}
              >
                {index < currentIndex ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`
                  font-semibold hidden sm:inline transition-colors duration-300
                  ${
                    index === currentIndex
                      ? 'text-purple-700 text-lg'
                      : index < currentIndex
                        ? 'text-green-600'
                        : 'text-gray-400'
                  }
                `}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className="flex-1 h-1 mx-4 bg-gray-200 rounded-full relative overflow-hidden">
                <div
                  className={`absolute inset-0 transition-all duration-500 rounded-full ${
                    index < currentIndex
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                      : 'bg-gray-200'
                  }`}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
