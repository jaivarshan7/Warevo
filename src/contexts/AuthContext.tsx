import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { User, Tenant, Role } from "@/types";
import { supabase } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  role: Role;
  isLoading: boolean;
  allUsers: User[];
  allTenants: Tenant[];
  switchUser: (userId: string) => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export { AuthProvider };

// Normalizes User objects returned from Supabase where 1-to-1 reverse relations
// (like client:Client(*)) may be returned as single-element arrays by PostgREST.
export function normalizeUser(u: any): User {
  if (!u) return u;
  const rawClient = u.client;
  const client = Array.isArray(rawClient)
    ? (rawClient.length > 0 ? rawClient[0] : null)
    : (rawClient || null);
  const rawTenant = u.tenant;
  const tenant = Array.isArray(rawTenant)
    ? (rawTenant.length > 0 ? rawTenant[0] : null)
    : (rawTenant || null);

  return {
    ...u,
    client,
    clientId: client?.id || u.clientId || null,
    tenant,
    tenantId: u.tenantId || tenant?.id || null,
  };
}

// Refresh users from Supabase - returns the users list
export async function refreshUsersFromSupabase() {
  try {
    const { data: users } = await supabase
      .from("User")
      .select("*, tenant:Tenant(*), client:Client(*)");
    if (users && users.length > 0) {
      return (users as any[]).map(normalizeUser);
    }
    return [];
  } catch (err) {
    console.error("Failed to refresh users from Supabase:", err);
    return [];
  }
}

/**
 * Resolve a WMS User from an authenticated Supabase Auth email.
 * Returns the user (with tenant) if found and ACTIVE, or null otherwise.
 * Does NOT throw — callers should handle null.
 */
