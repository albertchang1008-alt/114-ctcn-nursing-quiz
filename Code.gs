// Google Apps Script — 題庫系統 v1.935 slim
// 角色：Google Sheet 是老師維護入口；學生端與運算工作都在 Firebase。
// 保留功能：
// 1. 題庫 / 系統設定 / 可選學生名單 → Firestore
// 2. Firestore answerBatches → Google Sheet 成績紀錄
// 3. 基本設定儲存、學生 email 檢查、同步狀態
// 已移除：GAS 學生登入、GAS 判分、GAS 即時排行、GAS 錯題查詢、GAS 舊後台分析。

const SHEET_QUESTIONS = "題庫";
const SHEET_SETTINGS = "系統設定";
const SHEET_STUDENTS = "學生名單";
const SHEET_SCORES = "成績紀錄";
const APP_VERSION = "v1.935";
const ADMIN_SESSION_TTL_SECONDS = 21600;
const ADMIN_LOGIN_WINDOW_SECONDS = 600;
const ADMIN_LOGIN_MAX_FAILURES = 5;
const COMPLETION_DASHBOARD_CACHE_SECONDS = 120;
const COMPLETION_DASHBOARD_CACHE_MAX_BYTES = 90000;
const RECENT_ANSWERS_CACHE_SECONDS = 120;

const SCORE_HEADERS = [
  "時間戳記", "學號", "姓名", "測驗單元", "測驗模式", "第幾次",
  "分數", "答對題數", "答錯題數", "作答秒數",
  "Batch ID", "Google Email", "Firebase UID", "Auth Provider", "Details JSON"
];

function doGet(e) {
  return jsonResponse({
    status: "ok",
    service: "quiz-gas-slim",
    version: APP_VERSION,
    message: "學生端不使用 GAS；請由後台執行同步。"
  });
}

function doPost(e) {
  try {
    var payload = parsePayload(e);
    var action = String(payload.action || "");
    if (action === "adminLogin") return handleAdminLogin(payload);
    var adminSession = requireAdminSessionV1935(payload);
    if (action === "verifyAdminSession") return jsonResponse({ status: "ok", verified: true, adminName: adminSession.adminName, expiresAt: adminSession.expiresAt });
    if (action === "adminLogout") return handleAdminLogoutV1935(payload);
    if (action === "getCompletionDashboardV1935") return handleGetCompletionDashboardV1935(payload);
    if (action === "getRecentAnswersV1935") return handleGetRecentAnswersV1935(payload);
    if (action === "saveSettings") return handleSaveSettings(payload);
    if (action === "syncQuestionBankV1925") return handleSyncQuestionBankV1925(payload);
    if (action === "syncSettingsV1925") return handleSyncSettingsV1925(payload);
    if (action === "syncStudentsV1925") return handleSyncStudentsV1925(payload);
    if (action === "syncFirebaseV19" || action === "syncFirebaseV1685" || action === "syncAllFirebaseV1925") return handleSyncFirebaseV19(payload);
    if (action === "getFirebaseBootstrap") return jsonResponse({ status: "ok", data: buildFirebasePayloadV19() });
    if (action === "validateStudentEmailsV19") return handleValidateStudentRosterV1925();
    if (action === "getSyncStatusV19") return handleGetSyncStatusV19();
    if (action === "syncFirestoreScoresToSheetsV19") return handleSyncFirestoreScoresToSheetsV19(payload);
    if (action === "migrateWrongQuestionsV2") return handleMigrateWrongQuestionsV2();
    if (action === "getTeacherData") return handleGetTeacherDataSlim();
    return jsonResponse({
      status: "error",
      message: "GAS slim 已移除此 action：" + action + "。學生端請使用 Firebase；後台分析請改讀 Firestore 匯出資料。"
    });
  } catch (err) {
    if (err && err.code === "AUTH_REQUIRED") {
      return jsonResponse({ status: "auth_required", message: err.message || "管理員登入已失效，請重新登入。" });
    }
    console.error("GAS 管理 action 失敗：", err && err.stack ? err.stack : err);
    return jsonResponse({ status: "error", message: err && err.message ? err.message : "伺服器處理失敗" });
  }
}

function handleAdminLogin(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("管理人名單");
  if (!sheet || sheet.getLastRow() <= 1) return jsonResponse({ status: "error", verified: false, message: "尚未建立管理人名單" });
  var adminId = String(payload.adminId || "").trim();
  var adminPassword = String(payload.adminPassword || "").trim();
  var cache = CacheService.getScriptCache();
  var failureKey = adminLoginFailureKeyV1935(adminId);
  var failureCount = Number(cache.get(failureKey) || 0);
  if (failureCount >= ADMIN_LOGIN_MAX_FAILURES) {
    return jsonResponse({ status: "rate_limited", verified: false, message: "登入失敗次數過多，請 10 分鐘後再試。" });
  }
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(3, sheet.getLastColumn())).getValues();
  for (var i = 0; i < rows.length; i++) {
    var id = rows[i][0] ? String(rows[i][0]).trim() : "";
    var pwd = rows[i][1] ? String(rows[i][1]).trim() : "";
    var name = rows[i][2] ? String(rows[i][2]).trim() : id;
    if (id === adminId && pwd === adminPassword) {
      cache.remove(failureKey);
      var session = createAdminSessionV1935(adminId, name);
      return jsonResponse({
        status: "ok",
        verified: true,
        adminName: name,
        adminSessionToken: session.token,
        expiresAt: session.expiresAt,
        expiresInSeconds: ADMIN_SESSION_TTL_SECONDS
      });
    }
  }
  cache.put(failureKey, String(failureCount + 1), ADMIN_LOGIN_WINDOW_SECONDS);
  return jsonResponse({ status: "ok", verified: false, message: "帳號或密碼錯誤" });
}

function adminDigestV1935(value) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ""), Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "");
}

function adminSessionCacheKeyV1935(token) {
  return "admin_session_v1935_" + adminDigestV1935(token);
}

function adminLoginFailureKeyV1935(adminId) {
  return "admin_login_fail_v1935_" + adminDigestV1935(String(adminId || "").toLowerCase());
}

function createAdminSessionV1935(adminId, adminName) {
  var token = [Utilities.getUuid(), Utilities.getUuid(), String(Date.now())].join("").replace(/-/g, "");
  var now = Date.now();
  var session = {
    adminId: String(adminId || ""),
    adminName: String(adminName || adminId || "管理員"),
    issuedAt: new Date(now).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ADMIN_SESSION_TTL_SECONDS * 1000).toISOString()
  };
  CacheService.getScriptCache().put(adminSessionCacheKeyV1935(token), JSON.stringify(session), ADMIN_SESSION_TTL_SECONDS);
  return { token: token, expiresAt: session.expiresAt };
}

function authRequiredErrorV1935(message) {
  var err = new Error(message || "管理員登入已失效，請重新登入。");
  err.code = "AUTH_REQUIRED";
  return err;
}

function requireAdminSessionV1935(payload) {
  var token = String(payload && payload.adminSessionToken || "").trim();
  if (!token) throw authRequiredErrorV1935("缺少管理員 session，請重新登入。");
  var cache = CacheService.getScriptCache();
  var key = adminSessionCacheKeyV1935(token);
  var raw = cache.get(key);
  if (!raw) throw authRequiredErrorV1935("管理員 session 已過期，請重新登入。");
  var session;
  try { session = JSON.parse(raw); }
  catch (err) {
    cache.remove(key);
    throw authRequiredErrorV1935("管理員 session 無效，請重新登入。");
  }
  var now = Date.now();
  session.lastSeenAt = new Date(now).toISOString();
  session.expiresAt = new Date(now + ADMIN_SESSION_TTL_SECONDS * 1000).toISOString();
  cache.put(key, JSON.stringify(session), ADMIN_SESSION_TTL_SECONDS);
  return session;
}

function handleAdminLogoutV1935(payload) {
  var token = String(payload && payload.adminSessionToken || "").trim();
  if (token) CacheService.getScriptCache().remove(adminSessionCacheKeyV1935(token));
  return jsonResponse({ status: "ok", message: "已安全登出" });
}

function handleGetTeacherDataSlim() {
  var data = buildFirebasePayloadV19();
  var roster = (data.students || []).filter(function(s) { return s.enabled !== false; });
  var studentInfoMap = {};
  var studentHistory = {};
  var classMap = {};
  roster.forEach(function(s) {
    studentInfoMap[s.studentId] = {
      studentId: s.studentId,
      name: s.name,
      class: s.className,
      className: s.className,
      campus: s.campus || "",
      seatNo: s.seatNo || "",
      email: s.email || "",
      subjectId: s.subjectId || "",
      subjectIds: s.subjectIds || [],
      role: s.role || "student",
      enabled: s.enabled !== false
    };
    studentHistory[s.studentId] = {
      studentId: s.studentId,
      name: s.name,
      class: s.className,
      className: s.className,
      subjectId: s.subjectId || "",
      subjectIds: s.subjectIds || [],
      attempts: []
    };
    if (!classMap[s.className]) classMap[s.className] = { "class": s.className, studentCount: 0, total: 0, correct: 0, rate: 0, topicBreakdown: [] };
    classMap[s.className].studentCount++;
  });
  return jsonResponse({
    status: "ok",
    mode: "slim",
    message: "GAS slim 不再計算分析；請以 Firebase / 匯出資料為準。",
    classList: Object.keys(classMap).sort(function(a, b) { return a.localeCompare(b, "zh-TW", { numeric: true }); }).map(function(k) { return classMap[k]; }),
    allClassList: data.settings.allClassList || [],
    topics: data.settings.topics || [],
    completionSettings: data.settings.completionSettings || {},
    questionStats: [],
    topicStats: data.settings.topics || [],
    studentWrongDetails: {},
    studentHistory: studentHistory,
    studentInfoMap: studentInfoMap,
    counts: data.counts
  });
}

