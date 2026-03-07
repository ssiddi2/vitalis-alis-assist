import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FuturisticBackground } from '@/components/virtualis/FuturisticBackground';
import alisLogo from '@/assets/alis-logo.png';
import {
  Mic, FileText, ClipboardList, DollarSign, TrendingUp, MonitorSmartphone,
  Shield, ArrowRight, Ear, Brain, Zap, ExternalLink
} from 'lucide-react';

const features = [
  { icon: Mic, title: 'Ambient AI Scribe', desc: 'Real-time speech-to-text captures the clinical encounter hands-free while you focus on the patient.' },
  { icon: FileText, title: 'Auto SOAP Notes', desc: 'Structured Progress, Consult, Discharge & Procedure notes generated from templates — ready to sign.' },
  { icon: ClipboardList, title: 'Intelligent Orders', desc: 'AI-staged labs, imaging & prescriptions appear in a review sidebar for one-click physician approval.' },
  { icon: DollarSign, title: 'Real-Time Billing', desc: 'CPT & ICD-10 codes suggested automatically with confidence scores, reducing claim denials.' },
  { icon: TrendingUp, title: 'Clinical Trends', desc: 'Vitals, labs & medication history synthesised into early-warning insights at the point of care.' },
  { icon: MonitorSmartphone, title: 'Multi-EMR Support', desc: 'Connects to Epic, Cerner & Meditech — fits your existing workflow, not the other way around.' },
];

const metrics = [
  { value: '15–30 min', label: 'Saved per patient encounter' },
  { value: '60%', label: 'Fewer clicks in documentation' },
  { value: '15–25%', label: 'Billing capture improvement' },
];

const steps = [
  { icon: Ear, title: 'Listen', desc: 'ALIS captures the ambient conversation in real time.' },
  { icon: Brain, title: 'Analyse', desc: 'Clinical context is mapped to notes, orders & codes.' },
  { icon: Zap, title: 'Act', desc: 'Drafts are staged for physician review — never auto-executed.' },
];

export default function Product() {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <FuturisticBackground variant="full" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <img src={alisLogo} alt="ALIS" className="h-9 w-9 object-contain" />
          <span className="font-semibold text-lg tracking-tight text-foreground">ALIS</span>
        </div>
        <Link to="/auth">
          <Button variant="outline" size="sm">Sign In</Button>
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative z-10 text-center px-6 pt-16 pb-24 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-card/60 text-xs font-medium text-muted-foreground mb-6">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse-glow" />
          AI-Powered Clinical Intelligence
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-4">
          <span className="text-gradient-primary">Ambient Learning</span><br />Intelligence System
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto mb-8">
          ALIS listens, documents, and stages orders in real time — so clinicians can focus on patients, not paperwork.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href="https://vitalis-alis-assist.lovable.app" target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="btn-primary-gradient gap-2 px-8">
              Try Live Demo <ExternalLink className="w-4 h-4" />
            </Button>
          </a>
          <Link to="/auth">
            <Button variant="outline" size="lg">Sign In <ArrowRight className="w-4 h-4 ml-1" /></Button>
          </Link>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="relative z-10 px-6 pb-24 max-w-6xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2">What ALIS Does</h2>
        <p className="text-muted-foreground text-center mb-10 max-w-lg mx-auto text-sm">Six integrated capabilities that eliminate busywork from the clinical workflow.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <Card key={f.title} className="card-apple group hover:border-primary/30 transition-colors">
              <CardContent className="p-6 flex flex-col gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-base">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ROI Metrics */}
      <section className="relative z-10 px-6 pb-24 max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">Measured Impact</h2>
        <div className="grid sm:grid-cols-3 gap-5">
          {metrics.map((m) => (
            <div key={m.label} className="glass rounded-2xl border border-border p-8 text-center shadow-soft">
              <p className="text-4xl sm:text-5xl font-bold text-gradient-primary mb-2">{m.value}</p>
              <p className="text-muted-foreground text-sm">{m.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 px-6 pb-24 max-w-4xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">How It Works</h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <div key={s.title} className="flex flex-col items-center text-center gap-3">
              <div className="relative">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-soft">
                  <s.icon className="w-7 h-7" />
                </div>
                <span className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">{i + 1}</span>
              </div>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-muted-foreground text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Safety */}
      <section className="relative z-10 px-6 pb-24 max-w-3xl mx-auto text-center">
        <div className="glass rounded-2xl border border-border p-10 shadow-soft">
          <Shield className="w-10 h-10 text-success mx-auto mb-4" />
          <h2 className="text-xl sm:text-2xl font-bold mb-3">Physician-in-the-Loop</h2>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-lg mx-auto">
            ALIS <span className="font-semibold text-foreground">never</span> executes orders autonomously. Every note, prescription and lab order is staged for explicit physician review and signature — keeping you in full control.
          </p>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="relative z-10 px-6 pb-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-3">Experience ALIS Today</h2>
        <p className="text-muted-foreground text-sm mb-6">No install. No credit card. Explore the live demo instantly.</p>
        <a href="https://vitalis-alis-assist.lovable.app" target="_blank" rel="noopener noreferrer">
          <Button size="lg" className="btn-primary-gradient gap-2 px-10">
            Launch Demo <ExternalLink className="w-4 h-4" />
          </Button>
        </a>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Virtualis · ALIS — Ambient Learning Intelligence System
      </footer>
    </div>
  );
}
