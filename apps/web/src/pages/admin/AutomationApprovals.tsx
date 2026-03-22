import type { ElementType } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Gauge, History, Link2, AlertTriangle, BarChart3 } from 'lucide-react';

type AutomationNavCard = {
  title: string;
  description: string;
  href: string;
  icon: ElementType;
};

const NAV_CARDS: AutomationNavCard[] = [
  {
    title: 'Automation System Switchboard',
    description: 'Manage engine controls, field-level criteria, and run product/account checks from one page.',
    href: '/admin/automation/system',
    icon: Gauge,
  },
  {
    title: 'AI API Integrations',
    description: 'Connect providers, map functions, and test routing for verifier/fixer pipelines.',
    href: '/admin/automation/ai-integrations',
    icon: Link2,
  },
  {
    title: 'Failed AI Approval',
    description: 'Review technical failures after automatic retry and rerun selected approvals.',
    href: '/admin/products/failed-ai-approvals',
    icon: AlertTriangle,
  },
  {
    title: 'Product Price Compare',
    description: 'View products flagged by AI for large price variance against category peers.',
    href: '/admin/products/price-compare',
    icon: BarChart3,
  },
];

export default function AdminAutomationApprovalsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Automation Outcomes</h1>
        <p className="text-sm text-gray-600">
          Legacy control surfaces were consolidated into the Automation System Switchboard to remove duplication.
        </p>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <Bot className="mt-0.5 h-5 w-5 text-blue-700" />
          <div>
            <p className="text-sm font-semibold text-blue-900">Consolidation complete</p>
            <p className="mt-1 text-sm text-blue-800">
              Engine Controls, criteria mapping, and manual product/account approval checks now live in the
              <span className="font-semibold"> Automation System Switchboard</span>.
            </p>
            <Link
              to="/admin/automation/system"
              className="mt-2 inline-flex items-center rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
            >
              Open Switchboard
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {NAV_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              to={card.href}
              className="rounded-xl border bg-white p-4 shadow-sm transition hover:border-amber-300 hover:shadow"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-amber-50 p-2">
                  <Icon className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{card.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{card.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <History className="mt-0.5 h-5 w-5 text-gray-600" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Where to review outcomes</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
              <li>Use <span className="font-medium">Failed AI Approval</span> for technical failure cases and reruns.</li>
              <li>Use <span className="font-medium">Product Price Compare</span> for non-blocking price outlier recommendations.</li>
              <li>Use the Switchboard evaluation report for immediate per-product/per-account diagnostics.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
