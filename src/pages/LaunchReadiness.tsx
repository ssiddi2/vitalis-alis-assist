import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHospital } from '@/contexts/HospitalContext';
import { useAuth } from '@/contexts/AuthContext';
import { GovernanceRegistry } from '@/components/virtualis/GovernanceRegistry';
import { CredentialingPanel } from '@/components/virtualis/CredentialingPanel';
import { OperationsReadiness } from '@/components/virtualis/OperationsReadiness';
import { LaunchReadinessDashboard } from '@/components/virtualis/LaunchReadinessDashboard';
import { ComplianceMatrix } from '@/components/virtualis/ComplianceMatrix';
import { ObesityLaunchWorkspace } from '@/components/virtualis/ObesityLaunchWorkspace';

export default function LaunchReadiness() {
  const navigate = useNavigate();
  const { selectedHospital } = useHospital();
  const { isAdmin } = useAuth();
  const selectedHospitalId = selectedHospital?.id ?? null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-sm px-4 sm:px-8 py-4 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="gap-2 rounded-xl">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Admin</span>
        </Button>
        <div className="w-px h-6 bg-slate-200" />
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Gauge className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Launch Readiness</h1>
            <p className="text-xs text-slate-500">Clinical governance · consent · credentialing · operations</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        {!selectedHospitalId ? (
          <p className="text-sm text-slate-600">Select a facility to review its readiness gates.</p>
        ) : (
          <Tabs defaultValue="readiness" className="space-y-4">
            <TabsList className="rounded-full">
              <TabsTrigger value="readiness" className="rounded-full text-xs">Readiness</TabsTrigger>
              <TabsTrigger value="obesity" className="rounded-full text-xs">Obesity</TabsTrigger>
              <TabsTrigger value="compliance" className="rounded-full text-xs">Compliance</TabsTrigger>
              <TabsTrigger value="governance" className="rounded-full text-xs">Governance</TabsTrigger>
              <TabsTrigger value="credentialing" className="rounded-full text-xs">Credentialing</TabsTrigger>
              <TabsTrigger value="operations" className="rounded-full text-xs">Operations</TabsTrigger>
            </TabsList>
            <TabsContent value="readiness">
              <LaunchReadinessDashboard hospitalId={selectedHospitalId} />
            </TabsContent>
            <TabsContent value="obesity">
              <ObesityLaunchWorkspace hospitalId={selectedHospitalId} />
            </TabsContent>
            <TabsContent value="compliance">
              <ComplianceMatrix hospitalId={selectedHospitalId} />
            </TabsContent>
            <TabsContent value="governance">
              <GovernanceRegistry hospitalId={selectedHospitalId} />
            </TabsContent>
            <TabsContent value="credentialing">
              <CredentialingPanel hospitalId={selectedHospitalId} isAdmin={isAdmin} />
            </TabsContent>
            <TabsContent value="operations">
              <OperationsReadiness hospitalId={selectedHospitalId} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
