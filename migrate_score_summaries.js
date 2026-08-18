#!/usr/bin/env node
"use strict";

// v1.925 一次性回補工具。預設只預覽；必須加 --apply 才會寫入 Firestore。
// 驗證方式：GOOGLE_OAUTH_ACCESS_TOKEN，或已安裝並登入 gcloud CLI。

const crypto = require("crypto");
const { execFileSync } = require("child_process");

const args = process.argv.slice(2);
const projectArg = args.find(v => v.startsWith("--project="));
const projectId = projectArg ? projectArg.split("=")[1] : "";
const apply = args.includes("--apply");
const rebuildProgress = args.includes("--rebuild-progress");
if (!projectId) {
  console.error("用法：node migrate_score_summaries.js --project=PROJECT_ID [--apply] [--rebuild-progress]");
  process.exit(1);
}

function accessToken() {
  if (process.env.GOOGLE_OAUTH_ACCESS_TOKEN) return process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  return execFileSync("gcloud", ["auth", "application-default", "print-access-token"], { encoding: "utf8" }).trim();
}

function decode(value) {
  if (!value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return new Date(value.timestampValue);
  if ("nullValue" in value) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value.mapValue) return decodeFields(value.mapValue.fields || {});
  return null;
}

function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decode(value)]));
}

function encode(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === "object") return { mapValue: { fields: encodeFields(value) } };
  return { stringValue: String(value) };
}

function encodeFields(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, encode(value)]));
}

function legacyTopicId(first, batch) {
  if (first.topicId) return String(first.topicId);
  const key = [first.subjectId || "subject", first.chapterId || first.chapterName || first.category || batch.topic || "未分類"].join("|");
  return "legacy_" + crypto.createHash("sha256").update(key).digest("hex").slice(0, 24);
}

function makeSummary(batch, documentName, topicMap) {
  let details = [];
  try { details = JSON.parse(batch.detailsJson || "[]"); } catch (_) {}
  const first = details[0] || {};
  const topicMeta = topicMap.get(batch.topic) || {};
  const batchId = batch.batchId || documentName.split("/").pop();
  const questionCount = Number(batch.correctCount || 0) + Number(batch.wrongCount || 0);
  const clientDate = new Date(batch.clientCreatedAt || batch.createdAt || 0);
  return {
    batchId,
    uid: batch.uid || "",
    studentId: batch.studentId || "",
    name: batch.name || "",
    className: batch.className || "",
    campus: batch.campus || "",
    courseId: first.courseId || topicMeta.courseId || "",
    subjectId: first.subjectId || "",
    subjectName: first.subjectName || "",
    topicId: batch.topic === "綜合練習" ? "topic_comprehensive" : (first.topicId || topicMeta.topicId || legacyTopicId(first, batch)),
    topicName: first.chapterName || first.category || topicMeta.chapterName || batch.topic || "未分類",
    topicDisplayName: batch.topic || "未分類",
    mode: batch.mode || "完整測驗",
    isRetryMode: !!batch.isRetryMode,
    countsTowardBest: !batch.isRetryMode && batch.countsTowardScore === true,
    countsTowardCompletion: !batch.isRetryMode && batch.countsTowardScore === true,
    attempt: Number(batch.attempt || 1),
    score: Number(batch.score || 0),
    correctCount: Number(batch.correctCount || 0),
    wrongCount: Number(batch.wrongCount || 0),
    questionCount,
    duration: Number(batch.duration || 0),
    avgAnswerSec: questionCount > 0 && Number(batch.duration || 0) > 0 ? Math.round(Number(batch.duration) / questionCount) : null,
    answeredAt: Number.isNaN(clientDate.getTime()) ? new Date() : clientDate,
    clientAnsweredAt: batch.clientCreatedAt || "",
    source: "migration-v1.925"
  };
}