function parsePayload(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try { return JSON.parse(e.postData.contents); }
  catch (err) { return {}; }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function localNow() {
  return Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy/MM/dd HH:mm:ss");
}

function findColIdx(headers, names) {
  var lower = headers.map(function(h) { return String(h || "").trim().toLowerCase(); });
  for (var i = 0; i < names.length; i++) {
    var key = String(names[i]).trim().toLowerCase();
    var idx = lower.indexOf(key);
    if (idx !== -1) return idx;
  }
  return -1;
}

function getCell(row, idx) {
  return idx >= 0 && row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : "";
}

function splitCsv(value) {
  return String(value || "").split(",").map(function(s) { return s.trim(); }).filter(Boolean);
}

function getSettingsMap(ss) {
  var sheet = ss.getSheetByName(SHEET_SETTINGS);
  var map = {};
  if (!sheet || sheet.getLastRow() < 2) return map;
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var key = rows[i][0] ? String(rows[i][0]).trim() : "";
    if (key) map[key] = rows[i][1] === undefined || rows[i][1] === null ? "" : String(rows[i][1]).trim();
  }
  return map;
}

function readSettings(ss) {
  var map = getSettingsMap(ss);
  function setting(keys, fallback) {
    for (var i = 0; i < keys.length; i++) {
      var value = map[keys[i]];
      if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
    }
    return fallback || "";
  }
  var domainRestrictionEnabled = String(setting(["allowed_email_enabled", "email_domain_restriction_enabled"], "false")).toLowerCase() === "true";
  var domains = splitCsv(setting(["allowed_email_domains"], "")).map(function(s) { return s.replace(/^@/, "").toLowerCase(); });
  var emails = splitCsv(setting(["allowed_email_exceptions", "allowed_emails"], "")).map(function(s) { return s.toLowerCase(); });
  return {
    passScore: parseInt(setting(["completion_pass_score"], "80"), 10) || 80,
    completionTopics: splitCsv(setting(["completion_topics"], "")),
    completionTopicIds: splitCsv(setting(["completion_topic_ids"], "")),
    completionClasses: splitCsv(setting(["completion_classes"], "")),
    scoreHistoryTopics: splitCsv(setting(["score_history_topics"], "")),
    scoreHistoryTopicIds: splitCsv(setting(["score_history_topic_ids"], "")),
    deadline: setting(["deadline"], ""),
    systemTitle: setting(["systemTitle", "system_title"], ""),
    titleColor: setting(["titleColor", "title_color"], ""),
    authSettings: {
      enabled: domainRestrictionEnabled,
      domains: domains,
      emails: emails
    },
    emailDomainRestrictionEnabled: domainRestrictionEnabled,
    allowedEmailDomains: domains,
    allowedEmails: emails,
    loginCards: [
      { title: setting(["login_card_1_title"], ""), body: setting(["login_card_1_body"], "") },
      { title: setting(["login_card_2_title"], ""), body: setting(["login_card_2_body"], "") },
      { title: setting(["login_card_3_title"], ""), body: setting(["login_card_3_body"], "") }
    ]
  };
}

function handleSaveSettings(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SETTINGS);
    sheet.appendRow(["設定名稱", "值"]);
    sheet.getRange(1, 1, 1, 2).setFontWeight("bold").setBackground("#f3e8ff");
  }
  var rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues() : [];
  var keyMap = {};
  rows.forEach(function(r, i) { if (r[0]) keyMap[String(r[0]).trim()] = i + 2; });
  function upsert(key, value) {
    if (keyMap[key]) sheet.getRange(keyMap[key], 2).setValue(value);
    else sheet.appendRow([key, value]);
  }

  var cards = (payload.loginCards || []).slice(0, 3);
  upsert("completion_pass_score", parseInt(payload.passScore || "80", 10) || 80);
  upsert("completion_topics", (payload.completionTopics || []).join(","));
  upsert("completion_topic_ids", (payload.completionTopicIds || []).join(","));
  upsert("completion_classes", (payload.completionClasses || []).join(","));
  upsert("score_history_topics", (payload.scoreHistoryTopics || []).join(","));
  upsert("score_history_topic_ids", (payload.scoreHistoryTopicIds || []).join(","));
  upsert("allowed_email_enabled", payload.emailDomainRestrictionEnabled ? "TRUE" : "FALSE");
  upsert("email_domain_restriction_enabled", payload.emailDomainRestrictionEnabled ? "true" : "false");
  upsert("allowed_email_domains", (payload.allowedEmailDomains || []).join(","));
  upsert("allowed_email_exceptions", (payload.allowedEmails || []).join(","));
  upsert("allowed_emails", (payload.allowedEmails || []).join(","));
  upsert("systemTitle", String(payload.systemTitle || "").trim());
  upsert("titleColor", String(payload.titleColor || "").trim());
  upsert("system_title", String(payload.systemTitle || "").trim());
  upsert("title_color", String(payload.titleColor || "").trim());
  for (var i = 0; i < 3; i++) {
    upsert("login_card_" + (i + 1) + "_title", cards[i] && cards[i].title ? String(cards[i].title).trim() : "");
    upsert("login_card_" + (i + 1) + "_body", cards[i] && cards[i].body ? String(cards[i].body).trim() : "");
  }
  return jsonResponse({ status: "ok", message: "設定已儲存，請同步到 Firebase。" });
}

function normalizeAnswerText(rawAnswer, options) {
  var raw = rawAnswer === null || rawAnswer === undefined ? "" : String(rawAnswer).trim();
  var up = raw.toUpperCase();
  if (["A", "B", "C", "D"].indexOf(up) !== -1) return options[up.charCodeAt(0) - 65] || "";
  if (["1", "2", "3", "4"].indexOf(up) !== -1) return options[parseInt(up, 10) - 1] || "";
  return raw;
}

