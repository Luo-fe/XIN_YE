/**
 * 内容管理 API 客户端
 * 对接 server-plugin.js 中的 /api/content/* 接口
 * 直接读写 blog/src/data/ 下的 JSON 和 MD 文件
 */

const BASE = '/api/content'

/** 通用请求封装 */
async function request(url, options = {}) {
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(data.error || `请求失败 (${resp.status})`)
  }
  return data
}

// ===== JSON 资源 CRUD（moods / moments / anniversaries / timeline / friends）=====

/** 读取资源列表 */
export async function listItems(resource) {
  const { data } = await request(`${BASE}/${resource}`)
  return data
}

/** 新增条目 */
export async function createItem(resource, item) {
  const { data } = await request(`${BASE}/${resource}`, {
    method: 'POST',
    body: JSON.stringify(item),
  })
  return data
}

/** 更新单条 */
export async function updateItem(resource, id, patch) {
  const { data } = await request(`${BASE}/${resource}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
  return data
}

/** 删除单条 */
export async function deleteItem(resource, id) {
  await request(`${BASE}/${resource}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/** 批量替换（整体覆盖） */
export async function replaceAll(resource, items) {
  const { data } = await request(`${BASE}/${resource}`, {
    method: 'PUT',
    body: JSON.stringify(items),
  })
  return data
}

// ===== 日记管理 =====

/** 列出日记 */
export async function listDiaries() {
  const { data } = await request(`${BASE}/diaries`)
  return data
}

/** 读取单篇日记 */
export async function readDiary(filename) {
  const { data } = await request(`${BASE}/diaries/${encodeURIComponent(filename)}`)
  return data
}

/** 新建/更新日记（filename 为空时新建） */
export async function saveDiary({ filename, title, date, cover, summary, content }) {
  const url = filename
    ? `${BASE}/diaries/${encodeURIComponent(filename)}`
    : `${BASE}/diaries`
  const { data } = await request(url, {
    method: filename ? 'PUT' : 'POST',
    body: JSON.stringify({ title, date, cover, summary, content }),
  })
  return data
}

/** 删除日记 */
export async function deleteDiary(filename) {
  await request(`${BASE}/diaries/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  })
}

// ===== 照片管理 =====

/** 读取照片 manifest */
export async function listPhotos() {
  const { data } = await request(`${BASE}/photos-manifest`)
  return data
}

/** 整体替换照片 manifest */
export async function savePhotosManifest(items) {
  const { data } = await request(`${BASE}/photos-manifest`, {
    method: 'PUT',
    body: JSON.stringify(items),
  })
  return data
}

/** 上传缩略图（dataUrl → 服务端写入 public/photos/） */
export async function uploadThumbnail(filename, dataUrl) {
  const { data } = await request(
    `${BASE}/photo-thumb/${encodeURIComponent(filename)}`,
    {
      method: 'POST',
      body: JSON.stringify({ dataUrl }),
    },
  )
  return data
}

/**
 * 批量物理删除照片
 * 删除缩略图文件 + 从 local-photos-manifest.json / photos-manifest.json 中移除记录
 * @param {string[]} ids 照片 ID 列表
 * @returns {Promise<{ deletedFiles: number, deletedRecords: number, errors: string[] }>}
 */
export async function batchDeletePhotos(ids) {
  const { data } = await request(`${BASE}/photos/batch-delete`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
  return data
}
