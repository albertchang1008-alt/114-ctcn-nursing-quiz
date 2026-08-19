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

## v1.918 - 2026-08-11

### 修訂重點

- 修正部分 iPhone 學生完成 Google 選帳後回到首頁，卻無法還原 Firebase 登入狀態的問題。
- 根因是 GitHub Pages 與 Firebase `authDomain` 不同站；iOS Safari 與 Chrome 都會限制 redirect 流程所需的第三方儲存。
- `startGoogleLogin()` 改為在使用者點擊後立即呼叫 `signInWithPopup()`，避免先 `await setPersistence()` 導致 Safari 遺失 user activation。
- popup 失敗時不再自動降級為 `signInWithRedirect()`，避免形成「選帳號 → 返回首頁 → 仍未登入」循環。
- 新增 popup 被封鎖、重複 popup 與不支援環境的明確提示。
- `firebase-v1685.js` 加入 `?v=1918` cachebuster，確保 GitHub Pages 部署後學生取得新版登入程式。

### 驗收重點

- iPhone Safari 與 Chrome 按「使用 Google 登入」後應開啟 Google 登入視窗，完成後留在原頁並進入系統。
- 登入流程不應再整頁跳轉到 Google 後返回。
- 若封鎖 popup，頁面應顯示允許彈出式視窗的明確訊息。
- Firebase Authentication 的授權網域仍需包含 `albertchang1008-alt.github.io`。

## v1.917 - 2026-07-03

### 修訂重點

- 修正學生端每次載入都讀取整個 `questions` collection，導致 Firestore reads 異常偏高的問題。
- `Code.gs` 同步 Firebase 時新增 `questionBundles/current` manifest。
- `Code.gs` 會把完整題庫切成 `questionBundles/current/chunks/{chunkId}`，目前以每包最多 50 題、每包約 700KB 以下為原則。
- `firebase-v1685.js` 的 `loadBootstrap()` 改為優先讀取 `questionBundles/current` 與 chunks。
- 若 bundle 尚未建立或 Firestore rules 未放行，前端會 fallback 到舊的 `questions` collection，避免學生端無題可用。
- `firestore.rules` 新增 `questionBundles/{bundleId}` 與其 `chunks` 的讀取規則。
- `firebase-config.js` 新增 `collections.questionBundle = "questionBundles/current"`。
- 版本號同步更新為 v1.917。

### 驗收重點

- 後台按「同步到 Firebase」後，Firestore 應出現 `questionBundles/current` 與 `questionBundles/current/chunks/001...N`。
- 學生端載入後，應從 bundle 取得題庫，不應每次讀取 1000+ 筆 `questions` 文件。
- Firebase 用量中的讀取數，後續應明顯低於舊版載入行為。
- 若未更新 rules 或尚未同步 bundle，學生端仍可 fallback，但讀取量會回到舊模式。
- 既有 `questions` collection 保留，不影響後台、題庫同步、舊資料相容與未來分析。

## v1.916 - 2026-06-30

### 修訂重點

- 修正測驗中學生點選答案後無法修改的問題。
- `renderQuestion()` 不再於已作答狀態把選項按鈕設為 disabled。
- `handleOptionClick()` 移除「已選過就 return」的防護，交卷前可重選並覆蓋本題暫存答案。
- 重選答案會重新計算本題最後作答秒數；Firebase 仍只在交卷時一次寫入。
- 版本號同步更新為 v1.916。

### 驗收重點

- 同一題第一次點選後，仍可改選其他選項。
- 改選後畫面只顯示最後選擇。
- 上一題回看時仍可改選。
- 交卷後成績與解析依最後選擇判定。
- 作答中仍不寫入 Firebase。

## v1.915 - 2026-06-29

### 修訂重點

- 學生端右上角新增「淺色 / 夜讀」風格切換按鈕。
- 風格選擇寫入瀏覽器 `localStorage`，重新整理後保留上次選擇。
- 題庫新增章節講義資料欄位支援：`講義標題`、`講義連結`，也支援 `lectureTitle`、`lectureUrl`、`handoutTitle`、`handoutUrl`。
- `Code.gs` 同步題庫到 Firebase 時會保留題目與章節層級的講義連結。
- `firebase-v1685.js` 正規化題庫、錯題與作答明細時保留講義欄位，方便後續分析或回放。
- `index.html` 章節列若有講義連結，會在測驗與閃卡按鈕旁顯示「講義」按鈕，點擊後以新分頁開啟。
- `CreateQuestionBankSheet.gs` 新增講義欄位到空白範本。
- 版本號同步更新為 v1.915。

