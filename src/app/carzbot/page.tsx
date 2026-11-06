import { CarzBotOrb } from "@/components/carzbot-orb";

export const metadata = { title: "CarzBot — Carz AI" };

/**
 * No padding and no max-width: the orb owns the whole stage.
 *
 * It positions the pill from the viewport and flies to 46% of it, so a wrapper
 * that added page padding would move the stage out from under the arithmetic.
 * §4: the shell's one scroller is this main, and the orb fills it exactly, so
 * there is nothing here to scroll.
 */
export default function CarzBotPage() {
  return (
    <main className="h-full w-full">
      <CarzBotOrb />
    </main>
  );
}
