export interface LocalFileItem {
  name: string
  lastModified?: Date
}

const apiOrigin = import.meta.env.VITE_API_ORIGIN ?? ''

export async function getBlob(name: string): Promise<Blob> {
  const resp = await fetch(`${apiOrigin}/api/v1/files/${encodeURIComponent(name)}`)
  if (!resp.ok) {
    throw new Error('下载文件失败')
  }
  return await resp.blob()
}

export async function listBlobs(): Promise<LocalFileItem[]> {
  const resp = await fetch(`${apiOrigin}/api/v1/files`)
  if (!resp.ok) {
    throw new Error('获取文件列表失败')
  }
  const names = (await resp.json()) as string[]
  return names.map((n) => ({ name: n }))
}

export async function uploadBlob(file: File): Promise<void> {
  const formData = new FormData()
  formData.append('file', file)
  const resp = await fetch(`${apiOrigin}/api/v1/files/upload`, {
    method: 'POST',
    body: formData
  })
  if (!resp.ok) {
    throw new Error('上传文件失败')
  }
}

export async function deleteBlob(name: string): Promise<void> {
  const resp = await fetch(`${apiOrigin}/api/v1/files/${encodeURIComponent(name)}`, {
    method: 'DELETE'
  })
  if (!resp.ok) {
    throw new Error('删除文件失败')
  }
}

export async function downloadReviewedDocx(name: string, acceptedOnly = true): Promise<void> {
  const resp = await fetch(
    `${apiOrigin}/api/v1/review/${encodeURIComponent(name)}/export-docx?accepted_only=${acceptedOnly ? 'true' : 'false'}`
  )
  if (!resp.ok) {
    throw new Error('导出审阅版失败')
  }
  const blob = await resp.blob()
  const url = URL.createObjectURL(blob)
  const contentDisposition = resp.headers.get('content-disposition') ?? ''
  const fileNameMatch = /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(contentDisposition)
  const fileName = decodeURIComponent(fileNameMatch?.[1] || fileNameMatch?.[2] || `${name.replace(/\.[^.]+$/, '')}_审阅版.docx`)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