function readQuestionsForFirebaseV19(ss) {
  var sheet = ss.getSheetByName(SHEET_QUESTIONS) || ss.getSheetByName("歷屆國考優化題庫分頁");
  if (!sheet || sheet.getLastRow() <= 1) {
    var sheets = ss.getSheets();
    for (var si = 0; si < sheets.length; si++) {
      var candidate = sheets[si];
      if (candidate.getLastRow() <= 1) continue;
      var candidateHeaders = candidate.getRange(1, 1, 1, candidate.getLastColumn()).getValues()[0]
        .map(function(h) { return String(h || "").trim(); });
      if (findColIdx(candidateHeaders, ["問題", "題目", "question", "q"]) !== -1 &&
          findColIdx(candidateHeaders, ["選項A", "選項1", "optionA", "a"]) !== -1) {
        sheet = candidate;
        break;
      }
    }
  }
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0].map(function(h) { return String(h || "").trim(); });

  var cSubjectId = findColIdx(headers, ["科目ID", "subjectId"]);
  var cSubjectName = findColIdx(headers, ["科目名稱", "科目", "subjectName", "subject", "course"]);
  var cYear = findColIdx(headers, ["年度", "年份", "year", "國考年度代碼"]);
  var cTerm = findColIdx(headers, ["學期", "term"]);
  var cChapterId = findColIdx(headers, ["章節ID", "chapterId"]);
  var cChapter = findColIdx(headers, ["章節名稱", "章節", "chapterName", "chapter"]);
  var cUnit = findColIdx(headers, ["單元", "unit"]);
  var cSubCategory = findColIdx(headers, ["次分類", "subCategory"]);
  var cCategory = findColIdx(headers, ["分類", "category", "章節名稱", "章節", "次分類", "單元"]);
  if (cCategory === -1) cCategory = 1;
  var cQuestion = findColIdx(headers, ["問題", "題幹", "question", "q", "題目"]);
  if (cQuestion === -1) cQuestion = 2;
  var cA = findColIdx(headers, ["選項A", "選項1", "optionA", "a"]);
  var cB = findColIdx(headers, ["選項B", "選項2", "optionB", "b"]);
  var cC = findColIdx(headers, ["選項C", "選項3", "optionC", "c"]);
  var cD = findColIdx(headers, ["選項D", "選項4", "optionD", "d"]);
  var cAns = findColIdx(headers, ["正確答案", "答案", "answer", "ans", "解答"]);
  var cExp = findColIdx(headers, ["解析", "explanation"]);
  var cColor = findColIdx(headers, ["顏色", "color"]);
  if (cColor === -1) cColor = 9;
  var cType = findColIdx(headers, ["題型", "type"]);
  var cImg = findColIdx(headers, ["圖片網址", "圖片", "imageUrl", "img"]);
  var cId = findColIdx(headers, ["題目ID", "ID", "id", "題號"]);
  var cCog = findColIdx(headers, ["認知類型", "cogType", "認知"]);
  var cDifficulty = findColIdx(headers, ["難易度", "difficulty"]);
  var cImportance = findColIdx(headers, ["章節的重要性", "重要性", "importance"]);
  var cStatus = findColIdx(headers, ["題目狀態評估", "狀態", "status"]);
  var cSourcePage = findColIdx(headers, ["來源頁碼", "sourcePage"]);
  var cExamSource = findColIdx(headers, ["國考來源", "examSource"]);
  var cExamYearCode = findColIdx(headers, ["國考年度代碼", "年度代碼", "examYearCode"]);
  var cConcept = findColIdx(headers, ["核心概念", "coreConcept", "socraticConcept"]);
  var cMisconception = findColIdx(headers, ["常見誤解", "misconception", "socraticMisconception"]);
  var cHint1 = findColIdx(headers, ["① 先看題幹", "先看題幹", "提示1", "提示 1", "hint1", "socraticHint1"]);
  var cHint2 = findColIdx(headers, ["② 比較觀念", "比較觀念", "提示2", "提示 2", "hint2", "socraticHint2"]);
  var cHint3 = findColIdx(headers, ["③ 推回答案", "推回答案", "提示3", "提示 3", "hint3", "socraticHint3"]);
  var cRemedialChapter = findColIdx(headers, ["補救章節", "推薦章節", "remedialChapter"]);
  var cRemedialUrl = findColIdx(headers, ["推薦影片", "補救資源", "資源連結", "remedialUrl"]);
  var cLectureTitle = findColIdx(headers, ["講義標題", "講義名稱", "lectureTitle", "handoutTitle"]);
  var cLectureUrl = findColIdx(headers, ["講義連結", "講義網址", "講義URL", "lectureUrl", "handoutUrl", "handout"]);

  var version = "";
  var out = [];
  var seen = {};
  var lastImgUrl = "";
  for (var r = 1; r < rows.length; r++) {
    var row = rows[r];
    var questionText = getCell(row, cQuestion);
    if (!questionText) continue;

    var subjectName = getCell(row, cSubjectName);
    var subjectId = getCell(row, cSubjectId) || (subjectName ? firebaseSafeDocId(subjectName).toLowerCase() : "");
    var year = getCell(row, cYear);
    var term = getCell(row, cTerm);
    var chapter = getCell(row, cChapter);
    var chapterId = getCell(row, cChapterId) || (chapter ? firebaseSafeDocId(chapter).toLowerCase() : "");
    var unit = getCell(row, cUnit);
    var subCategory = getCell(row, cSubCategory);
    var category = getCell(row, cCategory) || chapter || subCategory || unit || "未分類";
    if ((category === unit || /^\d+(\.0+)?$/.test(category)) && chapter) category = chapter;
    var top = subjectName ? subjectName + "｜" + category : category;
    var courseId = "course_" + stableHashText([subjectId || subjectName, year, term].join("|")).slice(0, 24);
    var topicId = "topic_" + stableHashText([courseId, subjectId || subjectName, chapterId || chapter || category].join("|")).slice(0, 24);
    var qid = getCell(row, cId) || "ROW_" + (r + 1);
    var baseId = [subjectId || subjectName, year, term, chapterId || chapter, category, qid].filter(Boolean).join("__") || ("ROW_" + (r + 1));
    if (seen[baseId]) {
      seen[baseId] += 1;
      baseId = baseId + "__ROW_" + (r + 1);
    } else {
      seen[baseId] = 1;
    }

    var options = [getCell(row, cA), getCell(row, cB), getCell(row, cC), getCell(row, cD)].filter(Boolean);
    var qType = getCell(row, cType);
    var imgUrl = getCell(row, cImg);
    var isImage = qType === "圖片" || qType.toLowerCase() === "image";
    if (isImage) {
      if (imgUrl) lastImgUrl = imgUrl;
      else imgUrl = lastImgUrl;
    } else {
      lastImgUrl = "";
    }

    var answerText = normalizeAnswerText(getCell(row, cAns), options);
    out.push({
      id: qid,
      firebaseQuestionId: baseId,
      originalQuestionId: qid,
      subject: subjectName,
      subjectId: subjectId,
      subjectName: subjectName,
      courseId: courseId,
      topicId: topicId,
      year: year,
      term: term,
      chapter: chapter,
      chapterId: chapterId,
      chapterName: chapter,
      unit: unit,
      category: category,
      subCategory: subCategory,
      sourceRow: r + 1,
      top: top,
      q: questionText,
      text: questionText,
      options: options,
      ans: answerText,
      answer: answerText,
      exp: getCell(row, cExp) || "尚無解析",
      explanation: getCell(row, cExp) || "尚無解析",
      color: getCell(row, cColor) || "red",
      questionType: qType,
      difficulty: getCell(row, cDifficulty),
      importance: getCell(row, cImportance),
      questionStatus: getCell(row, cStatus),
      sourcePage: getCell(row, cSourcePage),
      examSource: getCell(row, cExamSource),
      examYearCode: getCell(row, cExamYearCode),
      imgUrl: imgUrl,
      isImage: !!imgUrl || isImage,
      cogType: getCell(row, cCog),
      socraticConcept: getCell(row, cConcept),
      socraticMisconception: getCell(row, cMisconception),
      socraticHint1: getCell(row, cHint1),
      socraticHint2: getCell(row, cHint2),
      socraticHint3: getCell(row, cHint3),
      remedialChapter: getCell(row, cRemedialChapter) || chapter || category,
      remedialUrl: getCell(row, cRemedialUrl),
      lectureTitle: getCell(row, cLectureTitle),
      lectureUrl: getCell(row, cLectureUrl),
      questionBankVersion: version,
      updatedAtText: ""
    });
  }
  return out;
}

function buildTopics(questions) {
  var map = {};
  questions.forEach(function(q) {
    if (!map[q.top]) map[q.top] = {
      name: q.top,
      color: q.color || "red",
      count: 0,
      subject: q.subject || q.subjectName || "",
      subjectId: q.subjectId || "",
      subjectName: q.subjectName || q.subject || "",
      chapterId: q.chapterId || "",
      chapterName: q.chapterName || q.chapter || q.category || q.top,
      courseId: q.courseId || "",
      topicId: q.topicId || "",
      chapter: q.chapter || q.chapterName || "",
      category: q.category || q.top,
      lectureTitle: q.lectureTitle || "",
      lectureUrl: q.lectureUrl || "",
      bundleId: "topic_" + stableHashText(q.top).slice(0, 24),
      cogTypes: []
    };
    if (!map[q.top].lectureUrl && q.lectureUrl) map[q.top].lectureUrl = q.lectureUrl;
    if (!map[q.top].lectureTitle && q.lectureTitle) map[q.top].lectureTitle = q.lectureTitle;
    if (q.cogType && map[q.top].cogTypes.indexOf(q.cogType) === -1) map[q.top].cogTypes.push(q.cogType);
    map[q.top].count += 1;
  });
  return Object.keys(map).sort(function(a, b) {
    var x = map[a];
    var y = map[b];
    var s = String(x.subjectName || x.subject || "").localeCompare(String(y.subjectName || y.subject || ""), "zh-TW", { numeric: true });
    if (s !== 0) return s;
    var c = String(x.chapterId || x.chapterName || x.category || x.name || "").localeCompare(String(y.chapterId || y.chapterName || y.category || y.name || ""), "zh-TW", { numeric: true });
    if (c !== 0) return c;
    return String(a).localeCompare(String(b), "zh-TW", { numeric: true });
  }).map(function(k) { return map[k]; });
}

function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : "";
}

function emailKey(email) {
  email = normalizeEmail(email);
  return email ? encodeURIComponent(email).replace(/\./g, "%2E") : "";
}

function splitSubjectIdsV1925(value) {
  var seen = {};
  return String(value || "").split(/[,，;；\n]+/).map(function(s) { return s.trim(); }).filter(function(id) {
    if (!id || seen[id]) return false;
    seen[id] = true;
    return true;
  });
}