### 驗收重點

- 右上角切換按鈕可在夜讀深色與淺色模式間切換。
- 重新整理後仍保留學生上次選擇的風格。
- Google Sheet 題庫任一章節填入講義連結，同步到 Firebase 後，學生端該章節出現「講義」按鈕。
- 點擊「講義」應以新分頁開啟，不影響測驗或閃卡流程。
- 沒有講義連結的章節不應顯示空按鈕。

## v1.913 - 2026-06-29

### 修訂重點

- 學生端前端視覺切換為第三種「夜讀深色」風格。
- `index.html` 新增 `night-study` 主題樣式，以深色卡片、青藍操作色與粉色標題作為主視覺。
- 章節列新增 `chapter-row`、`chapter-title`、`chapter-meta`、`chapter-track`、`chapter-fill` 等樣式掛點，方便深色主題覆蓋原本 inline style。
- 測驗選項新增 `option-picked` 與 `option-muted` 狀態 class，讓已選答案與未選項目在深色風格下清楚但不提前揭露正解。
- 版本號同步更新為 v1.913。

### 驗收重點

- 學生端首頁、科目章節、測驗、閃卡與結果頁應呈現深色夜讀風格。
- 測驗作答中仍只顯示已選答案，不應提前顯示紅色錯誤與綠色正解。
- 章節卡、按鈕、modal、輸入框在手機與桌面都應清楚可讀。
- Firebase 登入、抽題、交卷與完成度流程不應因風格切換受影響。

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
# v1.922 - 2026-08-15

### 改造內容

- v1.919：開頁改讀公開設定，Google 登入後才讀 `system/main` 與題庫；題庫 rules 改為需登入。
- v1.920：GAS 加入 SHA-256、`LockService`、題庫與學生名單差異同步；題庫改為內容定址章節 bundles，未變更章節可重用。
- v1.921：新增學生錯題狀態子集合、每次測驗錯題事件、尚未答對／曾經答錯模式與非破壞性搬移工具。
- v1.922：成績回寫改依 `clientCreatedAt` cursor 增量查詢，採 5 秒重疊及 Batch ID 去重。
- 正式環境停用全題 fallback；舊集合暫時保留，待部署後觀察 7～14 天再清理。

### 本機驗收

- `Code.gs`、Firebase JS 與兩份 HTML inline script 均通過 JavaScript 語法檢查。
- 內容雜湊重複計算一致；模擬三題兩章成功產生兩份章節 manifest/chunks。
- 已確認登入前程式只呼叫 `loadPublicConfig()`，登入後 `loadBootstrap()` 才能讀系統與章節 metadata。
- 正式環境實際 Firestore reads/writes、rules、OAuth、GAS REST 與手機登入仍需部署驗收。
# v1.923 - 2026-08-16

### 問題

- v1.922 章節卡片可顯示正確題數，但點「測驗」後題數彈窗顯示全部、已作答、未作答皆為 0，所有題數按鈕被停用。
- 原因是章節懶載入後 `allQuestionsForMenu` 固定為空，舊彈窗仍以該完整題庫快取計數。

### 修正與驗收

- 新增章節級題目快取，彈窗開啟時讀取所選章節 bundle，再依 Firebase 題目 ID 計算作答狀態。
- topic metadata `count` 作為載入前與錯誤時的 fallback，確保有題目的章節不會顯示 0。
- 加入快速切換章節的非同步競態保護。
- `index.html` inline JavaScript 語法與題數統計測試通過。
# v1.924 - 2026-08-17

### 問題與根因

- 成績紀錄的時間欄直接寫入 `clientCreatedAt` UTC ISO 字串，Google Sheet 因此顯示尾端 `Z` 的 UTC 時間，而非台北時間。

### 修正

- 增量 cursor 繼續保存 UTC ISO，避免改變查詢排序與重疊去重邏輯。
- Sheet 寫入改用 Date，試算表時區固定為 `Asia/Taipei`，顯示格式為 `yyyy/mm/dd hh:mm:ss`。
- 同步時自動轉換既有含 `Z` 或 offset 的 ISO 時間字串，並保留公式與既有本地格式。
# v1.925 - 2026-08-17

