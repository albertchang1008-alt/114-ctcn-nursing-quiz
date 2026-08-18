(function () {
  "use strict";

  var cfg = window.FIREBASE_V18_CONFIG || {};
  var app = null;
  var db = null;
  var auth = null;
  var boot = null;
  var publicConfigCache = null;
  var settingsCache = null;
  var chapterCache = {};
  var queueKey = "quiz_v169_firebase_queue";
  var redirectPendingKey = "quiz_v19_google_redirect_pending";

  function stableHashText(value) {
    var text = String(value || "");
    var hash = 2166136261;
    for (var i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function newBatchId() {
    return "B_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  }

  function stableTopicId(value, fallbackTopic) {
    var source = value || {};
    if (source.topicId) return String(source.topicId);
    var courseId = String(source.courseId || source.questionBankVersion || "default").trim();
    var subjectId = String(source.subjectId || "subject").trim();
    var chapterId = String(source.chapterId || "").trim();
    var category = String(source.category || source.chapterName || fallbackTopic || source.topic || "未分類").trim();
    var stablePart = chapterId || category;
    return "topic_" + stableHashText([courseId, subjectId, stablePart].join("|"));
  }

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
    try {
      auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL).catch(function(err) {
        console.warn("Firebase Auth persistence 設定失敗：", err && err.message ? err.message : err);
      });
    } catch (e) {
      console.warn("Firebase Auth persistence 不支援：", e.message);
    }
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
      courseId: q.courseId || "",
      topicId: q.topicId || stableTopicId(q, q.top || q.category),
      year: q.year || "",
      term: q.term || "",
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
      lectureTitle: q.lectureTitle || q.handoutTitle || "",
      lectureUrl: q.lectureUrl || q.handoutUrl || "",
      source: q.source || "firebase",
      questionBankVersion: q.questionBankVersion || q.version || ""
    };
  }

  function uniqueTopics(questions) {
    var map = {};
    questions.forEach(function (q) {
      var name = q.top || "未分類";
      if (!map[name]) map[name] = {
        name: name,
        color: q.color || "red",
        count: 0,
        courseId: q.courseId || "",
        topicId: q.topicId || stableTopicId(q, name),
        subjectId: q.subjectId || "",
        subjectName: q.subjectName || q.subject || "",
        chapterId: q.chapterId || "",
        chapterName: q.chapterName || q.chapter || "",
        category: q.category || name,
        lectureTitle: q.lectureTitle || "",
        lectureUrl: q.lectureUrl || ""
      };
      if (!map[name].lectureUrl && q.lectureUrl) map[name].lectureUrl = q.lectureUrl;
      if (!map[name].lectureTitle && q.lectureTitle) map[name].lectureTitle = q.lectureTitle;
      map[name].count += 1;
    });
    return Object.keys(map).sort(function (a, b) {
      var aa = map[a];
      var bb = map[b];
      var s = String(aa.subjectName || aa.subjectId || "").localeCompare(String(bb.subjectName || bb.subjectId || ""), "zh-TW", { numeric: true, sensitivity: "base" });
      if (s !== 0) return s;
      return String(aa.chapterId || aa.chapterName || aa.name || "").localeCompare(String(bb.chapterId || bb.chapterName || bb.name || ""), "zh-TW", { numeric: true, sensitivity: "base" });
    }).map(function (k) { return map[k]; });
  }

  async function loadPublicConfig() {
    if (!init()) return null;
    if (publicConfigCache) return publicConfigCache;
    var c = cfg.collections || {};
    var snap = await docPath(c.publicConfig || "publicConfig/main").get();
    publicConfigCache = snap.exists ? (snap.data() || {}) : {
      title: "動態題庫測驗",
      titleColor: "sky",
      version: "v1.933"
    };
    return publicConfigCache;
  }

  async function loadAuthenticatedSettings(forceRefresh) {
    if (!init()) throw new Error("Firebase 尚未啟用");
    await ensureSignedIn();
    if (forceRefresh) {
      settingsCache = null;
      boot = null;
    }
    if (settingsCache) return settingsCache;
    var c = cfg.collections || {};
    var snap = await docPath(c.settings || "system/main").get();
    if (!snap.exists) throw new Error("系統設定尚未同步");
    settingsCache = snap.data() || {};
    return settingsCache;
  }

  async function loadChapterQuestions(topicOrMeta) {
    if (!init()) throw new Error("Firebase 尚未啟用");
    await ensureSignedIn();
    var meta = typeof topicOrMeta === "string"
      ? ((boot && boot.topics || []).find(function(t) { return t.name === topicOrMeta; }) || {})
      : (topicOrMeta || {});
    var bundleId = meta.bundleId || meta.chapterBundleId || "";
    if (!bundleId) throw new Error("章節題庫索引不存在：" + (meta.name || topicOrMeta || ""));
    if (chapterCache[bundleId]) return chapterCache[bundleId];
    var chapterHash = meta.chapterHash || "";
    if (!chapterHash) throw new Error("章節題庫版本不存在：" + bundleId);
    var chapterPath = (cfg.collections && cfg.collections.questionChapterRoot || "questionChapterBundles") + "/" + chapterHash;
    var manifestSnap = await docPath(chapterPath).get();
    if (!manifestSnap.exists) throw new Error("找不到章節題庫：" + bundleId);
    var manifest = manifestSnap.data() || {};
    var ids = Array.isArray(manifest.chunkIds) ? manifest.chunkIds : [];
    var snaps = await Promise.all(ids.map(function(id) {
      return docPath(chapterPath + "/chunks/" + id).get();
    }));
    var list = [];
    snaps.forEach(function(snap) {
      var data = snap.exists ? (snap.data() || {}) : {};
      (Array.isArray(data.questions) ? data.questions : []).forEach(function(item) {
        var q = normalizeQuestion(item);
        if (q.id && q.q) list.push(q);
      });
    });
    chapterCache[bundleId] = list;
    return list;
  }

  async function loadTopicsQuestions(topics) {
    var names = Array.isArray(topics) ? topics : [];
    var lists = await Promise.all(names.map(loadChapterQuestions));
    return [].concat.apply([], lists);
  }

  async function loadQuestionBundle(settings) {
    var c = cfg.collections || {};
    var bundlePath = c.questionBundle || settings.questionBundlePath || "questionBundles/current";
    var manifestSnap = await docPath(bundlePath).get();
    if (!manifestSnap.exists) return null;

    var manifest = manifestSnap.data() || {};
    var chunkIds = Array.isArray(manifest.chunkIds) ? manifest.chunkIds : [];
    if (!chunkIds.length) return null;

    var chunkSnaps = await Promise.all(chunkIds.map(function(id) {
      return docPath(bundlePath + "/chunks/" + id).get();
    }));

    var questions = [];
    chunkSnaps.forEach(function(snap) {
      if (!snap.exists) return;
      var data = snap.data() || {};
      (Array.isArray(data.questions) ? data.questions : []).forEach(function(item) {
        var q = normalizeQuestion(item);
        if (q.id && q.q) questions.push(q);
      });
    });

    if (!questions.length) return null;
    return {
      manifest: manifest,
      questions: questions
    };
  }

  async function loadQuestionsFallback(settings) {
    var c = cfg.collections || {};
    var activeQuestionBankVersion = settings.questionBankVersion || "";
    var snap = await db.collection(c.questions || "questions").get();
    var questions = [];
    snap.forEach(function (doc) {
      var q = normalizeQuestion(doc);
      if (activeQuestionBankVersion && q.questionBankVersion !== activeQuestionBankVersion) return;
      if (q.id && q.q) questions.push(q);
    });
    return questions;
  }

  async function loadBootstrap() {
    if (!init()) return null;
    if (boot) return boot;
    await ensureSignedIn();
    var c = cfg.collections || {};
    var settings = {};
    try {
      settings = await loadAuthenticatedSettings();
    } catch (err) {
      console.warn("[v1.925] Firebase 設定讀取失敗，略過：", err);
    }
    var questions = [];
    var bundle = null;
    var chapterMode = settings.questionLoadMode === "chapterBundle" && settings.activeQuestionBankPath;
    if (!chapterMode && cfg.allowLegacyQuestionFallback) {
      try { bundle = await loadQuestionBundle(settings); } catch (err) {
        console.warn("[v1.925] 舊題庫 bundle 讀取失敗：", err);
      }
      questions = bundle ? bundle.questions : await loadQuestionsFallback(settings);
    }
    if (!chapterMode && !questions.length) throw new Error("章節題庫尚未發布，且正式環境已停用全題 fallback");

    boot = {
      status: "success",
      source: chapterMode ? "firebase-chapter-bundle" : (bundle ? "firebase-bundle" : "firebase"),
      title: settings.systemTitle || settings.title || settings.system_title || "動態題庫測驗",
      titleColor: settings.titleColor || settings.title_color || "sky",
      topics: settings.topics || uniqueTopics(questions),
      questions: questions,
      questionBundle: bundle ? bundle.manifest : null,
      studentHashes: settings.studentHashes || [],
      completionSettings: settings.completionSettings || settings,
      allClassList: settings.allClassList || [],
      deadline: settings.deadline || "",
      rankingCache: null,
      questionBankVersion: settings.questionBankVersion || (bundle && bundle.manifest ? bundle.manifest.questionBankVersion : ""),
      activeQuestionBankPath: settings.activeQuestionBankPath || "",
      questionLoadMode: settings.questionLoadMode || "legacy"
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

  function clearRedirectPending() {
    try { sessionStorage.removeItem(redirectPendingKey); } catch (err) {}
  }

  function hasRedirectPending() {
    try { return !!sessionStorage.getItem(redirectPendingKey); } catch (err) { return false; }
  }

  function waitForAuthUser(timeoutMs) {
    if (!auth) return Promise.resolve(null);
    if (auth.currentUser && !auth.currentUser.isAnonymous) return Promise.resolve(auth.currentUser);
    return new Promise(function(resolve) {
      var done = false;
      var timer = setTimeout(function() {
        if (done) return;
        done = true;
        try { unsub(); } catch (err) {}
        resolve(auth.currentUser && !auth.currentUser.isAnonymous ? auth.currentUser : null);
      }, timeoutMs || 3000);
      var unsub = auth.onAuthStateChanged(function(user) {
        if (done) return;
        if (user && !user.isAnonymous) {
          done = true;
          clearTimeout(timer);
          try { unsub(); } catch (err) {}
          resolve(user);
        }
      }, function() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { unsub(); } catch (err) {}
        resolve(null);
      });
    });
  }

  async function startGoogleLogin() {
    if (!init()) throw new Error("Firebase 尚未啟用");
    var provider = googleProvider();

    // GitHub Pages 與 firebaseapp.com 是不同來源。iOS Safari/Chrome 會封鎖
    // redirect 登入所需的第三方儲存，因此正式登入只使用 popup。
    // 這裡也不能在 signInWithPopup 前 await：Safari 可能因此失去使用者點擊
    // 的 activation，接著把 popup 判定為非使用者觸發而封鎖。
    try {
      var popupPromise = auth.signInWithPopup(provider);
      var popup = await popupPromise;
      clearRedirectPending();
      return { status: "ok", user: popup.user };
    } catch (err) {
      // 不再自動 fallback 到 signInWithRedirect；在跨站儲存受限的瀏覽器
      // 中，redirect 只會回到登入頁卻無法還原 Firebase 使用者。
      throw err;
    }
  }

  async function handleGoogleRedirectResult() {
    if (!init()) return null;
    try {
      var result = await auth.getRedirectResult();
      if (result && result.user) {
        clearRedirectPending();
        return result.user;
      }
    } catch (err) {
      err.message = "Google 登入回傳失敗：" + err.message;
      throw err;
    }
    var user = await waitForAuthUser(3500);
    if (user) {
      clearRedirectPending();
      return user;
    }
    return null;
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
    if (student.uid && student.uid !== user.uid) {
      var claimed = new Error("此學生資料已綁定其他 Google 帳號，請聯絡老師。");
      claimed.code = "student/already-claimed";
      throw claimed;
    }
    if (!student.uid) {
      var bindData = {
        uid: user.uid || "",
        email: student.email,
        emailKey: student.emailKey,
        studentId: String(student.studentId || ""),
        authProvider: "google",
        emailVerified: user.emailVerified !== false,
        updatedAt: nowField()
      };
      var bindBatch = db.batch();
      bindBatch.set(db.collection(c.students || "students").doc(bindData.studentId), bindData, { merge: true });
      bindBatch.set(db.collection(c.studentsByEmail || "studentsByEmail").doc(key), bindData, { merge: true });
      await bindBatch.commit();
      Object.assign(student, bindData);
    }
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
      source: "self-register-v1.925"
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
      source: "firebase-v1.925"
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
    var completionTopicIds = Array.isArray(payload.completionTopicIds) ? payload.completionTopicIds.slice() : [];
    if (payload.completionScopeResolved === true) {
      return { passScore: passScore || 80, completionTopics: completionTopics, completionTopicIds: completionTopicIds };
    }
    if (passScore && (completionTopics.length || completionTopicIds.length)) {
      return { passScore: passScore, completionTopics: completionTopics, completionTopicIds: completionTopicIds };
    }
    try {
      var bootData = await loadBootstrap();
      var settings = (bootData && bootData.completionSettings) || {};
      if (!passScore) passScore = Number(settings.passScore || 80);
      if (!completionTopics.length && Array.isArray(settings.completionTopics)) completionTopics = settings.completionTopics.slice();
      if (!completionTopicIds.length && Array.isArray(settings.completionTopicIds)) completionTopicIds = settings.completionTopicIds.slice();
    } catch (err) {
      // 作答寫入不應因為設定讀取失敗而中斷。
    }
    return { passScore: passScore || 80, completionTopics: completionTopics, completionTopicIds: completionTopicIds };
  }

  function summarizeCurrentAttemptByTopic(batch, details) {
    var groups = {};
    details.forEach(function(d) {
      var topic = d.topic || batch.topic || "未分類";
      if (!groups[topic]) groups[topic] = {
        topic: topic,
        topicId: stableTopicId(d, topic),
        topicName: d.chapterName || d.category || topic,
        courseId: d.courseId || "",
        subjectId: d.subjectId || "",
        correct: 0,
        total: 0,
        totalSec: 0,
        secCount: 0
      };
      groups[topic].total += 1;
      if (d.isCorrect) groups[topic].correct += 1;
      if (d.answerSec !== null && d.answerSec !== undefined && !isNaN(Number(d.answerSec))) {
        groups[topic].totalSec += Number(d.answerSec);
        groups[topic].secCount += 1;
      }
    });

    if (batch.topic && batch.topic !== "綜合練習") {
      if (!groups[batch.topic]) groups[batch.topic] = {
        topic: batch.topic,
        topicId: stableTopicId(batch, batch.topic),
        topicName: batch.topic,
        courseId: batch.courseId || "",
        subjectId: batch.subjectId || "",
        correct: batch.correctCount,
        total: batch.correctCount + batch.wrongCount,
        totalSec: 0,
        secCount: 0
      };
      groups[batch.topic].score = batch.score;
      if (batch.duration && (batch.correctCount + batch.wrongCount) > 0) {
        groups[batch.topic].avgSec = Math.round(batch.duration / (batch.correctCount + batch.wrongCount));
      }
    }

    return Object.keys(groups).map(function(topic) {
      var g = groups[topic];
      var score = g.score !== undefined ? Number(g.score) : (g.total > 0 ? Math.round((g.correct / g.total) * 100) : 0);
      var avgSec = g.avgSec !== undefined ? g.avgSec : (g.secCount > 0 ? Math.round(g.totalSec / g.secCount) : null);
      return {
        topic: topic,
        topicId: g.topicId || stableTopicId(g, topic),
        topicName: g.topicName || topic,
        courseId: g.courseId || "",
        subjectId: g.subjectId || "",
        score: score,
        avgSec: avgSec
      };
    });
  }

  function mergeStudentProgress(existing, batch, settings, attemptSummaries) {
    var current = existing || {};
    var detailMap = {};
    var topicProgress = Object.assign({}, current.topicProgress || {});
    (Array.isArray(current.details) ? current.details : []).forEach(function(d) {
      if (!d || !d.topic) return;
      var legacyId = d.topicId || stableTopicId(d, d.topic);
      detailMap[d.topic] = {
        topic: d.topic,
        topicId: legacyId,
        topicName: d.topicName || d.topic,
        best: d.best === undefined ? null : d.best,
        passed: !!d.passed,
        avgSec: d.avgSec === undefined ? null : d.avgSec,
        lastScore: d.lastScore === undefined ? null : d.lastScore,
        bestCountsTowardScore: d.bestCountsTowardScore === true,
        lastAnsweredAtText: d.lastAnsweredAtText || ""
      };
      if (!topicProgress[legacyId]) topicProgress[legacyId] = Object.assign({}, detailMap[d.topic]);
    });

    var completionTopics = settings.completionTopics || [];
    var completionTopicIds = settings.completionTopicIds || [];
    completionTopics.forEach(function(topic) {
      if (!detailMap[topic]) detailMap[topic] = {
        topic: topic,
        topicId: "",
        topicName: topic,
        best: null,
        passed: false,
        avgSec: null,
        lastScore: null,
        lastAnsweredAtText: ""
      };
    });

    attemptSummaries.forEach(function(s) {
      if (!s.topic || s.topic === "綜合練習") return;
      if (!detailMap[s.topic]) {
        detailMap[s.topic] = { topic: s.topic, topicId: s.topicId, topicName: s.topicName || s.topic, best: null, passed: false, avgSec: null, lastScore: null, lastAnsweredAtText: "" };
      }
      var d = detailMap[s.topic];
      var oldProgress = topicProgress[s.topicId] || {};
      var previousBest = oldProgress.bestCountsTowardScore === true
        ? oldProgress.best
        : (d.bestCountsTowardScore === true ? d.best : null);
      d.topicId = s.topicId;
      d.topicName = s.topicName || d.topicName || s.topic;
      d.lastScore = s.score;
      d.best = previousBest === null || previousBest === undefined ? s.score : Math.max(Number(previousBest) || 0, s.score);
      d.passed = (Number(d.best) || 0) >= settings.passScore;
      d.bestCountsTowardScore = true;
      if (s.avgSec !== null && s.avgSec !== undefined) d.avgSec = s.avgSec;
      d.lastAnsweredAtText = batch.clientCreatedAt || new Date().toISOString();
      topicProgress[s.topicId] = {
        topicId: s.topicId,
        topic: s.topic,
        topicName: s.topicName || s.topic,
        courseId: s.courseId || "",
        subjectId: s.subjectId || "",
        best: d.best,
        lastScore: s.score,
        passed: d.passed,
        bestCountsTowardScore: true,
        avgSec: d.avgSec,
        lastBatchId: batch.batchId,
        lastAnsweredAt: nowField(),
        lastAnsweredAtText: d.lastAnsweredAtText
      };
    });

    // 完成度設定只控制統計範圍，不得再裁掉學生其他單元的歷史最高分。
    var orderedTopics = completionTopics.concat(Object.keys(detailMap).filter(function(topic) {
      return completionTopics.indexOf(topic) === -1;
    }).sort(function(a, b) { return a.localeCompare(b, "zh-TW"); }));
    var details = orderedTopics.map(function(topic) {
      return detailMap[topic] || { topic: topic, topicId: "", topicName: topic, best: null, passed: false, avgSec: null, lastScore: null, lastAnsweredAtText: "" };
    });

    return {
      studentId: batch.studentId,
      name: batch.name,
      passScore: settings.passScore,
      completionTopics: completionTopics,
      completionTopicIds: completionTopicIds,
      details: details,
      topicProgress: topicProgress,
      lastBatchId: batch.batchId,
      lastTopic: batch.topic,
      lastScore: batch.score,
      updatedAt: nowField(),
      updatedAtText: batch.clientCreatedAt || new Date().toISOString(),
      source: "firebase-v1.925-progress"
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

  function mergeProcessedBatchIds(existing, batchId, clientCreatedAt) {
    var processed = Object.assign({}, (existing && existing.processedBatchIds) || {});
    processed[batchId] = clientCreatedAt || new Date().toISOString();
    var keys = Object.keys(processed).sort(function(a, b) {
      return String(processed[b] || "").localeCompare(String(processed[a] || ""));
    });
    keys.slice(200).forEach(function(key) { delete processed[key]; });
    return processed;
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

  function buildScoreSummary(batch, details) {
    var first = details[0] || {};
    var topicId = batch.topic === "綜合練習"
      ? "topic_comprehensive"
      : stableTopicId(first, batch.topic);
    var questionCount = Number(batch.correctCount || 0) + Number(batch.wrongCount || 0);
    var clientDate = new Date(batch.clientCreatedAt || "");
    var answeredAt = isNaN(clientDate.getTime())
      ? nowField()
      : window.firebase.firestore.Timestamp.fromDate(clientDate);
    return {
      batchId: batch.batchId,
      uid: batch.uid,
      studentId: batch.studentId,
      name: batch.name,
      className: batch.className,
      campus: batch.campus,
      courseId: first.courseId || batch.courseId || "",
      subjectId: first.subjectId || batch.subjectId || "",
      subjectName: first.subjectName || batch.subjectName || "",
      topicId: topicId,
      topicName: first.chapterName || first.category || batch.topic,
      topicDisplayName: batch.topic,
      mode: batch.mode,
      isRetryMode: batch.isRetryMode,
      countsTowardBest: !!batch.countsTowardScore,
      countsTowardCompletion: !!batch.countsTowardScore,
      attempt: batch.attempt,
      score: batch.score,
      correctCount: batch.correctCount,
      wrongCount: batch.wrongCount,
      questionCount: questionCount,
      duration: batch.duration,
      avgAnswerSec: questionCount > 0 && batch.duration > 0 ? Math.round(batch.duration / questionCount) : null,
      answeredAt: answeredAt,
      submittedAt: nowField(),
      clientAnsweredAt: batch.clientCreatedAt,
      source: "firebase-v1.925-summary"
    };
  }

  async function submitAttempt(payload) {
    if (!init()) throw new Error("Firebase 尚未啟用");
    var user = await ensureSignedIn();
    await assertActiveSession(payload.studentId, payload.token);
    var c = cfg.collections || {};
    var batchId = payload.batchId || newBatchId();
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
      subjectId: Array.isArray(payload.subjectIds) ? (payload.subjectIds[0] || "") : (payload.subjectId || ""),
      subjectIds: Array.isArray(payload.subjectIds) ? payload.subjectIds.slice() : (payload.subjectId ? [payload.subjectId] : []),
      topic: payload.topic || "",
      mode: payload.mode || "",
      attempt: Number(payload.attempt) || 1,
      score: Number(payload.score) || 0,
      correctCount: Number(payload.correctCount) || 0,
      wrongCount: Number(payload.wrongCount) || 0,
      duration: Number(payload.duration) || 0,
      isRetryMode: !!payload.isRetryMode,
      // 由題數選擇流程明確標記；抽題練習不更新最高分。
      // 閃卡固定使用全部題目，因此會傳入 true。
      countsTowardScore: !payload.isRetryMode && payload.countsTowardScore === true,
      token: payload.token || "",
      ip: payload.ip || "",
      questionBankVersion: payload.questionBankVersion || "",
      settingsVersion: payload.settingsVersion || "",
      createdAt: nowField(),
      clientCreatedAt: payload.clientCreatedAt || new Date().toISOString(),
      source: "firebase-v1.925",
      detailsJson: JSON.stringify(details.map(function (d, idx) {
        return {
          questionId: d.questionId || ("Q_" + idx),
          questionFirebaseId: d.questionFirebaseId || d.firebaseQuestionId || d.questionId || ("Q_" + idx),
          questionText: d.questionText || "",
          topic: d.topic || "",
          topicId: d.topicId || stableTopicId(d, d.topic || payload.topic),
          courseId: d.courseId || "",
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
          remedialChapter: d.remedialChapter || "",
          lectureTitle: d.lectureTitle || "",
          lectureUrl: d.lectureUrl || ""
        };
      }))
    };
    
    var answerRef = db.collection(c.answerBatches || "answerBatches").doc(batchId);
    var summaryRef = db.collection(c.scoreSummaries || "scoreSummaries").doc(batchId);
    var progressRef = batch.studentId ? db.collection(c.studentProgress || "studentProgress").doc(batch.studentId) : null;
    var settings = !batch.isRetryMode && batch.studentId ? await resolveCompletionSettings(payload) : null;
    var attemptSummaries = batch.countsTowardScore ? summarizeCurrentAttemptByTopic(batch, details) : [];

    var transactionResult = await db.runTransaction(async function(writer) {
      // 所有讀取必須在 transaction 寫入前完成；batchId 也作為離線補送的冪等鍵。
      var progressSnap = progressRef ? await writer.get(progressRef) : null;
      var existingProgress = progressSnap && progressSnap.exists ? (progressSnap.data() || {}) : {};
      if ((existingProgress.processedBatchIds || {})[batchId]) return { duplicate: true };
      var opCount = 0;
      writer.set(answerRef, batch, { merge: true });
      opCount++;

      // 成績歷程只收「全部題目」測驗與閃卡；抽題練習只保留在 answerBatches。
      if (batch.countsTowardScore) {
        writer.set(summaryRef, buildScoreSummary(batch, details), { merge: true });
        opCount++;
      }

      if (batch.studentId) {
      var progressDoc;
      if (!batch.isRetryMode) {
        progressDoc = mergeStudentProgress(existingProgress, batch, settings, attemptSummaries);
        progressDoc.attemptedQuestions = mergeAttemptedQuestions(existingProgress, details);
        progressDoc.attemptedQuestionCount = Object.keys(progressDoc.attemptedQuestions || {}).length;
      } else {
        progressDoc = { studentId: batch.studentId, updatedAt: nowField(), updatedAtText: new Date().toISOString() };
      }
      progressDoc.uid = batch.uid;
      progressDoc.email = batch.email;
      progressDoc.className = batch.className;
      progressDoc.campus = batch.campus;
      progressDoc.subjectId = batch.subjectId;
      progressDoc.subjectIds = batch.subjectIds;
      var wrongState = mergeActiveWrongQuestions(existingProgress, details);
      progressDoc.activeWrongQuestions = wrongState.active;
      progressDoc.activeWrongQuestionTimes = wrongState.times;
      progressDoc.activeWrongQuestionCount = Object.keys(wrongState.active || {}).length;
      progressDoc.wrongDataVersion = "v2";
      progressDoc.processedBatchIds = mergeProcessedBatchIds(existingProgress, batchId, batch.clientCreatedAt);
      writer.set(progressRef, progressDoc, { merge: true });
      opCount++;

        // v1.925：錯題只寫 V2；頂層舊 wrongQuestions 已停止寫入。
        var wrongItems = [];
        details.forEach(function(d, idx) {
          var qid = String(d.questionFirebaseId || d.firebaseQuestionId || d.questionId || ("Q_" + idx));
          var wrongRef = db.collection(c.students || "students").doc(batch.studentId).collection("wrongQuestions").doc(safeDocId(qid));
          if (!d.isCorrect) {
            writer.set(wrongRef, {
              uid: batch.uid,
              studentId: batch.studentId,
              questionId: qid,
              chapterId: d.chapterId || "",
              topic: d.topic || "未分類",
              active: true,
              wrongCount: window.firebase.firestore.FieldValue.increment(1),
              lastWrongAt: nowField(),
              resolvedAt: null,
              lastBatchId: batchId,
              questionBankVersion: batch.questionBankVersion || ""
            }, { merge: true });
            wrongItems.push({ questionId: qid, chapterId: d.chapterId || "", topic: d.topic || "未分類" });
            opCount++;
          } else if ((existingProgress.activeWrongQuestions || {})[qid]) {
            writer.set(wrongRef, {
              uid: batch.uid,
              studentId: batch.studentId,
              questionId: qid,
              active: false,
              resolvedAt: nowField(),
              lastBatchId: batchId
            }, { merge: true });
            opCount++;
          }
        });
        if (wrongItems.length) {
          var eventRef = db.collection(c.students || "students").doc(batch.studentId).collection("wrongReviewEvents").doc(batchId);
          writer.set(eventRef, {
            uid: batch.uid,
            studentId: batch.studentId,
            batchId: batchId,
            wrongAt: nowField(),
            clientWrongAt: batch.clientCreatedAt,
            questionIds: wrongItems.map(function(item) { return item.questionId; }),
            items: wrongItems
          }, { merge: true });
          opCount++;
        }
      }
      return { duplicate: false, opCount: opCount };
    });
    return { status: "ok", batchId: batchId, duplicate: !!transactionResult.duplicate, writtenDetails: details.length };
  }

  async function submitAttemptWithFallback(payload) {
    // 離線補送必須沿用相同 batchId 與原始作答時間，避免重複摘要或時間漂移。
    if (!payload.batchId) payload.batchId = newBatchId();
    if (!payload.clientCreatedAt) payload.clientCreatedAt = new Date().toISOString();
    try {
      return await submitAttempt(payload);
    } catch (err) {
      console.warn("[v1.925] Firebase 作答寫入失敗，已暫存：", err);
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
    await loadBootstrap();
    var questionMap = {};

    if (opts.mode === "history") {
      var eventsRef = db.collection(c.students || "students").doc(String(studentId || "")).collection("wrongReviewEvents");
      var eventsQuery = cutoff ? eventsRef.where("wrongAt", ">=", new Date(cutoff)).orderBy("wrongAt", "desc") : eventsRef.orderBy("wrongAt", "desc");
      var eventsSnap = await eventsQuery.get();
      var historical = {};
      eventsSnap.forEach(function(doc) {
        var event = doc.data() || {};
        (Array.isArray(event.items) ? event.items : []).forEach(function(item) {
          if (topics.length && !topicSet[item.topic || "未分類"]) return;
          historical[item.questionId] = item;
        });
      });
      var historyItems = Object.keys(historical).map(function(id) { return historical[id]; });
      var historyTopics = Array.from(new Set(historyItems.map(function(item) { return item.topic; }).filter(Boolean)));
      var historyQuestions = await loadTopicsQuestions(historyTopics);
      historyQuestions.forEach(function(q) {
        if (q.firebaseQuestionId) questionMap[q.firebaseQuestionId] = q;
        if (q.id && !questionMap[q.id]) questionMap[q.id] = q;
      });
      return historyItems.map(function(item) { return questionMap[item.questionId]; }).filter(function(q) { return q && q.id && q.q; });
    }

    // v1.921：先讀錯題 metadata，再只載入涉及的章節 bundle。
    try {
      var stateSnap = await db.collection(c.students || "students").doc(String(studentId || ""))
        .collection("wrongQuestions").where("active", "==", true).get();
      var states = [];
      stateSnap.forEach(function(doc) {
        var state = doc.data() || {};
        if (topics.length && !topicSet[state.topic || "未分類"]) return;
        var last = parseClientTime(state.lastWrongAt);
        if (cutoff && last && last.getTime() < cutoff) return;
        states.push(state);
      });
      if (states.length) {
        var chapterTopics = Array.from(new Set(states.map(function(s) { return s.topic; }).filter(Boolean)));
        var chapterQuestions = await loadTopicsQuestions(chapterTopics);
        chapterQuestions.forEach(function(q) {
          if (q.firebaseQuestionId) questionMap[q.firebaseQuestionId] = q;
          if (q.id && !questionMap[q.id]) questionMap[q.id] = q;
        });
        return states.map(function(s) { return questionMap[s.questionId]; }).filter(function(q) { return q && q.id && q.q; });
      }
      return [];
    } catch (v2Err) {
      console.warn("[v1.925] 錯題 V2 讀取失敗：", v2Err);
      throw v2Err;
    }
  }

  window.Firebase1685 = {
    init: init,
    isEnabled: init,
    loadBootstrap: loadBootstrap,
    loadPublicConfig: loadPublicConfig,
    loadAuthenticatedSettings: loadAuthenticatedSettings,
    loadChapterQuestions: loadChapterQuestions,
    loadTopicsQuestions: loadTopicsQuestions,
    submitAttempt: submitAttempt,
    submitAttemptWithFallback: submitAttemptWithFallback,
    loadWrongQuestions: loadWrongQuestions,
    flushQueue: flushQueue,
    ensureSignedIn: ensureSignedIn,
    startGoogleLogin: startGoogleLogin,
    handleGoogleRedirectResult: handleGoogleRedirectResult,
    hasRedirectPending: hasRedirectPending,
    clearRedirectPending: clearRedirectPending,
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
