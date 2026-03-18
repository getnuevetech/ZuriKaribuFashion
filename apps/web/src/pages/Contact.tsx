import { MessageCircle, Phone, Mail } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-gray-900">Contact Us</h1>
        <p className="mt-3 text-sm text-gray-600">
          Start a support chat, send us an email, or request a call-back from customer service.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border p-4">
            <MessageCircle className="h-5 w-5 text-amber-600" />
            <h2 className="mt-2 text-sm font-semibold text-gray-900">Live Chat</h2>
            <p className="mt-1 text-xs text-gray-600">
              Use the chat popup at the bottom-right to start a conversation and choose your language.
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <Mail className="h-5 w-5 text-amber-600" />
            <h2 className="mt-2 text-sm font-semibold text-gray-900">Email Support</h2>
            <p className="mt-1 text-xs text-gray-600">
              Reach our team by email. Incoming emails can be auto-converted into support tickets.
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <Phone className="h-5 w-5 text-amber-600" />
            <h2 className="mt-2 text-sm font-semibold text-gray-900">VoIP Callback</h2>
            <p className="mt-1 text-xs text-gray-600">
              Where available, support agents can connect with you via in-app VoIP.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