## 成績資料層

- 新增 `scoreSummaries/{batchId}` 輕量逐次摘要，與完整 `answerBatches` 同批寫入。
- 正式 `nurse-4981a` 已發布新版 Firestore rules 與全部 scoreSummaries 複合索引（含 uid + answeredAt）。
- 修正 `getTeacherData` 將 Google Sheet 學生名單回傳為空物件的問題；未作答學生現在也會出現在後台班級名單。
- 學生名單同時有「修課班級」與「班級」時優先採用修課班級，並排除 teacher/admin 角色進入學生同步。
- 學生名單新增 `科目ID` 關聯；支援逗號分隔多科目，並以 Firebase 已發布題庫的 subjectId 驗證。
- 每位學生的完成度母項目改為「全域完成度設定 × 學生科目ID」交集；學生端與教師後台均排除其他科目的章節。
- 學生歷次成績查詢改用 Firebase Auth `uid + answeredAt`，與 owner rules 直接對齊；新增複合索引及可辨識的權限／索引／網路錯誤訊息。
- 重寫後台 Firebase 同步：題庫、設定、學生名單各有獨立 action 與按鈕；完整同步保留但需再次確認。
- 學生名單同步只讀「學生名單」，設定同步只讀系統設定與題庫首列標題，只有題庫同步會建立題庫 hash、章節 manifest 與 chunks。
- 離線佇列預先產生並保留 `batchId`，避免重送重複紀錄。
- 新增學生歷史分頁、逐題時間明細及後台最近 100 筆即時監聽。

## 完成度

- 題庫同步新增穩定 `topicId` 與 `courseId`。
- 新增 `completionTopicIds`，並保留名稱設定相容。
- 修正完成度清單裁掉其他單元最高分，以及完成度分子計入非指定單元的問題。
- 修正後台設定頁題目來源為字串時顯示 `undefined`，並合併多個班級資料來源。

## 安全與部署

- 學生只能讀自己的摘要與完整作答；教師全班監聽要求 `admin` Custom Claim。
- `studentAttempts` 不再允許任意已登入使用者讀取。
- 新增摘要查詢複合索引與預設 dry-run 的歷史回補工具。

# v1.926 - 2026-08-18

## 測驗倒數

- 每次測驗依實際出題數以每題 60 秒計算上限，題目載入完成後才開始計時。
- 頂端顯示本次測驗倒數；剩餘 20% 顯示警示，最後 60 秒顯示紅色。
- 時間到自動交卷並允許未作答題送出；截止後即使首次送出失敗，也只能重新送出，不能修改答案。
- 手動交卷停止計時並保存實際秒數；逾時交卷保存完整時間上限。

## 手機章節名稱

- 章節名稱由單行 `nowrap` 省略改為最多兩行顯示，超過兩行才截斷。
- 平均每題秒數移到章節資訊列，避免與長標題競爭寬度。
- 完整標題保留在 `title` 屬性，桌面端可輔助查看。

## 版本與驗收

- 學生端、後台、GAS `APP_VERSION` 與資源 cachebuster 同步更新為 `v1.926`。
- `index.html` 與 `admin.html` inline JavaScript 語法檢查通過；40 題倒數換算與逾時自動送出測試通過。
- 尚需在 iPhone Safari／Chrome 實機確認兩行標題與倒數版面。

# v1.927 - 2026-08-18

## 歷次成績長單元名稱

- 歷次成績清單移除單行 `truncate`，改為最多兩行顯示，超過兩行才省略。
- 清單左側標題區加入 `flex: 1` 與 `min-width: 0`，確保右側分數不會將單元名稱壓縮到消失。
- 歷次成績明細頁套用相同的兩行標題規則，分數區保持 `shrink-0`。
- 完整單元名稱保留在 `title` 屬性。

## 版本與驗收

- 學生端、後台、GAS `APP_VERSION` 與資源 cachebuster 同步更新為 `v1.927`。
- `index.html`、`admin.html` 與 `Code.gs` 語法檢查通過。
- 尚需在 iPhone Safari／Chrome 實機確認歷次成績清單及明細的兩行標題版面。

# v1.928 - 2026-08-18

## 歷次成績表格

