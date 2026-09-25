import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useAuth, normalizeUser } from "@/contexts/AuthContext";

/**
 * AuthCallbackPage — handles the OAuth redirect from Supabase/Google.
 *
 * Flow:
 *   Google → Supabase → /auth/callback (this page)
 *     → getSession() to confirm Supabase auth session
 *     → query WMS User by supabaseUserId
 *     → if unlinked, attempt rpc_link_auth_user_by_email
 *     → ACTIVE user found  → setAuthenticatedUser → /dashboard
 *     → No user found       → NOT_REGISTERED → sign out → /login?error=not_registered
 *     → INACTIVE user found → ACCOUNT_INACTIVE → sign out → /login?error=inactive
 *     → Query/link error    → real error state on page (NOT Account Inactive)
 */
export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, setAuthenticatedUser } = useAuth();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorDetail, setErrorDetail] = useState<string>("");
  const [pendingTargetUserId, setPendingTargetUserId] = useState<string | null>(null);

  // Monitor AuthContext state update confirmation before navigating to /dashboard
  useEffect(() => {
    if (pendingTargetUserId && user && user.id === pendingTargetUserId) {
      console.debug("[GoogleOAuth] navigating dashboard");
      navigate("/dashboard", { replace: true });
    }
  }, [pendingTargetUserId, user, navigate]);

  useEffect(() => {
    let cancelled = false;

    console.debug("[GoogleOAuth] callback mounted");
    localStorage.removeItem("warehouse_os_logged_out");

    async function resolveGoogleUser() {
      try {
        // 1. Obtain authenticated Supabase user
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (cancelled) return;

        const sessionExists = Boolean(sessionData?.session?.user);
        console.debug("[GoogleOAuth] session exists:", sessionExists);

        // State A: Supabase authentication failed
        if (sessionError || !sessionData?.session?.user) {
          console.error("[GoogleOAuth] Supabase session error:", sessionError);
          if (!sessionData?.session?.user && !sessionError) {
            navigate("/login", { replace: true });
            return;
          }
          setErrorMessage("Authentication failed. Please try signing in again.");
          setErrorDetail(sessionError?.message || "No valid session found.");
          setStatus("error");
          return;
        }

        const authUser = sessionData.session.user;
        const authUserId = authUser.id;
        const authEmail = authUser.email;

        console.debug("[GoogleOAuth] auth user id:", authUserId);
        console.debug("[GoogleOAuth] auth email:", authEmail);

        // 2. Authoritative lookup by supabaseUserId
        const { data: wmsUsers, error: usersError } = await supabase
          .from("User")
          .select("*, supabaseUserId, tenant:Tenant(*), clientEmployee:ClientEmployee(*, client:Client(*))")
          .eq("supabaseUserId", authUserId)
          .limit(1);

        if (cancelled) return;

        // State B: WMS User lookup returned an actual database/query error
        if (usersError) {
          console.error("[GoogleOAuth] WMS lookup error:", usersError);
          await supabase.auth.signOut();
          setErrorMessage("Unable to verify your warehouse management account.");
          setErrorDetail(usersError.message);
          setStatus("error");
          return;
        }

        let rawUser = wmsUsers?.[0] as any;

        // 3. If no WMS User is linked by supabaseUserId, attempt secure linkage by email
        if (!rawUser && authEmail) {
          console.debug("[GoogleOAuth] Attempting account linkage for email:", authEmail);
          const { data: linkData, error: linkError } = await supabase.rpc(
            "rpc_link_auth_user_by_email",
            {
              p_auth_user_id: authUserId,
              p_email: authEmail,
            }
          );

          if (cancelled) return;

          if (linkError || !linkData?.success) {
            console.warn("[GoogleOAuth] Account linkage failed:", linkError?.message || linkData);
            const errMsg = linkError?.message || "";

            // Check if failure is due to inactive status
            if (errMsg.toLowerCase().includes("inactive")) {
              console.debug("[GoogleOAuth] WMS user status: INACTIVE (from RPC)");
              await supabase.auth.signOut();
              localStorage.removeItem("warehouse_os_user_id");
              localStorage.removeItem("warehouse_os_supabase_uid");
              localStorage.setItem("warehouse_os_logged_out", "true");
              navigate("/login?error=inactive", {
                replace: true,
                state: {
                  errorType: "ACCOUNT_INACTIVE",
                  errorMessage: "Your account is inactive. Please contact your administrator."
                }
              });
              return;
            }

            // Check if failure is due to user not existing
            if (errMsg.toLowerCase().includes("no wms user found")) {
              console.debug("[GoogleOAuth] WMS user found: false");
              await supabase.auth.signOut();
              localStorage.removeItem("warehouse_os_user_id");
              localStorage.removeItem("warehouse_os_supabase_uid");
              localStorage.setItem("warehouse_os_logged_out", "true");
              navigate("/login?error=not_registered", {
                replace: true,
                state: {
                  errorType: "NOT_REGISTERED",
                  errorMessage: "Your account is not registered in the WMS. Please contact your administrator."
                }
              });
              return;
            }

            // Other error -> State B: database / bootstrap error (NOT Account Inactive)
            await supabase.auth.signOut();
            setErrorMessage("Account linkage failed. Please contact your administrator.");
            setErrorDetail(errMsg || "An unexpected error occurred during account linkage.");
            setStatus("error");
            return;
          }

          // Re-query WMS User now that supabaseUserId is linked
          const { data: linkedUsers, error: linkedQueryError } = await supabase
            .from("User")
            .select("*, supabaseUserId, tenant:Tenant(*), clientEmployee:ClientEmployee(*, client:Client(*))")
            .eq("supabaseUserId", authUserId)
            .limit(1);

          if (cancelled) return;

          if (linkedQueryError) {
            console.error("[GoogleOAuth] Re-query after linkage error:", linkedQueryError);
            await supabase.auth.signOut();
            setErrorMessage("Failed to load user profile after linkage.");
            setErrorDetail(linkedQueryError.message);
            setStatus("error");
            return;
          }

          rawUser = linkedUsers?.[0];
        }

        // Normalize rawUser
        const wmsUser = rawUser ? normalizeUser(rawUser) : null;
        console.debug("[GoogleOAuth] WMS user found:", Boolean(wmsUser));

        // State C: WMS User does not exist
        if (!wmsUser) {
          await supabase.auth.signOut();
          localStorage.removeItem("warehouse_os_user_id");
          localStorage.removeItem("warehouse_os_supabase_uid");
          localStorage.setItem("warehouse_os_logged_out", "true");
          navigate("/login?error=not_registered", {
            replace: true,
            state: {
              errorType: "NOT_REGISTERED",
              errorMessage: "Your account is not registered in the WMS. Please contact your administrator."
            }
          });
          return;
        }

        console.debug("[GoogleOAuth] WMS user status:", wmsUser.status);

        // State D: WMS User exists and User.status === INACTIVE
        if (wmsUser.status === "INACTIVE") {
          await supabase.auth.signOut();
          localStorage.removeItem("warehouse_os_user_id");
          localStorage.removeItem("warehouse_os_supabase_uid");
          localStorage.setItem("warehouse_os_logged_out", "true");
          navigate("/login?error=inactive", {
            replace: true,
            state: {
              errorType: "ACCOUNT_INACTIVE",
              errorMessage: "Your account is inactive. Please contact your administrator."
            }
          });
          return;
        }

        // State E: WMS User exists and User.status === ACTIVE
        // If there is a ClientEmployee:
        if (wmsUser.clientEmployee && wmsUser.clientEmployee.status === "INACTIVE") {
          console.debug("[GoogleOAuth] ClientEmployee status: INACTIVE");
          await supabase.auth.signOut();
          localStorage.removeItem("warehouse_os_user_id");
          localStorage.removeItem("warehouse_os_supabase_uid");
          localStorage.setItem("warehouse_os_logged_out", "true");
          navigate("/login?error=inactive", {
            replace: true,
            state: {
              errorType: "ACCOUNT_INACTIVE",
              errorMessage: "Your account is inactive. Please contact your administrator."
            }
          });
          return;
        }

        // Active user (warehouse user without ClientEmployee OR client user with active ClientEmployee)
        console.debug("[GoogleOAuth] calling setAuthenticatedUser");
        setAuthenticatedUser(wmsUser, wmsUser.tenant);
        setPendingTargetUserId(wmsUser.id);
      } catch (err: any) {
        if (cancelled) return;
        console.error("[GoogleOAuth] Unexpected error during resolution:", err);
        await supabase.auth.signOut();
        setErrorMessage("An unexpected authentication error occurred.");
        setErrorDetail(err?.message || String(err));
        setStatus("error");
      }
    }

    resolveGoogleUser();

    return () => {
      cancelled = true;
    };
  }, [navigate, setAuthenticatedUser]);

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
