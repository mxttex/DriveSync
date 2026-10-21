interface LocalFile {
  id?: string
  name?: string
  size?: string
  md5?: string
  path?: string
}

interface DriveFile {
  id?: string
  name?: string
  md5?: string
}

export type {LocalFile, DriveFile}