- 將學生端歷次成績卡片清單改為語意化表格，顯示單元、作答時間、答對題數、用時與成績。
- 單元名稱允許完整換行，表格在手機畫面可橫向滑動。
- 表格列保留滑鼠點擊與鍵盤 Enter／空白鍵開啟逐題明細。

## 後台顯示設定

- 新增歷次成績單元勾選清單，與完成度計算單元分開管理。
- GAS 系統設定新增 `score_history_topics`、`score_history_topic_ids` 的讀寫與 Firebase 同步。
- 學生端依 topicId 優先、單元名稱相容舊紀錄進行篩選；空白設定代表全部顯示。

## 版本與驗收

- 學生端、後台、GAS `APP_VERSION` 與資源 cachebuster 同步更新為 `v1.928`。
- 尚需部署 GAS 與前端，後台儲存並同步設定後，以學生帳號確認表格及單元篩選。

# v1.929 - 2026-08-18

## 歷次成績清單精簡

- 歷次成績由五欄橫向表格改為單欄三行表格，每筆依序顯示科目、單元與成績。
- 成績行右側保留台北時間的日期與分鐘，方便分辨同單元多次作答。
- 答對題數與用時僅在點入明細後顯示，降低手機清單資訊密度。
- 科目優先讀取成績摘要的 `subjectName`／`subjectId`，舊資料則由題庫 topic metadata 補找。

## 版本與驗收

- 學生端、後台、Firebase fallback、GAS `APP_VERSION` 與資源 cachebuster 同步更新為 `v1.929`。
- JavaScript、GAS 語法及科目 fallback 邏輯需完成靜態驗收。

# v1.930 - 2026-08-18

## 完成度定義修正

- 發現入口單元卡片的「完成度％」採用做過題數／總題數，與入口頂端及後台的達標完成度不同。
- 將該百分比正名為「題目練習率」，保留其追蹤題目接觸範圍的用途。
- 新增正式「完成狀態」，由 `studentProgress.topicProgress`／`details` 的最高有效分數與後台門檻判定。
- 完整測驗與完整閃卡會更新最高有效分數；抽題練習只更新題目練習率。
- 歷次成績清單與明細同步顯示目前單元完成狀態，與入口及後台共用同一資料來源。
- 修正舊學生缺少科目ID時，完成度範圍被清空而隱藏摘要的相容問題。

## 版本與驗收

- 學生端、後台、Firebase fallback、GAS `APP_VERSION` 與資源 cachebuster 同步更新為 `v1.930`。
- 需驗證達標、未達標、未納入完成度，以及抽題練習不改變正式完成狀態等情境。

# v1.931 - 2026-08-18

## 手動更新完成度看板

- 後台新增科目／單元篩選的全學生完成度表格與四張摘要卡。
- Google Sheet 名單負責補入未作答學生，Firebase `studentProgress` 負責最高有效分數。
- 使用手動「更新資料」觸發 collection `get()`，不建立即時 listener；前端篩選不增加讀取。
- 教師帳號必須具有 Firebase `admin: true` Custom Claim 才能讀取全體 `studentProgress`。
- 按未完成優先排序，再依班級與學號排列，方便老師找出尚未練習學生。

## 完成度一致性

- 入口、歷次成績與完成度看板均以目前後台 `passScore` 對 `best` 重算。
- 不再以學生文件內可能因門檻變更而過期的 `passed` 布林值作為顯示依據。
- 後台調整達標門檻後，學生重新載入入口、老師重新更新看板即可套用，不需等待再次作答。

## 版本與驗收

- 學生端、後台、Firebase fallback、GAS `APP_VERSION` 與資源 cachebuster 同步更新為 `v1.931`。
- 本版不需要新增 Firestore index；既有 rules 已允許 `admin` 讀取 `studentProgress`。

# v1.932 - 2026-08-18

## 動態課程進度

- 後台完成度勾選區改稱「目前必須完成的單元」，作為老師可隨課程進度調整的唯一清單。
- 未勾選單元視為尚未納入目前課程進度，不進入學生與老師完成度分母。
- 學生既有 `topicProgress.best` 永久保留；清單調整只改變目前要求範圍。

## 學生尚待完成看板

