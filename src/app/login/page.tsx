import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import type { OAuthProvider } from "@/core/oauth";

const allProviders: OAuthProvider[] = ["github", "google", "gitlab"];

function getAvailableProviders(): OAuthProvider[] {
  return allProviders.filter(
    (p) => !!process.env[`OAUTH_${p.toUpperCase()}_CLIENT_ID`],
  );
}

export default function LoginPage() {
  const availableProviders = getAvailableProviders();

  return (
    <Suspense>
      <LoginForm availableProviders={availableProviders} />
    </Suspense>
  );
}
