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
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-10 sm:px-8 sm:py-14">
        <header className="flex flex-col gap-3 border-b border-border pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
            public compliance document
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl">
            Proof of SMS consent
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            This page documents how delta collects consent for transactional SMS
            reminders sent through Twilio.
          </p>
        </header>

        <section className="grid gap-px border border-border bg-border sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label} className="bg-background px-4 py-4">
              <dt className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70">
                {label}
              </dt>
              <dd className="mt-2 text-sm text-foreground">{value}</dd>
            </div>
          ))}
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr]">
          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-4">
              <h2 className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                How consent is collected
              </h2>
              <ol className="flex flex-col gap-3 text-sm text-foreground">
                {consentSteps.map((step, index) => (
                  <li
                    key={step}
                    className="flex gap-3 border border-border px-4 py-3"
                  >
                    <span className="text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                What users agree to receive
              </h2>
              <ul className="flex flex-col gap-3 text-sm text-foreground">
                {reminderRules.map((rule) => (
                  <li key={rule} className="border border-border px-4 py-3">
                    {rule}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-4">
              <h2 className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                Sample message
              </h2>
              <div className="border border-border px-4 py-4">
                <p className="text-sm text-foreground">{sampleMessage}</p>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                Opt-out and account control
              </h2>
              <ul className="flex flex-col gap-3 text-sm text-foreground">
                {optOutOptions.map((option) => (
                  <li key={option} className="border border-border px-4 py-3">
                    {option}
                  </li>
                ))}
              </ul>
            </section>

            <section className="border border-border px-4 py-4 text-sm text-muted-foreground">
              delta is a self-hosted productivity application. SMS reminders are
              initiated only after a user configures their own phone number and
              reminder rules inside the authenticated app.
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
