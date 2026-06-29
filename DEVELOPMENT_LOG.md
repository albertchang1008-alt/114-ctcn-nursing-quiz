# 題庫系統開發紀錄

## 維護規則

每一次修訂都必須更新本檔，並同步更新：

```text
README.md
前端顯示版本號
GAS / Firebase 同步狀態版本號
相關部署或驗收說明
```

版本號採用：

```text
主要版號.次版號.修訂號
```

例如：

```text
v1.905
```

## v1.905 - 2026-06-29

### 修訂重點

- 新增 `CreateQuestionBankSheet.gs`，可直接建立一份新的 Google Sheet 題庫系統範本。
- 範本會建立 `系統設定`、`題庫`、`學生名單`、`成績紀錄`、`README` 分頁。
- `題庫` 分頁包含科目、章節、題目、選項、解答、完整解析與蘇格拉底式解析欄位。
- `系統設定` 分頁預先建立登入卡片、email 限制、達標分數等設定列。
- 提供 `createQuestionBankSystemSheetV1905` 建立新 Sheet，也提供 `setupCurrentSpreadsheetForQuestionBankSystemV1905` 設定目前 Sheet。

### 驗收重點

- 執行 `createQuestionBankSystemSheetV1905` 後，Apps Script 執行記錄應顯示新 Sheet URL。
- 新 Sheet 應包含五個必要分頁。
- `題庫` 分頁應有 `科目ID`、`科目名稱`、`章節ID`、`章節名稱`、`問題`、`選項A-D`、`解答`、`解析`、三段提示欄位。

## v1.904 - 2026-06-29

### 修訂重點

- 取消學生端讀取 `rankingCaches/home`，不再載入班級排行與今日練習人數快取。
- 後台首頁不再自動載入班級排行與今日人數，避免為排行榜增加 Firebase 讀寫成本。
- `answerBatches.detailsJson` 補入科目、章節、分類、次分類、難易度、重要性、認知類型與每題秒數，保留未來速度與正確性分析能力。
- `studentProgress/{studentId}` 新增 `attemptedQuestions` 與 `attemptedQuestionCount`，用於快速判斷學生做過哪些題。
- `studentProgress/{studentId}` 新增 `activeWrongQuestions`、`activeWrongQuestionTimes`、`activeWrongQuestionCount`，用一筆個人進度文件支援歷史錯題快速讀取。
- `wrongQuestions` 改為只在答錯時寫入，答對題不再寫 `active:false` 文件，降低每次交卷寫入數。
- 題庫同步新增 `subjectId`、`subjectName`、`chapterId`、`chapterName`、`text`、`answer`，同時保留舊欄位 `q`、`ans` 相容既有前端。

### 成本策略

- 作答中維持 0 次 Firebase 寫入。
- 交卷時一次寫入成績批次與個人進度。
- 錯題只寫錯題，不寫每一題。
- 班級排行與今日人數暫停，未來改由後台批次分析 `answerBatches`。

### 驗收重點

- 載入首頁時不應讀取 `rankingCaches/home`。
- 完成測驗後，`answerBatches.detailsJson` 應包含 `answerSec`、`subjectId`、`chapterId`、`cogType` 等分析欄位。
- 完成測驗後，`studentProgress/{studentId}.attemptedQuestions` 應包含本次題目 ID。
- 完成測驗後，`studentProgress/{studentId}.activeWrongQuestions` 應反映目前仍答錯的題目。
- 錯 3 題時只新增或更新 3 筆 `wrongQuestions`。

## v1.903 - 2026-06-29

### 修訂重點

- 導入蘇格拉底式解析方案 A，支援 `核心概念`、`常見誤解`、三段提示與補救章節欄位。
- 保留舊解析欄位，學生端顯示順序改為「引導式解析」在上、「完整解析」在下。
- `Code.gs` 題庫同步可讀取 `微生物與免疫學近十年國考題062926.xlsx` 的欄位格式。
- 題幹欄位優先讀 `問題`，避免讀到含選項組合的 `題目` 欄造成畫面重複。
- 分類欄位優先讀 `章節名稱`，避免把數字 `單元` 當成分類。
- Firebase 題庫格式新增 Socratic 欄位，作答明細與錯題閃卡保留這些資料。

### 驗收重點

- 題庫同步後，Firestore `questions` 文件應有 `socraticConcept`、`socraticHint1` 等欄位。
- 學生完成測驗後，檢討頁應同時顯示引導式解析與完整解析。
- 閃卡答題後，背面應同時顯示引導式解析與完整解析。
- 舊題庫若沒有方案 A 欄位，前端應只顯示完整解析，不應出現空白引導區。

## v1.902 - 2026-06-29

### 修訂重點

