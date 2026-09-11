import { CarzBotChat } from "@/components/ui/carzbot-chat";

export const metadata = { title: "CarzBot — Carz AI" };

export default function CarzBotPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-2 py-10">
      <CarzBotChat />
    </main>
  );
}
