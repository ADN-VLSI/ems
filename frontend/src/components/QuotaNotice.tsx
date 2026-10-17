import React from 'react';
import { DollarSign, ShieldAlert, Cpu, Database, Mail, Globe, CheckCircle2 } from 'lucide-react';

export const QuotaNotice: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
      {/* Title */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
          <DollarSign className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">
            Free-Tier Specifications & Quota Governance
          </h3>
          <p className="text-xs text-slate-500">
            Strictly designed for 100% ongoing free-tier hosting, API, database, and SMTP delivery.
          </p>
        </div>
      </div>

      {/* Grid of Providers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. GitHub Pages */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
              <Globe className="w-4 h-4 text-blue-600" />
              <span>GitHub Pages (Frontend)</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Free Tier
            </span>
          </div>
          <ul className="text-xs text-slate-600 space-y-1">
            <li>• <strong>Quota:</strong> 100 GB bandwidth / month, 10 builds / hour</li>
            <li>• <strong>Expected usage:</strong> &lt; 2 GB / month for daily employee updates</li>
            <li>• <strong>Safety mechanism:</strong> Pure static client bundle; zero secrets or employee PII stored in Git</li>
            <li>• <strong>Quota limit behavior:</strong> Clean static 429 error without billing escalation</li>
          </ul>
        </div>

        {/* 2. Cloudflare Workers */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
              <Cpu className="w-4 h-4 text-orange-600" />
              <span>Cloudflare Workers (API)</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Free Tier
            </span>
          </div>
          <ul className="text-xs text-slate-600 space-y-1">
            <li>• <strong>Quota:</strong> 100,000 requests / day (10ms CPU time/request)</li>
            <li>• <strong>Expected usage:</strong> ~500–1,500 requests / day across all employees</li>
            <li>• <strong>Safety mechanism:</strong> Pay-as-you-go disabled; requests return 429 if quota exceeded</li>
            <li>• <strong>Quota limit behavior:</strong> Returns friendly HTTP 429; never auto-upgrades</li>
          </ul>
        </div>

        {/* 3. Cloudflare D1 */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
              <Database className="w-4 h-4 text-indigo-600" />
              <span>Cloudflare D1 (Database)</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Free Tier
            </span>
          </div>
          <ul className="text-xs text-slate-600 space-y-1">
            <li>• <strong>Quota:</strong> 5 Million rows read / day, 100,000 rows written / day, 5 GB storage</li>
            <li>• <strong>Expected usage:</strong> &lt; 10,000 reads / day, &lt; 200 writes / day</li>
            <li>• <strong>Safety mechanism:</strong> Optimized indexed queries, JSON text payloads under 128 KB</li>
            <li>• <strong>Quota limit behavior:</strong> Rejects excess writes gracefully with operational error</li>
          </ul>
        </div>

        {/* 4. SMTP Service */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
              <Mail className="w-4 h-4 text-rose-600" />
              <span>SMTP Email Dispatch</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Free Tier
            </span>
          </div>
          <ul className="text-xs text-slate-600 space-y-1">
            <li>• <strong>Compatible Free Providers:</strong> Brevo (300/day), Gmail SMTP (500/day), Resend (100/day)</li>
            <li>• <strong>Expected volume:</strong> 20–80 emails / day (individual copies + team + company report)</li>
            <li>• <strong>Safety mechanism:</strong> 300ms inter-message delay in GitHub Actions dispatcher to prevent rate spikes</li>
            <li>• <strong>Idempotency:</strong> <code>report_deliveries</code> table in D1 guarantees zero duplicate emails on retry</li>
          </ul>
        </div>
      </div>

      {/* Safety Summary Banner */}
      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Cost Guarantee Policy</span>
        </div>
        <p>
          No payment methods or credit cards are required or attached to Cloudflare, GitHub, or the SMTP dispatcher. If any service boundary is reached, operations halt safely with explicit diagnostic errors rather than incurring any surprise billing or automated tier upgrades.
        </p>
      </div>
    </div>
  );
};
