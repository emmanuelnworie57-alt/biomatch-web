"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Droplet,
  HeartPulse,
  Wallet,
  CalendarClock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  MapPin,
  Loader2,
} from "lucide-react";

const ELIGIBILITY_DAYS = 56;
const CRITICAL_THRESHOLD = 5;

interface Profile {
  full_name: string;
  blood_group: string | null;
  genotype: string | null;
  last_donation_date: string | null;
}

interface WalletData {
  points: number;
  lifetime_donations: number;
}

interface CriticalBank {
  hospital_name: string;
  location: string;
  units: number;
}

export default function DonorDashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [criticalMatches, setCriticalMatches] = useState<CriticalBank[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }

    const [{ data: profileRow }, { data: walletRow }] = await Promise.all([
      supabase
        .from("biomatch_profiles")
        .select("full_name, blood_group, genotype, last_donation_date")
        .eq("id", userId)
        .single(),
      supabase
        .from("biomatch_wallets")
        .select("points, lifetime_donations")
        .eq("user_id", userId)
        .single(),
    ]);

    if (profileRow) setProfile(profileRow as Profile);
    if (walletRow) setWallet(walletRow as WalletData);

    if (profileRow?.blood_group) {
      const { data: banks } = await supabase
        .from("biomatch_hospital_banks")
        .select("hospital_name, location, inventory");

      const matches: CriticalBank[] = (banks ?? [])
        .map((bank) => ({
          hospital_name: bank.hospital_name as string,
          location: bank.location as string,
          units: (bank.inventory as Record<string, number>)?.[profileRow.blood_group as string] ?? 0,
        }))
        .filter((b) => b.units < CRITICAL_THRESHOLD)
        .slice(0, 3);

      setCriticalMatches(matches);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const eligibility = getEligibility(profile?.last_donation_date ?? null);
  const profileComplete = Boolean(profile?.blood_group && profile?.genotype);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-gray-500">Here&apos;s where things stand with your BioMatch account.</p>
      </header>

      {/* Top stat row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Droplet}
          label="Blood Group"
          value={profile?.blood_group ?? "Not set"}
          tone={profile?.blood_group ? "default" : "warning"}
        />
        <StatCard icon={Wallet} label="Loyalty Points" value={String(wallet?.points ?? 0)} />
        <StatCard
          icon={HeartPulse}
          label="Lifetime Donations"
          value={String(wallet?.lifetime_donations ?? 0)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Eligibility card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 lg:col-span-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4.5 w-4.5 text-rose-600" />
            <h2 className="text-sm font-semibold text-gray-900">Donation Eligibility</h2>
          </div>

          {eligibility.eligible ? (
            <div className="mt-4 flex items-start gap-3 rounded-lg bg-emerald-50 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-emerald-800">You&apos;re eligible to donate</p>
                <p className="mt-0.5 text-xs text-emerald-700">
                  {eligibility.lastDonation
                    ? `Last donation was ${eligibility.daysSince} days ago, past the ${ELIGIBILITY_DAYS}-day minimum.`
                    : "No prior donation on record — you're clear to give whenever you're ready."}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-start gap-3 rounded-lg bg-amber-50 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Eligible again in {eligibility.daysRemaining} day{eligibility.daysRemaining === 1 ? "" : "s"}
                </p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Donors need a {ELIGIBILITY_DAYS}-day gap between donations for safe recovery.
                </p>
              </div>
            </div>
          )}

          {!profileComplete && (
            <Link
              href="/donor/health-profile"
              className="mt-4 flex items-center justify-between rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 hover:border-rose-300 hover:bg-rose-50/50"
            >
              <span>Complete your health profile to confirm match eligibility</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {/* Points / perks teaser */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <Wallet className="h-4.5 w-4.5 text-rose-600" />
            <h2 className="text-sm font-semibold text-gray-900">Rewards</h2>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{wallet?.points ?? 0}</p>
          <p className="text-xs text-gray-400">points available</p>
          <Link
            href="/donor/wallet"
            className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-2 text-sm font-medium text-white hover:bg-rose-700"
          >
            View Wallet & Perks
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Critical need nearby */}
      {criticalMatches.length > 0 && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4.5 w-4.5 text-red-600" />
            <h2 className="text-sm font-semibold text-red-900">
              Your blood type ({profile?.blood_group}) is critically low nearby
            </h2>
          </div>
          <div className="mt-4 space-y-2">
            {criticalMatches.map((bank) => (
              <div
                key={bank.hospital_name}
                className="flex items-center justify-between rounded-lg bg-white px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{bank.hospital_name}</p>
                    <p className="text-xs text-gray-400">{bank.location}</p>
                  </div>
                </div>
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                  {bank.units} units left
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2 text-gray-400">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-bold ${tone === "warning" ? "text-amber-600" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}

function getEligibility(lastDonationDate: string | null) {
  if (!lastDonationDate) {
    return { eligible: true, lastDonation: false, daysSince: 0, daysRemaining: 0 };
  }

  const last = new Date(lastDonationDate);
  const now = new Date();
  const daysSince = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, ELIGIBILITY_DAYS - daysSince);

  return {
    eligible: daysSince >= ELIGIBILITY_DAYS,
    lastDonation: true,
    daysSince,
    daysRemaining,
  };
}