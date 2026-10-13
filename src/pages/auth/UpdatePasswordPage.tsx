import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  Lock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound
} from "lucide-react";

export const UpdatePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isInitializing, setIsInitializing] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initRecoverySession() {
      try {
        setIsInitializing(true);
        setErrorMessage(null);

        // 1. Check for PKCE authorization code in URL query params
        const code = searchParams.get("code");
        if (code) {
          console.debug("[UpdatePassword] Exchanging PKCE code for session...");
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.warn("[UpdatePassword] PKCE code exchange failed:", error.message);
            if (isMounted) {
              setHasValidSession(false);
              setErrorMessage("The password reset link is invalid or has expired. Please request a new link.");
              setIsInitializing(false);
            }
            return;
          }
          if (data?.session && isMounted) {
            console.debug("[UpdatePassword] PKCE session established successfully.");
            setHasValidSession(true);
            setIsInitializing(false);
            return;
          }
        }

        // 2. Check existing session from URL hash tokens or active recovery session
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) {
          console.warn("[UpdatePassword] getSession error:", sessionErr.message);
        }

        if (sessionData?.session?.user) {
          if (isMounted) {
            console.debug("[UpdatePassword] Active session found for password reset.");
            setHasValidSession(true);
            setIsInitializing(false);
          }
          return;
        }

        // 3. Listen for onAuthStateChange (e.g. hash token processing)
        const {
          data: { subscription }
        } = supabase.auth.onAuthStateChange((event, session) => {
          console.debug("[UpdatePassword] onAuthStateChange event:", event);
          if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session?.user) {
            if (isMounted) {
              setHasValidSession(true);
              setIsInitializing(false);
            }
          }
        });

        // Give Supabase a short window to parse hash tokens if present
        const timer = setTimeout(async () => {
          if (isMounted) {
            const { data: delayedSession } = await supabase.auth.getSession();
            if (delayedSession?.session?.user) {
              setHasValidSession(true);
            } else if (!hasValidSession) {
              setHasValidSession(false);
            }
            setIsInitializing(false);
          }
        }, 1200);

        return () => {
          subscription.unsubscribe();
          clearTimeout(timer);
        };
      } catch (err: any) {
        console.error("[UpdatePassword] Session initialization error:", err);
        if (isMounted) {
          setHasValidSession(false);
          setErrorMessage(err?.message || "Failed to initialize password recovery session.");
          setIsInitializing(false);
        }
      }
    }

    initRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  // Handle automatic redirect countdown after success
  useEffect(() => {
    if (redirectCountdown === null) return;
    if (redirectCountdown <= 0) {
      navigate("/login", { replace: true });
      return;
    }
    const timer = setTimeout(() => {
      setRedirectCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [redirectCountdown, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    const cleanPassword = password.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanPassword) {
      setErrorMessage("Please enter a new password.");
      return;
    }

    if (cleanPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    if (cleanPassword !== cleanConfirm) {
      setErrorMessage("Passwords do not match. Please verify both fields.");
      return;
    }

    try {
      setIsSubmitting(true);

      const { data, error } = await supabase.auth.updateUser({
        password: cleanPassword
      });

      if (error) {
        console.error("[UpdatePassword] updateUser error:", error);
        setErrorMessage(error.message || "Failed to update password. Please try again.");
        return;
      }

      console.debug("[UpdatePassword] Password successfully updated:", data?.user?.id);
      setSuccessMessage("Password updated successfully! You can now sign in with your new password.");

      // Cleanly sign out of the recovery session so user enters credentials fresh
      try {
        await supabase.auth.signOut();
      } catch (signOutErr) {
        console.warn("[UpdatePassword] Post-reset signOut warning:", signOutErr);
      }

      // Clear local auth tokens
      localStorage.removeItem("warehouse_os_user_id");
      localStorage.removeItem("warehouse_os_supabase_uid");

      // Start countdown to redirect
      setRedirectCountdown(3);
    } catch (err: any) {
      console.error("[UpdatePassword] Submit unexpected error:", err);
      setErrorMessage(err?.message || "An unexpected error occurred while updating your password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="w-full max-w-md space-y-6">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white text-2xl mx-auto shadow-lg shadow-indigo-950/60">
            W
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Warevo</h1>
          <p className="text-xs text-slate-400">
            Multi-Tenant Warehouse Management & Supply Operations
          </p>
        </div>

        {/* Main Card */}
        <Card className="p-6">
          {isInitializing ? (
            <div className="py-8">
              <LoadingSpinner message="Verifying recovery session..." />
            </div>
          ) : successMessage ? (
            <div className="space-y-5 text-center py-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-950/40">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-white tracking-tight">Password Reset Complete</h2>
                <p className="text-xs text-slate-300">{successMessage}</p>
                {redirectCountdown !== null && (
                  <p className="text-[11px] text-slate-500 mt-2 font-mono">
                    Redirecting to login in {redirectCountdown}s...
                  </p>
                )}
              </div>
              <Button
                type="button"
                onClick={() => navigate("/login", { replace: true })}
                className="w-full mt-2"
              >
                Go to Sign In
              </Button>
            </div>
          ) : !hasValidSession ? (
            <div className="space-y-5 text-center py-2">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-950/40">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-white tracking-tight">Invalid or Expired Link</h2>
                <p className="text-xs text-slate-300">
                  {errorMessage ||
                    "This password reset link is invalid, has already been used, or has expired."}
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  For security reasons, reset links can only be used once within their active validity period.
                </p>
              </div>
              <div className="pt-2 space-y-2">
                <Link to="/login">
                  <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="text-base font-semibold text-white">Create New Password</h2>
                  <p className="text-xs text-slate-400">
                    Enter your new secure password below to regain access.
                  </p>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* New Password */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter at least 8 characters"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                    autoFocus
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 space-y-0.5 pt-1">
                <p>• Must be at least 8 characters long</p>
                <p>• Both password fields must match exactly</p>
              </div>

              <Button type="submit" isLoading={isSubmitting} className="w-full mt-2">
                <Lock className="w-4 h-4 mr-1.5" />
                Update Password
              </Button>

              <div className="pt-2 text-center">
                <Link
                  to="/login"
                  className="text-xs text-slate-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};

export default UpdatePasswordPage;
