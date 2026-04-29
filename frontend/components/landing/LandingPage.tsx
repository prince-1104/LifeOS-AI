"use client";

import { SignInButton, SignUpButton, useUser } from "@clerk/nextjs";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { 
  ChartBarIcon, 
  MapPinIcon, 
  CalendarIcon, 
  StarIcon 
} from "@heroicons/react/24/solid";
import { CpuChipIcon } from "@heroicons/react/24/outline";
import { ParticleBackground } from "./ParticleBackground";

export function LandingPage() {
  const { isSignedIn, isLoaded, user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      if (user?.primaryEmailAddress?.emailAddress === "doptonin@gmail.com") {
        router.replace("/admin");
      } else {
        router.replace("/chat");
      }
    }
  }, [isLoaded, isSignedIn, user, router]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0e0716] text-[#FF9ECA]">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0e0716] text-[#FF9ECA]">
        <div className="animate-pulse">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0e0716] text-white selection:bg-[#FF9ECA] selection:text-[#0e0716] font-sans pb-0">
      {/* 3D Particle Background */}
      <div className="fixed inset-0 z-0">
        <ParticleBackground />
      </div>
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#0e0716]/60 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-10">
            <span className="flex items-center gap-1 sm:gap-3 text-base sm:text-xl font-bold tracking-tight text-[#E8D1FF]">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-[#0e0716] flex items-center justify-center shrink-0">
                <Image src="/navbar_logo.png" alt="Cortexa AI" width={52} height={52} className="object-cover scale-[1.3]" />
              </div>
              <span className="hidden min-[380px]:block">Cortexa AI</span>
            </span>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
              <a href="#" className="text-[#FF9ECA] border-b-2 border-[#FF9ECA] pb-1">Solutions</a>
              <a href="#" className="text-white/60 hover:text-white transition">Technology</a>
            </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-6">
            <a href="/pricing" className="text-[12px] sm:text-sm font-semibold text-white/80 hover:text-white transition">
              Pricing
            </a>
            <SignInButton mode="modal">
              <button className="text-[12px] sm:text-sm font-semibold text-white/80 hover:text-white transition">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="rounded-full bg-gradient-to-r from-[#FFB1D8] to-[#FF80B6] px-3 py-1.5 sm:px-5 sm:py-2.5 text-[12px] sm:text-sm font-bold text-[#3B0E21] shadow-[0_0_15px_rgba(255,128,182,0.3)] transition hover:opacity-90 hover:scale-105 active:scale-95">
                Create Account
              </button>
            </SignUpButton>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 pt-28 sm:pt-40 pb-20 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#084D73] bg-[#0A2640]/50 px-3 py-1 mb-6 sm:mb-8">
              <div className="w-2 h-2 rounded-full bg-[#1DE6DB]"></div>
              <span className="text-xs font-bold tracking-wider text-[#1DE6DB]">V4.0 LAUNCH</span>
            </div>
            
            <h1 className="text-[42px] sm:text-6xl md:text-7xl lg:text-[80px] font-extrabold leading-[1.05] tracking-tight mb-6 sm:mb-8">
               Your life,<br />
               <span className="bg-gradient-to-r from-[#FFB1D8] to-[#FF80B6] bg-clip-text text-transparent">
                  understood.
               </span>
            </h1>
            
            <p className="text-base sm:text-lg md:text-[21px] text-white/60 font-light leading-[1.6] mb-8 sm:mb-10 max-w-lg">
              Cortexa is the first autonomous memory engine that transforms your digital footprint into a searchable, actionable intelligence layer. Personal finance, memories, and schedules — perfectly synced.
            </p>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <SignUpButton mode="modal">
                <button className="rounded-full bg-gradient-to-r from-[#FFB1D8] to-[#FF80B6] px-8 py-4 text-base font-bold text-[#3B0E21] shadow-[0_0_20px_rgba(255,128,182,0.4)] transition hover:opacity-90 hover:scale-105 active:scale-95">
                  Get Started Free
                </button>
              </SignUpButton>
              <button className="rounded-full border border-white/10 bg-[#1A0C27] hover:bg-[#2A153A] px-8 py-4 text-base font-bold text-[#FF80B6] transition">
                 Watch the Keynote
              </button>
            </div>
          </div>
          
          <div className="relative justify-self-center lg:justify-self-end mt-8 lg:mt-0 w-full max-w-[400px]">
             <div className="group relative w-full aspect-[7/4] rounded-3xl overflow-hidden flex items-center justify-center cursor-pointer shadow-[0_0_40px_rgba(255,128,182,0.5),0_0_80px_rgba(255,128,182,0.2)] sm:shadow-2xl transition-shadow duration-500 sm:hover:shadow-[0_0_40px_rgba(255,128,182,0.5),0_0_80px_rgba(255,128,182,0.2)]">
                <Image src="/hero_brand.jpg" alt="Cortexa AI" fill className="object-cover object-center transition-all duration-500 drop-shadow-[0_0_50px_rgba(255,128,182,0.8)] scale-105 sm:drop-shadow-none sm:scale-100 sm:group-hover:drop-shadow-[0_0_50px_rgba(255,128,182,0.8)] sm:group-hover:scale-105" priority />
             </div>
             {/* Glow behind mockup — always visible on mobile, enhanced on hover for desktop */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-[#380E53]/40 to-[#FF80B6]/20 blur-[100px] -z-10 rounded-full opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity duration-500"></div>
          </div>
        </div>

        {/* Promo Banner */}
        <div className="mt-20 sm:mt-32 max-w-5xl mx-auto rounded-3xl bg-[#09040c] border border-white/5 p-5 sm:p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-5 sm:gap-6 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
           <div className="flex items-center gap-4 sm:gap-5 text-center md:text-left">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#2A153A] flex items-center justify-center shrink-0">
                 <StarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[#E8D1FF]" />
              </div>
              <div>
                 <h3 className="text-lg sm:text-xl font-bold text-white mb-1 sm:mb-1.5">Limited Founder&apos;s Offer</h3>
                 <p className="text-white/60 text-sm sm:text-[15px]">
                    Join for just <span className="text-[#FF80B6] font-semibold">6rs/month</span> with promocode <span className="px-2 py-0.5 rounded bg-[#FF80B6]/15 text-[#FF80B6] font-mono text-xs ml-1 font-bold">NEW80</span>
                 </p>
              </div>
           </div>
           <SignUpButton mode="modal">
              <button className="whitespace-nowrap rounded-full bg-[#E8D1FF] px-6 sm:px-8 py-3 sm:py-3.5 text-sm sm:text-[15px] font-bold text-[#140A1F] transition hover:bg-white active:scale-95 w-full md:w-auto">
                 CLAIM OFFER
              </button>
           </SignUpButton>
        </div>

        {/* Capabilities Section */}
        <div className="mt-24 sm:mt-40 mb-20">
           <div className="mb-10 sm:mb-14">
              <h4 className="text-[#4194D8] font-bold text-xs tracking-[0.2em] uppercase mb-4">Capabilities</h4>
              <h2 className="text-3xl sm:text-4xl md:text-[44px] font-bold tracking-tight text-[#E8D1FF]">Precision Intelligence.</h2>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Card 1 */}
              <div className="group relative overflow-hidden rounded-[28px] bg-[#140A1F] border border-[#FF80B6]/40 sm:border-white/[0.04] p-8 lg:col-span-1 h-[320px] shadow-[0_0_30px_rgba(255,128,182,0.2)] sm:shadow-lg transition sm:hover:border-[#FF80B6]/50 sm:hover:shadow-[0_0_40px_rgba(255,128,182,0.4)] sm:hover:-translate-y-1">
                 <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPgo8ZGVmcz4KPHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxwYXRoIGQ9Ik0gNDAgMCBMIDAgMCAwIDQwIiBmaWxsPSJub25lIiBzdHJva2U9IiMyQTFCNDUiIHN0cm9rZS13aWR0aD0iMSIvPgo8L3BhdHRlcm4+CjwvZGVmcz4KPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPgo8L3N2Zz4=')" }}></div>
                 <div className="absolute bottom-0 right-0 top-1/3 left-1/4 bg-gradient-to-t from-[#1A0C27] to-transparent z-10 pointer-events-none"></div>
                 <div className="relative z-20 h-full flex flex-col justify-end">
                    <h3 className="text-[22px] font-bold text-[#E8D1FF] mb-3">Natural-language finance</h3>
                    <p className="text-white/60 text-[15px] leading-relaxed">
                       &quot;How much did I spend on dining last month vs my average?&quot; Cortexa parses every transaction into plain English answers.
                    </p>
                 </div>
                 <div className="absolute top-8 right-8 text-[#FF80B6]/15">
                    <ChartBarIcon className="w-[100px] h-[100px]" />
                 </div>
              </div>

              {/* Card 2 */}
              <div className="group relative overflow-hidden rounded-[28px] bg-[#09151A] border border-[#1DE6DB]/40 sm:border-white/[0.04] p-8 lg:col-span-1 h-[320px] shadow-[0_0_30px_rgba(29,230,219,0.2)] sm:shadow-lg transition sm:hover:border-[#1DE6DB]/50 sm:hover:shadow-[0_0_40px_rgba(29,230,219,0.4)] sm:hover:-translate-y-1">
                 <div className="absolute right-0 top-0 opacity-30 pointer-events-none w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#1DE6DB]/20 via-transparent to-transparent"></div>
                 <div className="relative z-20 h-full flex flex-col justify-end">
                    <div className="mb-auto">
                       <CpuChipIcon className="w-12 h-12 text-[#1DE6DB] opacity-80" />
                    </div>
                    <h3 className="text-[22px] font-bold text-white mb-3">Searchable memory</h3>
                    <p className="text-white/60 text-[15px] leading-relaxed max-w-[95%]">
                       Never forget a detail again. From meeting notes to grocery lists, everything is indexed and instantly retrievable.
                    </p>
                 </div>
              </div>

              {/* Card 3 */}
              <div className="group relative overflow-hidden rounded-[28px] bg-[#140A1F] border border-[#FF80B6]/40 sm:border-white/[0.04] p-8 lg:col-span-1 h-[320px] shadow-[0_0_30px_rgba(255,128,182,0.2)] sm:shadow-lg transition sm:hover:border-[#FF80B6]/50 sm:hover:shadow-[0_0_40px_rgba(255,128,182,0.4)] sm:hover:-translate-y-1">
                 <div className="relative z-20 h-full flex flex-col justify-end">
                    <div className="mb-auto inline-flex w-12 h-12 rounded-full bg-[#FF80B6]/10 items-center justify-center">
                       <svg className="w-6 h-6 text-[#FF80B6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                       </svg>
                    </div>
                    <h3 className="text-[22px] font-bold text-[#FFB1D8] mb-3">Spending insights</h3>
                    <p className="text-white/60 text-[15px] leading-relaxed relative">
                       AI-driven pattern recognition identifies hidden costs and suggests optimized saving routes based on your lifestyle.
                       <span className="absolute -bottom-6 left-0 w-3/4 h-1 bg-gradient-to-r from-[#1A0C27] via-[#FF80B6] to-[#1A0C27] opacity-40"></span>
                    </p>
                 </div>
              </div>

              {/* Card 4 (Wide) */}
              <div className="group relative overflow-hidden rounded-[28px] bg-[#1A0B2E] border border-[#B254E8]/40 sm:border-white/[0.04] p-8 lg:col-span-3 min-h-[280px] shadow-[0_0_30px_rgba(178,84,232,0.2)] sm:shadow-lg transition sm:hover:border-[#B254E8]/50 sm:hover:shadow-[0_0_40px_rgba(178,84,232,0.4)] flex flex-col md:flex-row items-center justify-between gap-12">
                 <div className="relative z-20 md:w-1/2 pl-2">
                    <h3 className="text-4xl font-bold text-[#E8D1FF] mb-5">Contextual Reminders</h3>
                    <p className="text-white/60 text-[16px] leading-[1.7] max-w-md">
                       Cortexa doesn&apos;t just remind you at a time; it reminds you in the moment. <span className="text-white">&quot;Remind me to buy lightbulbs when I&apos;m near a hardware store.&quot;</span>
                    </p>
                 </div>
                 <div className="relative z-20 md:w-1/2 flex flex-col justify-center gap-5 w-full max-w-md">
                    {/* Widget 1 */}
                    <div className="rounded-[20px] bg-black/60 border border-white/5 p-4 flex items-center gap-5 backdrop-blur-md relative overflow-hidden shadow-xl">
                       <div className="w-12 h-12 rounded-full bg-[#1DE6DB]/10 flex items-center justify-center text-[#1DE6DB]">
                          <MapPinIcon className="w-6 h-6" />
                       </div>
                       <div>
                          <div className="text-white font-medium text-[15px] mb-0.5">Hardware Store nearby</div>
                          <div className="text-[#1DE6DB] text-sm">Buy smart bulbs</div>
                       </div>
                    </div>
                    {/* Widget 2 */}
                    <div className="rounded-[20px] bg-black/60 border border-white/5 p-4 flex items-center gap-5 backdrop-blur-md relative overflow-hidden shadow-xl ml-6">
                       <div className="w-12 h-12 rounded-full bg-[#B254E8]/10 flex items-center justify-center text-[#B254E8]">
                          <CalendarIcon className="w-6 h-6" />
                       </div>
                       <div>
                          <div className="text-white font-medium text-[15px] mb-0.5">Meeting in 15m</div>
                          <div className="text-[#B254E8] text-sm">Review Q4 metrics</div>
                       </div>
                    </div>
                 </div>
              </div>

           </div>
        </div>

        {/* CTA Section */}
        <div className="py-16 sm:py-24 text-center mt-12 sm:mt-20 relative">
           <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#E8D1FF] mb-6 leading-tight px-2">
              Experience the future <br className="hidden md:block" /> of human agency.
           </h2>
           <p className="text-white/60 text-[15px] sm:text-[17px] max-w-xl mx-auto mb-10 sm:mb-12 leading-relaxed px-2">
              Join over 150,000+ early adopters building a smarter life with Cortexa AI.<br className="hidden md:block" /> No setup required, just your curiosity.
           </p>
           <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 px-4">
              <a href="https://expo.dev/artifacts/eas/n9gaBqr2boNGphTALoCxV1.apk" download className="block w-full sm:w-auto rounded-full bg-[#E8D1FF] px-8 py-4 text-base font-bold text-[#140A1F] shadow-[0_0_20px_rgba(232,209,255,0.2)] transition hover:opacity-90 hover:scale-105 active:scale-95 text-center">
                 Download our Mobile App
              </a>
              <button className="w-full sm:w-auto rounded-full border border-white/10 bg-[#1A0B2E] hover:bg-[#2A153A] px-8 py-4 text-base font-bold text-[#E8D1FF] transition">
                 Explore Desktop
              </button>
           </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 bg-[#050208]/80 backdrop-blur-md px-6 py-12 mt-10">
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
            <div>
               <span className="flex items-center justify-center md:justify-start gap-2 text-base font-bold tracking-tight text-[#E8D1FF] mb-3 uppercase">
                  Cortexa AI
               </span>
               <p className="text-[11px] text-white/40 tracking-widest font-mono">
                  © 2024 CORTEXA AI. PRECISION ENGINEERED INTELLIGENCE.
               </p>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 text-[11px] font-bold tracking-[0.15em] text-white/50 uppercase">
               <a href="#" className="hover:text-white transition">Privacy Policy</a>
               <a href="#" className="hover:text-white transition">Terms of Service</a>
               <a href="#" className="hover:text-white transition">Security</a>
               <a href="#" className="hover:text-white transition">Status</a>
               <a href="#" className="hover:text-white transition">Community</a>
            </div>

            <div className="flex items-center justify-center gap-3">
               <a href="#" className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#FFB1D8] transition">
                  <span className="text-xl font-bold">@</span>
               </a>
               <a href="#" className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#FFB1D8] transition">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                     <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                  </svg>
               </a>
            </div>
         </div>
      </footer>
    </div>
  );
}
