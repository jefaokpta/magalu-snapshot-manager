'use strict';

const BASE_URL = 'https://api.magalu.cloud/br-se1/compute';
const PAGE_SIZE = 200;

function assertApiKey() {
  if (!process.env.X_API_KEY) {
    throw new Error(
      'X_API_KEY não definida. Defina a variável de ambiente X_API_KEY ' +
        '(localmente use --env-file=.env; no GitHub Actions deixe no secret X_API_KEY).'
    );
  }
}

async function request(path, options = {}) {
  assertApiKey();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'x-api-key': process.env.X_API_KEY,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      try {
        detail = await res.text();
      } catch {
        detail = '';
      }
    }
    const err = new Error(
      `HTTP ${res.status} em ${options.method || 'GET'} ${path}${detail ? ': ' + detail : ''}`
    );
    err.status = res.status;
    err.path = path;
    throw err;
  }

  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return null;
}

async function listAll(path, key) {
  const items = [];
  let offset = 0;
  while (true) {
    const sep = path.includes('?') ? '&' : '?';
    const data = await request(`${path}${sep}_limit=${PAGE_SIZE}&_offset=${offset}`);
    const batch = data && data[key] ? data[key] : [];
    items.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return items;
}

async function listInstances() {
  return listAll('/v1/instances', 'instances');
}

async function listSnapshots() {
  return listAll('/v1/snapshots', 'snapshots');
}

async function createSnapshot(instanceId, name) {
  return request('/v1/snapshots', {
    method: 'POST',
    body: JSON.stringify({ name, instance: { id: instanceId } }),
  });
}

async function deleteSnapshot(id) {
  return request(`/v1/snapshots/${id}`, { method: 'DELETE' });
}

module.exports = {
  listInstances,
  listSnapshots,
  createSnapshot,
  deleteSnapshot,
};