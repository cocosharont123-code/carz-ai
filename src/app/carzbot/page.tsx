import { CarzBotChat } from "@/components/carzbot/carzbot-chat";

export const metadata = { title: "CarzBot — Carz AI" };

/**
 * CarzBot.
 *
 * A chat, not the morph orb that used to live here: the orb answered one
 * question and had nowhere to put a second, while the route behind it has
 * always taken a transcript. §4 -- this main is the shell's one scroller, and
 * the thread grows inside it with the composer stuck to its bottom.
 */
export default function CarzBotPage() {
  return (
    <main className="h-full w-full">
      <CarzBotChat />
    </main>
  );
}
