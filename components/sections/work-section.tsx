"use client"

import { useReveal } from "@/hooks/use-reveal"
import { useRouter } from "next/navigation"

export function WorkSection() {
  const { ref, isVisible } = useReveal(0.3)

  return (
    <section
      ref={ref}
      className="flex h-screen w-screen shrink-0 snap-start items-center px-6 pt-32 md:px-12 md:pt-20 lg:px-16"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div
          className={`mb-8 transition-all duration-700 md:mb-12 ${
            isVisible ? "translate-x-0 opacity-100" : "-translate-x-12 opacity-0"
          }`}
        >
          <h2 className="mb-2 font-sans text-4xl font-light tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Pay easily by
          </h2>
          <p className="font-mono text-sm text-foreground/60 md:text-base">/ Choose your preferred payment method</p>
        </div>

        <div className="space-y-6 md:space-y-8">
          {[
            {
              number: "01",
              title: "Pay via ENS",
              category: "Web3 Identity",
              direction: "right",
            },
            {
              number: "02",
              title: "Tap and Pay",
              category: "NFC Technology",
              direction: "right",
            },
            {
              number: "03",
              title: "Scanning a QR",
              category: "Quick & Secure",
              direction: "left",
            },
            {
              number: "04",
              title: "Pay by Link",
              category: "Share & Pay",
              direction: "left",
            },
           
          ].map((project, i) => (
            <ProjectCard key={i} project={project} index={i} isVisible={isVisible} />
          ))}
        </div>
      </div>
    </section>
  )
}

function ProjectCard({
  project,
  index,
  isVisible,
}: {
  project: { number: string; title: string; category: string;  direction: string }
  index: number
  isVisible: boolean
}) {
  const router = useRouter()
  
  const getRevealClass = () => {
    if (!isVisible) {
      return project.direction === "left" ? "-translate-x-16 opacity-0" : "translate-x-16 opacity-0"
    }
    return "translate-x-0 opacity-100"
  }

  const handleClick = () => {
    // Navigate to ENS resolver page for "Pay via ENS"
    if (project.title === "Pay via ENS") {
      router.push("/ens")
    }
  }

  const isClickable = project.title === "Pay via ENS"

  return (
    <div
      onClick={isClickable ? handleClick : undefined}
      className={`group flex items-center justify-between border-b border-foreground/10 py-6 transition-all duration-700 hover:border-foreground/20 md:py-8 ${getRevealClass()} ${
        isClickable ? "cursor-pointer" : ""
      }`}
      style={{
        transitionDelay: `${index * 150}ms`,
        marginLeft: index % 2 === 0 ? "0" : "auto",
        maxWidth: index % 2 === 0 ? "85%" : "90%",
      }}
    >
      <div className="flex items-start gap-4 md:gap-8">
        <span className="font-mono text-sm text-foreground/30 transition-colors group-hover:text-foreground/50 md:text-base pt-1">
          {project.number}
        </span>
        <div className="flex items-start gap-3 flex-1">
          <div className="flex-1">
            <h3 className="mb-1 font-sans text-xl font-light text-foreground transition-transform duration-300 group-hover:translate-x-2 md:text-2xl lg:text-3xl">
              {project.title}
            </h3>
            <p className="font-mono text-xs text-foreground/50 md:text-sm">{project.category}</p>
          </div>
          {isClickable && (
            <svg className="w-5 h-5 text-foreground/30 group-hover:text-foreground/60 transition-all duration-300 group-hover:translate-x-1 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </div>
    </div>
  )
}
