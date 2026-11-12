"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, KeyRound, Lock, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import { MembraneSchematicArt } from "@/components/auth/MembraneSchematicArt";
import { Alert, Button, Input, Label, Modal } from "@/components/ui";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  remember_me: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetStage, setResetStage] = useState<"request" | "confirm" | "done">("request");
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember_me: true },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setErrorMsg(null);
    try {
      await login(values.email, values.password, values.remember_me);
      router.push("/dashboard");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to sign in.");
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetFeedback(null);
    try {
      const res = await api.auth.forgotPassword(resetEmail);
      if (res.reset_token) {
        setResetToken(res.reset_token);
      }
      setResetFeedback(res.message);
      setResetStage("confirm");
    } catch (err) {
      setResetFeedback(err instanceof ApiError ? err.message : "Could not initiate reset.");
    }
  };

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetFeedback(null);
    try {
      const res = await api.auth.resetPassword({
        token: resetToken,
        new_password: newPassword,
        confirm_password: confirmNewPassword,
      });
      setResetFeedback(res.message);
      setResetStage("done");
    } catch (err) {
      setResetFeedback(err instanceof ApiError ? err.message : "Password reset failed.");
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      {/* Left: Login Form */}
      <div className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-16 xl:px-24">
        <div className="w-full max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-teal-700 text-white font-bold shadow-sm">
              CP
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">COW PRO</h1>
              <p className="text-xs text-slate-500">
                Dairy Membrane Processing Design &amp; Simulation
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-slate-900">Sign in to workspace</h2>
            <p className="text-sm text-slate-500 mt-1">
              Access your dairy RO &amp; NF engineering projects and simulation models.
            </p>
          </div>

          {errorMsg && (
            <Alert variant="error" className="mb-5">
              {errorMsg}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email" required>
                Email Address
              </Label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  id="email"
                  type="email"
                  placeholder="engineer@dairyplant.org"
                  className="pl-9"
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-rose-600 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password" required>
                Password
              </Label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-9 pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-rose-600 mt-1">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="inline-flex items-center gap-2 text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                  {...register("remember_me")}
                />
                Remember session
              </label>
              <button
                type="button"
                onClick={() => {
                  setResetStage("request");
                  setResetFeedback(null);
                  setForgotOpen(true);
                }}
                className="font-medium text-sky-700 hover:text-sky-800 cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-full mt-2" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Login to COW PRO"}
            </Button>
          </form>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-slate-800 block">Demo Engineer Account</span>
                <span className="font-mono text-[11px] text-slate-500">
                  engineer@cowpro.dev / CowProDemo2026!
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setValue("email", "engineer@cowpro.dev");
                  setValue("password", "CowProDemo2026!");
                }}
              >
                Fill Demo
              </Button>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            New to COW PRO?{" "}
            <Link href="/register" className="font-semibold text-teal-700 hover:text-teal-800">
              Create an engineering account
            </Link>
          </p>
        </div>
      </div>

      {/* Right: Engineering Illustration */}
      <div className="hidden lg:block">
        <MembraneSchematicArt />
      </div>

      {/* Forgot Password Modal */}
      <Modal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Reset Account Password"
        maxWidth="max-w-md"
      >
        {resetFeedback && (
          <Alert variant={resetStage === "done" ? "success" : "info"} className="mb-4">
            {resetFeedback}
          </Alert>
        )}

        {resetStage === "request" && (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <p className="text-xs text-slate-600">
              Enter your registered engineering email address to generate a password reset token.
            </p>
            <div>
              <Label htmlFor="reset-email" required>
                Email Address
              </Label>
              <Input
                id="reset-email"
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="engineer@dairyplant.org"
              />
            </div>
            <Button type="submit" variant="teal" className="w-full">
              <KeyRound className="w-4 h-4" /> Send Reset Token
            </Button>
          </form>
        )}

        {resetStage === "confirm" && (
          <form onSubmit={handleCompleteReset} className="space-y-3">
            <div>
              <Label htmlFor="reset-token" required>
                Reset Token
              </Label>
              <Input
                id="reset-token"
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="new-pass" required>
                New Password (min 8 chars)
              </Label>
              <Input
                id="new-pass"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="confirm-new-pass" required>
                Confirm New Password
              </Label>
              <Input
                id="confirm-new-pass"
                type="password"
                required
                minLength={8}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" className="w-full">
              Update Password
            </Button>
          </form>
        )}

        {resetStage === "done" && (
          <Button type="button" variant="teal" className="w-full" onClick={() => setForgotOpen(false)}>
            Return to Login
          </Button>
        )}
      </Modal>
    </div>
  );
}