function readStudentsForFirebaseV19(ss) {
  var sheet = ss.getSheetByName(SHEET_STUDENTS);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0].map(function(h) { return String(h || "").trim(); });
  var cId = findColIdx(headers, ["學號", "studentId", "student_id", "id"]);
  var cName = findColIdx(headers, ["姓名", "學生姓名", "name"]);
  // 同時存在「修課班級」與「班級」時，以實際修課班級為主。
  var cCourseClass = findColIdx(headers, ["修課班級", "課程班級", "courseClass", "course_class"]);
  var cHomeClass = findColIdx(headers, ["班級", "原班級", "class", "className"]);
  var cCampus = findColIdx(headers, ["校區", "campus"]);
  var cSeat = findColIdx(headers, ["座號", "seatNo", "seat"]);
  var cEmail = findColIdx(headers, ["Email", "email", "E-mail", "電子郵件", "信箱", "學校email", "Google帳號", "Google信箱"]);
  var cSubjectId = findColIdx(headers, ["科目ID", "科目 Id", "subjectId", "subject_id", "subjectIds", "subject_ids"]);
  var cRole = findColIdx(headers, ["角色", "role"]);
  var cEnabled = findColIdx(headers, ["啟用狀態", "啟用", "enabled", "狀態", "status"]);
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var sid = getCell(rows[i], cId);
    if (!sid) continue;
    var email = normalizeEmail(getCell(rows[i], cEmail));
    var enabledRaw = getCell(rows[i], cEnabled);
    var subjectIds = splitSubjectIdsV1925(getCell(rows[i], cSubjectId));
    var role = getCell(rows[i], cRole) || "student";
    if (/^(teacher|admin|教師|老師|管理員)$/i.test(role)) continue;
    out.push({
      studentId: sid,
      name: getCell(rows[i], cName) || sid,
      className: getCell(rows[i], cCourseClass) || getCell(rows[i], cHomeClass) || "未分班",
      campus: getCell(rows[i], cCampus),
      seatNo: getCell(rows[i], cSeat),
      email: email,
      emailKey: emailKey(email),
      subjectId: subjectIds[0] || "",
      subjectIds: subjectIds,
      role: role,
      enabled: enabledRaw ? !/^(停用|否|false|disabled|0)$/i.test(enabledRaw) : true,
      updatedAtText: localNow()
    });
  }
  return out;
}

function validateStudentEmailsV19(optionalStudents, optionalValidSubjectIds) {
  var students = Array.isArray(optionalStudents) ? optionalStudents : readStudentsForFirebaseV19(SpreadsheetApp.getActiveSpreadsheet());
  var validateSubjects = Array.isArray(optionalValidSubjectIds);
  var validSubjectMap = {};
  (optionalValidSubjectIds || []).forEach(function(id) { validSubjectMap[String(id)] = true; });
  var emailMap = {};
  var idMap = {};
  var blankEmail = [];
  var invalidEmails = [];
  var blankSubjectIds = [];
  var invalidSubjectIds = [];
  students.forEach(function(s) {
    if (!idMap[s.studentId]) idMap[s.studentId] = [];
    idMap[s.studentId].push(s);
    var subjectIds = Array.isArray(s.subjectIds) ? s.subjectIds : splitSubjectIdsV1925(s.subjectId);
    if (!subjectIds.length) {
      blankSubjectIds.push({ studentId: s.studentId, name: s.name, className: s.className });
    } else if (validateSubjects) {
      var unknown = subjectIds.filter(function(id) { return !validSubjectMap[id]; });
      if (unknown.length) invalidSubjectIds.push({ studentId: s.studentId, name: s.name, subjectIds: unknown });
    }
    if (!s.email) {
      blankEmail.push({ studentId: s.studentId, name: s.name, className: s.className });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) {
      invalidEmails.push({ studentId: s.studentId, name: s.name, email: s.email });
      return;
    }
    if (!emailMap[s.email]) emailMap[s.email] = [];
    emailMap[s.email].push(s);
  });
  var duplicateEmails = Object.keys(emailMap).filter(function(k) { return emailMap[k].length > 1; }).map(function(k) {
    return { email: k, students: emailMap[k].map(function(s) { return { studentId: s.studentId, name: s.name, className: s.className }; }) };
  });
  var duplicateIds = Object.keys(idMap).filter(function(k) { return idMap[k].length > 1; }).map(function(k) {
    return { studentId: k, students: idMap[k].map(function(s) { return { name: s.name, className: s.className, email: s.email }; }) };
  });
  return {
    status: duplicateEmails.length || duplicateIds.length || invalidEmails.length || blankSubjectIds.length || invalidSubjectIds.length ? "error" : "ok",
    total: students.length,
    usable: students.filter(function(s) { return s.email && s.enabled !== false; }).length,
    blankEmail: blankEmail,
    duplicateEmails: duplicateEmails,
    duplicateIds: duplicateIds,
    invalidEmails: invalidEmails,
    blankSubjectIds: blankSubjectIds,
    invalidSubjectIds: invalidSubjectIds,
    validSubjectIds: optionalValidSubjectIds || []
  };
}

function publishedSubjectIdsV1925(projectId, token) {
  var system = firebaseGetDocumentV1920(projectId, token, "system/main") || {};
  var map = {};
  (system.topics || []).forEach(function(topic) {
    var id = String(topic && topic.subjectId || "").trim();
    if (id) map[id] = true;
  });
  return Object.keys(map).sort(function(a, b) { return a.localeCompare(b, "zh-TW", { numeric: true }); });
}

function studentRosterValidationMessageV1925(check) {
  var parts = [];
  var duplicateEmails = check.duplicateEmails || [];
  var duplicateIds = check.duplicateIds || [];
  var invalidEmails = check.invalidEmails || [];
  var blankSubjectIds = check.blankSubjectIds || [];
  var invalidSubjectIds = check.invalidSubjectIds || [];
  if (duplicateEmails.length) parts.push("重複 email " + duplicateEmails.length + " 組");
  if (invalidEmails.length) parts.push("email 格式錯誤 " + invalidEmails.length + " 筆");
  if (duplicateIds.length) parts.push("重複學號 " + duplicateIds.length + " 組");
  if (blankSubjectIds.length) {
    parts.push("科目ID空白 " + blankSubjectIds.length + " 位（例如：" + blankSubjectIds.slice(0, 3).map(function(s) { return s.studentId; }).join("、") + "）");
  }
  if (invalidSubjectIds.length) {
    var examples = invalidSubjectIds.slice(0, 3).map(function(s) { return s.studentId + "=" + (s.subjectIds || []).join(","); }).join("；");
    parts.push("科目ID未對應已發布題庫 " + invalidSubjectIds.length + " 位（例如：" + examples + "）");
  }
  return parts.join("；") || "資料格式不正確";
}

function handleValidateStudentRosterV1925() {
  var props = PropertiesService.getScriptProperties();
  var projectId = props.getProperty("FIREBASE_PROJECT_ID");
  var validSubjectIds = projectId ? publishedSubjectIdsV1925(projectId, firebaseAccessToken()) : null;
  return jsonResponse(validateStudentEmailsV19(null, validSubjectIds));
}

function buildQuestionSyncDataV1925(ss) {
  var qSheet = ss.getSheetByName(SHEET_QUESTIONS);
  if (!qSheet) throw new Error("找不到「" + SHEET_QUESTIONS + "」分頁");
  var questions = readQuestionsForFirebaseV19(ss);
  var bankHash = stableHashText(JSON.stringify(questions.map(function(q) {
    var item = stripQuestionForBundleV19(q);
    delete item.questionBankVersion;
    return item;
  })));
  var bankVersion = "QB_" + bankHash.slice(0, 24);
  questions.forEach(function(q) { q.questionBankVersion = bankVersion; });
  var topics = buildTopics(questions);
  var questionBundle = buildQuestionBundleV19(questions);
  var chapterBank = buildChapterQuestionBankV1920(questions, topics, bankHash, bankVersion);
  var chapterHashByName = {};
  chapterBank.chapters.forEach(function(c) { chapterHashByName[c.name] = c.contentHash; });
  topics.forEach(function(t) { t.chapterHash = chapterHashByName[t.name] || ""; });
  return {
    questions: questions,
    topics: topics,
    questionBundle: questionBundle,
    chapterBank: chapterBank,
    bankHash: bankHash,
    bankVersion: bankVersion,
    counts: {
      questions: questions.length,
      questionBundleChunks: questionBundle.chunks.length,
      topics: topics.length,
      subjects: uniqueCount(questions.map(function(q) { return q.subject || "未設定科目"; }))
    }
  };
}

function buildStudentSyncDataV1925(ss) {
  var students = readStudentsForFirebaseV19(ss);
  var studentHash = stableHashText(JSON.stringify(students.map(function(s) {
    var copy = Object.assign({}, s);
    delete copy.updatedAtText;
    return copy;
  })));
  var classMap = {};
  students.forEach(function(s) { if (s.className && s.enabled !== false) classMap[s.className] = true; });
  return {
    students: students,
    studentHash: studentHash,
    allClassList: Object.keys(classMap).sort(function(a, b) { return a.localeCompare(b, "zh-TW", { numeric: true }); }),
    counts: {
      students: students.length,
      googleLoginStudents: students.filter(function(s) { return s.email && s.enabled !== false; }).length
    }
  };
}

function buildSettingsSyncDataV1925(ss) {
  var settings = readSettings(ss);
  var qSheet = ss.getSheetByName(SHEET_QUESTIONS);
  var firstRow = qSheet ? qSheet.getRange(1, 1, 1, Math.max(10, qSheet.getLastColumn())).getValues()[0] : [];
  var firstCell = firstRow[0] ? String(firstRow[0]).trim() : "";
  var title = settings.systemTitle || (firstCell && firstCell !== "科目ID" ? firstCell : "動態題庫測驗");
  var titleColor = settings.titleColor || (firstRow[9] ? String(firstRow[9]).trim() : "sky");
  return {
    system: {
      title: title,
      titleColor: titleColor,
      version: APP_VERSION,
      authMode: "google",
      completionSettings: settings,
      deadline: settings.deadline || "",
      updatedAtText: localNow()
    },
    publicConfig: {
      title: title,
      titleColor: titleColor,
      version: APP_VERSION,
      loginCards: settings.loginCards || []
    }
  };
}

