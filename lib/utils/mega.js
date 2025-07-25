import { File } from 'megajs'

export async function downloadSessionFromMega(megaLink) {
  return new Promise((resolve, reject) => {
    const file = File.fromURL(megaLink)
    file.loadAttributes((err, f) => {
      if (err) return reject(err)
      let chunks = []
      let stream = f.download()
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', () => resolve(Buffer.concat(chunks)))
      stream.on('error', reject)
    })
  })
}
