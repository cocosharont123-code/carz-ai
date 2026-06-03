import Link from "next/link";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { AnimatedAIChat } from "@/components/ui/animated-ai-chat";
import { PLANS } from "@/lib/plans";
import { isPlanId, PLAN_COOKIE } from "@/lib/store";

export default async function AssistantPage() {
  const jar = await cookies();
  const cookiePlan = jar.get(PLAN_COOKIE)?.value;
  const plan = isPlanId(cookiePlan) ? cookiePlan : "free";
  const allowed = PLANS[plan].aiAssistant;

  return (
    <>
      <SiteHeader />
      {allowed ? (
        <AnimatedAIChat />
      ) : (
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-24 text-center">
          <div className="rounded-3xl border border-violet-500/40 bg-gradient-to-b from-violet-500/10 to-card p-8 backdrop-blur-xl">
            <div className="text-4xl">🔒✨</div>
            <h1 className="mt-4 text-2xl font-extrabold">The AI assistant is Max-only</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Chat with an expert car AI — comparisons, buying advice, specs and history. Upgrade to
              Max to unlock it.
            </p>
            <Link
              href="/pricing"
              className="mt-6 inline-block rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 px-6 py-3 font-bold text-white"
            >
              Upgrade to Max
            </Link>
          </div>
        </main>
      )}
    </>
  );
}
