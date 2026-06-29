(function () {
  "use strict";

  var cfg = window.FIREBASE_V18_CONFIG || {};
  var app = null;
  var db = null;
  var auth = null;
  var boot = null;
  var queueKey = "quiz_v169_firebase_queue";

  function enabled() {
    var c = cfg.firebaseConfig || {};
    return !!(cfg.enabled && window.firebase && c.apiKey && c.projectId && c.authDomain && c.appId);
  }

  function init() {
    if (!enabled()) return false;
    if (app && db && auth) return true;
    app = window.firebase.apps && window.firebase.apps.length
      ? window.firebase.app()
      : window.firebase.initializeApp(cfg.firebaseConfig);
    db = window.firebase.firestore(app);
    
    // 啟用離線快取，大幅提升第二次開啟網頁的載入速度
    try {
      db.enablePersistence({ synchronizeTabs: true }).catch(function(err) {
        console.warn("Firestore 離線快取啟用失敗，代碼：", err.code);
      });
    } catch (e) {
      console.warn("瀏覽器不支援離線快取：", e.message);
    }
    
    auth = window.firebase.auth(app);
    return true;
  }

  function docPath(path) {
    var parts = String(path || "").split("/").filter(Boolean);
    if (parts.length % 2 !== 0) throw new Error("Firestore 文件路徑不正確：" + path);
    var ref = db.collection(parts[0]).doc(parts[1]);
    for (var i = 2; i < parts.length; i += 2) ref = ref.collection(parts[i]).doc(parts[i + 1]);
    return ref;
  }

  function normalizeQuestion(doc) {
    var q = doc.data ? doc.data() : doc;
    var docId = doc.id || q.firebaseQuestionId || q.docId || q.id || "";
    return {
      id: q.id || q.originalQuestionId || docId,
      firebaseQuestionId: q.firebaseQuestionId || docId,
      originalQuestionId: q.originalQuestionId || q.id || "",
      top: q.top || q.category || "未分類",
      subjectId: q.subjectId || "",
      subjectName: q.subjectName || q.subject || "",
      chapterId: q.chapterId || "",
      chapterName: q.chapterName || q.chapter || "",
      q: q.q || q.text || q.question || "",
      options: Array.isArray(q.options) ? q.options : [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean),
      ans: q.ans || q.answer || "",
      exp: q.exp || q.explanation || "尚無解析",
      color: q.color || "red",
      questionType: q.questionType || q.type || "",
      difficulty: q.difficulty || "",
      importance: q.importance || "",
      questionStatus: q.questionStatus || "",
      unit: q.unit || "",
      chapter: q.chapter || q.chapterName || "",
      category: q.category || "",
      subCategory: q.subCategory || "",
      sourcePage: q.sourcePage || "",
      examSource: q.examSource || "",
      examYearCode: q.examYearCode || "",
      imgUrl: q.imgUrl || q.imageUrl || "",
      isImage: !!(q.isImage || q.imgUrl || q.imageUrl),
      cogType: q.cogType || "",
      socraticConcept: q.socraticConcept || q.coreConcept || "",
      socraticMisconception: q.socraticMisconception || q.misconception || "",
      socraticHint1: q.socraticHint1 || q.hint1 || "",
      socraticHint2: q.socraticHint2 || q.hint2 || "",
      socraticHint3: q.socraticHint3 || q.hint3 || "",
      remedialChapter: q.remedialChapter || "",
      remedialUrl: q.remedialUrl || "",
      source: q.source || "firebase",
      questionBankVersion: q.questionBankVersion || q.version || ""
    };
  }

  function uniqueTopics(questions) {
    var map = {};
    questions.forEach(function (q) {
      var name = q.top || "未分類";
      if (!map[name]) map[name] = { name: name, color: q.color || "red", count: 0 };
      map[name].count += 1;
    });
    return Object.keys(map).sort(function (a, b) { return a.localeCompare(b, "zh-TW"); }).map(function (k) { return map[k]; });
  }

  async function loadBootstrap() {
    if (!init()) return null;
    if (boot) return boot;
    var c = cfg.collections || {};
    var settings = {};
    try {
      var s = await docPath(c.settings || "system/main").get();
      if (s.exists) settings = s.data() || {};
    } catch (err) {
      console.warn("[v1.905] Firebase 設定讀取失敗，略過：", err);
    }
    var activeQuestionBankVersion = settings.questionBankVersion || "";
    var snap = await db.collection(c.questions || "questions").get();
    var questions = [];
    snap.forEach(function (doc) {
      var q = normalizeQuestion(doc);
      if (activeQuestionBankVersion && q.questionBankVersion !== activeQuestionBankVersion) return;
      if (q.id && q.q) questions.push(q);
    });
    if (!questions.length) return null;

    boot = {
      status: "success",
      source: "firebase",
      title: settings.title || "動態題庫測驗",
      titleColor: settings.titleColor || "sky",
      topics: settings.topics || uniqueTopics(questions),
      questions: questions,
      studentHashes: settings.studentHashes || [],
      completionSettings: settings.completionSettings || settings,
      allClassList: settings.allClassList || [],
      deadline: settings.deadline || "",
      rankingCache: null,
      questionBankVersion: settings.questionBankVersion || ""
    };
    return boot;
  }

  function currentUserEmail() {
    return auth && auth.currentUser ? (auth.currentUser.email || "") : "";
  }

  async function ensureSignedIn() {
    if (!init()) throw new Error("Firebase 尚未啟用");
    if (auth.currentUser && !auth.currentUser.isAnonymous) return auth.currentUser;
    throw new Error("請先使用 Google 帳號登入");
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function emailKey(email) {
    var normalized = normalizeEmail(email);
    if (!normalized) return "";
    return encodeURIComponent(normalized).replace(/\./g, "%2E");
  }

  function isLineBrowser() {
    return /Line\//i.test(navigator.userAgent || "");
  }

  function isMobileBrowser() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  }

  function googleProvider() {
    var provider = new window.firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    return provider;
  }

  async function startGoogleLogin(forceRedirect) {
    if (!init()) throw new Error("Firebase 尚未啟用");
    var provider = googleProvider();
    if (forceRedirect || isMobileBrowser()) {
      await auth.signInWithRedirect(provider);
      return { status: "redirect" };
    }
    try {
      var popup = await auth.signInWithPopup(provider);
      return { status: "ok", user: popup.user };
    } catch (err) {
      if (err && (err.code === "auth/popup-blocked" || err.code === "auth/popup-closed-by-user")) {
        await auth.signInWithRedirect(provider);
        return { status: "redirect" };
      }
      throw err;
    }
  }

  async function handleGoogleRedirectResult() {
    if (!init()) return null;
    try {
      var result = await auth.getRedirectResult();
      if (result && result.user) return result.user;
    } catch (err) {
      err.message = "Google 登入回傳失敗：" + err.message;
      throw err;
    }
    return auth.currentUser && !auth.currentUser.isAnonymous ? auth.currentUser : null;
  }

  async function resolveStudentByGoogleEmail(user) {
    if (!init()) throw new Error("Firebase 尚未啟用");
    if (!user || !user.email) throw new Error("Google 帳號沒有 email，無法比對學生名單");
    var c = cfg.collections || {};
    var key = emailKey(user.email);
    var doc = await db.collection(c.studentsByEmail || "studentsByEmail").doc(key).get();
    if (!doc.exists) {
      var error = new Error("找不到此 Google 帳號的學生資料，請確認是否使用老師登錄的 email，或聯絡老師。");
      error.code = "student/not-found";
      error.email = normalizeEmail(user.email);
      throw error;
    }
    var student = doc.data() || {};
    if (student.enabled === false || String(student.status || "").toLowerCase() === "disabled") {
      var disabled = new Error("此帳號目前未開放使用，請聯絡老師。");
      disabled.code = "student/disabled";
      disabled.email = normalizeEmail(user.email);
      throw disabled;
    }
    student.email = normalizeEmail(student.email || user.email);
    student.emailKey = student.emailKey || key;
    return student;
  }

  async function registerStudentProfile(profile) {
    if (!init()) throw new Error("Firebase 尚未啟用");
    var user = await ensureSignedIn();
    var email = normalizeEmail(user.email || "");
    if (!email) throw new Error("Google 帳號沒有 email，無法註冊");
    if (user.emailVerified === false) {
      var verifyErr = new Error("請先完成 Google 信箱認證後再註冊");
      verifyErr.code = "auth/email-not-verified";
      throw verifyErr;
    }
    var studentId = String(profile && profile.studentId || "").trim();
    var name = String(profile && profile.name || "").trim();
    var className = String(profile && profile.className || "").trim();
    var campus = String(profile && profile.campus || "").trim();
    if (!studentId || !name || !className || !campus) throw new Error("請完整填寫學號、姓名、班級與校區");
    var c = cfg.collections || {};
    var key = emailKey(email);
    var studentRef = db.collection(c.students || "students").doc(studentId);
    var emailRef = db.collection(c.studentsByEmail || "studentsByEmail").doc(key);
    var data = {
      uid: user.uid || "",
      email: email,
      emailKey: key,
      studentId: studentId,
      name: name,
      className: className,
      campus: campus,
      seatNo: "",
      role: profile.role || "student",
      enabled: true,
      emailVerified: user.emailVerified !== false,
      authProvider: "google",
      createdAt: nowField(),
      updatedAt: nowField(),
      source: "self-register-v1.905"
    };
    var writer = db.batch();
    writer.set(studentRef, data, { merge: false });
    writer.set(emailRef, data, { merge: false });
    await writer.commit();
    return data;
  }

  function currentUserInfo() {
    var user = auth && auth.currentUser ? auth.currentUser : null;
    return user ? {
      uid: user.uid || "",
      email: normalizeEmail(user.email || ""),
      displayName: user.displayName || "",
      photoURL: user.photoURL || ""
    } : { uid: "", email: "", displayName: "", photoURL: "" };
  }

  function nowField() {
    return window.firebase.firestore.FieldValue.serverTimestamp();
  }

  function safeDocId(raw) {
    return String(raw || "doc").replace(/[^\w.-]/g, "_").slice(0, 150);
  }

  function makeSessionToken(studentId) {
    return String(studentId || "student") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
  }

  async function createLoginState(student, meta) {
    var user = await ensureSignedIn();
    var c = cfg.collections || {};
    var token = makeSessionToken(student.studentId);
    var info = {
      studentId: String(student.studentId || ""),
      name: String(student.name || student.studentName || ""),
      email: normalizeEmail(student.email || user.email || ""),
      uid: user.uid || "",
      token: token,
      ip: meta && meta.ip || "",
      device: meta && meta.device || "",
      browser: meta && meta.browser || "",
      loginTime: nowField(),
      status: "active",
      authProvider: "google",
      source: "firebase-v1.905"
    };
    await db.collection(c.loginStates || "loginStates").doc(info.studentId).set(info, { merge: true });
    return token;
  }

  function watchLoginState(studentId, token, onInvalid) {
    if (!init()) return function () {};
    var c = cfg.collections || {};
    return db.collection(c.loginStates || "loginStates").doc(String(studentId || "")).onSnapshot(function (doc) {
      if (!doc.exists) return;
      var data = doc.data() || {};
      if (data.token && data.token !== token && typeof onInvalid === "function") onInvalid(data);
    });
  }

  async function assertActiveSession(studentId, token) {
    await ensureSignedIn();
    var c = cfg.collections || {};
    var doc = await db.collection(c.loginStates || "loginStates").doc(String(studentId || "")).get();
    if (!doc.exists) throw new Error("找不到登入狀態，請重新登入");
    var data = doc.data() || {};
    if (!token || data.token !== token) {
      var err = new Error("帳號重複登入，本次作答成績未計入");
      err.code = "session/replaced";
      throw err;
    }
    return true;
  }

  function readQueue() {
    try { return JSON.parse(localStorage.getItem(queueKey) || "[]"); }
    catch (e) { return []; }
  }

  function writeQueue(items) {
    localStorage.setItem(queueKey, JSON.stringify(items.slice(-500)));
  }

  function enqueue(payload) {
    var items = readQueue();
    items.push({ createdAt: new Date().toISOString(), payload: payload });
    writeQueue(items);
  }

  async function resolveCompletionSettings(payload) {
    var passScore = Number(payload.passScore || payload.completionPassScore || 0);
    var completionTopics = Array.isArray(payload.completionTopics) ? payload.completionTopics.slice() : [];
    if (passScore && completionTopics.length) return { passScore: passScore, completionTopics: completionTopics };
    try {
      var bootData = await loadBootstrap();
      var settings = (bootData && bootData.completionSettings) || {};
      if (!passScore) passScore = Number(settings.passScore || 80);
      if (!completionTopics.length && Array.isArray(settings.completionTopics)) completionTopics = settings.completionTopics.slice();
    } catch (err) {
      // 作答寫入不應因為設定讀取失敗而中斷。
    }
    return { passScore: passScore || 80, completionTopics: completionTopics };
  }

  function summarizeCurrentAttemptByTopic(batch, details) {
    var groups = {};
    details.forEach(function(d) {
      var topic = d.topic || batch.topic || "未分類";
      if (!groups[topic]) groups[topic] = { topic: topic, correct: 0, total: 0, totalSec: 0, secCount: 0 };
      groups[topic].total += 1;
      if (d.isCorrect) groups[topic].correct += 1;
      if (d.answerSec !== null && d.answerSec !== undefined && !isNaN(Number(d.answerSec))) {
        groups[topic].totalSec += Number(d.answerSec);
        groups[topic].secCount += 1;
      }
    });

    if (batch.topic && batch.topic !== "綜合練習") {
      if (!groups[batch.topic]) groups[batch.topic] = { topic: batch.topic, correct: batch.correctCount, total: batch.correctCount + batch.wrongCount, totalSec: 0, secCount: 0 };
      groups[batch.topic].score = batch.score;
      if (batch.duration && (batch.correctCount + batch.wrongCount) > 0) {
        groups[batch.topic].avgSec = Math.round(batch.duration / (batch.correctCount + batch.wrongCount));
      }
    }

    return Object.keys(groups).map(function(topic) {
      var g = groups[topic];
      var score = g.score !== undefined ? Number(g.score) : (g.total > 0 ? Math.round((g.correct / g.total) * 100) : 0);
      var avgSec = g.avgSec !== undefined ? g.avgSec : (g.secCount > 0 ? Math.round(g.totalSec / g.secCount) : null);
      return { topic: topic, score: score, avgSec: avgSec };
    });
  }

  function mergeStudentProgress(existing, batch, settings, attemptSummaries) {
    var current = existing || {};
    var detailMap = {};
    (Array.isArray(current.details) ? current.details : []).forEach(function(d) {
      if (d && d.topic) detailMap[d.topic] = {
        topic: d.topic,
        best: d.best === undefined ? null : d.best,
        passed: !!d.passed,
        avgSec: d.avgSec === undefined ? null : d.avgSec,
        lastScore: d.lastScore === undefined ? null : d.lastScore,
        lastAnsweredAtText: d.lastAnsweredAtText || ""
      };
    });

    var completionTopics = settings.completionTopics || [];
    completionTopics.forEach(function(topic) {
      if (!detailMap[topic]) detailMap[topic] = { topic: topic, best: null, passed: false, avgSec: null, lastScore: null, lastAnsweredAtText: "" };
    });

    attemptSummaries.forEach(function(s) {
      if (!s.topic || s.topic === "綜合練習") return;
      if (!detailMap[s.topic]) {
        detailMap[s.topic] = { topic: s.topic, best: null, passed: false, avgSec: null, lastScore: null, lastAnsweredAtText: "" };
      }
      var d = detailMap[s.topic];
      d.lastScore = s.score;
      d.best = d.best === null || d.best === undefined ? s.score : Math.max(Number(d.best) || 0, s.score);
      d.passed = (Number(d.best) || 0) >= settings.passScore;
      if (s.avgSec !== null && s.avgSec !== undefined) d.avgSec = s.avgSec;
      d.lastAnsweredAtText = new Date().toISOString();
    });

    var orderedTopics = completionTopics.length ? completionTopics : Object.keys(detailMap).sort(function(a, b) { return a.localeCompare(b, "zh-TW"); });
    var details = orderedTopics.map(function(topic) {
      return detailMap[topic] || { topic: topic, best: null, passed: false, avgSec: null, lastScore: null, lastAnsweredAtText: "" };
    });

    return {
      studentId: batch.studentId,
      name: batch.name,
      passScore: settings.passScore,
      completionTopics: orderedTopics,
      details: details,
      lastBatchId: batch.batchId,
      lastTopic: batch.topic,
      lastScore: batch.score,
      updatedAt: nowField(),
      updatedAtText: new Date().toISOString(),
      source: "firebase-v1.905-progress"
    };
  }

  function mergeAttemptedQuestions(existing, details) {
    var attempted = Object.assign({}, (existing && existing.attemptedQuestions) || {});
    details.forEach(function(d, idx) {
      var qid = d.questionFirebaseId || d.firebaseQuestionId || d.questionId || ("Q_" + idx);
      if (qid) attempted[String(qid)] = true;
    });
    return attempted;
  }

  function mergeActiveWrongQuestions(existing, details) {
    var active = Object.assign({}, (existing && existing.activeWrongQuestions) || {});
    var times = Object.assign({}, (existing && existing.activeWrongQuestionTimes) || {});
    var nowIso = new Date().toISOString();
    details.forEach(function(d, idx) {
      var qid = d.questionFirebaseId || d.firebaseQuestionId || d.questionId || ("Q_" + idx);
      if (!qid) return;
      qid = String(qid);
      if (d.isCorrect) {
        delete active[qid];
        delete times[qid];
      } else {
        active[qid] = true;
        times[qid] = nowIso;
      }
    });
    return { active: active, times: times };
  }

  async function submitAttempt(payload) {
    if (!init()) throw new Error("Firebase 尚未啟用");
    var user = await ensureSignedIn();
    await assertActiveSession(payload.studentId, payload.token);
    var c = cfg.collections || {};
    var batchId = payload.batchId || ("B_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8));
    var userInfo = currentUserInfo();
    var email = normalizeEmail(payload.email || userInfo.email || currentUserEmail());
    var details = Array.isArray(payload.details) ? payload.details : [];
    
    var batch = {
      batchId: batchId,
      uid: user.uid || userInfo.uid || "",
      email: email,
      authProvider: "google",
      studentId: payload.studentId || "",
      name: payload.name || "",
      className: payload.className || "",
      campus: payload.campus || "",
      topic: payload.topic || "",
      mode: payload.mode || "",
      attempt: Number(payload.attempt) || 1,
      score: Number(payload.score) || 0,
      correctCount: Number(payload.correctCount) || 0,
      wrongCount: Number(payload.wrongCount) || 0,
      duration: Number(payload.duration) || 0,
      isRetryMode: !!payload.isRetryMode,
      token: payload.token || "",
      ip: payload.ip || "",
      questionBankVersion: payload.questionBankVersion || "",
      settingsVersion: payload.settingsVersion || "",
      createdAt: nowField(),
      clientCreatedAt: new Date().toISOString(),
      source: "firebase-v1.905",
      detailsJson: JSON.stringify(details.map(function (d, idx) {
        return {
          questionId: d.questionId || ("Q_" + idx),
          questionFirebaseId: d.questionFirebaseId || d.firebaseQuestionId || d.questionId || ("Q_" + idx),
          questionText: d.questionText || "",
          topic: d.topic || "",
          subjectId: d.subjectId || "",
          subjectName: d.subjectName || "",
          chapterId: d.chapterId || "",
          chapterName: d.chapterName || "",
          category: d.category || "",
          subCategory: d.subCategory || "",
          difficulty: d.difficulty || "",
          importance: d.importance || "",
          sourcePage: d.sourcePage || "",
          examSource: d.examSource || "",
          examYearCode: d.examYearCode || "",
          selectedText: d.selectedText || "",
          correctText: d.correctText || "",
          isCorrect: !!d.isCorrect,
          answerSec: d.answerSec === null || d.answerSec === undefined ? null : Number(d.answerSec),
          questionType: d.questionType || "",
          cogType: d.cogType || "",
          socraticConcept: d.socraticConcept || "",
          remedialChapter: d.remedialChapter || ""
        };
      }))
    };
    
    var writer = db.batch();
    var opCount = 0;
    
    writer.set(db.collection(c.answerBatches || "answerBatches").doc(batchId), batch, { merge: true });
    opCount++;
    
    for (var idx = 0; idx < details.length; idx++) {
      var d = details[idx];
      var qid = d.questionId || ("Q_" + idx);
      var firebaseQid = d.questionFirebaseId || d.firebaseQuestionId || qid;
      var progressId = safeDocId(batch.studentId + "_" + firebaseQid);
      var wrongId = progressId;
      
      if (!d.isCorrect) {
        writer.set(db.collection(c.wrongQuestions || "wrongQuestions").doc(wrongId), {
          uid: batch.uid,
          studentId: batch.studentId,
          name: batch.name,
          email: email,
          questionId: qid,
          questionFirebaseId: firebaseQid,
          questionText: d.questionText || "",
          topic: d.topic || "",
          subjectId: d.subjectId || "",
          subjectName: d.subjectName || "",
          chapterId: d.chapterId || "",
          chapterName: d.chapterName || "",
          category: d.category || "",
          subCategory: d.subCategory || "",
          difficulty: d.difficulty || "",
          importance: d.importance || "",
          cogType: d.cogType || "",
          correctText: d.correctText || "",
          selectedText: d.selectedText || "",
          lastWrongAt: nowField(),
          clientCreatedAt: new Date().toISOString(),
          lastBatchId: batchId,
          active: true,
          source: "firebase-v1.905"
        }, { merge: true });
        opCount++;
      }
      
      if (opCount >= 400) {
        await writer.commit();
        writer = db.batch();
        opCount = 0;
      }
    }

    if (!batch.isRetryMode && batch.studentId) {
      var settings = await resolveCompletionSettings(payload);
      var progressRef = db.collection(c.studentProgress || "studentProgress").doc(batch.studentId);
      var existingProgress = {};
      try {
        var progressSnap = await progressRef.get();
        if (progressSnap.exists) existingProgress = progressSnap.data() || {};
      } catch (err) {
        // 沒讀到舊摘要時，仍可用本次成績建立新摘要。
      }
      var attemptSummaries = summarizeCurrentAttemptByTopic(batch, details);
      var progressDoc = mergeStudentProgress(existingProgress, batch, settings, attemptSummaries);
      progressDoc.uid = batch.uid;
      progressDoc.email = batch.email;
      progressDoc.className = batch.className;
      progressDoc.campus = batch.campus;
      progressDoc.attemptedQuestions = mergeAttemptedQuestions(existingProgress, details);
      progressDoc.attemptedQuestionCount = Object.keys(progressDoc.attemptedQuestions || {}).length;
      var wrongState = mergeActiveWrongQuestions(existingProgress, details);
      progressDoc.activeWrongQuestions = wrongState.active;
      progressDoc.activeWrongQuestionTimes = wrongState.times;
      progressDoc.activeWrongQuestionCount = Object.keys(wrongState.active || {}).length;
      writer.set(progressRef, progressDoc, { merge: true });
      opCount++;
    }
    
    if (opCount > 0) {
      await writer.commit();
    }
    return { status: "ok", batchId: batchId, writtenDetails: details.length };
  }

  async function submitAttemptWithFallback(payload) {
    try {
      return await submitAttempt(payload);
    } catch (err) {
      console.warn("[v1.905] Firebase 作答寫入失敗，已暫存：", err);
      enqueue(payload);
      return { status: "queued", message: err.message };
    }
  }

  async function flushQueue() {
    if (!init()) return { status: "skip" };
    await ensureSignedIn();
    var items = readQueue();
    if (!items.length) return { status: "ok", flushed: 0 };
    var remain = [];
    var flushed = 0;
    for (var i = 0; i < items.length; i++) {
      try {
        await submitAttempt(items[i].payload);
        flushed += 1;
      } catch (err) {
        remain.push(items[i]);
      }
    }
    writeQueue(remain);
    return { status: "ok", flushed: flushed, remaining: remain.length };
  }

  function parseClientTime(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") {
      var d = value.toDate();
      if (d.getTime() <= 0 || d.getFullYear() <= 1970) return new Date();
      return d;
    }
    if (value.seconds !== undefined) {
      var d2 = new Date(value.seconds * 1000);
      if (d2.getTime() <= 0 || d2.getFullYear() <= 1970) return new Date();
      return d2;
    }
    var t = new Date(value);
    if (isNaN(t.getTime())) return null;
    if (t.getTime() <= 0 || t.getFullYear() <= 1970) return new Date();
    return t;
  }

  async function loadWrongQuestions(studentId, options) {
    if (!init()) throw new Error("Firebase 尚未啟用");
    await ensureSignedIn();
    var opts = options || {};
    var c = cfg.collections || {};
    var hours = Number(opts.hours) || 0;
    var topics = Array.isArray(opts.topics) ? opts.topics : (opts.topic ? [opts.topic] : []);
    var topicSet = {};
    topics.filter(Boolean).forEach(function (t) { topicSet[t] = true; });
    var cutoff = hours > 0 ? Date.now() - hours * 60 * 60 * 1000 : 0;
    var bootData = await loadBootstrap();
    var questionMap = {};
    (bootData && bootData.questions || []).forEach(function (q) {
      if (q.firebaseQuestionId) questionMap[q.firebaseQuestionId] = q;
      if (q.id && !questionMap[q.id]) questionMap[q.id] = q;
    });

    try {
      var progressSnap = await db.collection(c.studentProgress || "studentProgress").doc(String(studentId || "")).get();
      if (progressSnap.exists) {
        var progress = progressSnap.data() || {};
        var activeMap = progress.activeWrongQuestions || {};
        var timeMap = progress.activeWrongQuestionTimes || {};
        var progressOut = [];
        Object.keys(activeMap).forEach(function(qid) {
          if (!activeMap[qid]) return;
          var q = questionMap[qid];
          if (!q || !q.id || !q.q) return;
          if (topics.length && !topicSet[q.top || "未分類"]) return;
          var lastWrongAt = parseClientTime(timeMap[qid]);
          if (cutoff && lastWrongAt && lastWrongAt.getTime() < cutoff) return;
          progressOut.push(q);
        });
        if (Object.keys(activeMap).length || progress.activeWrongQuestionCount !== undefined) return progressOut;
      }
    } catch (err) {
      // 舊資料沒有 activeWrongQuestions 時，回退查 wrongQuestions 集合。
    }

    var snap = await db.collection(c.wrongQuestions || "wrongQuestions")
      .where("studentId", "==", String(studentId || ""))
      .get();

    var out = [];
    snap.forEach(function (doc) {
      var w = doc.data() || {};
      if (!w.active) return;
      if (topics.length && !topicSet[w.topic || "未分類"]) return;
      var lastWrongAt = parseClientTime(w.lastWrongAt) || parseClientTime(w.clientCreatedAt);
      if (cutoff && lastWrongAt && lastWrongAt.getTime() < cutoff) return;
      var q = questionMap[w.questionFirebaseId || w.questionId];
      if (q && q.id && q.q) out.push(q);
    });
    return out;
  }

  window.Firebase1685 = {
    init: init,
    isEnabled: init,
    loadBootstrap: loadBootstrap,
    submitAttempt: submitAttempt,
    submitAttemptWithFallback: submitAttemptWithFallback,
    loadWrongQuestions: loadWrongQuestions,
    flushQueue: flushQueue,
    ensureSignedIn: ensureSignedIn,
    startGoogleLogin: startGoogleLogin,
    handleGoogleRedirectResult: handleGoogleRedirectResult,
    resolveStudentByGoogleEmail: resolveStudentByGoogleEmail,
    registerStudentProfile: registerStudentProfile,
    createLoginState: createLoginState,
    watchLoginState: watchLoginState,
    assertActiveSession: assertActiveSession,
    currentUserInfo: currentUserInfo,
    normalizeEmail: normalizeEmail,
    emailKey: emailKey,
    isLineBrowser: isLineBrowser,
    isMobileBrowser: isMobileBrowser,
    queueCount: function () { return readQueue().length; }
  };
})();