- Firebase 目標專案由 `ap-neuron` 切換為 `nurse-4981a`。
- `.firebaserc` default project 改為 `nurse-4981a`。
- `firebase-config.js` 移除舊 `ap-neuron` 前端設定，改為等待貼入 `nurse-4981a` Web app SDK config。
- README 補充 service account JSON 佈建說明。
- 新增 `.gitignore`，避免 `*-firebase-adminsdk-*.json` 私鑰檔被上傳。

### Service Account

目前提供的 JSON：

```text
nurse-4981a-firebase-adminsdk-fbsvc-d0c1977f3a.json
```

可用於 Apps Script 指令碼屬性：

```text
FIREBASE_PROJECT_ID = nurse-4981a
FIREBASE_CLIENT_EMAIL = firebase-adminsdk-fbsvc@nurse-4981a.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY = JSON 內 private_key 的完整內容
```

### 後續必做

- 到 Firebase Console 的 Web app 取得 `nurse-4981a` Firebase SDK config。
- 將 `apiKey`、`messagingSenderId`、`appId`、`measurementId` 貼入 `firebase-config.js`。
- 確認 Firestore Database 已在 `nurse-4981a` 建立。
- 確認 Authentication 的授權網域包含 GitHub Pages 網域。

## v1.901 - 2026-06-28

### 修訂重點

- 登入頁採用「方案 A：考試入口型」。
- 學生登入頁移除班級排行。
- 登入頁保留後台可設定的三段提醒，但呈現為一個正式的「考試提醒」區塊。
- Google 登入卡改為單一清楚入口。
- GAS 瘦身，日常 Web App 不再承擔學生登入、判題、排行、錯題、分析或歷史大量補回。
- 新增完整佈建 SOP 到 `README.md`。
- 新增本開發紀錄檔。

### 架構決策

- 學生端資料讀寫固定走 Firebase。
- Google Sheet 是老師維護題庫、設定與成績回寫後查看的介面。
- GAS 只做 Sheet ↔ Firebase 同步。
- 十年題庫、多科目、多年度資料應以 Firebase 作為主要運行資料庫。
- 大量歷史成績補回不可放在日常 GAS Web App，應改為一次性遷移工具。

### 已保留

- `Code.full-legacy.gs` 保留舊版完整 GAS，僅供查詢與回溯。
- `Code.gs` 是正式瘦身版。
- 後台仍可設定首頁標題、標題顏色、登入提醒、email 限制、完成度分類。

### 驗收項目

- `index.html` script 語法檢查通過。
- `admin.html` script 語法檢查通過。
- `Code.gs` 語法檢查通過。
- 學生端 `postGAS()` 會阻擋 GAS 呼叫。
- 後台 `postGAS()` 有 slim action 白名單。

### 後續注意

- 若要補回歷史成績，需建立獨立遷移工具。
- 若十年題庫資料量變大，題庫同步應分科目、年度或版本切分。
- 成績回寫 Google Sheet 應逐步改成增量 cursor，避免長期資料量過大時回寫變慢。

## v1.9 - 2026-06

### 修訂重點

- 規劃 Google 登入為學生身份基礎。
- 首次登入可註冊。
- 支援後台設定允許 email 網域與例外信箱。
- 重新整理後透過 Firebase Auth 與 `loginStates` 恢復登入狀態。
- 建立 Firebase-first 學生端方向。

### 主要問題

- 舊 GAS 承擔太多即時運算，面對大量學生與長期題庫會變慢。
- 學生端曾混用 GAS 與 Firebase，造成資料來源與成績顯示不一致。
- 排行、今日人數、完成度與歷史補回需要拆成不同資料流程。

## v1.69 / v1.685 系列 - 2026-06

### 修訂重點

- 將既有題庫系統逐步接上 Firebase。
- 嘗試把題庫、成績、完成度搬到 Firebase。
- 保留 Google Sheet 作為老師維護資料與成績查看入口。

### 主要問題

- Firebase 與 GAS 混合期間，部分成績顯示與回寫流程不一致。
- 題目 ID 在不同分類可能重複，造成 Firestore batch write 衝突。
- 學生作答後完成度與 Google Sheet 成績總表需要更明確的同步策略。

## v1.681 / v1.684 系列 - 2026-06

### 修訂重點

- 修正閃卡與測驗計分邏輯。
- 錯題重做不計分。
- 加入完成度、排行、今日練習人數等功能。
- 改善手機端排行顯示。
- 加入倒數計時與後台設定。

### 主要問題

- GAS 每次計算排行與今日人數太耗資源。
- 重複登入與 session 檢查若過度輪詢會增加 GAS 負擔。
- 閃卡答案顯示、選項顏色與題庫答案一致性需要更嚴格處理。
