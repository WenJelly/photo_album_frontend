const HOME_HERO_IMAGE_URL =
  "https://picture-storage-1325426290.cos.ap-guangzhou.myqcloud.com/public/1921565781396983809/2025-05-11_EsuDN34k9DzFdTajwebp"

export function HeroIntro() {
  return (
    <section data-testid="home-hero-shell" className="w-full pb-0 pt-0">
      <div
        data-testid="home-hero"
        className="min-h-screen w-full bg-[#d8d3cb]"
        style={{
          backgroundImage: `url(${HOME_HERO_IMAGE_URL})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      />
    </section>
  )
}
