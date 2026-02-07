import alisLogo from '@/assets/alis-logo.png';

export function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/10 to-info/10 border border-primary/20 flex items-center justify-center shadow-soft">
        <img src={alisLogo} alt="ALIS" className="w-6 h-6 object-contain" />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-card border border-border shadow-soft">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-primary/40 animate-typing-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
