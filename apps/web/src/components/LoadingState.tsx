export function LoadingState({ message = 'Yükleniyor…' }: { message?: string }) {
  return (
    <div className="state-card" role="status">
      {message}
    </div>
  );
}
