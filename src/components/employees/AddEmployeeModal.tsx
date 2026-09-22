import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { createEmployeeWithAuth } from "@/lib/employeeService";
import { Role, ALLOWED_EMPLOYEE_ROLES, Tenant } from "@/types";
import { Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId?: string;
  isPlatformAdmin?: boolean;
  allTenants?: Array<Tenant | { id: string; name: string; status: string }>;
}

const ROLE_LABELS: Record<string, string> = {
  WAREHOUSE_STAFF: "Warehouse Staff",
  ACCOUNTS_TEAM: "Accounts Team",
  ACCOUNTANT: "Accountant",
  WAREHOUSE_MODERATOR: "Warehouse Moderator",
  WAREHOUSE_OWNER: "Warehouse Owner"
};

export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  tenantId,
  isPlatformAdmin = false,
  allTenants = []
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>("WAREHOUSE_STAFF");
  const [selectedTenantId, setSelectedTenantId] = useState<string>(tenantId || "");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setName("");
      setEmail("");
      setPassword("");
      setMobile("");
      setSelectedRole("WAREHOUSE_STAFF");
      setSelectedTenantId(tenantId || "");
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, tenantId]);

  const validateForm = (): string | null => {
    if (!name.trim()) {
      return "Name is required";
    }
    if (!email.trim()) {
      return "Email is required";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return "Invalid email format";
    }
    if (!password) {
      return "Password is required";
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters";
    }
    if (!selectedRole) {
      return "Role is required";
    }
    if (isPlatformAdmin && !selectedTenantId) {
      return "Company selection is required";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await createEmployeeWithAuth({
        name: name.trim(),
        email: email.trim(),
        password,
        mobile: mobile.trim() || undefined,
        role: selectedRole,
        tenantId: isPlatformAdmin ? selectedTenantId : tenantId
      });

      if (result.success) {
        setSuccess(`${name.trim()} added successfully!`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setError(result.error || "Failed to create employee");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Employee"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Company Selection - Platform Admin Only */}
        {isPlatformAdmin && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Select Company *
            </label>
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={isSubmitting}
              required
            >
              <option value="">Select a company...</option>
              {allTenants
                .filter((t) => t.status === "ACTIVE")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            placeholder="Enter full name"
            disabled={isSubmitting}
            required
          />
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Role *
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as Role)}
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            disabled={isSubmitting}
            required
          >
            {((isPlatformAdmin
              ? [...ALLOWED_EMPLOYEE_ROLES, "WAREHOUSE_OWNER" as Role]
              : ALLOWED_EMPLOYEE_ROLES) as Role[]).map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role] || role}
              </option>
            ))}
          </select>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Email *
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            placeholder="employee@company.com"
            disabled={isSubmitting}
            required
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Password *
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 pr-10 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Minimum 8 characters"
              disabled={isSubmitting}
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              disabled={isSubmitting}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Password will be used for login and never stored in the WMS database.
          </p>
        </div>

        {/* Mobile */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Mobile
          </label>
          <input
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            placeholder="+91 98765 43210"
            disabled={isSubmitting}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </span>
            ) : (
              "Create Employee"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
