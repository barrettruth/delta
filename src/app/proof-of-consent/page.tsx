import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Proof of SMS consent | delta",
  description:
    "Public documentation of delta's transactional SMS reminder opt-in flow.",
};

const consentSteps = [
  "The user signs in to delta and opens Settings → Integrations → reminders.",
  "The user chooses Twilio SMS and enters a phone number they control as a reminder endpoint.",
  "The user saves the endpoint inside the authenticated app before any SMS reminders can be sent.",
  "The user creates or enables task reminders, which determines whether any future transactional reminder messages are delivered.",
];

const reminderRules = [
  "delta sends transactional task reminders only. It does not send marketing campaigns or third-party list traffic.",
  "Recipients are numbers explicitly entered by the authenticated account holder inside their own settings.",
  "Message frequency depends on the reminders the user creates and may be zero in months where no reminders are scheduled.",
];

const optOutOptions = [
  "Reply STOP to opt out of future SMS messages.",
  "Reply START or UNSTOP to opt back in after a carrier-level stop.",
  "Delete or disable the SMS reminder endpoint in Settings → Integrations → reminders.",
];

const facts = [
  ["Product", "delta"],
  ["Channel", "Transactional SMS task reminders"],
  ["Opt-in type", "Authenticated web form"],
  ["Audience", "Users who explicitly add their own phone number"],
];

const sampleMessage =
  'delta reminder: "Pay rent" is due tomorrow at 9:00 AM. Reply STOP to opt out.';

export default function ProofOfConsentPage() {
  return (
    <main className="min-h-dvh bg-stone-50 text-neutral-900">
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-14 sm:px-10 sm:py-20">
        <header className="flex flex-col items-center gap-4 border-b border-neutral-300/80 pb-10 text-center">
          <p className="text-[11px] uppercase tracking-[0.24em] text-neutral-500">
            delta · public compliance document
          </p>
          <h1 className="max-w-2xl font-serif text-4xl leading-tight sm:text-5xl">
            Proof of SMS consent
          </h1>
          <p className="max-w-2xl font-serif text-lg leading-8 text-neutral-700">
            This page documents how delta collects consent for transactional SMS
            reminders sent through Twilio.
          </p>
        </header>

        <section className="space-y-5">
          <h2 className="text-sm uppercase tracking-[0.2em] text-neutral-500">
            Service overview
          </h2>
          <dl className="space-y-4 border-y border-neutral-300/80 py-6">
            {facts.map(([label, value]) => (
              <div
                key={label}
                className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-6"
              >
                <dt className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                  {label}
                </dt>
                <dd className="font-serif text-lg leading-8 text-neutral-800">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="space-y-5">
          <h2 className="text-sm uppercase tracking-[0.2em] text-neutral-500">
            How consent is collected
          </h2>
          <ol className="space-y-5">
            {consentSteps.map((step, index) => (
              <li key={step} className="grid gap-2 sm:grid-cols-[3rem_1fr]">
                <span className="font-serif text-2xl text-neutral-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="font-serif text-lg leading-8 text-neutral-800">
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-5">
          <h2 className="text-sm uppercase tracking-[0.2em] text-neutral-500">
            What users agree to receive
          </h2>
          <ul className="space-y-4">
            {reminderRules.map((rule) => (
              <li
                key={rule}
                className="font-serif text-lg leading-8 text-neutral-800"
              >
                {rule}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-5">
          <h2 className="text-sm uppercase tracking-[0.2em] text-neutral-500">
            Sample message
          </h2>
          <blockquote className="border-l border-neutral-300 pl-6 font-serif text-lg leading-8 text-neutral-800 italic">
            {sampleMessage}
          </blockquote>
        </section>

        <section className="space-y-5">
          <h2 className="text-sm uppercase tracking-[0.2em] text-neutral-500">
            Opt-out and account control
          </h2>
          <ul className="space-y-4">
            {optOutOptions.map((option) => (
              <li
                key={option}
                className="font-serif text-lg leading-8 text-neutral-800"
              >
                {option}
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-neutral-300/80 pt-8 text-center">
          <p className="font-serif text-lg leading-8 text-neutral-700">
            delta is a self-hosted productivity application. SMS reminders are
            initiated only after a user configures their own phone number and
            reminder rules inside the authenticated app.
          </p>
        </section>
      </article>
    </main>
  );
}
