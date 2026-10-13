import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { User, Tenant, Role, ClientEmployeeRole } from "@/types";
import { supabase } from "@/lib/supabase";
import { DEFAULT_CLIENT_ROLE_PERMISSIONS } from "@/lib/permissions";

export type AuthErrorType = "INVALID_CREDENTIALS" | "ACCOUNT_INACTIVE" | "NOT_REGISTERED" | "GENERAL";

interface AuthContextType {
  user: User | any;
  tenant: Tenant | null;
  role: Role;
  isLoading: boolean;
  allUsers: User[];
  allTenants: Tenant[];
  switchUser: (userId: string) => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  signInWithEmailAndPassword: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null; errorType?: AuthErrorType }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  setAuthenticatedUser: (user: User, tenant?: Tenant | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export { AuthProvider };

// Normalizes User objects returned from Supabase where 1-to-1 reverse relations
// (like clientEmployee:ClientEmployee(*, client:Client(*))) may be returned as single-element arrays by PostgREST.
export function normalizeUser(u: any): User {
  if (!u) return u;
  const rawClientEmployee = u.clientEmployee;
  const clientEmployee = Array.isArray(rawClientEmployee)
    ? (rawClientEmployee.length > 0 ? rawClientEmployee[0] : null)
    : (rawClientEmployee || null);

  const rawRoleDef = clientEmployee?.roleDefinition;
  const roleDefinition = Array.isArray(rawRoleDef)
    ? (rawRoleDef.length > 0 ? rawRoleDef[0] : null)
    : (rawRoleDef || null);

  // Authoritative permissions resolution:
  // 1. Live permissions array if already attached (from rpc_get_my_permissions)
  // 2. RoleDefinition permissions if loaded from DB
  // 3. Fallback to default permissions by employeeRole
  let permissions: string[] = [];
  if (Array.isArray(u.permissions) && u.permissions.length > 0) {
    permissions = u.permissions;
  } else if (roleDefinition?.permissions && Array.isArray(roleDefinition.permissions) && roleDefinition.permissions.length > 0) {
    permissions = roleDefinition.permissions
      .map((rp: any) => rp.permission?.key || rp.key || rp.permissionId)
      .filter(Boolean);
  } else if (clientEmployee?.employeeRole) {
    const roleKey = (clientEmployee.employeeRole || "").toUpperCase();
    permissions = (DEFAULT_CLIENT_ROLE_PERMISSIONS as Record<string, string[]>)[roleKey] || [];
  }

  // Resolve company from clientEmployee.client or fallback to u.client
  const rawClient = clientEmployee?.client || u.client;
  const client = Array.isArray(rawClient)
    ? (rawClient.length > 0 ? rawClient[0] : null)
    : (rawClient || null);

  const rawTenant = u.tenant;
  const tenant = Array.isArray(rawTenant)
    ? (rawTenant.length > 0 ? rawTenant[0] : null)
    : (rawTenant || null);

  return {
    ...u,
    permissions,
    clientEmployee: clientEmployee ? { ...clientEmployee, roleDefinition } : null,
    client: client
      ? {
          ...client,
          employeeRole: clientEmployee?.employeeRole || client.employeeRole || null,
          contactPerson: clientEmployee?.contactPerson || client.contactPerson || u.name,
          mobile: clientEmployee?.mobile || client.mobile || u.mobile,
          email: clientEmployee?.email || client.email || u.email,
        }
      : null,
    clientId: client?.id || clientEmployee?.clientId || u.clientId || null,
    tenant,
    tenantId: u.tenantId || tenant?.id || null,
  };
}

// Refresh users from Supabase - returns the users list
export async function refreshUsersFromSupabase() {
  try {
    const { data: users } = await supabase
      .from("User")
      .select("*, supabaseUserId, tenant:Tenant(*), clientEmployee:ClientEmployee(*, client:Client(*), roleDefinition:RoleDefinition(*, permissions:RolePermission(*, permission:Permission(*))))");
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
 * Resolve a WMS User from an authenticated Supabase Auth user ID.
 * Returns the user (with tenant & client employee) if found, or null otherwise.
 * Does NOT throw — callers handle null and check status.
 */
export async function resolveWmsUserBySupabaseUserId(
  supabaseUserId: string,
  allUsers: User[] = [],
  forceDbLookup: boolean = false
): Promise<User | null> {
  if (!supabaseUserId) return null;

  // First check in-memory list if not forcing fresh DB lookup
  if (!forceDbLookup && allUsers.length > 0) {
    const inMemory = allUsers.find(
      (u) => u.supabaseUserId === supabaseUserId
    );
    if (inMemory) return normalizeUser(inMemory);
  }

  // Fall back to authoritative DB lookup
  try {
    const { data, error } = await supabase
      .from("User")
      .select("*, supabaseUserId, tenant:Tenant(*), clientEmployee:ClientEmployee(*, client:Client(*), roleDefinition:RoleDefinition(*, permissions:RolePermission(*, permission:Permission(*))))")
      .eq("supabaseUserId", supabaseUserId)
      .limit(1);

    if (error) {
      console.warn("[AuthContext] DB lookup error for supabaseUserId:", error);
      return null;
    }
    return data?.[0] ? normalizeUser(data[0]) : null;
  } catch (err) {
    console.error("[AuthContext] DB lookup exception:", err);
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
  const userRef = useRef<User | null>(null);

  const setAuthenticatedUser = (authUser: User, authTenant?: Tenant | null) => {
    const normalized = normalizeUser(authUser);
    console.debug("[AuthContext] setting authenticated user:", normalized.email);
    userRef.current = normalized;
    setUser(normalized);
    localStorage.removeItem("warehouse_os_logged_out");
    localStorage.setItem("warehouse_os_user_id", normalized.id);
    if (normalized.supabaseUserId) {
      localStorage.setItem("warehouse_os_supabase_uid", normalized.supabaseUserId);
    }
    const resolvedTenant =
      authTenant ||
      allTenantsRef.current.find((t) => t.id === normalized.tenantId) ||
      allTenants.find((t) => t.id === normalized.tenantId) ||
      (normalized.tenant as Tenant) ||
      null;
    setTenant(resolvedTenant);
    setIsLoading(false);

    if (normalized.role === "CLIENT" || (normalized.role as string) === "CLIENT_ACCOUNTANT") {
      void supabase.rpc("rpc_get_my_permissions").then(
        ({ data, error }) => {
          if (!error && Array.isArray(data) && data.length > 0) {
            setUser((prev: any) => (prev ? { ...prev, permissions: data } : prev));
            if (userRef.current) {
              userRef.current.permissions = data;
            }
          }
        },
        (err: any) => console.warn(err)
      );
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      const pathname = typeof window !== "undefined" ? window.location.pathname : "";
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
          .select("*, supabaseUserId, tenant:Tenant(*), clientEmployee:ClientEmployee(*, client:Client(*), roleDefinition:RoleDefinition(*, permissions:RolePermission(*, permission:Permission(*))))");

        const userList = ((users as any[]) || []).map(normalizeUser);
        if (isMounted) {
          setAllUsers(userList);
          allUsersRef.current = userList;
        }

        // ─── 3. Check for an existing Supabase Auth session (OAuth return) ─
        const { data: sessionData } = await supabase.auth.getSession();
        const supabaseSession = sessionData?.session;

        if (!isMounted) return;

        // If on /auth/callback, defer resolution to AuthCallbackPage so it can handle linkage and navigation.
        // Keep isLoading true so route guards do not bounce to /login before AuthCallbackPage sets the user.
        if (pathname.startsWith("/auth/callback")) {
          console.debug("[AuthContext] current pathname:", pathname);
          console.debug("[AuthContext] On /auth/callback; letting AuthCallbackPage process callback");
          return;
        }

        // If on /auth/update-password or URL indicates password recovery, defer to UpdatePasswordPage.
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        const search = typeof window !== "undefined" ? window.location.search : "";
        if (
          pathname.startsWith("/auth/update-password") ||
          hash.includes("type=recovery") ||
          search.includes("type=recovery")
        ) {
          console.debug("[AuthContext] Password recovery flow detected; deferring to UpdatePasswordPage");
          setIsLoading(false);
          initialized.current = true;
          return;
        }

        if (!supabaseSession?.user) {
          // No live Supabase Auth session — clear any stale WMS user state
          console.debug("[AuthContext] clearing user (no live Supabase session)");
          localStorage.removeItem("warehouse_os_user_id");
          localStorage.removeItem("warehouse_os_supabase_uid");
          userRef.current = null;
          setUser(null);
          setTenant(null);
        } else {
          // ─── Active Supabase Auth session ──────────────────────────────────
          // An authentic Supabase Auth session exists. Never let a stale warehouse_os_logged_out override it.
          localStorage.removeItem("warehouse_os_logged_out");

          const authUserId = supabaseSession.user.id;
          let wmsUser = await resolveWmsUserBySupabaseUserId(authUserId, userList, true);

          // If not linked yet, attempt rpc_link_auth_user_by_email before giving up
          if (!wmsUser && supabaseSession.user.email) {
            try {
              const { data: linkRes } = await supabase.rpc("rpc_link_auth_user_by_email", {
                p_auth_user_id: authUserId,
                p_email: supabaseSession.user.email
              });
              if (linkRes?.success) {
                wmsUser = await resolveWmsUserBySupabaseUserId(authUserId, [], true);
              }
            } catch (linkErr) {
              console.warn("[AuthContext] initAuth: link error:", linkErr);
            }
          }

          console.debug("[AuthContext] resolved WMS user:", wmsUser ? wmsUser.email : null);

          if (wmsUser) {
            const isUserInactive = wmsUser.status === "INACTIVE";
            const isClientEmployeeInactive = Boolean(wmsUser.clientEmployee && wmsUser.clientEmployee.status === "INACTIVE");

            if (isUserInactive || isClientEmployeeInactive) {
              console.warn("[AuthContext] Session exists for inactive user. Signing out.");
              await supabase.auth.signOut();
              console.debug("[AuthContext] clearing user (inactive user in initAuth)");
              localStorage.removeItem("warehouse_os_user_id");
              localStorage.removeItem("warehouse_os_supabase_uid");
              localStorage.setItem("warehouse_os_logged_out", "true");
              userRef.current = null;
              setUser(null);
              setTenant(null);
            } else if (wmsUser.status === "ACTIVE") {
              // Active user!
              if (wmsUser.role === "CLIENT" || (wmsUser.role as string) === "CLIENT_ACCOUNTANT") {
                try {
                  const { data: myPerms } = await supabase.rpc("rpc_get_my_permissions");
                  if (Array.isArray(myPerms) && myPerms.length > 0) {
                    wmsUser.permissions = myPerms;
                  }
                } catch (permErr) {
                  console.warn("[AuthContext] rpc_get_my_permissions error in initAuth:", permErr);
                }
              }
              console.debug("[AuthContext] setting authenticated user:", wmsUser.email);
              localStorage.removeItem("warehouse_os_logged_out");
              localStorage.setItem("warehouse_os_user_id", wmsUser.id);
              localStorage.setItem("warehouse_os_supabase_uid", authUserId);
              const normalized = normalizeUser(wmsUser);
              userRef.current = normalized;
              setUser(normalized);
              const userTenant = tenantList.find(
                (t) => t.id === wmsUser.tenantId
              );
              setTenant(userTenant || (wmsUser.tenant as Tenant) || null);
            }
          } else {
            // User not found in WMS: clear session keys, do NOT treat as inactive
            console.debug("[AuthContext] clearing user (unregistered WMS user in initAuth)");
            localStorage.removeItem("warehouse_os_user_id");
            localStorage.removeItem("warehouse_os_supabase_uid");
            userRef.current = null;
            setUser(null);
            setTenant(null);
          }
        }
      } catch (err) {
        console.error("Failed to initialize auth:", err);
        if (isMounted) {
          console.debug("[AuthContext] clearing user (init exception)");
          userRef.current = null;
          setUser(null);
          setTenant(null);
        }
      } finally {
        if (isMounted) {
          // If on /auth/callback, keep isLoading true so AuthCallbackPage completes setAuthenticatedUser
          if (!pathname.startsWith("/auth/callback")) {
            setIsLoading(false);
          }
          initialized.current = true;
        }
      }
    }

    initAuth();

    // ─── 4. Supabase Auth state change listener ──────────────────────────
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      const pathname = typeof window !== "undefined" ? window.location.pathname : "";
      console.debug("[AuthContext] onAuthStateChange event:", event);
      console.debug("[AuthContext] session user:", session?.user?.id, session?.user?.email);
      if (event === "PASSWORD_RECOVERY") {
        console.debug("[AuthContext] PASSWORD_RECOVERY event received; routing to /auth/update-password");
        setIsLoading(false);
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth/update-password")) {
          window.location.href = `/auth/update-password${window.location.search}${window.location.hash}`;
        }
        return;
      }

      if (pathname.startsWith("/auth/callback") || pathname.startsWith("/auth/update-password")) {
        console.debug("[AuthContext] onAuthStateChange on auth flow route; letting page process");
        return;
      }

      // Prevent competing initialization from overwriting an already authenticated user:
      if (userRef.current && session?.user && userRef.current.supabaseUserId === session.user.id) {
        console.debug("[AuthContext] setting authenticated user (already matched):", userRef.current.email);
        setIsLoading(false);
        return;
      }

      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        const authUserId = session.user.id;
        if (!authUserId) return;

        localStorage.removeItem("warehouse_os_logged_out");

        // Authoritatively resolve WMS user from the authenticated supabaseUserId
        let wmsUser = await resolveWmsUserBySupabaseUserId(authUserId, allUsersRef.current, true);

        // Attempt link if not yet linked
        if (!wmsUser && session.user.email) {
          try {
            const { data: linkRes } = await supabase.rpc("rpc_link_auth_user_by_email", {
              p_auth_user_id: authUserId,
              p_email: session.user.email
            });
            if (linkRes?.success) {
              wmsUser = await resolveWmsUserBySupabaseUserId(authUserId, [], true);
            }
          } catch (linkErr) {
            console.warn("[AuthContext] onAuthStateChange: link error:", linkErr);
          }
        }

        if (!isMounted) return;
        console.debug("[AuthContext] resolved WMS user:", wmsUser ? wmsUser.email : null);

        if (wmsUser) {
          const isUserInactive = wmsUser.status === "INACTIVE";
          const isClientEmployeeInactive = Boolean(wmsUser.clientEmployee && wmsUser.clientEmployee.status === "INACTIVE");

          if (isUserInactive || isClientEmployeeInactive) {
            console.warn("[AuthContext] Inactive user in onAuthStateChange. Signing out.");
            await supabase.auth.signOut();
            console.debug("[AuthContext] clearing user (inactive in onAuthStateChange)");
            localStorage.removeItem("warehouse_os_user_id");
            localStorage.removeItem("warehouse_os_supabase_uid");
            localStorage.setItem("warehouse_os_logged_out", "true");
            userRef.current = null;
            setUser(null);
            setTenant(null);
            setIsLoading(false);
          } else if (wmsUser.status === "ACTIVE") {
            // Persist and activate
            if (wmsUser.role === "CLIENT" || (wmsUser.role as string) === "CLIENT_ACCOUNTANT") {
              try {
                const { data: myPerms } = await supabase.rpc("rpc_get_my_permissions");
                if (Array.isArray(myPerms) && myPerms.length > 0) {
                  wmsUser.permissions = myPerms;
                }
              } catch (permErr) {
                console.warn("[AuthContext] rpc_get_my_permissions error in onAuthStateChange:", permErr);
              }
            }
            console.debug("[AuthContext] setting authenticated user:", wmsUser.email);
            localStorage.removeItem("warehouse_os_logged_out");
            localStorage.setItem("warehouse_os_user_id", wmsUser.id);
            localStorage.setItem("warehouse_os_supabase_uid", session.user.id);

            const normalized = normalizeUser(wmsUser);
            userRef.current = normalized;
            setUser(normalized);
            const userTenant =
              allTenantsRef.current.find((t) => t.id === wmsUser.tenantId) ||
              (wmsUser.tenant as Tenant) ||
              null;
            setTenant(userTenant);
            setIsLoading(false);
          }
        } else {
          setIsLoading(false);
        }
      } else if (event === "SIGNED_OUT") {
        // Supabase session ended — ensure WMS state is cleared too
        console.debug("[AuthContext] clearing user (SIGNED_OUT event)");
        localStorage.removeItem("warehouse_os_user_id");
        localStorage.removeItem("warehouse_os_supabase_uid");
        localStorage.setItem("warehouse_os_logged_out", "true");
        if (isMounted) {
          userRef.current = null;
          setUser(null);
          setTenant(null);
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ─── switchUser: used by demo quick-login ───────────────
  const switchUser = async (userId: string) => {
    setIsLoading(true);
    try {
      localStorage.removeItem("warehouse_os_logged_out");
      const selected =
        allUsersRef.current.find((u) => u.id === userId) ||
        allUsers.find((u) => u.id === userId);
      if (selected) {
        if (selected.status === "INACTIVE" || selected.clientEmployee?.status === "INACTIVE") {
          throw new Error("Your account is inactive. Please contact your administrator.");
        }
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

  const signInWithEmailAndPassword = async (
    email: string,
    password: string
  ): Promise<{ error: Error | null; errorType?: AuthErrorType }> => {
    setIsLoading(true);
    try {
      // 1. Authenticate with Supabase Auth
      // CRITICAL: Do NOT perform pre-authentication check (preserves security against email enumeration)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (authError || !authData?.user) {
        return {
          error: new Error("Invalid email or password."),
          errorType: "INVALID_CREDENTIALS"
        };
      }

      const authUser = authData.user;
      const authUserId = authUser.id;

      // Clear any previous logout state
      localStorage.removeItem("warehouse_os_logged_out");

      // 2. Authoritative lookup of WMS User by supabaseUserId
      let wmsUser = await resolveWmsUserBySupabaseUserId(authUserId, allUsersRef.current, true);

      // If not yet linked by supabaseUserId, attempt secure linkage by authenticated email
      if (!wmsUser && authUser.email) {
        try {
          const { data: linkData } = await supabase.rpc("rpc_link_auth_user_by_email", {
            p_auth_user_id: authUserId,
            p_email: authUser.email
          });
          if (linkData?.success) {
            wmsUser = await resolveWmsUserBySupabaseUserId(authUserId, [], true);
          }
        } catch (linkErr) {
          console.warn("[AuthContext] Linkage attempt error:", linkErr);
        }
      }

      // 3. User does not exist in WMS (Requirement 4)
      if (!wmsUser) {
        console.warn("[AuthContext] Auth succeeded but no WMS User found for supabaseUserId:", authUserId);
        await supabase.auth.signOut();
        localStorage.removeItem("warehouse_os_user_id");
        localStorage.removeItem("warehouse_os_supabase_uid");
        localStorage.setItem("warehouse_os_logged_out", "true");
        setUser(null);
        setTenant(null);
        return {
          error: new Error("Your account is not registered in the WMS. Please contact your administrator."),
          errorType: "NOT_REGISTERED"
        };
      }

      // 4. Inactive WMS User (Requirement 3)
      if (wmsUser.status === "INACTIVE" || wmsUser.clientEmployee?.status === "INACTIVE") {
        console.warn("[AuthContext] WMS User is INACTIVE for supabaseUserId:", authUserId);
        await supabase.auth.signOut();
        localStorage.removeItem("warehouse_os_user_id");
        localStorage.removeItem("warehouse_os_supabase_uid");
        localStorage.setItem("warehouse_os_logged_out", "true");
        setUser(null);
        setTenant(null);
        return {
          error: new Error("Your account is inactive. Please contact your administrator."),
          errorType: "ACCOUNT_INACTIVE"
        };
      }

      // 5. Active WMS user - persist session and activate
      localStorage.setItem("warehouse_os_user_id", wmsUser.id);
      localStorage.setItem("warehouse_os_supabase_uid", authUserId);

      const normalizedWmsUser = normalizeUser(wmsUser);
      setUser(normalizedWmsUser);

      const matchingTenant =
        allTenantsRef.current.find((t) => t.id === normalizedWmsUser.tenantId) ||
        allTenants.find((t) => t.id === normalizedWmsUser.tenantId) ||
        (normalizedWmsUser.tenant as Tenant) ||
        null;
      setTenant(matchingTenant || null);

      return { error: null };
    } catch (err) {
      return { error: err as Error, errorType: "GENERAL" };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    console.debug("[AuthContext] clearing user (explicit signOut)");
    // Clear WMS session state
    localStorage.removeItem("warehouse_os_user_id");
    localStorage.removeItem("warehouse_os_supabase_uid");
    localStorage.setItem("warehouse_os_logged_out", "true");
    userRef.current = null;
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
        .select("*, supabaseUserId, tenant:Tenant(*), clientEmployee:ClientEmployee(*, client:Client(*))");
      const list = (users as User[]) || [];
      setAllUsers(list);
      allUsersRef.current = list;
    } catch (err) {
      console.error("Failed to refresh users:", err);
    }
  };

  const signInWithGoogle = async () => {
    try {
      localStorage.removeItem("warehouse_os_logged_out");
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
        signInWithEmailAndPassword,
        signInWithGoogle,
        signOut,
        refreshUsers,
        setAuthenticatedUser,
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
