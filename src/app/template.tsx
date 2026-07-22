// Re-mounts on every route change → each screen fades in + rises 10px (400ms).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
