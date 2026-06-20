import Link from 'next/link';
import { Button, Card, PageHeader } from '@easybookshelf/ui';
import { AdminAuthGate } from '@/components/admin-auth-gate';

const adminSections = [
  { title: 'Users', description: 'Manage accounts, roles, and suspensions', href: '/users' },
  {
    title: 'Commission',
    description: 'Purchase/rental commission and member discount',
    href: '/commission',
  },
  {
    title: 'Settlements',
    description: 'Generate and pay publisher earnings',
    href: '/settlements',
  },
  {
    title: 'Subscriptions',
    description: 'Ad-free plans — default ₹30/mo, ₹300/yr',
    href: '/subscriptions',
  },
  {
    title: 'Book approvals',
    description: 'Review and approve publisher submissions',
    href: '/books',
  },
];

export default function AdminHomePage() {
  return (
    <AdminAuthGate>
      <PageHeader
        title="Platform administration"
        description="Manage pricing, commission rates, subscriptions, content approvals, and revenue."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {adminSections.map((section) => (
          <Card key={section.title}>
            <h2 className="font-serif text-lg font-semibold">{section.title}</h2>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
              {section.description}
            </p>
            <Link href={section.href}>
              <Button variant="ghost" className="mt-4">
                Manage
              </Button>
            </Link>
          </Card>
        ))}
      </div>
    </AdminAuthGate>
  );
}
