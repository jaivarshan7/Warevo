import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ShieldCheck, ArrowRight, Building2, User } from "lucide-react";

export const LoginPage: React.FC = () => {
  const { allUsers, switchUser, signInWithEmail } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const res = await signInWithEmail(email);
    setIsLoading(false);
    if (res.error) {
      setError(res.error.message);
    } else {
      navigate("/dashboard");
    }
  };

  const handleQuickLogin = async (userId: string) => {
    await switchUser(userId);
    navigate("/dashboard");
  };

  const sortedDemoUsers = React.useMemo(() => {
    const priority: Record<string, number> = {
      PLATFORM_ADMIN: 1,
      WAREHOUSE_OWNER: 2,
      ACCOUNTANT: 3,
      WAREHOUSE_STAFF: 4,
      PRODUCT_RECEIVER: 5,
      CLIENT: 6
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
                placeholder="owner-apex@example.test"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Sign In with Email
            </Button>
          </form>

          {/* Quick Demo Switcher */}
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
        </Card>
      </div>
    </div>
  );
};
