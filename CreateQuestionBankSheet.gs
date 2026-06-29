// 題庫系統 v1.915 - Google Sheet 初始化工具
// 使用方式：
// 1. 到 script.google.com 新增 Apps Script 專案。
// 2. 貼上本檔內容。
// 3. 執行 createQuestionBankSystemSheetV1915。
// 4. 第一次執行會要求 Google 權限。
// 5. 執行完成後到「執行記錄」查看新 Google Sheet 連結。

function createQuestionBankSystemSheetV1907() {
  return createQuestionBankSystemSheetV1915();
}

function createQuestionBankSystemSheetV1906() {
  return createQuestionBankSystemSheetV1915();
}

function createQuestionBankSystemSheetV1905() {
  return createQuestionBankSystemSheetV1915();
}

function createQuestionBankSystemSheetV1915() {
  var title = "題庫系統-v1.915-空白範本";
  var ss = SpreadsheetApp.create(title);

  setupQuestionBankSystemSheetV1905_(ss);

  Logger.log("已建立 Google Sheet：");
  Logger.log(ss.getUrl());

  return {
    status: "ok",
    spreadsheetId: ss.getId(),
    url: ss.getUrl()
  };
}

// 如果你已經開好一份空白 Google Sheet，也可以把本腳本貼到該 Sheet 的 Apps Script，
// 然後執行此函式，它會直接在目前試算表建立需要的分頁。
function setupCurrentSpreadsheetForQuestionBankSystemV1907() {
  return setupCurrentSpreadsheetForQuestionBankSystemV1915();
}

function setupCurrentSpreadsheetForQuestionBankSystemV1906() {
  return setupCurrentSpreadsheetForQuestionBankSystemV1915();
}

function setupCurrentSpreadsheetForQuestionBankSystemV1905() {
  return setupCurrentSpreadsheetForQuestionBankSystemV1915();
}

function setupCurrentSpreadsheetForQuestionBankSystemV1915() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupQuestionBankSystemSheetV1905_(ss);
  Logger.log("已設定目前 Google Sheet：");
  Logger.log(ss.getUrl());
}

function setupQuestionBankSystemSheetV1905_(ss) {
  var sheetsToKeep = [
    "系統設定",
    "題庫",
    "學生名單",
    "成績紀錄",
    "README"
  ];

  sheetsToKeep.forEach(function(name) {
    getOrCreateSheet_(ss, name);
  });

  // 刪除預設空白工作表，避免同步時讀錯分頁。
  ss.getSheets().forEach(function(sheet) {
    var name = sheet.getName();
    if (sheetsToKeep.indexOf(name) === -1 && /^工作表|^Sheet/i.test(name)) {
      ss.deleteSheet(sheet);
    }
  });

  setupSettingsSheet_(ss.getSheetByName("系統設定"));
  setupQuestionSheet_(ss.getSheetByName("題庫"));
  setupStudentSheet_(ss.getSheetByName("學生名單"));
  setupScoreSheet_(ss.getSheetByName("成績紀錄"));
  setupReadmeSheet_(ss.getSheetByName("README"));

  ss.setActiveSheet(ss.getSheetByName("題庫"));
}

function setupSettingsSheet_(sheet) {
  sheet.clear();
  var rows = [
    ["設定名稱", "值", "說明"],
    ["systemTitle", "微生物與免疫學題庫系統", "學生端首頁標題"],
    ["titleColor", "sky", "標題顏色：sky / pink / violet / emerald"],
    ["completion_pass_score", "90", "完成度達標分數"],
    ["allowed_email_enabled", "false", "是否限制 Google 登入信箱範圍"],
    ["allowed_email_domains", "ctcn.edu.tw", "允許網域，多個用逗號分隔，例如 ctcn.edu.tw,gmail.com"],
    ["allowed_email_exceptions", "", "例外完整信箱，多個用逗號分隔"],
    ["login_card_1_title", "使用 Google 帳號登入", "登入頁說明卡片 1 標題"],
    ["login_card_1_body", "請使用老師指定的信箱登入。", "登入頁說明卡片 1 內容"],
    ["login_card_2_title", "作答紀錄", "登入頁說明卡片 2 標題"],
    ["login_card_2_body", "完成作答後才會一次送出成績。", "登入頁說明卡片 2 內容"],
    ["login_card_3_title", "錯題複習", "登入頁說明卡片 3 標題"],
    ["login_card_3_body", "錯題複習不計入成績。", "登入頁說明卡片 3 內容"]
  ];
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  formatHeader_(sheet, 1, 1, rows[0].length);
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, 1, 240);
  sheet.setColumnWidths(2, 1, 360);
  sheet.setColumnWidths(3, 1, 420);
}

