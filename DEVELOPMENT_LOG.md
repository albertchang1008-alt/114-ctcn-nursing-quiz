# 題庫系統開發紀錄

## 維護規則

每一次修訂都必須更新本檔，並同步更新：

```text
README.md
handoff.md
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

## 已知待處理問題 - 2026-06-29

### 新增交接檔維護

- 自 2026-06-29 起，專案根目錄新增 `handoff.md` 作為工作接力檔。
- 每次程式或文件修訂後，需同步更新 `handoff.md`，記錄目前狀態、已完成事項、待處理問題、最近修改檔案與下一步建議。
- `handoff.md` 不可放入 Firebase private key、API token、密碼或其他敏感資訊。

### 測驗作答畫面狀態顯示異常（v1.912 已處理，待實機驗收）

- 手機端測驗時，題號與已作答數可能不同步。例如畫面在第 2 / 23 題時，底部已顯示已作答 3 / 23。
- v1.912 起，作答中不再立即顯示紅色錯誤選項與綠色正確答案。
- v1.912 起，作答中只顯示學生已選答案，交卷後才顯示正解與解析。
- v1.912 起，最後一題的下一題按鈕文案改為「已到最後一題」。

### 綜合練習分類清單的認知類型顯示不完整（v1.912 已處理，待實機驗收）

- 手機端開啟「綜合練習 - 選擇分類」時，只有「微生物與免疫學 | 細菌遺傳學」顯示 `記憶・理解・應用`，其他章節沒有顯示認知類型。
- v1.912 已將綜合練習的認知類型來源改為完整題庫快取 `allQuestionsForMenu`，不再使用會被目前測驗或閃卡覆蓋的 `allQuestionsData`。
- 若某分類沒有認知類型資料，前端會明確顯示「尚未標註認知類型」。

## v1.912 - 2026-06-29

### 修訂重點

- 測驗作答中不再立即揭露正解：學生選答案後只顯示「已選」狀態。
- 正確答案、錯誤答案與完整解析維持在交卷後的解析區顯示。
- 底部作答統計改為「本次已作答 X / N」，避免和目前題號混淆。
- 最後一題的下一題按鈕文案改為「已到最後一題」，避免誤以為還能前進。
- 綜合練習分類 modal 的認知類型彙整改用完整題庫快取，避免只顯示上一個已載入章節的認知類型。
- 綜合練習分類若沒有認知類型資料，明確顯示「尚未標註認知類型」。
- 版本號同步更新為 v1.912。

### 驗收重點

- 測驗作答中選答案後，不應出現紅色錯誤或綠色正解。
- 交卷後解析區仍應顯示正確答案、學生選擇與解析。
- 回上一題檢查時，只應看到該題已選答案，不應提前看到正解。
- 綜合練習分類 modal 應從完整題庫顯示各分類的認知類型。
- 沒有認知類型的分類應顯示「尚未標註認知類型」。

## v1.911 - 2026-06-29

### 修訂重點

- 學生端進入主選單時不再自動選取第一個科目。
- 未點選科目前，章節區改顯示「請先點選上方科目」提示。
- 只有學生主動點選科目後，才顯示該科目的章節、完成度與測驗入口。

### 驗收重點

- 登入後應先看到科目按鈕，不應直接看到章節列表。
- 點選科目後，才顯示該科目的章節清單。
- 切換科目後，章節清單應跟著更新。

## v1.910 - 2026-06-29

### 修訂重點

- 修正手機端 Google 登入選完帳號後，又回到登入頁且沒有明確錯誤的問題。
- `firebase-v1685.js` 登入流程改為 popup 優先，popup 被阻擋或不支援時才改用 redirect。
- redirect 登入前會記錄 pending 狀態，回跳後若 Firebase Auth 沒有恢復使用者，會顯示明確提示。
- redirect 回跳後新增等待 `onAuthStateChanged` 的保護，避免 iOS/Safari 較慢初始化時誤判未登入。
- 明確設定 Firebase Auth persistence 為 `LOCAL`，降低重新整理或回跳後登入狀態遺失。
- 「切換 Google 帳號」不再強制 redirect，改用同樣的 popup 優先流程。

### 驗收重點

- 手機 Safari 點「使用 Google 登入」後，選擇帳號應可進入主選單或註冊畫面。
- 若瀏覽器阻擋 popup，系統可自動 fallback 到 redirect。
- 若 redirect 回跳後仍無登入狀態，登入頁應顯示原因，不應安靜回到原畫面。
- LINE 內建瀏覽器仍應阻擋登入並提示改用 Safari / Chrome。

## v1.909 - 2026-06-29

### 修訂重點

- 學生端主選單改為先選科目，再列出該科目的章節。
- 章節排序加入 `chapterId`，避免只用章節名稱排序造成順序混亂。
- 章節列新增已做題數、全部題數、完成度、最高分與平均作答秒數。
- 點「測驗」後先顯示題數選擇 modal，可選 10 / 20 / 30 / 50 / 全部題目。
- 抽題改用 `studentProgress.attemptedQuestions`：未作答題優先，已作答題排後，同組內隨機洗牌。
- 測驗作答頁新增上一題 / 下一題與已作答題數顯示。
- 答題不再自動跳下一題，學生可回看已作答題目與正解。
- 送出前會檢查是否全部作答；交卷後才一次寫入 Firebase。
- 修正 `系統設定` 分頁的標題欄位讀取。
- GAS 現在優先讀取 `systemTitle` 與 `titleColor`，符合目前 Google Sheet 範本。
- 舊欄位 `system_title` / `title_color` 保留相容，但不再要求手動維護。
- email 限制設定同時支援 `allowed_email_enabled` / `allowed_email_exceptions` 與舊版欄位。
- 避免題庫第一欄 `科目ID` 被誤當成學生端首頁標題。

### 驗收重點

- 學生登入後應先看到科目按鈕，再看到該科目的章節清單。
- 章節順序應依 `chapterId` 自然排序。
- 點章節測驗後，應先選題數，不應直接進入全章全部題目。
- 答題後應能按上一題回看；按下一題進入下一題。
- 所有題目完成前不可送出。
- 交卷後該章節已做題數與最高分應更新。
- 在 `系統設定` 分頁修改 `systemTitle` 後，按「同步到 Firebase」，學生端首頁應顯示新標題。
- 在 `系統設定` 分頁修改 `titleColor` 後，學生端首頁標題顏色應更新。
- 若 `system_title` / `title_color` 留空，不應影響新版設定。

## v1.907 - 2026-06-29

### 修訂重點

- 修正教師後台登入成功後，資料讀取仍要求學生端 Firebase Google Auth 的問題。
- `admin.html` 的 `loadTeacherData()` 現在會先嘗試讀 Firebase 後台快取；若尚未 Google Auth 或 rules 不允許讀取，改回 GAS 後台通道。
- 保持分工：管理人登入用 `管理人名單`；學生登入與防雙視窗才使用 Firebase Authentication。
- `CreateQuestionBankSheet.gs` 增加 v1.907 函式入口，同時保留舊版函式相容文件。

### 驗收重點

- 建立 `管理人名單` 後，管理人可登入後台。
- 登入後台後，不應再因「請先使用 Google 帳號登入」而卡住。
- 若 Firebase 後台快取尚未準備好，後台仍能開啟，並顯示 GAS slim 可提供的資料。

## v1.906 - 2026-06-29

### 修訂重點

- `admin.html` 改為獨立教師後台入口。
- 後台頁不再自動執行學生端 `fetchQuestionBank()`。
- 後台頁不再顯示學生端的「載入中」、「系統發生錯誤」、「班級完成度排行」、「學生登入」或作答框架。
- 新增乾淨的後台首頁卡片，登入後才讀取後台管理資料。
- `CreateQuestionBankSheet.gs` 增加 v1.906 函式入口，同時保留 v1.905 函式相容舊說明。

### 驗收重點

- 開啟 `admin.html` 時，只看到教師管理後台入口。
- 點「管理人登入」才出現管理人登入 modal。
- 沒有 GAS 或題庫錯誤時，不應在後台頁看到學生端錯誤卡片。
- 學生端 `index.html` 不受此修正影響。

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