function buildFirebasePayloadV19() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var questionData = buildQuestionSyncDataV1925(ss);
  var studentData = buildStudentSyncDataV1925(ss);
  var settingData = buildSettingsSyncDataV1925(ss);
  return {
    generatedAt: localNow(),
    settings: Object.assign({}, settingData.system, {
      topics: questionData.topics,
      questionBundlePath: "questionBundles/current",
      questionLoadMode: "chapterBundle",
      activeQuestionBankPath: "questionBanks/" + questionData.bankHash,
      activeQuestionBankHash: questionData.bankHash,
      allClassList: studentData.allClassList,
      questionBankVersion: questionData.bankVersion
    }),
    questions: questionData.questions,
    questionBundle: questionData.questionBundle,
    chapterBank: questionData.chapterBank,
    bankHash: questionData.bankHash,
    studentHash: studentData.studentHash,
    students: studentData.students,
    counts: Object.assign({}, questionData.counts, studentData.counts)
  };
}

function stableHashText(text) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text || ""), Utilities.Charset.UTF_8);
  return digest.map(function(b) {
    var n = b < 0 ? b + 256 : b;
    return ("0" + n.toString(16)).slice(-2);
  }).join("");
}

function buildChapterQuestionBankV1920(questions, topics, bankHash, bankVersion) {
  var topicMeta = {};
  topics.forEach(function(t) { topicMeta[t.name] = t; });
  var groups = {};
  questions.forEach(function(q) {
    var key = q.top || "未分類";
    if (!groups[key]) groups[key] = [];
    groups[key].push(q);
  });
  var chapters = Object.keys(groups).sort().map(function(name) {
    var items = groups[name].map(function(q) {
      var item = stripQuestionForBundleV19(q);
      delete item.questionBankVersion;
      return item;
    });
    var chunks = [];
    var current = [];
    var currentBytes = 2;
    items.forEach(function(item) {
      var itemBytes = Utilities.newBlob(JSON.stringify(item)).getBytes().length + 2;
      if (current.length && (current.length >= 50 || currentBytes + itemBytes > 700 * 1024)) {
        var id = String(chunks.length + 1).padStart(3, "0");
        chunks.push({ id: id, index: chunks.length + 1, count: current.length, questions: current });
        current = [];
        currentBytes = 2;
      }
      current.push(item);
      currentBytes += itemBytes;
    });
    if (current.length) {
      var lastId = String(chunks.length + 1).padStart(3, "0");
      chunks.push({ id: lastId, index: chunks.length + 1, count: current.length, questions: current });
    }
    return {
      id: topicMeta[name].bundleId,
      name: name,
      contentHash: stableHashText(JSON.stringify(items)),
      questionCount: items.length,
      chunkIds: chunks.map(function(c) { return c.id; }),
      chunks: chunks
    };
  });
  return {
    manifest: {
      version: APP_VERSION,
      schema: "questionBank/chapterBundle/v2",
      contentHash: bankHash,
      questionBankVersion: bankVersion,
      questionCount: questions.length,
      chapterCount: chapters.length,
      chapters: chapters.map(function(c) {
        return { id: c.id, name: c.name, contentHash: c.contentHash, questionCount: c.questionCount, chunkIds: c.chunkIds };
      }),
      updatedAtText: localNow()
    },
    chapters: chapters
  };
}

function buildQuestionBundleV19(questions) {
  var maxQuestionsPerChunk = 50;
  var maxBytesPerChunk = 700 * 1024;
  var chunks = [];
  var current = [];
  var currentBytes = 2;

  questions.forEach(function(q) {
    var item = stripQuestionForBundleV19(q);
    var itemBytes = Utilities.newBlob(JSON.stringify(item)).getBytes().length + 2;
    if (current.length && (current.length >= maxQuestionsPerChunk || currentBytes + itemBytes > maxBytesPerChunk)) {
      chunks.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(item);
    currentBytes += itemBytes;
  });
  if (current.length) chunks.push(current);

  var chunkDocs = chunks.map(function(items, idx) {
    var id = String(idx + 1).padStart(3, "0");
    return {
      id: id,
      index: idx + 1,
      count: items.length,
      questions: items
    };
  });
  return {
    manifest: {
      version: APP_VERSION,
      schema: "questionBundle/v1",
      chunkSize: maxQuestionsPerChunk,
      chunkCount: chunkDocs.length,
      questionCount: questions.length,
      chunkIds: chunkDocs.map(function(c) { return c.id; }),
      questionBankVersion: questions.length ? questions[0].questionBankVersion : "",
      updatedAtText: localNow()
    },
    chunks: chunkDocs
  };
}

function stripQuestionForBundleV19(q) {
  return {
    id: q.id || "",
    firebaseQuestionId: q.firebaseQuestionId || "",
    originalQuestionId: q.originalQuestionId || "",
    top: q.top || "",
    courseId: q.courseId || "",
    topicId: q.topicId || "",
    subjectId: q.subjectId || "",
    subjectName: q.subjectName || q.subject || "",
    chapterId: q.chapterId || "",
    chapterName: q.chapterName || q.chapter || "",
    q: q.q || "",
    options: q.options || [],
    ans: q.ans || "",
    exp: q.exp || "",
    color: q.color || "",
    questionType: q.questionType || "",
    difficulty: q.difficulty || "",
    importance: q.importance || "",
    questionStatus: q.questionStatus || "",
    unit: q.unit || "",
    chapter: q.chapter || "",
    category: q.category || "",
    subCategory: q.subCategory || "",
    sourcePage: q.sourcePage || "",
    examSource: q.examSource || "",
    examYearCode: q.examYearCode || "",
    imgUrl: q.imgUrl || "",
    isImage: q.isImage === true,
    cogType: q.cogType || "",
    socraticConcept: q.socraticConcept || "",
    socraticMisconception: q.socraticMisconception || "",
    socraticHint1: q.socraticHint1 || "",
    socraticHint2: q.socraticHint2 || "",
    socraticHint3: q.socraticHint3 || "",
    remedialChapter: q.remedialChapter || "",
    remedialUrl: q.remedialUrl || "",
    lectureTitle: q.lectureTitle || "",
    lectureUrl: q.lectureUrl || "",
    source: q.source || "",
    questionBankVersion: q.questionBankVersion || ""
  };
}

function uniqueCount(values) {
  var map = {};
  values.forEach(function(v) { map[v] = true; });
  return Object.keys(map).length;
}

function runFirebaseSyncLockedV1925(worker) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return jsonResponse({ status: "busy", message: "已有另一個 Firebase 同步正在執行" });
  try {
    var props = PropertiesService.getScriptProperties();
    var projectId = props.getProperty("FIREBASE_PROJECT_ID");
    if (!projectId) return jsonResponse({ status: "needs_config", message: "尚未設定 FIREBASE_PROJECT_ID" });
    var result = worker({
      ss: SpreadsheetApp.getActiveSpreadsheet(),
      props: props,
      projectId: projectId,
      token: firebaseAccessToken()
    });
    return jsonResponse(Object.assign({ status: "ok", generatedAt: localNow() }, result || {}));
  } finally {
    lock.releaseLock();
  }
}

function syncQuestionBankCoreV1925(ctx) {
  var data = buildQuestionSyncDataV1925(ctx.ss);
  var previousStatus = firebaseGetDocumentV1920(ctx.projectId, ctx.token, "syncStatus/main") || {};
  var questionBankChanged = previousStatus.activeQuestionBankHash !== data.bankHash;
  var previousManifest = questionBankChanged && previousStatus.activeQuestionBankHash
    ? (firebaseGetDocumentV1920(ctx.projectId, ctx.token, "questionBanks/" + previousStatus.activeQuestionBankHash) || {})
    : {};
  var previousChapterHashes = {};
  (previousManifest.chapters || []).forEach(function(c) { if (c.contentHash) previousChapterHashes[c.contentHash] = true; });
  var writes = [];
  if (questionBankChanged) {
    writes.push({ update: { name: firestoreDocName(ctx.projectId, "questionBanks", data.bankHash), fields: firebaseFields(data.chapterBank.manifest) } });
    data.chapterBank.chapters.forEach(function(chapter) {
      if (previousChapterHashes[chapter.contentHash]) return;
      var chapterFields = {
        id: chapter.id, name: chapter.name, contentHash: chapter.contentHash,
        questionCount: chapter.questionCount, chunkIds: chapter.chunkIds,
        questionBankVersion: data.chapterBank.manifest.questionBankVersion
      };
      writes.push({ update: { name: firestoreDocName(ctx.projectId, "questionChapterBundles", chapter.contentHash), fields: firebaseFields(chapterFields) } });
      chapter.chunks.forEach(function(chunk) {
        writes.push({ update: { name: firestoreDocName(ctx.projectId, "questionChapterBundles/" + chapter.contentHash + "/chunks", chunk.id), fields: firebaseFields(chunk) } });
      });
    });
  }
  writes.push(firebaseMergeWrite(ctx.projectId, "system", "main", {
    version: APP_VERSION,
    topics: data.topics,
    questionBundlePath: "questionBundles/current",
    questionLoadMode: "chapterBundle",
    activeQuestionBankPath: "questionBanks/" + data.bankHash,
    activeQuestionBankHash: data.bankHash,
    questionBankVersion: data.bankVersion,
    updatedAtText: localNow()
  }));
  writes.push(firebaseMergeWrite(ctx.projectId, "syncStatus", "main", {
    version: APP_VERSION,
    mode: "split-v1.925",
    firebaseProjectId: ctx.projectId,
    lastQuestionSyncAt: localNow(),
    counts: data.counts,
    activeQuestionBankHash: data.bankHash,
    questionBankChanged: questionBankChanged
  }));
  firebaseBatchWrite(ctx.projectId, ctx.token, writes);
  return { message: questionBankChanged ? "題庫同步完成" : "題庫內容未變更，已跳過題庫資料寫入", syncType: "questions", counts: data.counts, written: writes.length, changed: questionBankChanged, questionBankChanged: questionBankChanged };
}

