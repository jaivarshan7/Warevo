import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

/**
 * AuthCallbackPage — handles the OAuth redirect from Supabase/Google.
 *
 * Flow:
 *   Google → Supabase → /auth/callback (this page)
 *     → getSession() to confirm Supabase auth session
 *     → query WMS User by authenticated email
 *     → ACTIVE user found  → save userId to localStorage → /dashboard
 *     → No user found       → show "no WMS account" error → sign out
 *     → INACTIVE user found → show "account inactive" error → sign out
 *
 * AuthContext's onAuthStateChange listener picks up the session
 * and sets the WMS user independently; this page handles the
 * redirect and user-facing error messages.
 */
export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorDetail, setErrorDetail] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function resolveGoogleUser() {
      try {
        // 1. Wait for Supabase to process the OAuth callback tokens from the URL.
        //    detectSessionInUrl:true means supabase-js already parsed the tokens;
        //    getSession() returns the current session.
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (cancelled) return;

        if (sessionError) {
          console.error("[AuthCallback] Session error:", sessionError);
          setErrorMessage("Authentication failed. Please try again.");
          setErrorDetail(sessionError.message);
          setStatus("error");
          return;
        }

        const authUser = sessionData?.session?.user;

        if (!authUser) {
          // No Supabase session — likely the user navigated here directly
          console.warn("[AuthCallback] No Supabase session found after OAuth redirect.");
          navigate("/login", { replace: true });
          return;
        }

        // 2. Resolve the authenticated user ID (source of truth from Supabase Auth)
        const authUserId = authUser.id;

        if (!authUserId) {
          await supabase.auth.signOut();
          setErrorMessage("Could not determine your authenticated user ID.");
          setErrorDetail("Authentication failed to provide a valid user ID.");
          setStatus("error");
          return;
        }

        // 3. Look up the WMS User by supabaseUserId
        const { data: wmsUsers, error: usersError } = await supabase
          .from("User")
          .select("id, name, email, role, status, tenantId, supabaseUserId, tenant:Tenant(*), client:Client(*)")
          .eq("supabaseUserId", authUserId)
          .limit(1);

        if (cancelled) return;

        if (usersError) {
          console.error("[AuthCallback] User lookup error:", usersError);
          await supabase.auth.signOut();
          setErrorMessage("Failed to look up your WMS account. Please try again.");
          setErrorDetail(usersError.message);
          setStatus("error");
          return;
        }

        const wmsUser = wmsUsers?.[0] as any;
        // Supabase may return the client relation as an array; normalize to single object or null
        if (wmsUser && Array.isArray(wmsUser.client)) {
          wmsUser.client = wmsUser.client[0] || null;
        }

        // 4a. No matching WMS user
        if (!wmsUser) {
          console.warn("[AuthCallback] No WMS user found for supabaseUserId:", authUserId);
          await supabase.auth.signOut();
          setErrorMessage("No WMS account is associated with this authenticated account.");
          setErrorDetail(
            `The authenticated account (${authUser.email}) is not registered in this WMS. ` +
            "Please contact your administrator."
          );
          setStatus("error");
          return;
        }

        // 4b. Inactive WMS user
        if (wmsUser.status !== "ACTIVE") {
          console.warn("[AuthCallback] WMS user is inactive:", wmsUser.id);
          await supabase.auth.signOut();
          setErrorMessage("Your WMS account is inactive.");
          setErrorDetail(
            "Your account has been deactivated. Please contact your administrator."
          );
          setStatus("error");
          return;
        }

        // 4c. Verify this is a CLIENT user with a linked Client record
        //    (required for Google Sign-In and email/mobile login as a client employee)
        if (wmsUser.role !== "CLIENT") {
          console.warn("[AuthCallback] WMS user is not a CLIENT role:", wmsUser.id, wmsUser.role);
          await supabase.auth.signOut();
          setErrorMessage("Access denied. This Google account is associated with a " +
            "non-client WMS role. Please contact your administrator.");
          setErrorDetail(
            "The authenticated Google account does not have the CLIENT role required " +
            "for client employee access. Only users with role=CLIENT can sign in with Google."
          );
          setStatus("error");
          return;
        }

        // Verify the user has a linked Client record with employeeRole
        if (!wmsUser.client || !wmsUser.client.id || !wmsUser.client.employeeRole) {
          console.warn("[AuthCallback] CLIENT user missing linked Client record:", wmsUser.id);
          await supabase.auth.signOut();
          setErrorMessage("Access denied. Your WMS user is missing a linked Client record.");
          setErrorDetail(
            "Your WMS user account has role=CLIENT but is not linked to a Client company. " +
            "Please contact your administrator to complete the client employee setup."
          );
          setStatus("error");
          return;
        }

        // 5. Valid, active WMS user — persist their WMS userId so AuthContext can pick it up
        // IMPORTANT: Update User.supabaseUserId to link the WMS User record to the Supabase Auth account.
        // This is required for Storage RLS policies that validate auth.uid() against User.supabaseUserId.
        if (wmsUser.supabaseUserId !== authUser.id) {
          const { error: updateError } = await supabase
            .from("User")
            .update({ supabaseUserId: authUser.id })
            .eq("id", wmsUser.id);
          
          if (updateError) {
            console.warn("[AuthCallback] Failed to update User.supabaseUserId:", updateError);
            // Continue anyway - this is a best-effort update for Storage RLS compatibility
          } else {
            console.info("[AuthCallback] Updated User.supabaseUserId:", authUser.id);
          }
        }
        
        localStorage.removeItem("warehouse_os_logged_out");
        localStorage.setItem("warehouse_os_user_id", wmsUser.id);
        // Also store the supabase auth user id for future session checks
        localStorage.setItem("warehouse_os_supabase_uid", authUser.id);

        console.info(
          `[AuthCallback] Google login success: ${wmsUser.name} (${wmsUser.role})`
        );

        // Navigate to dashboard — AppShell / AuthContext will finalize user state
        if (!cancelled) {
          navigate("/dashboard", { replace: true });
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[AuthCallback] Unexpected error:", err);
        await supabase.auth.signOut();
        setErrorMessage("An unexpected error occurred during sign-in.");
        setErrorDetail(String(err));
        setStatus("error");
      }
    }

    resolveGoogleUser();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("warehouse_os_user_id");
    localStorage.removeItem("warehouse_os_supabase_uid");
    localStorage.setItem("warehouse_os_logged_out", "true");
    navigate("/login", { replace: true });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <LoadingSpinner message="Verifying your Google account with WMS..." />
        <p className="mt-4 text-xs text-slate-500">
          This will only take a moment.
        </p>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-rose-900/40 border border-rose-700/60 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-rose-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
          </div>
        </div>

        {/* Error Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-lg font-bold text-white">Access Denied</h1>
            <p className="text-sm font-medium text-rose-300">{errorMessage}</p>
          </div>

          {errorDetail && (
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <p className="text-xs text-slate-400 leading-relaxed">{errorDetail}</p>
            </div>
          )}

          <div className="text-center">
            <p className="text-xs text-slate-500 mb-4">
              If you believe this is a mistake, please contact your warehouse administrator.
            </p>
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
