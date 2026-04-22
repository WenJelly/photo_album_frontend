import type { Ref } from "react"

import { SphereExperienceSection } from "@/components/sphere-experience/SphereExperienceSection"
import type { SphereDataSource } from "@/components/sphere-experience/types"
import { listPictures } from "@/lib/picture-api"

const HOME_HERO_IMAGE_URL =
  "https://picture-storage-1325426290.cos.ap-guangzhou.myqcloud.com/public/1/2026-04-21_545afae3f7420c3b.webp?imageMogr2/thumbnail/2560x2560>/format/webp/quality/85!/minsize/1/ignore-error/1"

interface HeroIntroProps {
  heroRef?: Ref<HTMLElement>
}

const homeSphereDataSource: SphereDataSource = {
  async fetchImages({ limit }) {
    const result = await listPictures({ pageNum: 1, pageSize: limit })

    return result.list.map((photo) => ({
      id: photo.id,
      imageUrl: photo.thumbnailSrc?.trim() || photo.src.trim(),
      alt: photo.alt,
    }))
  },
}

export function HeroIntro({ heroRef }: HeroIntroProps) {
  return (
    <>
      <section ref={heroRef} data-testid="home-hero-shell" className="home-hero-shell w-full pb-0 pt-0">
        <div
          data-testid="home-hero"
          className="home-hero-surface min-h-screen w-full bg-[#d8d3cb]"
          style={{
            backgroundImage: `url(${HOME_HERO_IMAGE_URL})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        />
      </section>
      <SphereExperienceSection dataSource={homeSphereDataSource} />
    </>
  )
}