async function resolveWmsUserByEmail(
  email: string,
  allUsers: User[]
): Promise<User | null> {
  if (!email) return null;
  const normalizedEmail = email.trim().toLowerCase();

  // First check in-memory list (avoids extra DB round-trip)
  const inMemory = allUsers.find(
    (u) => u.email?.trim().toLowerCase() === normalizedEmail
  );
  if (inMemory) return normalizeUser(inMemory);

  // Fall back to DB lookup
  try {
    const { data } = await supabase
      .from("User")
      .select("*, tenant:Tenant(*), client:Client(*)")
      .ilike("email", normalizedEmail)
      .limit(1);
    return data?.[0] ? normalizeUser(data[0]) : null;
  } catch {
    return null;
  }
}

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);

  // Track whether we have performed the initial auth bootstrap
  const initialized = useRef(false);
  // Cache the loaded users/tenants for use inside the auth state change listener
  const allUsersRef = useRef<User[]>([]);
  const allTenantsRef = useRef<Tenant[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        setIsLoading(true);

        // ─── 1. Load all tenants ───────────────────────────────────────────
        const { data: tenants } = await supabase
          .from("Tenant")
          .select("*")
          .order("name", { ascending: true });

        const tenantList = (tenants as Tenant[]) || [];
        if (isMounted) {
          setAllTenants(tenantList);
          allTenantsRef.current = tenantList;
        }

        // ─── 2. Load all WMS users ─────────────────────────────────────────
        const { data: users } = await supabase
          .from("User")
          .select("*, tenant:Tenant(*), client:Client(*)");

        const userList = ((users as any[]) || []).map(normalizeUser);
        if (isMounted) {
          setAllUsers(userList);
          allUsersRef.current = userList;
        }

        // ─── 3. Check for an existing Supabase Auth session (OAuth return) ─
        //    detectSessionInUrl:true in supabase-js already exchanges the
        //    OAuth tokens in the URL; getSession() returns the live session.
        const { data: sessionData } = await supabase.auth.getSession();
        const supabaseSession = sessionData?.session;

        if (!isMounted) return;

        const isLoggedOut = localStorage.getItem("warehouse_os_logged_out") === "true";
        const savedWmsUserId = localStorage.getItem("warehouse_os_user_id");

        if (isLoggedOut) {
          // Explicit logout — honour it even if Supabase session exists
          setUser(null);
          setTenant(null);
        } else if (supabaseSession?.user?.email && userList.length > 0) {
          // ─── Case A: Returning from Google OAuth ─────────────────────────
          // Supabase session has a verified email — map to WMS user
          const authEmail = supabaseSession.user.email.trim().toLowerCase();
          const googleWmsUser = userList.find(
            (u) => u.email?.trim().toLowerCase() === authEmail
          );

          if (googleWmsUser && googleWmsUser.status === "ACTIVE") {
            // Persist WMS user id for future page loads
            localStorage.setItem("warehouse_os_user_id", googleWmsUser.id);
            localStorage.setItem(
              "warehouse_os_supabase_uid",
              supabaseSession.user.id
            );
            setUser(googleWmsUser);
            const userTenant = tenantList.find(
              (t) => t.id === googleWmsUser.tenantId
            );
            setTenant(userTenant || (googleWmsUser.tenant as Tenant) || null);
          } else if (savedWmsUserId) {
            // Fallback to localStorage WMS user if Google user is invalid
            const found = userList.find((u) => u.id === savedWmsUserId);
            if (found && found.status === "ACTIVE") {
              setUser(found);
              const userTenant =
                tenantList.find((t) => t.id === found.tenantId) ||
                (found.tenant as Tenant) ||
                null;
              setTenant(userTenant);
            }
          } else {
            // Google session but no matching WMS user — don't auto-login
            setUser(null);
            setTenant(null);
          }
        } else if (savedWmsUserId && userList.length > 0) {
          // ─── Case B: Standard session resume from localStorage ───────────
          const found = userList.find((u) => u.id === savedWmsUserId);
          if (found && found.status === "ACTIVE") {
            setUser(found);
            const userTenant =
              tenantList.find((t) => t.id === found.tenantId) ||
              (found.tenant as Tenant) ||
              null;
            setTenant(userTenant);
          } else {
            setUser(null);
            setTenant(null);
          }
        } else if (userList.length > 0 && !isLoggedOut) {
          // ─── Case C: Fresh app load, no session — only auto-login in dev ─
          // In production, require explicit login; in dev, pick default user
          // Note: We do NOT auto-select any user — users must log in explicitly.
          setUser(null);
          setTenant(null);
        }
      } catch (err) {
        console.error("Failed to initialize auth:", err);
        if (isMounted) {
          setUser(null);
          setTenant(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          initialized.current = true;
        }
      }
    }

    initAuth();

    // ─── 4. Supabase Auth state change listener ──────────────────────────
    //    Handles OAuth callback events: SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED
    //    This fires when Supabase processes the OAuth URL tokens.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      console.debug("[AuthContext] onAuthStateChange:", event, session?.user?.email);

      if (event === "SIGNED_IN" && session?.user) {
        const authEmail = session.user.email?.trim().toLowerCase();
        if (!authEmail) return;

        const isLoggedOut =
          localStorage.getItem("warehouse_os_logged_out") === "true";
        if (isLoggedOut) return;

        // Resolve WMS user from the authenticated email
        const users = allUsersRef.current;
        const wmsUser = await resolveWmsUserByEmail(authEmail, users);

        if (!isMounted) return;

        if (wmsUser && wmsUser.status === "ACTIVE") {
          // Persist and activate
          localStorage.removeItem("warehouse_os_logged_out");
          localStorage.setItem("warehouse_os_user_id", wmsUser.id);
          localStorage.setItem("warehouse_os_supabase_uid", session.user.id);

          setUser(wmsUser);
          const userTenant =
            allTenantsRef.current.find((t) => t.id === wmsUser.tenantId) ||
            (wmsUser.tenant as Tenant) ||
            null;
          setTenant(userTenant);
          setIsLoading(false);
        }
        // If no wmsUser, AuthCallbackPage handles the error — do nothing here
      } else if (event === "SIGNED_OUT") {
        // Supabase session ended — ensure WMS state is cleared too
        localStorage.removeItem("warehouse_os_user_id");
        localStorage.removeItem("warehouse_os_supabase_uid");
        localStorage.setItem("warehouse_os_logged_out", "true");
        if (isMounted) {
          setUser(null);
          setTenant(null);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ─── switchUser: used by demo quick-login and email login ───────────────
  const switchUser = async (userId: string) => {
    setIsLoading(true);
    try {
      localStorage.removeItem("warehouse_os_logged_out");
      const selected =
        allUsersRef.current.find((u) => u.id === userId) ||
        allUsers.find((u) => u.id === userId);
      if (selected) {
        const normalizedSelected = normalizeUser(selected);
        setUser(normalizedSelected);
        localStorage.setItem("warehouse_os_user_id", normalizedSelected.id);

        const matchingTenant =
          allTenantsRef.current.find((t) => t.id === normalizedSelected.tenantId) ||
          allTenants.find((t) => t.id === normalizedSelected.tenantId) ||
          (normalizedSelected.tenant as Tenant) ||
          null;
        setTenant(matchingTenant || null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const switchTenant = async (tenantId: string) => {
    const selectedTenant =
      allTenantsRef.current.find((t) => t.id === tenantId) ||
      allTenants.find((t) => t.id === tenantId);
    if (selectedTenant) {
      setTenant(selectedTenant);
    }
  };

  const signInWithEmail = async (email: string) => {
    setIsLoading(true);
    try {
      const identifier = email.trim();
      const normalizedMobile = identifier.replace(/\D/g, "");
      const users = allUsersRef.current.length > 0 ? allUsersRef.current : allUsers;
      const matchingUser = users.find(
        (u) =>
          u.email?.toLowerCase() === identifier.toLowerCase() ||
          (normalizedMobile.length >= 7 &&
            (() => {
              const storedMobile = (u.mobile ?? "").replace(/\D/g, "");
              return (
                storedMobile === normalizedMobile ||
                (storedMobile.length >= 10 &&
                  normalizedMobile.length >= 10 &&
                  storedMobile.slice(-10) === normalizedMobile.slice(-10))
              );
            })())
      );
      if (matchingUser) {
        if (matchingUser.status !== "ACTIVE") {
          return {
            error: new Error(
              "Your WMS account is inactive. Please contact your administrator."
            ),
          };
        }
        localStorage.removeItem("warehouse_os_logged_out");
        await switchUser(matchingUser.id);
        return { error: null };
      }
      return {
        error: new Error(
          `No user found with email or mobile number "${identifier}"`
        ),
      };
    } catch (err) {
      return { error: err as Error };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    // Clear WMS session state
    localStorage.removeItem("warehouse_os_user_id");
    localStorage.removeItem("warehouse_os_supabase_uid");
    localStorage.setItem("warehouse_os_logged_out", "true");
    setUser(null);
    setTenant(null);

    // Sign out from Supabase Auth (covers Google OAuth sessions)
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Supabase signOut error (non-critical):", err);
    }
  };

  const refreshUsers = async () => {
    try {
      const { data: users } = await supabase
        .from("User")
        .select("*, tenant:Tenant(*), client:Client(*)");
      const list = (users as User[]) || [];
      setAllUsers(list);
      allUsersRef.current = list;
    } catch (err) {
      console.error("Failed to refresh users:", err);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // After Google authenticates, Supabase redirects here.
          // AuthCallbackPage processes the session and resolves the WMS user.
          redirectTo: window.location.origin + "/auth/callback",
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error("Failed to sign in with Google:", err);
      return { error: err as Error };
    }
    return { error: null };
  };

  const role = user?.role || "WAREHOUSE_STAFF";

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        role,
        isLoading,
        allUsers,
        allTenants,
        switchUser,
        switchTenant,
        signInWithEmail,
        signInWithGoogle,
        signOut,
        refreshUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
