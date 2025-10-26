"use client"

import { useReveal } from "@/hooks/use-reveal"
import Image from "next/image"

export function ServicesSection() {
  const { ref, isVisible } = useReveal(0.3)

  return (
    <section
      ref={ref}
      className="flex h-screen w-screen shrink-0 snap-start items-center px-6 pt-20 md:px-12 md:pt-0 lg:px-16"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div
          className={`mb-2 transition-all duration-700 md:mb-2 ${
            isVisible ? "translate-y-0 opacity-100" : "-translate-y-12 opacity-0"
          }`}
        >
          <p className="font-mono text-sm text-foreground/60 md:text-base">/ Services</p>
        </div>

        {/* Architecture Diagram */}
        <div
          className={`transition-all duration-700 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
          }`}
          style={{ transitionDelay: "200ms" }}
        >
          <div className="bg-foreground/5 backdrop-blur-sm border border-foreground/10 rounded-2xl p-4 md:p-6 lg:p-8 overflow-hidden">
            <div className="relative w-full max-w-5xl mx-auto" style={{ aspectRatio: '16/9' }}>
              <Image
                src="/Architecture.png"
                alt="NexxPay Architecture - Payment flow diagram showing unified balance, Nexus supported chains, and bridge & execute for non-supported chains"
                fill
                className="object-contain rounded-xl"
                priority
                sizes="(max-width: 640px) 90vw, (max-width: 1024px) 80vw, 65vw"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
