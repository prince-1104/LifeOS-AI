export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-500" />
        <div
          className="h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-500"
          style={{ animationDelay: "150ms" }}
        />
        <div
          className="h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-500"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}