async function firestoreRequest(path, options = {}) {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken()}`, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
}

async function loadBatches() {
  return loadCollection("answerBatches");
}

async function loadCollection(collectionId) {
  const rows = await firestoreRequest("documents:runQuery", {
    method: "POST",
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId }] } })
  });
  return rows.filter(row => row.document).map(row => ({
    name: row.document.name,
    data: decodeFields(row.document.fields || {})
  }));
}

function mergeProgress(existing, summaries, settings) {
  const passScore = Number(settings.passScore || existing.passScore || 80);
  const topicProgress = { ...(existing.topicProgress || {}) };
  const detailMap = new Map((existing.details || []).filter(d => d && d.topic).map(d => [d.topic, { ...d }]));
  const sorted = [...summaries].sort((a, b) => new Date(a.answeredAt) - new Date(b.answeredAt));
  sorted.forEach(summary => {
    if (!summary.countsTowardBest || summary.topicId === "topic_comprehensive") return;
    const legacy = detailMap.get(summary.topicDisplayName) || {};
    const current = topicProgress[summary.topicId] || {};
    const oldBest = current.bestCountsTowardScore === true
      ? current.best
      : (legacy.bestCountsTowardScore === true ? legacy.best : null);
    const best = oldBest === null || oldBest === undefined ? summary.score : Math.max(Number(oldBest) || 0, summary.score);
    const item = {
      ...current,
      topicId: summary.topicId,
      topic: summary.topicDisplayName,
      topicName: summary.topicName,
      courseId: summary.courseId,
      subjectId: summary.subjectId,
      best,
      lastScore: summary.score,
      passed: best >= passScore,
      bestCountsTowardScore: true,
      avgSec: summary.avgAnswerSec,
      lastBatchId: summary.batchId,
      lastAnsweredAt: summary.answeredAt,
      lastAnsweredAtText: summary.clientAnsweredAt || new Date(summary.answeredAt).toISOString()
    };
    topicProgress[summary.topicId] = item;
    detailMap.set(summary.topicDisplayName, { ...item });
  });
  const latest = sorted[sorted.length - 1] || {};
  return {
    ...existing,
    studentId: existing.studentId || latest.studentId || "",
    uid: existing.uid || latest.uid || "",
    name: existing.name || latest.name || "",
    className: existing.className || latest.className || "",
    campus: existing.campus || latest.campus || "",
    passScore,
    completionTopics: settings.completionTopics || existing.completionTopics || [],
    completionTopicIds: settings.completionTopicIds || existing.completionTopicIds || [],
    details: [...detailMap.values()],
    topicProgress,
    source: "migration-v1.925-progress",
    updatedAtText: new Date().toISOString()
  };
}

async function loadTopicMap() {
  try {
    const document = await firestoreRequest("documents/system/main");
    const settings = decodeFields(document.fields || {});
    return new Map((settings.topics || []).map(topic => [String(topic.name || topic.topic || ""), topic]).filter(([name]) => name));
  } catch (err) {
    console.warn("無法讀取 system/main topic 對照，舊資料將使用 legacy topicId：", err.message);
    return new Map();
  }
}

async function commitSummaries(items) {
  for (let offset = 0; offset < items.length; offset += 400) {
    const chunk = items.slice(offset, offset + 400);
    const writes = chunk.map(item => ({
      update: {
        name: `projects/${projectId}/databases/(default)/documents/scoreSummaries/${encodeURIComponent(item.batchId)}`,
        fields: encodeFields(item)
      }
    }));
    await firestoreRequest("documents:commit", { method: "POST", body: JSON.stringify({ writes }) });
    console.log(`已回補 ${Math.min(offset + chunk.length, items.length)} / ${items.length}`);
  }
}

async function commitProgress(items) {
  for (let offset = 0; offset < items.length; offset += 200) {
    const chunk = items.slice(offset, offset + 200);
    const writes = chunk.map(item => ({
      update: {
        name: `projects/${projectId}/databases/(default)/documents/studentProgress/${encodeURIComponent(item.studentId)}`,
        fields: encodeFields(item)
      }
    }));
    await firestoreRequest("documents:commit", { method: "POST", body: JSON.stringify({ writes }) });
    console.log(`已重建完成度 ${Math.min(offset + chunk.length, items.length)} / ${items.length}`);
  }
}

(async () => {
  const batches = await loadBatches();
  const topicMap = await loadTopicMap();
  const eligible = batches.filter(item => item.data.studentId && !item.data.isRetryMode && item.data.countsTowardScore === true);
  const summaries = eligible.map(item => makeSummary(item.data, item.name, topicMap));
  const unresolved = summaries.filter(item => item.topicId.startsWith("legacy_"));
  console.log(`answerBatches：${batches.length}；可回補正式成績：${summaries.length}；舊 topicId fallback：${unresolved.length}`);
  if (!apply) {
    console.log(`目前為預覽模式，未寫入。確認後加入 --apply${rebuildProgress ? "；本次也將重建 studentProgress" : ""}。`);
    return;
  }
  await commitSummaries(summaries);
  if (rebuildProgress) {
    console.warn("即將重建 studentProgress；請在停止學生交卷的維護時段執行，避免與新成績同時更新。");
    const progressDocs = await loadCollection("studentProgress");
    const existingByStudent = new Map(progressDocs.map(item => [String(item.data.studentId || item.name.split("/").pop()), item.data]));
    const byStudent = new Map();
    summaries.forEach(summary => {
      if (!byStudent.has(summary.studentId)) byStudent.set(summary.studentId, []);
      byStudent.get(summary.studentId).push(summary);
    });
    const settingsDoc = await firestoreRequest("documents/system/main");
    const system = decodeFields(settingsDoc.fields || {});
    const settings = system.completionSettings || {};
    const rebuilt = [...byStudent.entries()].map(([studentId, list]) => mergeProgress(existingByStudent.get(studentId) || {}, list, settings));
    await commitProgress(rebuilt);
  }
  console.log("scoreSummaries 回補完成。相同 batchId 可安全重跑。 ");
})().catch(err => {
  console.error("回補失敗：", err.message);
  process.exitCode = 1;
});
