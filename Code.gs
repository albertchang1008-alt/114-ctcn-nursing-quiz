// Google Apps Script — 題庫系統 v1.910 slim
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

const SCORE_HEADERS = [
  "時間戳記", "學號", "姓名", "測驗單元", "測驗模式", "第幾次",
  "分數", "答對題數", "答錯題數", "作答秒數",
  "Batch ID", "Google Email", "Firebase UID", "Auth Provider", "Details JSON"
];

function doGet(e) {
  return jsonResponse({
    status: "ok",
    service: "quiz-gas-slim",
    version: "v1.910",
    message: "學生端不使用 GAS；請由後台執行同步。"
  });
}

function doPost(e) {
  try {
    var payload = parsePayload(e);
    var action = String(payload.action || "");
    if (action === "saveSettings") return handleSaveSettings(payload);
    if (action === "adminLogin") return handleAdminLogin(payload);
    if (action === "syncFirebaseV19" || action === "syncFirebaseV1685") return handleSyncFirebaseV19(payload);
    if (action === "getFirebaseBootstrap") return jsonResponse({ status: "ok", data: buildFirebasePayloadV19() });
    if (action === "validateStudentEmailsV19") return jsonResponse(validateStudentEmailsV19());
    if (action === "getSyncStatusV19") return handleGetSyncStatusV19();
    if (action === "syncFirestoreScoresToSheetsV19") return handleSyncFirestoreScoresToSheetsV19(payload);
    if (action === "getTeacherData") return handleGetTeacherDataSlim();
    return jsonResponse({
      status: "error",
      message: "GAS slim 已移除此 action：" + action + "。學生端請使用 Firebase；後台分析請改讀 Firestore 匯出資料。"
    });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.message, stack: err.stack || "" });
  }
}

function handleAdminLogin(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("管理人名單");
  if (!sheet || sheet.getLastRow() <= 1) return jsonResponse({ status: "error", verified: false, message: "尚未建立管理人名單" });
  var adminId = String(payload.adminId || "").trim();
  var adminPassword = String(payload.adminPassword || "").trim();
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(3, sheet.getLastColumn())).getValues();
  for (var i = 0; i < rows.length; i++) {
    var id = rows[i][0] ? String(rows[i][0]).trim() : "";
    var pwd = rows[i][1] ? String(rows[i][1]).trim() : "";
    var name = rows[i][2] ? String(rows[i][2]).trim() : id;
    if (id === adminId && pwd === adminPassword) return jsonResponse({ status: "ok", verified: true, adminName: name });
  }
  return jsonResponse({ status: "ok", verified: false, message: "帳號或密碼錯誤" });
}

function handleGetTeacherDataSlim() {
  var data = buildFirebasePayloadV19();
  return jsonResponse({
    status: "ok",
    mode: "slim",
    message: "GAS slim 不再計算分析；請以 Firebase / 匯出資料為準。",
    classList: data.settings.allClassList || [],
    questionStats: [],
    topicStats: data.settings.topics || [],
    studentWrongDetails: {},
    studentHistory: {},
    studentInfoMap: {},
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
    completionClasses: splitCsv(setting(["completion_classes"], "")),
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
  upsert("completion_classes", (payload.completionClasses || []).join(","));
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

  var version = "QB_" + sheet.getLastRow() + "_" + Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMMddHHmmss");
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
      questionBankVersion: version,
      updatedAtText: localNow()
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
      chapter: q.chapter || q.chapterName || "",
      category: q.category || q.top
    };
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

function readStudentsForFirebaseV19(ss) {
  var sheet = ss.getSheetByName(SHEET_STUDENTS);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0].map(function(h) { return String(h || "").trim(); });
  var cId = findColIdx(headers, ["學號", "studentId", "student_id", "id"]);
  var cName = findColIdx(headers, ["姓名", "學生姓名", "name"]);
  var cClass = findColIdx(headers, ["班級", "修課班級", "class", "className"]);
  var cCampus = findColIdx(headers, ["校區", "campus"]);
  var cSeat = findColIdx(headers, ["座號", "seatNo", "seat"]);
  var cEmail = findColIdx(headers, ["Email", "email", "E-mail", "電子郵件", "信箱", "學校email", "Google帳號", "Google信箱"]);
  var cRole = findColIdx(headers, ["角色", "role"]);
  var cEnabled = findColIdx(headers, ["啟用狀態", "啟用", "enabled", "狀態", "status"]);
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var sid = getCell(rows[i], cId);
    if (!sid) continue;
    var email = normalizeEmail(getCell(rows[i], cEmail));
    var enabledRaw = getCell(rows[i], cEnabled);
    out.push({
      studentId: sid,
      name: getCell(rows[i], cName) || sid,
      className: getCell(rows[i], cClass) || "未分班",
      campus: getCell(rows[i], cCampus),
      seatNo: getCell(rows[i], cSeat),
      email: email,
      emailKey: emailKey(email),
      role: getCell(rows[i], cRole) || "student",
      enabled: enabledRaw ? !/^(停用|否|false|disabled|0)$/i.test(enabledRaw) : true,
      updatedAtText: localNow()
    });
  }
  return out;
}

