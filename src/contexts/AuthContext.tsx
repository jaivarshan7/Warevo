import React, { createContext, useContext, useEffect, useState } from "react";
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

// Refresh users from Supabase - returns the users list
export async function refreshUsersFromSupabase() {
  try {
    const { data: users } = await supabase
      .from("User")
      .select("*, tenant:Tenant(*), client:Client(*)")
      .order("role", { ascending: true });
    if (users && users.length > 0) {
      return users as User[];
    }
    return [];
  } catch (err) {
    console.error("Failed to refresh users from Supabase:", err);
    return [];
  }
}

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);

  // Load initial demo users and tenants
  useEffect(() => {
    async function initAuth() {
      try {
        setIsLoading(true);

        // Fetch all tenants
        const { data: tenants } = await supabase
          .from("Tenant")
          .select("*")
          .order("name", { ascending: true });

        if (tenants) {
          setAllTenants(tenants as Tenant[]);
        }

        // Fetch all users with tenant and client relation
        const { data: users } = await supabase
          .from("User")
          .select("*, tenant:Tenant(*), client:Client(*)")
          .order("role", { ascending: true });

        if (users && users.length > 0) {
          setAllUsers(users as User[]);

          // Check if user explicitly logged out
          const isLoggedOut = localStorage.getItem("warehouse_os_logged_out") === "true";
          const savedUserId = localStorage.getItem("warehouse_os_user_id");

          if (isLoggedOut) {
            setUser(null);
            setTenant(null);
          } else {
            const found = savedUserId ? users.find((u) => u.id === savedUserId) : null;
            const defaultUser = found || users.find((u) => u.role === "WAREHOUSE_OWNER") || users[0];

            setUser(defaultUser as User);

            if (defaultUser?.tenantId) {
              const userTenant = (tenants || []).find((t) => t.id === defaultUser.tenantId);
              setTenant((userTenant as Tenant) || null);
            } else if (tenants && tenants.length > 0) {
              setTenant(tenants[0] as Tenant);
            }
          }
        }
      } catch (err) {
        console.error("Failed to initialize auth:", err);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const switchUser = async (userId: string) => {
    setIsLoading(true);
    try {
      localStorage.removeItem("warehouse_os_logged_out");
      const selected = allUsers.find((u) => u.id === userId);
      if (selected) {
        setUser(selected);
        localStorage.setItem("warehouse_os_user_id", selected.id);

        if (selected.tenantId) {
          const matchingTenant = allTenants.find((t) => t.id === selected.tenantId);
          setTenant(matchingTenant || null);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const switchTenant = async (tenantId: string) => {
    const selectedTenant = allTenants.find((t) => t.id === tenantId);
    if (selectedTenant) {
      setTenant(selectedTenant);
    }
  };

  const signInWithEmail = async (email: string) => {
    setIsLoading(true);
    try {
      const identifier = email.trim();
      const normalizedMobile = identifier.replace(/\D/g, "");
      const matchingUser = allUsers.find(
        (u) =>
          u.email?.toLowerCase() === identifier.toLowerCase() ||
          (normalizedMobile.length >= 7 && (() => {
            const storedMobile = (u.mobile ?? "").replace(/\D/g, "");
            return storedMobile === normalizedMobile ||
              (storedMobile.length >= 10 && normalizedMobile.length >= 10 && storedMobile.slice(-10) === normalizedMobile.slice(-10));
          })())
      );
      if (matchingUser) {
        localStorage.removeItem("warehouse_os_logged_out");
        await switchUser(matchingUser.id);
        return { error: null };
      }
      return { error: new Error(`No user found with email or mobile number ${identifier}`) };
    } catch (err) {
      return { error: err as Error };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    localStorage.removeItem("warehouse_os_user_id");
    localStorage.setItem("warehouse_os_logged_out", "true");
    setUser(null);
    setTenant(null);
  };

  const refreshUsers = async () => {
    try {
      const { data: users } = await supabase
        .from("User")
        .select("*, tenant:Tenant(*), client:Client(*)")
        .order("role", { ascending: true });
      if (users && users.length > 0) {
        setAllUsers(users as User[]);
      } else {
        setAllUsers([]);
      }
    } catch (err) {
      console.error("Failed to refresh users:", err);
      setAllUsers([]);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/auth/callback",
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
        refreshUsers
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
