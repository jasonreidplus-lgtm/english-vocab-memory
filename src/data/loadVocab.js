/* ============================================================
   数据加载 —— 只读 vocab.json，整包加载后按 group 切成 550 关。
   架构铁律 2：所有关卡都由数据渲染；铁律 3：绝不修改任何词条字段。
   ============================================================ */

// 一个词条被认为“已生成、可用于学习/闯关”的判断。
// 兼容真实词库里 status 尚未生成完的情况：只有 status === 'done' 才算就绪。
export function isWordReady(w) {
  return w && w.status === 'done' && typeof w.word === 'string' && w.word.length > 0;
}

// 把扁平词条列表整理成有序关卡数组
export function buildLevels(records) {
  const byGroup = new Map();
  const byId = new Map();

  for (const r of records) {
    if (r == null || r.group == null) continue;
    byId.set(r.id, r);
    if (!byGroup.has(r.group)) byGroup.set(r.group, []);
    byGroup.get(r.group).push(r);
  }

  const levels = [...byGroup.keys()]
    .sort((a, b) => a - b)
    .map((group) => {
      const words = byGroup.get(group).slice().sort((a, b) => {
        if (a.id != null && b.id != null) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
        return 0;
      });
      const readyWords = words.filter(isWordReady);
      return {
        group,
        words,
        readyWords,
        // 关卡“已生成”= 至少有一个就绪词条；真实满关应为 10 个
        ready: readyWords.length > 0,
        count: words.length,
        readyCount: readyWords.length,
      };
    });

  return { levels, byId };
}

async function fetchJson(url) {
  // 不强制 no-cache：交给 Service Worker 的 stale-while-revalidate + HTTP 条件请求，
  // 重复访问走缓存秒开、后台校验只回 304，省流量。数据更新时 bump sw.js 的 CACHE 版本即可。
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
  return res.json();
}

// 加载词库。优先轻量索引(懒加载富字段)；没有索引则回退整包 vocab.json。
export async function loadVocab() {
  const base = import.meta.env.BASE_URL;

  // ① 轻量索引(只含 id/group/word/phonetic/base_meaning/pos/status)
  try {
    const records = await fetchJson(`${base}data/vocab-index.json`);
    if (Array.isArray(records) && records.length) {
      const { levels, byId } = buildLevels(records);
      return pack(levels, byId, records, true);
    }
  } catch {
    /* 无索引 → 回退整包 */
  }

  // ② 回退：整包 vocab.json（仍是唯一可编辑数据源）
  const data = await fetchJson(`${base}data/vocab.json`);
  const records = Array.isArray(data) ? data : data.words || data.records || [];
  if (!Array.isArray(records)) {
    throw new Error('vocab.json 格式不正确：期望一个数组，或 { words: [...] }');
  }
  const { levels, byId } = buildLevels(records);
  return pack(levels, byId, records, false);
}

function pack(levels, byId, records, lazy) {
  return {
    levels,
    byId,
    lazy,
    totalGroups: levels.length,
    totalWords: records.length,
    readyGroups: levels.filter((l) => l.ready).length,
  };
}

// 懒加载某 group 的富字段：{ [id]: { roots, examples, confusions, exam_tip, mnemonic } }
export async function loadGroupDetail(group) {
  return fetchJson(`${import.meta.env.BASE_URL}data/groups/g${group}.json`);
}