- 入口新增精簡待完成清單，只列目前必要且未達標單元。
- 顯示最高有效分數或尚無完整成績、距達標差距，以及測驗／閃卡快捷入口。
- 完成度摘要改稱「截至目前完成度」，避免誤解為全學期最終完成度。
- Firebase 設定讀取新增 force refresh；每次學生登入重新取得 `system/main`，同頁切換帳號也不沿用舊設定。

## 版本與驗收

- 學生端、後台、Firebase fallback、GAS `APP_VERSION` 與資源 cachebuster 同步更新為 `v1.932`。
- 需驗證老師調整清單並同步後，學生重新登入會看到最新待完成單元。

# v1.933 - 2026-08-18

## 學生端科目三層導覽

- 學生登入後固定停在科目選擇層，即使只有一個科目也不再自動選取。
- 選擇科目後進入科目首頁，顯示該科目待完成入口與完整章節清單。
- 原本跨科目直接展開的待完成看板改為科目首頁入口，點擊後才進入第三層清單。
- 待完成清單新增科目鍵篩選，只顯示目前科目中老師指定且未達標的單元。
- 沒有待完成單元時仍顯示入口與完成提示；全部章節不排除待完成單元。
- 新增返回科目選擇與返回科目首頁操作，測驗／閃卡返回後保留原導覽狀態。

## 版本與驗收

- 學生端、後台、Firebase fallback、GAS `APP_VERSION` 與資源 cachebuster 同步更新為 `v1.933`。
- 本版不變更 Firestore collections、rules、indexes 或 GAS 資料介面。
- 需在單科目、多科目、全部完成及部分未完成帳號驗證三層導覽與手機版面。

# v1.934 - 2026-08-19

## Ch08 顯示相容修正

- 查明學生原始作答紀錄與正式最高分正確；`0/N`、`0%` 是前端章節題目尚未載入卻直接以空陣列計算所致。
- 查明 Ch08 現行及歷史 `topicId` 存在重複或異動，不適合作為八個單元的唯一識別。
- 新增 `IMM-CH08-01` 至 `IMM-CH08-08` 前端相容碼，以章節編號對照新舊名稱；第二單元舊名稱相容到「第二型過敏」。
- 完成度、最高分、待完成看板與歷次成績以相容名稱鍵優先；Ch08 不再使用重複 `topicId` fallback。
- 題目練習率以章節實際題目 ID 與 `attemptedQuestions` 交集計算，並新增讀取中／無法讀取狀態。
- 未寫入或遷移 `studentProgress`、`answerBatches`、`scoreSummaries` 等歷史資料。

## 版本與驗收

- 學生端、後台、Firebase fallback、GAS `APP_VERSION` 與資源 cachebuster 同步更新為 `v1.934`。
- 完整證據、對照表與後續預防方案記錄於 `CH08_COMPATIBILITY_DECISION_2026-08-19.md`。

# v1.935 - 2026-08-19

## GAS 安全代理與認證

- `adminLogin` 成功後核發 6 小時滑動期限的隨機 session token，使用 GAS Script Cache 保存。
- 除登入外的管理 GAS actions 統一驗證 token；登出立即撤銷，登入失敗採每帳號 10 分鐘 5 次限制。
- Firebase OAuth access token 加入 50 分鐘伺服器快取，避免每次代理請求重取 OAuth token。
- 完成度看板改由 GAS 使用服務帳號讀取 `studentProgress`，前端不再要求 Firebase admin claim。

## 低流量完成度與最近做答

- 完成度代理使用 field mask 排除 attemptedQuestions、錯題、email、UID 與 processed batch IDs。
- 完成度與最近 100 筆做答各自使用 120 秒共用快取；強制更新才繞過快取。
- 最近做答採獨立展開式懶載入，只回傳摘要，不傳逐題 `detailsJson`。
- 看板狀態列顯示資料時間、快取狀態、Firestore reads、來源文件數及約略傳輸 KB。
- 管理端補入 Ch08 相容碼、尚缺單元欄，並讓摘要卡跟隨搜尋結果計算。
- 未修改 `studentProgress`、`answerBatches`、`scoreSummaries` 或其他歷史資料。

## 版本與部署

- 學生端、後台、Firebase fallback、GAS `APP_VERSION` 與資源 cachebuster 同步更新為 `v1.935`。
- 詳細資料流與驗收方式記錄於 `ADMIN_GAS_PROXY_V1935.md`。