function validateStudentEmailsV19() {
  var students = readStudentsForFirebaseV19(SpreadsheetApp.getActiveSpreadsheet());
  var emailMap = {};
  var idMap = {};
  var blankEmail = [];
  var invalidEmails = [];
  students.forEach(function(s) {
    if (!idMap[s.studentId]) idMap[s.studentId] = [];
    idMap[s.studentId].push(s);
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
    status: duplicateEmails.length || duplicateIds.length || invalidEmails.length ? "error" : "ok",
    total: students.length,
    usable: students.filter(function(s) { return s.email && s.enabled !== false; }).length,
    blankEmail: blankEmail,
    duplicateEmails: duplicateEmails,
    duplicateIds: duplicateIds,
    invalidEmails: invalidEmails
  };
}

function buildFirebasePayloadV19() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var qSheet = ss.getSheetByName(SHEET_QUESTIONS);
  if (!qSheet) throw new Error("找不到「" + SHEET_QUESTIONS + "」分頁");
  var firstRow = qSheet.getRange(1, 1, 1, Math.max(10, qSheet.getLastColumn())).getValues()[0];
  var settings = readSettings(ss);
  var questions = readQuestionsForFirebaseV19(ss);
  var topics = buildTopics(questions);
  var students = readStudentsForFirebaseV19(ss);
  var firstCell = firstRow[0] ? String(firstRow[0]).trim() : "";
  var title = settings.systemTitle || (firstCell && firstCell !== "科目ID" ? firstCell : "動態題庫測驗");
  var titleColor = settings.titleColor || (firstRow[9] ? String(firstRow[9]).trim() : "sky");
  var classMap = {};
  students.forEach(function(s) { if (s.className) classMap[s.className] = true; });
  return {
    generatedAt: localNow(),
    settings: {
      title: title,
      titleColor: titleColor,
      version: "v1.910",
      authMode: "google",
      topics: topics,
      completionSettings: settings,
      allClassList: Object.keys(classMap).sort(function(a, b) { return a.localeCompare(b, "zh-TW"); }),
      deadline: settings.deadline || "",
      questionBankVersion: questions.length ? questions[0].questionBankVersion : "",
      updatedAtText: localNow()
    },
    questions: questions,
    students: students,
    counts: {
      questions: questions.length,
      students: students.length,
      topics: topics.length,
      subjects: uniqueCount(questions.map(function(q) { return q.subject || "未設定科目"; })),
      googleLoginStudents: students.filter(function(s) { return s.email && s.enabled !== false; }).length
    }
  };
}

function uniqueCount(values) {
  var map = {};
  values.forEach(function(v) { map[v] = true; });
  return Object.keys(map).length;
}

