export async function getRepository(repository, { signal, fetcher = fetch } = {}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || repository.length > 180) throw new Error('owner/repository 형식이 필요합니다.');
  const response = await fetcher(`https://api.github.com/repos/${repository}`, { signal,
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'gods-eye-tools' } });
  if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
  const data = await response.json();
  return { name: data.full_name, url: data.html_url, description: data.description,
    license: data.license?.spdx_id || 'unconfirmed', archived: data.archived, updatedAt: data.updated_at };
}
