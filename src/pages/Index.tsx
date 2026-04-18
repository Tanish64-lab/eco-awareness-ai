import { SettingsProvider } from "@/components/SettingsContext";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { CampaignGenerator } from "@/components/CampaignGenerator";
import { Chatbot } from "@/components/Chatbot";
import { Quiz } from "@/components/Quiz";
import { DailyTip } from "@/components/DailyTip";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <SettingsProvider>
      <div className="min-h-screen bg-background">
        <Header />
        <main>
          <Hero />
          <CampaignGenerator />
          <Chatbot />
          <Quiz />
          <DailyTip />
        </main>
        <Footer />
      </div>
    </SettingsProvider>
  );
};

export default Index;
