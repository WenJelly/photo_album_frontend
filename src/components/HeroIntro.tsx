import heroImg from "@/assets/hero.png"

export function HeroIntro() {
  return (
    <section data-testid="home-hero-shell" className="w-full pb-0 pt-0">
      <div
        data-testid="home-hero"
        className="min-h-screen w-full bg-[#d8d3cb]"
        style={{
          backgroundImage: `url(${heroImg})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      />
    </section>
  )
}
