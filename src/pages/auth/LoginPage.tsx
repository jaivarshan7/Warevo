import React, { useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth, AuthErrorType } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ArrowRight, ArrowLeft, AlertTriangle, ShieldAlert, CheckCircle2, KeyRound } from "lucide-react";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { config } from "@/lib/config";
import { sendPasswordResetEmail } from "@/lib/services";

export const LoginPage: React.FC = () => {
  const { user, isLoading: authLoading, allUsers, switchUser, signInWithEmailAndPassword, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<AuthErrorType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [googleRedirecting, setGoogleRedirecting] = useState(false);

  // Forgot Password Modal State
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const from =
    (location.state?.from?.pathname
      ? `${location.state.from.pathname}${location.state.from.search || ""}`
      : searchParams.get("redirect")) || "/dashboard";

  // If already authenticated and active, go straight to destination
  React.useEffect(() => {
    if (!authLoading && user && user.status === "ACTIVE" && user.clientEmployee?.status !== "INACTIVE") {
      navigate(from, { replace: true });
    }
  }, [authLoading, user, navigate, from]);

  // If landing on /login with password recovery parameters or hash, forward to /auth/update-password
  React.useEffect(() => {
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    if (hash.includes("type=recovery") || search.includes("type=recovery")) {
      navigate(`/auth/update-password${search}${hash}`, { replace: true });
    }
  }, [navigate]);

  // Check URL parameters or navigation state for auth errors (e.g. from OAuth callback or route guards)
  React.useEffect(() => {
    const errorParam = searchParams.get("error");
    const stateErrorType = location.state?.errorType as AuthErrorType | undefined;

    if (errorParam === "inactive" || stateErrorType === "ACCOUNT_INACTIVE") {
      setErrorType("ACCOUNT_INACTIVE");
      setError(null);
    } else if (errorParam === "not_registered" || stateErrorType === "NOT_REGISTERED") {
      setErrorType("NOT_REGISTERED");
      setError(null);
    }
  }, [searchParams, location.state]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setErrorType(null);

    const res = await signInWithEmailAndPassword(email, password);
    setIsLoading(false);

    if (res.error) {
      if (res.errorType === "ACCOUNT_INACTIVE") {
        setErrorType("ACCOUNT_INACTIVE");
        setError(null);
      } else if (res.errorType === "NOT_REGISTERED") {
        setErrorType("NOT_REGISTERED");
        setError(null);
      } else {
        setErrorType("INVALID_CREDENTIALS");
        setError("Invalid email or password.");
      }
    } else {
      navigate(from, { replace: true });
    }
  };

  const handleResetToLogin = () => {
    setErrorType(null);
    setError(null);
    setPassword("");
    navigate("/login", { replace: true, state: {} });
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setErrorType(null);
    setGoogleRedirecting(true);
    localStorage.removeItem("warehouse_os_logged_out");
    // signInWithOAuth triggers a browser redirect to Google — the browser
    // navigates away from this page. We only get an error back if the redirect
    // itself fails to initiate (e.g. misconfigured provider).
    const res = await signInWithGoogle();
    if (res.error) {
      // Redirect failed to start — show error
      setGoogleRedirecting(false);
      setError(res.error.message || "Unable to sign in with Google. Please try again.");
    }
    // If no error, the browser has already navigated to Google — do nothing.
  };

  const handleQuickLogin = async (userId: string) => {
    try {
      await switchUser(userId);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Failed to switch user");
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    setResetError(null);
    setResetSuccess(null);
    try {
      await sendPasswordResetEmail(resetEmail.trim());
      setResetSuccess(
        `A password recovery link has been sent to ${resetEmail.trim()}. Please check your inbox and click the link to reset your password.`
      );
    } catch (err: any) {
      console.error("Forgot password error:", err);
      setResetError(err?.message || "Failed to send reset email. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };


  const sortedDemoUsers = React.useMemo(() => {
    const priority: Record<string, number> = {
      PLATFORM_ADMIN: 1,
      WAREHOUSE_OWNER: 2,
      WAREHOUSE_MODERATOR: 3,
      ACCOUNTANT: 4,
      ACCOUNTS_TEAM: 5,
      WAREHOUSE_STAFF: 6,
      CLIENT: 7,
      CLIENT_ACCOUNTANT: 8
    };
    return [...allUsers].sort(
      (a, b) => (priority[a.role] || 99) - (priority[b.role] || 99)
    ).slice(0, 8);
  }, [allUsers]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="w-full max-w-md space-y-6">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white text-2xl mx-auto shadow-lg shadow-indigo-950/60">
            W
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Warevo
          </h1>
          <p className="text-xs text-slate-400">
            Multi-Tenant Warehouse Management & Supply Operations
          </p>
        </div>

        {/* Login Card */}
        <Card className="p-6">
          {errorType === "ACCOUNT_INACTIVE" ? (
            <div className="space-y-5 text-center py-2">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-950/40">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-white tracking-tight">Account Inactive</h2>
                <p className="text-sm font-medium text-slate-300">
                  Your account is currently inactive.
                </p>
                <p className="text-xs text-slate-400">
                  Please contact your administrator.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleResetToLogin}
                className="w-full flex items-center justify-center gap-2 border-slate-700 hover:bg-slate-800 text-slate-200 mt-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Button>
            </div>
          ) : errorType === "NOT_REGISTERED" ? (
            <div className="space-y-5 text-center py-2">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400 shadow-lg shadow-rose-950/40">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-white tracking-tight">Account Not Registered</h2>
                <p className="text-sm font-medium text-slate-300">
                  Your account is not registered in the WMS.
                </p>
                <p className="text-xs text-slate-400">
                  Please contact your administrator.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleResetToLogin}
                className="w-full flex items-center justify-center gap-2 border-slate-700 hover:bg-slate-800 text-slate-200 mt-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Button>
            </div>
          ) : (
            <>
              <form onSubmit={handleEmailLogin} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(email || "");
                        setResetSuccess(null);
                        setResetError(null);
                        setIsForgotOpen(true);
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                <Button type="submit" className="w-full" isLoading={isLoading}>
                  Sign In with Email
                </Button>
              </form>

              {/* Google Sign-In */}
              <div className="mt-4 pt-4 border-t border-slate-800/60">
                <div className="text-center mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Or Continue with
                  </span>
                </div>

                <Button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 hover:bg-slate-700 hover:text-indigo-400 font-medium text-sm transition-colors"
                  disabled={isLoading || googleRedirecting}
                  isLoading={googleRedirecting}
                >
                  {!googleRedirecting && <GoogleIcon className="w-4 h-4" />}
                  {googleRedirecting ? "Redirecting to Google..." : "Continue with Google"}
                </Button>
              </div>

              {/* Quick Demo Switcher - only in development */}
              {config.showDemoFeatures && (
                <div className="mt-6 pt-6 border-t border-slate-800">
                  <div className="text-center mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Or Instant Demo Sign-In
                    </span>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {sortedDemoUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => handleQuickLogin(u.id)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors group"
                      >
                        <div className="truncate pr-2">
                          <p className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors">
                            {u.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            <span className={u.role === "PLATFORM_ADMIN" ? "text-rose-400 font-semibold" : ""}>
                              {u.role.replace(/_/g, " ")}
                            </span>
                            {" "}• {u.tenant?.name || "Apex Warehousing"}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Forgot Password Modal */}
        {isForgotOpen && (
          <Modal
            isOpen={isForgotOpen}
            onClose={() => setIsForgotOpen(false)}
            title="Reset Password"
            description="Enter your registered email address and we'll send you a link to reset your password."
          >
            {resetSuccess ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                  <div className="space-y-1">
                    <p className="font-semibold text-emerald-200">Reset Email Sent</p>
                    <p>{resetSuccess}</p>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setIsForgotOpen(false);
                      setResetSuccess(null);
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 pt-1">
                {resetError && (
                  <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <span>{resetError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Account Email Address
                  </label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                    autoFocus
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsForgotOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={resetLoading}>
                    <KeyRound className="w-4 h-4 mr-1.5" />
                    Send Reset Link
                  </Button>
                </div>
              </form>
            )}
          </Modal>
        )}
      </div>
    </div>
  );
};
