import React from 'react';
import { MotionConfig } from 'motion/react';
import { FarmProvider, useFarm } from './context/FarmContext';
import { Layout } from './components/Layout';
import { PageTransition, ToastContainer } from './components/ui/MotionPrimitives';
import { OverviewDashboard } from './pages/OverviewDashboard';
import { CowManagementPage } from './pages/CowManagementPage';
import { MilkProductionPage } from './pages/MilkProductionPage';
import { HealthMonitoringPage } from './pages/HealthMonitoringPage';
import { TreatmentMedicinePage } from './pages/TreatmentMedicinePage';
import { MilkSafetyPage } from './pages/MilkSafetyPage';
import { FarmEnvironmentPage } from './pages/FarmEnvironmentPage';
import { WaterManagementPage } from './pages/WaterManagementPage';
import { HardwareControlPage } from './pages/HardwareControlPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { AlertsCentrePage } from './pages/AlertsCentrePage';
import { ReportsAnalyticsPage } from './pages/ReportsAnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';

const AppContent: React.FC = () => {
  const { activePage, toasts, dismissToast } = useFarm();

  const renderPage = () => {
    switch (activePage) {
      case 'overview':
        return <OverviewDashboard />;
      case 'cows':
        return <CowManagementPage />;
      case 'milk':
        return <MilkProductionPage />;
      case 'health':
        return <HealthMonitoringPage />;
      case 'treatments':
        return <TreatmentMedicinePage />;
      case 'safety':
        return <MilkSafetyPage />;
      case 'environment':
        return <FarmEnvironmentPage />;
      case 'water':
        return <WaterManagementPage />;
      case 'hardware':
        return <HardwareControlPage />;
      case 'assistant':
        return <AIAssistantPage />;
      case 'alerts':
        return <AlertsCentrePage />;
      case 'reports':
        return <ReportsAnalyticsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <OverviewDashboard />;
    }
  };

  return (
    <>
      <Layout>
        <PageTransition pageKey={activePage}>{renderPage()}</PageTransition>
      </Layout>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
};

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <FarmProvider>
        <AppContent />
      </FarmProvider>
    </MotionConfig>
  );
}