function setupQuestionSheet_(sheet) {
  sheet.clear();
  var headers = [
    "科目ID",
    "科目名稱",
    "章節ID",
    "章節名稱",
    "次分類",
    "認知類型",
    "難易度",
    "章節的重要性",
    "國考來源",
    "國考年度代碼",
    "題號",
    "題目ID",
    "問題",
    "選項A",
    "選項B",
    "選項C",
    "選項D",
    "解答",
    "解析",
    "核心概念",
    "常見誤解",
    "① 先看題幹",
    "② 比較觀念",
    "③ 推回答案",
    "講義標題",
    "講義連結",
    "圖片網址",
    "題型"
  ];

  var samples = [
    [
      "micro_immunology",
      "微生物與免疫學",
      "ch01",
      "緒論",
      "染色原理",
      "理解",
      "中",
      "高",
      "護理師國考",
      "113",
      "1",
      "micro_ch01_001",
      "革蘭氏染色中用以區分陽性與陰性的關鍵步驟為何？",
      "結晶紫染色",
      "碘液媒染",
      "酒精脫色",
      "番紅複染",
      "酒精脫色",
      "革蘭氏染色最關鍵的鑑別步驟是酒精脫色。",
      "革蘭氏染色原理",
      "容易混淆初染劑、媒染劑與脫色劑。",
      "先看題目問的是哪一個步驟具有區分作用。",
      "結晶紫與碘液會讓細菌先形成紫色複合物，但還不是區分關鍵。",
      "真正讓陽性與陰性出現差異的是酒精脫色。",
      "緒論講義",
      "",
      "",
      "單選"
    ],
    [
      "anatomy",
      "解剖學",
      "ch02",
      "神經系統",
      "腦神經",
      "記憶",
      "易",
      "中",
      "練習題",
      "",
      "1",
      "anat_ch02_001",
      "下列何者為第十對腦神經？",
      "嗅神經",
      "視神經",
      "迷走神經",
      "舌下神經",
      "迷走神經",
      "第十對腦神經為迷走神經。",
      "腦神經序列",
      "容易把第九、十、十二對腦神經混淆。",
      "先確認題目問的是第幾對腦神經。",
      "第九對是舌咽，第十對是迷走，第十二對是舌下。",
      "所以第十對是迷走神經。",
      "神經系統講義",
      "",
      "",
      "單選"
    ]
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, samples.length, headers.length).setValues(samples);
  formatHeader_(sheet, 1, 1, headers.length);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(4);
  sheet.autoResizeColumns(1, headers.length);
  sheet.setColumnWidth(13, 420);
  sheet.setColumnWidth(19, 520);
  sheet.setColumnWidths(20, 7, 360);
  sheet.setColumnWidth(26, 420);

  var answerRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["選項A", "選項B", "選項C", "選項D", "A", "B", "C", "D"], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, 18, Math.max(2000, sheet.getMaxRows() - 1), 1).setDataValidation(answerRule);

  var typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["單選", "圖片"], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, 28, Math.max(2000, sheet.getMaxRows() - 1), 1).setDataValidation(typeRule);
}

function setupStudentSheet_(sheet) {
  sheet.clear();
  var rows = [
    ["校區", "修課班級", "座號", "班級", "學號", "姓名", "email", "角色", "啟用狀態"],
    ["新店", "護理一甲", "1", "護理一甲", "114510001", "測試學生", "student@example.com", "student", "true"],
    ["", "", "", "教師", "teacher001", "老師", "teacher@example.com", "teacher", "true"]
  ];
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  formatHeader_(sheet, 1, 1, rows[0].length);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, rows[0].length);
  sheet.setColumnWidth(7, 280);
}

function setupScoreSheet_(sheet) {
  sheet.clear();
  var headers = [
    "時間戳記",
    "學號",
    "姓名",
    "測驗單元",
    "測驗模式",
    "第幾次",
    "分數",
    "答對題數",
    "答錯題數",
    "作答秒數",
    "Batch ID",
    "Google Email",
    "Firebase UID",
    "Auth Provider",
    "Details JSON"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeader_(sheet, 1, 1, headers.length);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
  sheet.setColumnWidth(15, 520);
}

function setupReadmeSheet_(sheet) {
  sheet.clear();
  var rows = [
    ["項目", "說明"],
    ["用途", "這份 Google Sheet 是題庫系統 v1.915 的後台資料入口。"],
    ["同步方向", "Google Sheet 題庫 / 設定 / 學生名單 → GAS → Firebase。學生端不直接呼叫 GAS。"],
    ["題庫", "正式題庫請放在「題庫」分頁。每題至少需有問題、選項A-D、解答。每章節可在任一題填寫講義標題與講義連結。"],
    ["科目", "科目ID 建議使用英文或底線，例如 micro_immunology；科目名稱可用中文。"],
    ["章節", "章節ID 建議使用 ch01、ch02；章節名稱可用中文。"],
    ["解析", "可同時使用完整解析與蘇格拉底式解析欄位。"],
    ["錯題與分析", "系統會在 Firebase 保存作答明細，未來可分析速度與正確性。"],
    ["下一步", "將 Code.gs 部署到 Apps Script，再於後台按「同步到 Firebase」。"]
  ];
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  formatHeader_(sheet, 1, 1, rows[0].length);
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 760);
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function formatHeader_(sheet, row, col, width) {
  var range = sheet.getRange(row, col, 1, width);
  range
    .setBackground("#0ea5e9")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(row, 34);
}
