import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type AuthStatus = "loading" | "signed-out" | "signed-in";

export function AdminAccess() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) setStatus(data.session ? "signed-in" : "signed-out");
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setStatus(session ? "signed-in" : "signed-out");
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError("Sign-in failed. Check your Cloud email and password.");
      setBusy(false);
      return;
    }

    setPassword("");
    setOpen(false);
    setBusy(false);
    await navigate({ to: "/admin" });
  };

  if (status === "loading") return null;

  if (status === "signed-in") {
    return (
      <Button asChild variant="outline" size="sm" className="border-border/70 bg-background/80 backdrop-blur">
        <Link to="/admin">
          <ShieldCheck aria-hidden="true" />
          Admin
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className="border-border/70 bg-background/80 backdrop-blur"
      >
        <ShieldCheck aria-hidden="true" />
        Admin login
      </Button>

      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-login-title"
            className="w-full max-w-sm border border-border bg-card p-5 text-card-foreground shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mono-hud text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  Protected console
                </p>
                <h2 id="admin-login-title" className="mt-2 text-xl font-medium">
                  Admin login
                </h2>
              </div>
              <Button
                type="button"
                aria-label="Close admin login"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
              >
                <X aria-hidden="true" />
              </Button>
            </div>

            <form onSubmit={signIn} className="mt-5 space-y-4">
              <label className="block text-sm">
                <span className="mb-1.5 block text-muted-foreground">Cloud email</span>
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-10 w-full border border-input bg-background px-3 text-foreground outline-none ring-offset-background focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-muted-foreground">Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-10 w-full border border-input bg-background px-3 text-foreground outline-none ring-offset-background focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Checking access…" : "Continue to admin"}
              </Button>
            </form>

            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Admin access uses Cloud authentication and a separate admin role. Credentials are never stored in the app.
            </p>
          </div>
        </div>
      )}
    </>
  );
}