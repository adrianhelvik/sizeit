#!/usr/bin/env node

const path = require('path')
const fs = require('fs')

const rootDir = process.argv[2] || process.cwd()

const isProfiling = process.env.PROFILE_SIZEIT === 'true'

const scan = async (dir = rootDir, contents = {}) => {
  let nonDirectoryStats = false

  const files = await fs.promises.readdir(dir).catch(async e => {
    const stats = await fs.promises.lstat(dir)

    if (!stats.isDirectory()) {
      nonDirectoryStats = stats
    } else {
      throw e
    }
  })

  if (nonDirectoryStats) {
    const folderName = path.basename(dir)
    return { [folderName]: nonDirectoryStats.size }
  }

  await Promise.all(
    files.map(async file => {
      const absFile = path.resolve(dir, file)
      const stats = await fs.promises.lstat(absFile)

      if (stats.isDirectory()) {
        try {
          contents[file] = await scan(absFile)
        } catch (e) {}
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

if (isProfiling) {
  var start = new Date()
}

scan().then(contents => {
  if (isProfiling) {
    const end = new Date()
    console.log(`Scan duration: ${fmtTime(end - start)}\n`)
  }

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

  if (isProfiling) {
    const end = new Date()
    console.log(`\nFull duration: ${fmtTime(end - start)}`)
  }
})

function fmtSize(size) {
  if (size > 1024 ** 3) return (size / 1024 ** 3).toFixed(1) + 'GiB'
  if (size > 1024 ** 2) return (size / 1024 ** 2).toFixed(1) + 'MiB'
  if (size > 1024) return (size / 1024).toFixed(1) + 'KiB'
  return size + 'B  '
}

function fmtTime(timeInMillis) {
  if (timeInMillis > 300) {
    return (timeInMillis / 1000).toFixed(3) + 's'
  }
  return timeInMillis + 'ms'
}
