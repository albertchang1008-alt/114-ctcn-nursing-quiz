// Firebase v1.905 設定檔
// 1. 到 Firebase Console 建立 Web App。
// 2. 將 nurse-4981a 的 Firebase SDK config 貼到 firebaseConfig。
// 3. v1.905 學生端固定使用 Google 登入 + Firebase 題庫、判分、作答紀錄與錯題資料。
// 4. GAS/Google Sheet 保留為題庫、名單、設定與後台同步入口。
window.FIREBASE_V18_CONFIG = {
  enabled: true,
  firebaseConfig: {
    apiKey: "AIzaSyC2b7_mBqLehhejUaSrq9FL2v8jT6U3eRs",
    authDomain: "nurse-4981a.firebaseapp.com",
    projectId: "nurse-4981a",
    storageBucket: "nurse-4981a.firebasestorage.app",
    messagingSenderId: "495196858472",
    appId: "1:495196858472:web:4795a0b03f1fdfda0233dd",
    measurementId: "G-E6Q1K2EQN8"
  },
  collections: {
    questions: "questions",
    students: "students",
    studentsByEmail: "studentsByEmail",
    settings: "system/main",
    homeRanking: "rankingCaches/home",
    answerBatches: "answerBatches",
    answerDetails: "answerDetails",
    studentProgress: "studentProgress",
    wrongQuestions: "wrongQuestions",
    loginStates: "loginStates"
  }
};
