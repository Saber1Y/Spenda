import {SiteNav} from "@/components/marketing/SiteNav";
import {Hero} from "@/components/marketing/Hero";
import {ProblemSection} from "@/components/marketing/ProblemSection";
import {TwoFences} from "@/components/marketing/TwoFences";
import {HowItWorks} from "@/components/marketing/HowItWorks";
import {LiveProof} from "@/components/marketing/LiveProof";
import {MainnetReadiness} from "@/components/marketing/MainnetReadiness";
import {CTASection} from "@/components/marketing/CTASection";
import {SiteFooter} from "@/components/marketing/SiteFooter";

export default function Home() {
  return (
    <main>
      <SiteNav />
      <Hero />
      <ProblemSection />
      <TwoFences />
      <HowItWorks />
      <MainnetReadiness />
      <LiveProof />
      <CTASection />
      <SiteFooter />
    </main>
  );
}
