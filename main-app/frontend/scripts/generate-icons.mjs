import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = resolve(__dirname, '../public/favicon.svg')
const svgBuffer = readFileSync(svgPath)

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for (const size of sizes) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(resolve(__dirname, `../public/icons/icon-${size}x${size}.png`))
  console.log(`Generated icon-${size}x${size}.png`)
}

// Apple touch icon (180x180)
await sharp(svgBuffer)
  .resize(180, 180)
  .png()
  .toFile(resolve(__dirname, '../public/icons/apple-touch-icon.png'))
console.log('Generated apple-touch-icon.png')

// Maskable icon (512x512 with padding for safe zone)
await sharp(svgBuffer)
  .resize(410, 410)
  .extend({ top: 51, bottom: 51, left: 51, right: 51, background: { r: 5, g: 150, b: 105, alpha: 1 } })
  .png()
  .toFile(resolve(__dirname, '../public/icons/icon-512x512-maskable.png'))
console.log('Generated icon-512x512-maskable.png')

console.log('All icons generated successfully!')
