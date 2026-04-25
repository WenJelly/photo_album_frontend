const BASE83_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~"

function decode83(value: string) {
  let result = 0

  for (const char of value) {
    const digit = BASE83_ALPHABET.indexOf(char)

    if (digit === -1) {
      return null
    }

    result = result * 83 + digit
  }

  return result
}

function sRGBToLinear(value: number) {
  const normalizedValue = value / 255

  if (normalizedValue <= 0.04045) {
    return normalizedValue / 12.92
  }

  return ((normalizedValue + 0.055) / 1.055) ** 2.4
}

function linearToSRGB(value: number) {
  const normalizedValue = Math.max(0, Math.min(1, value))
  const srgb = normalizedValue <= 0.0031308 ? normalizedValue * 12.92 : 1.055 * normalizedValue ** (1 / 2.4) - 0.055

  return Math.round(srgb * 255)
}

function signedPow(value: number, exponent: number) {
  return Math.sign(value) * Math.abs(value) ** exponent
}

function decodeDC(value: number): [number, number, number] {
  const red = value >> 16
  const green = (value >> 8) & 255
  const blue = value & 255

  return [sRGBToLinear(red), sRGBToLinear(green), sRGBToLinear(blue)]
}

function decodeAC(value: number, maximumValue: number): [number, number, number] {
  const quantR = Math.floor(value / (19 * 19))
  const quantG = Math.floor(value / 19) % 19
  const quantB = value % 19

  return [
    signedPow((quantR - 9) / 9, 2) * maximumValue,
    signedPow((quantG - 9) / 9, 2) * maximumValue,
    signedPow((quantB - 9) / 9, 2) * maximumValue,
  ]
}

export function isValidBlurHash(blurHash?: string | null) {
  if (!blurHash) {
    return false
  }

  const sizeFlag = decode83(blurHash[0] ?? "")
  if (sizeFlag === null) {
    return false
  }

  const numY = Math.floor(sizeFlag / 9) + 1
  const numX = (sizeFlag % 9) + 1
  const expectedLength = 4 + 2 * numX * numY

  return blurHash.length === expectedLength && decode83(blurHash.slice(1, 2)) !== null
}

export function decodeBlurHashToPixels(blurHash: string, width: number, height: number, punch = 1) {
  if (!isValidBlurHash(blurHash) || width <= 0 || height <= 0) {
    return null
  }

  const sizeFlag = decode83(blurHash[0] ?? "")
  const quantizedMaximumValue = decode83(blurHash[1] ?? "")

  if (sizeFlag === null || quantizedMaximumValue === null) {
    return null
  }

  const numY = Math.floor(sizeFlag / 9) + 1
  const numX = (sizeFlag % 9) + 1
  const maximumValue = ((quantizedMaximumValue + 1) / 166) * punch
  const colors: Array<[number, number, number]> = []

  for (let index = 0; index < numX * numY; index += 1) {
    const encodedValue = decode83(blurHash.slice(2 + index * 2, 4 + index * 2))

    if (encodedValue === null) {
      return null
    }

    colors.push(index === 0 ? decodeDC(encodedValue) : decodeAC(encodedValue, maximumValue))
  }

  const pixels = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let red = 0
      let green = 0
      let blue = 0

      for (let j = 0; j < numY; j += 1) {
        for (let i = 0; i < numX; i += 1) {
          const basis = Math.cos((Math.PI * x * i) / width) * Math.cos((Math.PI * y * j) / height)
          const color = colors[i + j * numX]

          if (!color) {
            continue
          }

          red += color[0] * basis
          green += color[1] * basis
          blue += color[2] * basis
        }
      }

      const pixelIndex = 4 * (x + y * width)
      pixels[pixelIndex] = linearToSRGB(red)
      pixels[pixelIndex + 1] = linearToSRGB(green)
      pixels[pixelIndex + 2] = linearToSRGB(blue)
      pixels[pixelIndex + 3] = 255
    }
  }

  return pixels
}