function handleSyncFirebaseV19(payload) {
  var props = PropertiesService.getScriptProperties();
  var projectId = props.getProperty("FIREBASE_PROJECT_ID");
  if (!projectId) return jsonResponse({ status: "needs_config", message: "尚未設定 FIREBASE_PROJECT_ID", data: buildFirebasePayloadV19() });

  var data = buildFirebasePayloadV19();
  var emailCheck = validateStudentEmailsV19();
  if (emailCheck.duplicateEmails.length || emailCheck.duplicateIds.length || emailCheck.invalidEmails.length) {
    return jsonResponse({ status: "error", message: "學生名單 email / 學號檢查未通過，已停止同步 studentsByEmail", emailCheck: emailCheck });
  }

  var token = firebaseAccessToken();
  var writes = [];
  writes.push({ update: { name: firestoreDocName(projectId, "system", "main"), fields: firebaseFields(data.settings) } });
  data.questions.forEach(function(q) {
    writes.push({ update: { name: firestoreDocName(projectId, "questions", q.firebaseQuestionId), fields: firebaseFields(q) } });
  });
  data.students.forEach(function(s) {
    writes.push({ update: { name: firestoreDocName(projectId, "students", s.studentId), fields: firebaseFields(s) } });
    if (s.email && s.emailKey) writes.push({ update: { name: firestoreDocName(projectId, "studentsByEmail", s.emailKey), fields: firebaseFields(s) } });
  });
  writes.push({ update: { name: firestoreDocName(projectId, "syncStatus", "main"), fields: firebaseFields({
    version: "v1.910",
    mode: "slim",
    firebaseProjectId: projectId,
    lastQuestionSyncAt: localNow(),
    counts: data.counts
  }) } });
  firebaseBatchWrite(projectId, token, writes);
  return jsonResponse({ status: "ok", message: "Firebase 同步完成（slim）", counts: data.counts, written: writes.length, generatedAt: data.generatedAt });
}

function handleGetSyncStatusV19() {
  var props = PropertiesService.getScriptProperties();
  return jsonResponse({
    status: "ok",
    version: "v1.910",
    mode: "slim",
    firebaseProjectId: props.getProperty("FIREBASE_PROJECT_ID") || "",
    studentEmailCheck: validateStudentEmailsV19(),
    generatedAt: localNow()
  });
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

function firebaseJwtBase64(objOrBytes) {
  var bytes = Array.isArray(objOrBytes) ? objOrBytes : Utilities.newBlob(JSON.stringify(objOrBytes)).getBytes();
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "");
}

function firebaseAccessToken() {
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

function handleSyncFirestoreScoresToSheetsV19(payload) {
  var props = PropertiesService.getScriptProperties();
  var projectId = props.getProperty("FIREBASE_PROJECT_ID");
  if (!projectId) return jsonResponse({ status: "needs_config", message: "尚未設定 FIREBASE_PROJECT_ID" });
  var token = firebaseAccessToken();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ensureScoreSheet(ss);
  var existing = existingBatchIds(sheet);
  var docs = listFirestoreCollection(projectId, token, "answerBatches", 300);
  var rows = [];
  docs.forEach(function(doc) {
    var item = parseFirebaseFields(doc.fields || {});
    var batchId = item.batchId || doc.name.split("/").pop();
    if (existing[batchId]) return;
    var created = item.clientCreatedAt || item.createdAt || "";
    if (created instanceof Date) created = Utilities.formatDate(created, "Asia/Taipei", "yyyy/MM/dd HH:mm:ss");
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
  rows.sort(function(a, b) { return String(a[0]).localeCompare(String(b[0])); });
  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, SCORE_HEADERS.length).setValues(rows);
  props.setProperty("LAST_SCORE_SYNC_AT", localNow());
  return jsonResponse({ status: "ok", message: "已同步 Firebase 成績回 Sheet", appended: rows.length, scanned: docs.length });
}
