"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useHifz } from "@/lib/hifz/store";

// Returning learners open on Today; everyone else starts onboarding
export default function Home() {
  const router = useRouter();
  const data = useHifz();
  useEffect(() => {
    if (data) router.replace(data.profile.onboarded ? "/today" : "/welcome");
  }, [data, router]);
  return <div className="flex min-h-screen items-center justify-center"><span className="h-10 w-10 animate-pulse rounded-2xl bg-teal/30" /></div>;
}