function syncSettingsCoreV1925(ctx) {
  var data = buildSettingsSyncDataV1925(ctx.ss);
  var writes = [
    firebaseMergeWrite(ctx.projectId, "publicConfig", "main", data.publicConfig),
    firebaseMergeWrite(ctx.projectId, "system", "main", data.system),
    firebaseMergeWrite(ctx.projectId, "syncStatus", "main", {
      version: APP_VERSION,
      mode: "split-v1.925",
      firebaseProjectId: ctx.projectId,
      lastSettingsSyncAt: localNow()
    })
  ];
  firebaseBatchWrite(ctx.projectId, ctx.token, writes);
  return { message: "系統設定同步完成", syncType: "settings", written: writes.length, changed: true };
}

function syncStudentsCoreV1925(ctx) {
  var data = buildStudentSyncDataV1925(ctx.ss);
  var validSubjectIds = publishedSubjectIdsV1925(ctx.projectId, ctx.token);
  if (!validSubjectIds.length) throw new Error("Firebase 尚無已發布的科目ID，請先執行「同步題庫」");
  var emailCheck = validateStudentEmailsV19(data.students, validSubjectIds);
  if (emailCheck.status !== "ok") {
    throw new Error("學生名單檢查未通過：" + studentRosterValidationMessageV1925(emailCheck) + "。已發布科目ID：" + validSubjectIds.join("、"));
  }
  var studentsChanged = ctx.props.getProperty("LAST_STUDENT_SYNC_HASH") !== data.studentHash;
  var writes = [];
  if (studentsChanged) {
    data.students.forEach(function(s) {
      writes.push(firebaseMergeWrite(ctx.projectId, "students", s.studentId, s));
      if (s.email && s.emailKey) writes.push(firebaseMergeWrite(ctx.projectId, "studentsByEmail", s.emailKey, s));
    });
  }
  writes.push(firebaseMergeWrite(ctx.projectId, "system", "main", {
    version: APP_VERSION,
    allClassList: data.allClassList,
    updatedAtText: localNow()
  }));
  writes.push(firebaseMergeWrite(ctx.projectId, "syncStatus", "main", {
    version: APP_VERSION,
    mode: "split-v1.925",
    firebaseProjectId: ctx.projectId,
    lastStudentSyncAt: localNow(),
    studentCounts: data.counts,
    studentsChanged: studentsChanged
  }));
  firebaseBatchWrite(ctx.projectId, ctx.token, writes);
  ctx.props.setProperty("LAST_STUDENT_SYNC_HASH", data.studentHash);
  return { message: studentsChanged ? "學生名單同步完成" : "學生名單未變更，已跳過名單資料寫入", syncType: "students", counts: data.counts, written: writes.length, changed: studentsChanged, studentsChanged: studentsChanged, emailCheck: emailCheck };
}

function handleSyncQuestionBankV1925() {
  return runFirebaseSyncLockedV1925(syncQuestionBankCoreV1925);
}

function handleSyncSettingsV1925() {
  return runFirebaseSyncLockedV1925(syncSettingsCoreV1925);
}

function handleSyncStudentsV1925() {
  return runFirebaseSyncLockedV1925(syncStudentsCoreV1925);
}

function handleSyncFirebaseV19(payload) {
  return runFirebaseSyncLockedV1925(function(ctx) {
    var questions = syncQuestionBankCoreV1925(ctx);
    var settings = syncSettingsCoreV1925(ctx);
    var students = syncStudentsCoreV1925(ctx);
    return {
      message: "Firebase 完整同步完成",
      syncType: "all",
      written: Number(questions.written || 0) + Number(settings.written || 0) + Number(students.written || 0),
      counts: Object.assign({}, questions.counts || {}, students.counts || {}),
      questionBankChanged: !!questions.changed,
      studentsChanged: !!students.changed,
      parts: { questions: questions, settings: settings, students: students }
    };
  });
}

function firebaseGetDocumentV1920(projectId, token, path) {
  var url = "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents/" + path;
  var res = UrlFetchApp.fetch(url, { method: "get", headers: { Authorization: "Bearer " + token }, muteHttpExceptions: true });
  if (res.getResponseCode() === 404) return null;
  if (res.getResponseCode() >= 300) throw new Error("Firestore 文件讀取失敗：" + res.getContentText());
  return parseFirebaseFields((JSON.parse(res.getContentText()) || {}).fields || {});
}

function handleGetSyncStatusV19() {
  var props = PropertiesService.getScriptProperties();
  return jsonResponse({
    status: "ok",
    version: APP_VERSION,
    mode: "slim",
    firebaseProjectId: props.getProperty("FIREBASE_PROJECT_ID") || "",
    studentEmailCheck: validateStudentEmailsV19(),
    generatedAt: localNow()
  });
}

function completionTopicCompactV1935(item, fallbackTopicId) {
  item = item || {};
  var topic = String(item.topic || item.topicName || "").trim();
  var topicId = String(item.topicId || fallbackTopicId || "").trim();
  if (!topic && !topicId) return null;
  return {
    topic: topic,
    topicName: String(item.topicName || topic).trim(),
    topicId: topicId,
    best: item.best === undefined ? null : item.best,
    lastScore: item.lastScore === undefined ? null : item.lastScore,
    avgSec: item.avgSec === undefined ? null : item.avgSec,
    lastAnsweredAt: item.lastAnsweredAt || item.lastAnsweredAtText || ""
  };
}

