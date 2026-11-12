"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, CheckCircle2, Lock, Mail, User } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { MembraneSchematicArt } from "@/components/auth/MembraneSchematicArt";
import { Alert, Button, Input, Label } from "@/components/ui";

const registerSchema = z
  .object({
    full_name: z.string().min(2, "Full name is required"),
    email: z.string().email("Enter a valid email address"),
    organization: z.string().optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm_password: z.string().min(8, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (values: RegisterValues) => {
    setErrorMsg(null);
    try {
      const res = await api.auth.register(values);
      setVerificationToken(res.verification_token || "sent");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Registration failed.");
    }
  };

  const handleVerifyEmail = async () => {
    if (!verificationToken) return;
    setErrorMsg(null);
    try {
      await api.auth.verifyEmail(verificationToken);
      setVerified(true);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Verification failed.");
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      <div className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-16 xl:px-24">
        <div className="w-full max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-teal-700 text-white font-bold shadow-sm">
              CP
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">COW PRO</h1>
              <p className="text-xs text-slate-500">Engineer Registration</p>
            </div>
          </div>

          {!verificationToken ? (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-slate-900">Create your account</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Register to design, simulate, and export dairy RO/NF membrane systems.
                </p>
              </div>

              {errorMsg && (
                <Alert variant="error" className="mb-5">
                  {errorMsg}
                </Alert>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="full_name" required>
                    Full Name
                  </Label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <Input
                      id="full_name"
                      placeholder="Dr. Priya Sharma"
                      className="pl-9"
                      {...register("full_name")}
                    />
                  </div>
                  {errors.full_name && (
                    <p className="text-xs text-rose-600 mt-1">{errors.full_name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="email" required>
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="engineer@dairyinstitute.edu"
                      className="pl-9"
                      {...register("email")}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-rose-600 mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="organization">Organization or Institution (Optional)</Label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <Input
                      id="organization"
                      placeholder="National Dairy Process Engineering Center"
                      className="pl-9"
                      {...register("organization")}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password" required>
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Minimum 8 characters"
                      className="pl-9"
                      {...register("password")}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-xs text-rose-600 mt-1">{errors.password.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirm_password" required>
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <Input
                      id="confirm_password"
                      type="password"
                      placeholder="Re-enter password"
                      className="pl-9"
                      {...register("confirm_password")}
                    />
                  </div>
                  {errors.confirm_password && (
                    <p className="text-xs text-rose-600 mt-1">{errors.confirm_password.message}</p>
                  )}
                </div>

                <Button type="submit" variant="teal" size="lg" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-4">
              <div className="flex items-center gap-2.5 text-teal-700 font-semibold">
                <CheckCircle2 className="w-5 h-5" />
                Email Verification Required
              </div>
              {errorMsg && <Alert variant="error">{errorMsg}</Alert>}
              {!verified ? (
                <>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Your COW PRO engineering account has been created. Verify your email address
                    before signing in.
                  </p>
                  {verificationToken !== "sent" && (
                    <div className="rounded-lg bg-white border border-slate-200 p-3 text-xs">
                      <span className="text-slate-500 block mb-1">Local Development Verification Token:</span>
                      <code className="font-mono text-slate-800 break-all">{verificationToken}</code>
                    </div>
                  )}
                  <Button type="button" variant="teal" className="w-full" onClick={handleVerifyEmail}>
                    Verify Email Address Now
                  </Button>
                </>
              ) : (
                <>
                  <Alert variant="success">
                    Email verified! Your account is ready.
                  </Alert>
                  <Button type="button" variant="primary" className="w-full" onClick={() => router.push("/login")}>
                    Proceed to Login
                  </Button>
                </>
              )}
            </div>
          )}

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-sky-700 hover:text-sky-800">
              Sign in here
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:block">
        <MembraneSchematicArt />
      </div>
    </div>
  );
}
