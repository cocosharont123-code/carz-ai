// The page itself is a client component (it reads the acceptance record from
// localStorage), so its metadata lives here.
export const metadata = {
  title: "Privacy Policy | Carz AI",
  description: "How Carz AI collects, uses and protects your information.",
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