function compactStudentProgressV1935(doc) {
  var progress = parseFirebaseFields(doc.fields || {});
  var topicMap = {};
  function mergeTopic(item, fallbackTopicId) {
    var compact = completionTopicCompactV1935(item, fallbackTopicId);
    if (!compact) return;
    var nameKey = String(compact.topic || compact.topicName || "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
    var key = nameKey ? "name:" + nameKey : "id:" + compact.topicId;
    var previous = topicMap[key];
    if (!previous) {
      topicMap[key] = compact;
      return;
    }
    var previousBest = previous.best === null || previous.best === undefined ? null : Number(previous.best);
    var nextBest = compact.best === null || compact.best === undefined ? null : Number(compact.best);
    if (previousBest === null || (nextBest !== null && nextBest > previousBest)) {
      previous.best = compact.best;
      previous.avgSec = compact.avgSec;
    }
    if (compact.lastScore !== null && compact.lastScore !== undefined) previous.lastScore = compact.lastScore;
    if (String(compact.lastAnsweredAt || "") > String(previous.lastAnsweredAt || "")) previous.lastAnsweredAt = compact.lastAnsweredAt;
  }
  (Array.isArray(progress.details) ? progress.details : []).forEach(function(item) { mergeTopic(item, item && item.topicId); });
  Object.keys(progress.topicProgress || {}).forEach(function(topicId) { mergeTopic(progress.topicProgress[topicId], topicId); });
  return {
    studentId: String(progress.studentId || doc.name.split("/").pop()),
    updatedAt: progress.updatedAt || progress.updatedAtText || "",
    topics: Object.keys(topicMap).map(function(key) { return topicMap[key]; })
  };
}

function completionDashboardCacheResponseV1935(base, cacheHit, reads, cacheStored) {
  var generatedMillis = new Date(base.generatedAt || 0).getTime();
  return jsonResponse({
    status: "ok",
    generatedAt: base.generatedAt,
    cacheHit: !!cacheHit,
    cacheStored: cacheStored !== false,
    cacheAgeSeconds: generatedMillis ? Math.max(0, Math.floor((Date.now() - generatedMillis) / 1000)) : 0,
    firestoreDocumentsRead: Number(reads || 0),
    sourceDocumentCount: Number(base.sourceDocumentCount || 0),
    payloadBytes: Number(base.payloadBytes || 0),
    students: base.students || []
  });
}

function handleGetCompletionDashboardV1935(payload) {
  var cache = CacheService.getScriptCache();
  var cacheKey = "completion_dashboard_v1935";
  if (payload.forceRefresh !== true) {
    var cached = cache.get(cacheKey);
    if (cached) {
      try { return completionDashboardCacheResponseV1935(JSON.parse(cached), true, 0, true); }
      catch (err) { cache.remove(cacheKey); }
    }
  }
  var props = PropertiesService.getScriptProperties();
  var projectId = props.getProperty("FIREBASE_PROJECT_ID");
  if (!projectId) throw new Error("尚未設定 FIREBASE_PROJECT_ID");
  var docs = listFirestoreCollectionMaskedV1935(projectId, firebaseAccessToken(), "studentProgress", 300, [
    "studentId", "updatedAt", "updatedAtText", "details", "topicProgress"
  ]);
  var base = {
    generatedAt: new Date().toISOString(),
    sourceDocumentCount: docs.length,
    students: docs.map(compactStudentProgressV1935)
  };
  base.payloadBytes = Utilities.newBlob(JSON.stringify(base)).getBytes().length;
  var cacheJson = JSON.stringify(base);
  var cacheStored = Utilities.newBlob(cacheJson).getBytes().length <= COMPLETION_DASHBOARD_CACHE_MAX_BYTES;
  if (cacheStored) cache.put(cacheKey, cacheJson, COMPLETION_DASHBOARD_CACHE_SECONDS);
  else cache.remove(cacheKey);
  return completionDashboardCacheResponseV1935(base, false, docs.length, cacheStored);
}

function handleGetRecentAnswersV1935(payload) {
  var cache = CacheService.getScriptCache();
  var cacheKey = "recent_answers_v1935";
  if (payload.forceRefresh !== true) {
    var cached = cache.get(cacheKey);
    if (cached) {
      try {
        var cachedBase = JSON.parse(cached);
        return jsonResponse(Object.assign({}, cachedBase, {
          status: "ok", cacheHit: true, cacheAgeSeconds: Math.max(0, Math.floor((Date.now() - new Date(cachedBase.generatedAt).getTime()) / 1000)), firestoreDocumentsRead: 0
        }));
      } catch (err) { cache.remove(cacheKey); }
    }
  }
  var props = PropertiesService.getScriptProperties();
  var projectId = props.getProperty("FIREBASE_PROJECT_ID");
  if (!projectId) throw new Error("尚未設定 FIREBASE_PROJECT_ID");
  var docs = queryRecentAnswerBatchesV1935(projectId, firebaseAccessToken(), 100);
  var items = docs.map(function(doc) {
    var item = parseFirebaseFields(doc.fields || {});
    return {
      batchId: String(item.batchId || doc.name.split("/").pop()),
      studentId: String(item.studentId || ""),
      name: String(item.name || ""),
      className: String(item.className || ""),
      topic: String(item.topicDisplayName || item.topicName || item.topic || "未分類"),
      mode: String(item.mode || "練習"),
      score: Number(item.score || 0),
      correctCount: Number(item.correctCount || 0),
      wrongCount: Number(item.wrongCount || 0),
      questionCount: Number(item.questionCount || (Number(item.correctCount || 0) + Number(item.wrongCount || 0))),
      duration: Number(item.duration || 0),
      countsTowardScore: item.countsTowardScore === true,
      answeredAt: item.clientCreatedAt || item.createdAt || ""
    };
  });
  var base = { generatedAt: new Date().toISOString(), sourceDocumentCount: docs.length, items: items };
  base.payloadBytes = Utilities.newBlob(JSON.stringify(base)).getBytes().length;
  var cacheJson = JSON.stringify(base);
  var cacheStored = Utilities.newBlob(cacheJson).getBytes().length <= COMPLETION_DASHBOARD_CACHE_MAX_BYTES;
  if (cacheStored) cache.put(cacheKey, cacheJson, RECENT_ANSWERS_CACHE_SECONDS);
  else cache.remove(cacheKey);
  return jsonResponse(Object.assign({}, base, {
    status: "ok", cacheHit: false, cacheStored: cacheStored, cacheAgeSeconds: 0, firestoreDocumentsRead: docs.length
  }));
}

function handleMigrateWrongQuestionsV2() {
  var props = PropertiesService.getScriptProperties();
  var projectId = props.getProperty("FIREBASE_PROJECT_ID");
  if (!projectId) return jsonResponse({ status: "needs_config", message: "尚未設定 FIREBASE_PROJECT_ID" });
  var token = firebaseAccessToken();
  var questions = readQuestionsForFirebaseV19(SpreadsheetApp.getActiveSpreadsheet());
  var questionMap = {};
  questions.forEach(function(q) { questionMap[q.firebaseQuestionId] = q; });
  var progressDocs = listFirestoreCollection(projectId, token, "studentProgress", 300);
  var writes = [];
  progressDocs.forEach(function(doc) {
    var progress = parseFirebaseFields(doc.fields || {});
    var studentId = String(progress.studentId || doc.name.split("/").pop());
    var active = progress.activeWrongQuestions || {};
    var times = progress.activeWrongQuestionTimes || {};
    Object.keys(active).forEach(function(qid) {
      if (!active[qid]) return;
      var q = questionMap[qid] || {};
      writes.push({ update: {
        name: firestoreDocName(projectId, "students/" + firebaseSafeDocId(studentId) + "/wrongQuestions", firebaseSafeDocId(qid)),
        fields: firebaseFields({
          uid: progress.uid || "", studentId: studentId, questionId: qid,
          chapterId: q.chapterId || "", topic: q.top || "未分類", active: true,
          wrongCount: 1, clientLastWrongAt: times[qid] || "", source: "migration-v1.921"
        })
      } });
    });
  });
  firebaseBatchWrite(projectId, token, writes);
  return jsonResponse({ status: "ok", message: "錯題 V2 搬移完成", scannedStudents: progressDocs.length, migrated: writes.length });
}

function firebaseSafeDocId(id) {
  return String(id || "doc").replace(/[\/#?\[\]]/g, "_").slice(0, 1400);
}

function firestoreDocName(projectId, collection, id) {
  return "projects/" + projectId + "/databases/(default)/documents/" + collection + "/" + firebaseSafeDocId(id);
}

function firebaseValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(firebaseValue) } };
  if (typeof v === "object") {
    var fields = {};
    Object.keys(v).forEach(function(k) { fields[k] = firebaseValue(v[k]); });
    return { mapValue: { fields: fields } };
  }
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  return { stringValue: String(v) };
}

function firebaseFields(obj) {
  var fields = {};
  Object.keys(obj || {}).forEach(function(k) { fields[k] = firebaseValue(obj[k]); });
  return fields;
}

function firebaseMergeWrite(projectId, collection, id, obj) {
  var fields = firebaseFields(obj);
  return {
    update: { name: firestoreDocName(projectId, collection, id), fields: fields },
    updateMask: { fieldPaths: Object.keys(fields) }
  };
}

function firebaseJwtBase64(objOrBytes) {
  var bytes = Array.isArray(objOrBytes) ? objOrBytes : Utilities.newBlob(JSON.stringify(objOrBytes)).getBytes();
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "");
}

function firebaseAccessToken() {
  var tokenCache = CacheService.getScriptCache();
  var cachedToken = tokenCache.get("firebase_oauth_access_token_v1935");
  if (cachedToken) return cachedToken;
  var props = PropertiesService.getScriptProperties();
  var email = props.getProperty("FIREBASE_CLIENT_EMAIL") || props.getProperty("FIREBASE_SERVICE_ACCOUNT_EMAIL");
  var key = props.getProperty("FIREBASE_PRIVATE_KEY");
  if (!email || !key) throw new Error("尚未設定 FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY");
  key = key.replace(/\\n/g, "\n");
  var now = Math.floor(Date.now() / 1000);
  var unsigned = firebaseJwtBase64({ alg: "RS256", typ: "JWT" }) + "." + firebaseJwtBase64({
    iss: email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  });
  var jwt = unsigned + "." + firebaseJwtBase64(Utilities.computeRsaSha256Signature(unsigned, key));
  var res = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    payload: { grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt },
    muteHttpExceptions: true
  });
  var data = JSON.parse(res.getContentText());
  if (!data.access_token) throw new Error("Firebase token 取得失敗：" + res.getContentText());
  tokenCache.put("firebase_oauth_access_token_v1935", data.access_token, 3000);
  return data.access_token;
}

function firebaseBatchWrite(projectId, token, writes) {
  if (!writes.length) return;
  var byName = {};
  writes.forEach(function(w) {
    var name = w && w.update && w.update.name ? w.update.name : "";
    if (name) byName[name] = w;
  });
  var compacted = [];
  var seen = {};
  writes.forEach(function(w) {
    var name = w && w.update && w.update.name ? w.update.name : "";
    if (!name) compacted.push(w);
    else if (!seen[name]) {
      compacted.push(byName[name]);
      seen[name] = true;
    }
  });
  var url = "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents:batchWrite";
  for (var i = 0; i < compacted.length; i += 100) {
    var res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + token },
      payload: JSON.stringify({ writes: compacted.slice(i, i + 100) }),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() >= 300) throw new Error("Firestore 寫入失敗：" + res.getContentText());
  }
}

