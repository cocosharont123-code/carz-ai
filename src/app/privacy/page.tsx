import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PageMasthead } from "@/components/ui/editorial";
import {
  PRIVACY_SECTIONS,
  PRIVACY_INTRO,
  PRIVACY_UPDATED,
  PRIVACY_ENTITY,
  PRIVACY_CONTACT,
} from "@/lib/privacy";

export const metadata = {
  title: "Privacy Policy — Carz AI",
  description: "How Carz AI collects, uses and protects your information.",
};

/**
 * The Privacy Policy as a normal page.
 *
 * No acceptance gate, unlike the Terms: a privacy policy is a disclosure of
 * what happens to your data, not a bargain you strike. Blocking the app until
 * someone clicks "I accept" on one would misrepresent what it is.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <PageMasthead eyebrow={`Last updated ${PRIVACY_UPDATED}`} title="Privacy Policy" />

      <p className="mt-6 text-[13px] leading-relaxed opacity-70">{PRIVACY_INTRO}</p>

      <div className="mt-8 space-y-9">
        {PRIVACY_SECTIONS.map((section, i) => (
          <section key={section.title}>
            <h2 className="text-sm font-bold">
              <span className="mr-2 opacity-40 tabular-nums">{i + 1}.</span>
              {section.title}
            </h2>
            <div className="mt-3 space-y-3">
              {section.blocks.map((block, j) => {
                if (block.kind === "p") {
                  return (
                    <p key={j} className="text-[13px] leading-relaxed opacity-80">
                      {block.text}
                    </p>
                  );
                }
                if (block.kind === "h3") {
                  return (
                    <h3 key={j} className="util-label opacity-60">
                      {block.text}
                    </h3>
                  );
                }
                return (
                  <ul key={j} className="space-y-2">
                    {block.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-carz" />
                        <span className="opacity-80">{item}</span>
                      </li>
                    ))}
                  </ul>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-12 border-t border-white/10 pt-6">
        <p className="flex items-center gap-2 text-[13px] opacity-60">
          <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          {PRIVACY_ENTITY} · {PRIVACY_CONTACT}
        </p>
        <p className="mt-4">
          <Link href="/terms" className="util-label opacity-50 hover:opacity-100">
            Read the Terms of Service
          </Link>
        </p>
      </footer>
    </main>
  );
}
