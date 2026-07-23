import { SiteHeader } from "@/components/site-header";
import { ModernPricingPage, type PricingCardProps } from "@/components/ui/animated-glassy-pricing";

const plans: PricingCardProps[] = [
  {
    planName: "Free",
    description: "Everything you need to spot, identify and bid.",
    price: "0",
    features: ["Unlimited AI car scans", "Wishlist any auction", "Live leaderboard", "Car Hunt events"],
    buttonText: "Current plan",
    buttonVariant: "secondary",
  },
  {
    planName: "Carz+",
    description: "The membership for serious spotters.",
    price: "10",
    features: [
      "Auctions 24h early",
      "Members-only Garage",
      "Auto-bid + market-value insight",
      "Car alerts & radius pings",
      "Day streaks",
      "48h early access to new features",
    ],
    buttonText: "Get Carz+",
    isPopular: true,
    buttonVariant: "primary",
  },
];

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <ModernPricingPage
        title={
          <>
            Choose your <span className="text-cyan-400">Carz</span> plan
          </>
        }
        subtitle="Start free. Upgrade to Carz+ for early auctions, auto-bid, alerts and more."
        plans={plans}
        showAnimatedBackground
      />
    </>
  );
}