function parseFirebaseFields(fields) {
  var obj = {};
  if (!fields) return obj;
  Object.keys(fields).forEach(function(k) {
    var v = fields[k];
    if (v.stringValue !== undefined) obj[k] = v.stringValue;
    else if (v.integerValue !== undefined) obj[k] = Number(v.integerValue);
    else if (v.doubleValue !== undefined) obj[k] = Number(v.doubleValue);
    else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
    else if (v.timestampValue !== undefined) obj[k] = new Date(v.timestampValue);
    else if (v.arrayValue !== undefined) obj[k] = (v.arrayValue.values || []).map(function(item) { return parseFirebaseValue(item); });
    else if (v.mapValue !== undefined) obj[k] = parseFirebaseFields(v.mapValue.fields);
    else obj[k] = null;
  });
  return obj;
}

function parseFirebaseValue(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return Number(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return new Date(v.timestampValue);
  if (v.mapValue !== undefined) return parseFirebaseFields(v.mapValue.fields);
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(parseFirebaseValue);
  return null;
}

function ensureScoreSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_SCORES);
  if (!sheet) sheet = ss.insertSheet(SHEET_SCORES);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SCORE_HEADERS);
  } else {
    var current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), SCORE_HEADERS.length)).getValues()[0];
    var needHeader = SCORE_HEADERS.some(function(h, i) { return current[i] !== h; });
    if (needHeader) sheet.getRange(1, 1, 1, SCORE_HEADERS.length).setValues([SCORE_HEADERS]);
  }
  return sheet;
}

function existingBatchIds(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return {};
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idx = findColIdx(headers, ["Batch ID", "batchId"]);
  if (idx === -1) return {};
  var values = sheet.getRange(2, idx + 1, lastRow - 1, 1).getValues();
  var map = {};
  values.forEach(function(r) { if (r[0]) map[String(r[0])] = true; });
  return map;
}

function listFirestoreCollection(projectId, token, collection, pageSize) {
  var docs = [];
  var pageToken = "";
  do {
    var url = "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents/" + collection + "?pageSize=" + (pageSize || 300);
    if (pageToken) url += "&pageToken=" + encodeURIComponent(pageToken);
    var res = UrlFetchApp.fetch(url, {
      method: "get",
      headers: { Authorization: "Bearer " + token },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() >= 300) throw new Error("Firestore 讀取失敗：" + res.getContentText());
    var data = JSON.parse(res.getContentText());
    (data.documents || []).forEach(function(doc) { docs.push(doc); });
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return docs;
}

function listFirestoreCollectionMaskedV1935(projectId, token, collection, pageSize, fieldPaths) {
  var docs = [];
  var pageToken = "";
  do {
    var url = "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents/" + collection + "?pageSize=" + (pageSize || 300);
    (fieldPaths || []).forEach(function(path) { url += "&mask.fieldPaths=" + encodeURIComponent(path); });
    if (pageToken) url += "&pageToken=" + encodeURIComponent(pageToken);
    var res = UrlFetchApp.fetch(url, {
      method: "get",
      headers: { Authorization: "Bearer " + token },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() >= 300) throw new Error("Firestore 完成度代理讀取失敗：" + res.getContentText());
    var data = JSON.parse(res.getContentText() || "{}");
    (data.documents || []).forEach(function(doc) { docs.push(doc); });
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return docs;
}

function queryRecentAnswerBatchesV1935(projectId, token, limit) {
  var url = "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents:runQuery";
  var fields = [
    "batchId", "studentId", "name", "className", "topic", "topicName", "topicDisplayName", "mode",
    "score", "correctCount", "wrongCount", "questionCount", "duration", "countsTowardScore", "clientCreatedAt", "createdAt"
  ];
  var body = {
    structuredQuery: {
      select: { fields: fields.map(function(path) { return { fieldPath: path }; }) },
      from: [{ collectionId: "answerBatches" }],
      orderBy: [{ field: { fieldPath: "clientCreatedAt" }, direction: "DESCENDING" }],
      limit: Number(limit || 100)
    }
  };
  var res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) throw new Error("Firestore 最近做答讀取失敗：" + res.getContentText());
  return (JSON.parse(res.getContentText() || "[]") || []).map(function(row) { return row.document; }).filter(Boolean);
}

function queryAnswerBatchesSinceV1922(projectId, token, cursorIso) {
  if (!cursorIso) return listFirestoreCollection(projectId, token, "answerBatches", 300);
  var cursorTime = new Date(cursorIso);
  var overlapIso = isNaN(cursorTime.getTime()) ? cursorIso : new Date(cursorTime.getTime() - 5000).toISOString();
  var url = "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents:runQuery";
  var body = {
    structuredQuery: {
      from: [{ collectionId: "answerBatches" }],
      where: { fieldFilter: {
        field: { fieldPath: "clientCreatedAt" },
        op: "GREATER_THAN_OR_EQUAL",
        value: { stringValue: overlapIso }
      } },
      orderBy: [{ field: { fieldPath: "clientCreatedAt" }, direction: "ASCENDING" }]
    }
  };
  var res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) throw new Error("Firestore 增量成績查詢失敗：" + res.getContentText());
  var rows = JSON.parse(res.getContentText() || "[]");
  return rows.map(function(row) { return row.document; }).filter(Boolean);
}

function compressDetailsJson(jsonStr) {
  if (!jsonStr) return "";
  try {
    var details = JSON.parse(jsonStr);
    if (!Array.isArray(details)) return jsonStr;
    return JSON.stringify(details.map(function(d) {
      return {
        qid: d.questionId || d.qid || "",
        fqid: d.questionFirebaseId || d.fqid || "",
        ok: d.isCorrect === true || d.ok === true,
        sec: d.answerSec !== undefined ? d.answerSec : null,
        sel: d.selectedText || "",
        ans: d.correctText || ""
      };
    }));
  } catch (err) {
    return jsonStr;
  }
}

function scoreTimestampDateV1924(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    var parsed = new Date(value.trim());
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function normalizeScoreSheetTimesToTaipeiV1924(ss, sheet) {
  if (ss.getSpreadsheetTimeZone() !== "Asia/Taipei") ss.setSpreadsheetTimeZone("Asia/Taipei");
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;
  var range = sheet.getRange(2, 1, lastRow - 1, 1);
  var values = range.getValues();
  var formulas = range.getFormulas();
  var isoWithZone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
  var converted = 0;
  for (var i = 0; i < values.length; i++) {
    if (formulas[i][0]) {
      values[i][0] = formulas[i][0];
      continue;
    }
    var raw = values[i][0];
    if (typeof raw !== "string" || !isoWithZone.test(raw.trim())) continue;
    var parsed = scoreTimestampDateV1924(raw);
    if (!parsed) continue;
    values[i][0] = parsed;
    converted++;
  }
  if (converted) range.setValues(values);
  range.setNumberFormat("yyyy/mm/dd hh:mm:ss");
  return converted;
}

function handleSyncFirestoreScoresToSheetsV19(payload) {
  var props = PropertiesService.getScriptProperties();
  var projectId = props.getProperty("FIREBASE_PROJECT_ID");
  if (!projectId) return jsonResponse({ status: "needs_config", message: "尚未設定 FIREBASE_PROJECT_ID" });
  var token = firebaseAccessToken();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ensureScoreSheet(ss);
  var convertedTimestamps = normalizeScoreSheetTimesToTaipeiV1924(ss, sheet);
  var existing = existingBatchIds(sheet);
  var lastCursor = props.getProperty("LAST_SCORE_CURSOR_ISO") || "";
  var docs = queryAnswerBatchesSinceV1922(projectId, token, lastCursor);
  var rows = [];
  var maxCursor = lastCursor;
  docs.forEach(function(doc) {
    var item = parseFirebaseFields(doc.fields || {});
    var itemCursor = String(item.clientCreatedAt || "");
    if (itemCursor && (!maxCursor || itemCursor > maxCursor)) maxCursor = itemCursor;
    var batchId = item.batchId || doc.name.split("/").pop();
    if (existing[batchId]) return;
    var created = scoreTimestampDateV1924(item.createdAt) || scoreTimestampDateV1924(item.clientCreatedAt) || new Date();
    rows.push([
      created || localNow(),
      item.studentId || "",
      item.name || "",
      item.topic || "",
      item.mode || "",
      item.attempt || 1,
      item.score || 0,
      item.correctCount || 0,
      item.wrongCount || 0,
      item.duration || 0,
      batchId,
      item.email || "",
      item.uid || "",
      item.authProvider || "",
      compressDetailsJson(item.detailsJson || "")
    ]);
  });
  rows.sort(function(a, b) { return a[0].getTime() - b[0].getTime(); });
  if (rows.length) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, SCORE_HEADERS.length).setValues(rows);
    sheet.getRange(startRow, 1, rows.length, 1).setNumberFormat("yyyy/mm/dd hh:mm:ss");
  }
  if (maxCursor) props.setProperty("LAST_SCORE_CURSOR_ISO", maxCursor);
  props.setProperty("LAST_SCORE_SYNC_AT", localNow());
  return jsonResponse({ status: "ok", message: "已增量同步 Firebase 成績回 Sheet（Asia/Taipei）", appended: rows.length, scanned: docs.length, convertedTimestamps: convertedTimestamps, cursor: maxCursor });
}
