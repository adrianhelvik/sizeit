const chalk = require('chalk')
const path = require('path')
const fs = require('fs')

const rootDir = process.argv[2] || process.cwd()

const scan = async (dir = rootDir, contents = {}) => {
  const files = await fs.promises.readdir(dir)

  await Promise.all(
    files.map(async file => {
      const absFile = path.resolve(dir, file)
      const stats = await fs.promises.lstat(absFile)

      if (stats.isDirectory()) {
        try {
          contents[file] = await scan(absFile)
        } catch (e) {
          return
        }
      } else {
        contents[file] = stats.size
      }
    }),
  )

  return contents
}

process.on('unhandledRejection', e => {
  throw e
})

scan().then(contents => {
  const total = {}
  for (const key of Object.keys(contents)) {
    total[key] = (function sum(contents) {
      if (typeof contents === 'number') return contents
      return Object.keys(contents)
        .map(key => sum(contents[key]))
        .reduce((total, current) => total + current, 0)
    })(contents[key])
  }

  const folders = Object.keys(total).sort((a, b) => total[b] - total[a])
  const size = folders
    .map(folder => total[folder])
    .reduce((max, curr) => Math.max(max, fmtSize(curr).length), 0)

  for (const folder of folders) {
    console.log(
      `${chalk.bold(
        String(fmtSize(total[folder])).padStart(size, ' '),
      )}   ${folder}`,
    )
  }
})

function fmtSize(size) {
  if (size > 1024 ** 3) return (size / 1024 ** 3).toFixed(1) + 'gb'
  if (size > 1024 ** 2) return (size / 1024 ** 2).toFixed(1) + 'mb'
  if (size > 1024) return (size / 1024).toFixed(1) + 'kb'
  return size + ' b '
}