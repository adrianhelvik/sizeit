#!/usr/bin/env node

const path = require('path')
const fs = require('fs')

const rootDir = process.argv[2] || process.cwd()

const scan = async (dir = rootDir, contents = {}) => {
  const stats = await fs.promises.lstat(dir)

  if (!stats.isDirectory()) {
    const tmp = dir.split('/')
    const folderName = tmp[tmp.length - 1]
    return { [folderName]: stats.size }
  }

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
      `${String(fmtSize(total[folder])).padStart(size, ' ')}   ${folder}`,
    )
  }
})

function fmtSize(size) {
  if (size > 1024 ** 3) return (size / 1024 ** 3).toFixed(1) + 'GiB'
  if (size > 1024 ** 2) return (size / 1024 ** 2).toFixed(1) + 'MiB'
  if (size > 1024) return (size / 1024).toFixed(1) + 'KiB'
  return size + 'B  '
}
