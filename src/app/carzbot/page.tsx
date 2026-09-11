import { CarzBotChat } from "@/components/ui/carzbot-chat";

export const metadata = { title: "CarzBot — Carz AI" };

// No padding and no max-width here: the chat owns its own full-height layout,
// and a wrapper that adds page padding would put the composer above the bottom
// of the screen and give the page something to scroll.
export default function CarzBotPage() {
  return <CarzBotChat />;
}
