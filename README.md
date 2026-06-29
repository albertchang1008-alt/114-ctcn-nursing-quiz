# 題庫系統 v1.915 佈建說明

## 文件維護規則

每一次修訂都必須同步更新：

```text
README.md
DEVELOPMENT_LOG.md
handoff.md
前端可見版本號
GAS / Firebase 同步狀態中的版本號
```

本次版本：

```text
版本：v1.915
日期：2026-06-29
重點：加入第三種夜讀深色前端、右上角風格切換，以及章節講義連結。
```

## 版本定位

v1.915 以 v1.9 架構為基礎，學生端改為 Firebase Authentication 的 Google 登入。沒有預先建立學生名單時，學生第一次 Google 登入後會先註冊，系統確認 Google 信箱已驗證後，才建立學生資料並進入系統。

## 手機 Google 登入注意事項

v1.910 起，學生端 Google 登入流程調整為：

```text
優先使用 popup 登入
→ popup 被瀏覽器阻擋時才改用 redirect
→ redirect 回跳後等待 Firebase Auth 狀態初始化
→ 若仍沒有登入狀態，顯示明確錯誤訊息
```

若手機選完 Google 帳號後又回到登入畫面，請先確認：

```text
1. Firebase Authentication 的授權網域已加入 albertchang1008-alt.github.io。
2. 使用 Safari 或 Chrome，不使用 LINE 內建瀏覽器。
3. iPhone Safari 若仍失敗，可暫時關閉「防止跨網站追蹤」後再登入。
4. Firebase Console 的 Google Provider 已啟用。
```

學生端不會因手機登入失敗而改回學號姓名登入；身份仍以 Google 登入與 Firebase session token 為準。

資料分工：

- Google Sheet：老師維護題庫、系統設定、學生名單與成績回寫後的報表來源。
- GAS：只保留「Sheet ↔ Firebase」同步介面，不再負責學生登入、作答、判題、排行、錯題或大量分析。
- Firebase Authentication：學生 Google 登入與信箱驗證狀態。
- Firebase Firestore：題庫讀取、學生資料、作答批次、個人完成度、錯題、session token 與後台分析所需原始明細。
- 學生名單：可選。可用於老師預先建帳或後台管理，但不是學生首次登入的必要條件。

`Code.full-legacy.gs` 是舊版完整 GAS 備份；正式部署請使用瘦身後的 `Code.gs`。

## 交接檔 handoff.md

自 2026-06-29 起，專案根目錄新增：

```text
handoff.md
```

用途：

```text
記錄目前開發狀態
記錄最近修改檔案
記錄已知待處理問題
記錄下一步建議
提供下一輪 Codex 或人工接手依據
```

每次程式或文件修訂後，都必須同步更新 `handoff.md`。

注意：`handoff.md` 不可放入 Firebase private key、API token、密碼或其他敏感資訊。

## 首頁標題設定

學生端首頁標題直接在 Google Sheet 的 `系統設定` 分頁設定：

```text
systemTitle = 微生物與免疫學題庫系統
titleColor  = sky
```

支援的標題顏色可填：

```text
sky
pink
violet
emerald
```

也可以填十六進位色碼，例如：

```text
#0ea5e9
```

v1.909 起，GAS 會優先讀取 `systemTitle` / `titleColor`。舊版相容欄位 `system_title` / `title_color` 仍可讀取，但不需要手動維護兩份。

## 學生端選題與作答流程

v1.911 起，學生端不再自動展開章節。進入主選單後流程為：

```text
選科目
→ 選章節
→ 選測驗題數（10 / 20 / 30 / 50 / 全部）
→ 一題一題作答
→ 可用上一題 / 下一題檢查
→ 完成後一次送出 Firebase
```

未點選科目前，章節區只會顯示提示：

```text
請先點選上方科目
```

章節清單會顯示：

```text
章節編號與章節名稱
已做題數 / 全部題數
章節完成度
最高分
平均每題作答秒數（若已有資料）
```

抽題原則：

```text
1. 從 Firebase 題庫讀取該章節題目。
2. 讀取 studentProgress/{studentId}.attemptedQuestions。
3. 未作答題優先，已作答題排後。
4. 兩組內各自隨機洗牌。
5. 依學生選擇題數切出本次測驗。
```

答題中不會寫入 Firebase。學生完成全部題目並按送出後，才一次寫入 `answerBatches`，並更新 `studentProgress` 的成績摘要、完成度與 `attemptedQuestions`。

### v1.913 測驗畫面修正

v1.913 已處理下列兩項畫面問題：

```text
測驗作答中不再立即顯示紅色錯誤與綠色正解。
學生作答後只會看到「已選」狀態，交卷後才顯示正解與解析。
底部作答數改成「本次已作答」，避免和目前題號混淆。
綜合練習分類清單改用完整題庫快取彙整認知類型，不再被上一個章節載入狀態影響。
若某分類沒有認知類型資料，會顯示「尚未標註認知類型」。
```

### v1.915 前端風格與講義連結

v1.915 將學生端預設切換為第三種「夜讀深色」風格，右上角提供風格切換按鈕：

```text
夜讀模式：預設深色介面
淺色模式：切回原本較亮的介面
```

學生的選擇會存在瀏覽器 `localStorage`，重新整理後仍保留上次選擇。

章節清單支援講義連結。Google Sheet 題庫分頁可新增：

```text
講義標題
講義連結
```

英文欄位也可使用：

```text
lectureTitle
lectureUrl
handoutTitle
handoutUrl
```

同一章節只要任一題填入講義連結，同步到 Firebase 後，學生端該章節右側會顯示「講義」按鈕，點擊後以新分頁開啟。

## 後台入口

`admin.html` 是教師後台專用頁，不再共用學生端首頁框架。

後台開啟時只會顯示：

```text
教師管理後台
管理人登入
```

不會再出現學生端的：

```text
載入中
系統發生錯誤
班級完成度排行
學生登入
作答或閃卡畫面
```

後台登入後才會讀取管理資料；學生端題庫載入仍由 `index.html` 負責。

### 後台登入與 Firebase Auth 的分工

後台管理人登入目前使用 Google Sheet 的 `管理人名單` 分頁驗證：

```text
管理人名單
使用者ID | 密碼 | 顯示名稱
```

學生端 Google 登入使用 Firebase Authentication，這是學生身份與防雙視窗用的登入，不是後台管理人登入。

因此 `admin.html` 登入後如果尚未有 Firebase Google Auth 狀態，不應顯示：

```text
讀取失敗：請先使用 Google 帳號登入
```

v1.907 起，後台若無 Firebase Google Auth，會改走 GAS 後台通道讀取可用資料，不會阻擋教師後台開啟。

## 一鍵建立 Google Sheet 範本

本版本新增：

```text
CreateQuestionBankSheet.gs
```

這支腳本可以建立一份新的 Google Sheet，並自動產生：

```text
系統設定
題庫
學生名單
成績紀錄
README
```

操作方式：

1. 開啟 `script.google.com`。
2. 新增 Apps Script 專案。
3. 將 `CreateQuestionBankSheet.gs` 的全部內容貼上。
4. 儲存。
5. 執行：

```text
createQuestionBankSystemSheetV1915
```

6. 第一次執行會要求授權。
7. 執行完成後，到「執行記錄」查看新 Google Sheet 連結。

若你已經有一份空白 Google Sheet，也可以在該 Sheet 的 Apps Script 中貼上此檔，執行：

```text
setupCurrentSpreadsheetForQuestionBankSystemV1915
```

它會在目前試算表直接建立必要分頁。

## Firebase 讀寫成本策略

v1.911 先取消班級排行與今日練習人數快取，不再讓學生端或後台首頁為排行榜讀取 `rankingCaches/home`。

保留的學生端 Firebase 讀取：

```text
system/main
questions
studentProgress/{studentId}
loginStates/{studentId}
wrongQuestions（只有學生打開錯題功能時讀）
```

作答中不寫 Firebase。交卷時才一次寫入：

```text
answerBatches/{batchId}
studentProgress/{studentId}
wrongQuestions/{studentId_questionId} 只寫錯題
```

不再為答對題目寫入 `wrongQuestions active:false`，因此錯題成本是「錯幾題才寫幾筆」。
目前仍未掌握的錯題狀態會存在同一份 `studentProgress/{studentId}`：

```text
activeWrongQuestions
activeWrongQuestionTimes
activeWrongQuestionCount
```

學生打開歷史錯題時，系統會優先讀這一份個人進度文件；舊資料沒有此欄位時，才回退查 `wrongQuestions` 集合。

為了保留未來分析速度與正確性的能力，`answerBatches.detailsJson` 會保存：

```text
questionId
questionFirebaseId
subjectId
subjectName
chapterId
chapterName
lectureTitle
lectureUrl
topic
category
subCategory
cogType
difficulty
importance
selectedText
correctText
isCorrect
answerSec
```

未來如果要看班級、章節、科目、認知類型的正確率或平均作答秒數，應由後台按鈕或排程從 `answerBatches` 批次產生分析，不在學生登入或作答時即時計算。

## 蘇格拉底式解析方案 A

v1.911 支援「舊解析 + 引導式解析」並行。老師在 Google Sheet 題庫中維護舊解析欄位，學生仍能看到完整解析；若題庫同時有方案 A 欄位，學生完成作答或閃卡答題後，會先看到引導式解析，再看到完整解析。

建議欄位如下。你目前的 `微生物與免疫學近十年國考題062926.xlsx` 已具備這些欄位，不需要再手動新增。

```text
核心概念
常見誤解
① 先看題幹
② 比較觀念
③ 推回答案
解析
```

欄位用途：

- `核心概念`：本題要學生掌握的主概念。
- `常見誤解`：學生容易選錯的原因。
- `① 先看題幹`：第一層提示，帶學生抓題幹關鍵字。
- `② 比較觀念`：第二層提示，讓學生比較相近概念。
- `③ 推回答案`：第三層提示，引導學生推到答案。
- `解析`：原本完整解析，保留不刪。

同步到 Firebase 後，前端會讀取：

```text
socraticConcept
socraticMisconception
socraticHint1
socraticHint2
socraticHint3
remedialChapter
remedialUrl
exp
```

其中 `exp` 是舊解析。沒有方案 A 欄位的舊題庫仍可正常運作，只會顯示完整解析。

題庫分頁名稱可使用：

```text
題庫
歷屆國考優化題庫分頁
```

若兩者都不存在，GAS 會自動尋找第一個同時具有 `問題/題目` 與 `選項A` 欄位的分頁。

## Google 登入限制與登入保存

後台可設定學生 Google email 的允許範圍。設定位置：

```text
教師後台 → 完成度設定 → 限定 Google 登入信箱範圍
```

同一頁也可設定學生登入頁顯示內容：

```text
首頁主標題
標題顏色
登入說明卡片 1
登入說明卡片 2
登入說明卡片 3
```

學生 `index.html` 登入頁不顯示班級排行；排行與分析保留在 `admin.html` 後台。

可設定：

```text
是否啟用 email 限制
允許網域，例如 ctcn.edu.tw
例外完整信箱，例如 teacher@gmail.com
```

學生登入或首次註冊時，email 必須符合允許網域或例外信箱。設定儲存後，必須再按「同步到 Firebase」，學生端才會讀到最新規則。

網頁重整後不需要重新 Google 登入。系統會保存：

```text
studentId
sessionToken
email
uid
```

重新整理時流程：

```text
Firebase Auth 自動恢復 Google user
→ 檢查 email 是否符合後台限制
→ 讀取本機 sessionToken
→ 到 loginStates/{studentId} 驗 token 是否仍有效
→ token 一致：直接進入主選單
→ token 不一致：顯示重複登入並不計分
```

本機資料只當恢復線索，真正放行一定以 Firebase `loginStates` 為準。

## 完整佈建流程

以下流程是從空環境或換新版本時的完整佈建順序。若只是小改版，仍建議照「檢查 → 部署 → 同步 → 驗收」順序走一次。

### 1. 檢查本機專案檔案

確認工作資料夾：

```bash
cd "/Users/HHC/Documents/New project/題庫系統-v1.9"
```

必要檔案：

```text
index.html
admin.html
firebase-config.js
firebase-v1685.js
firestore.rules
firestore.indexes.json
firebase.json
Code.gs
README.md
DEVELOPMENT_LOG.md
```

正式 GAS 請使用：

```text
Code.gs
```

舊版備份只供查詢：

```text
Code.full-legacy.gs
```

### 2. 確認 Firebase project

本資料夾目前使用的 Firebase project：

```text
nurse-4981a
```

確認 CLI 可看到專案：

```bash
"/Users/HHC/Documents/New project/.tools/node/bin/npx" -y firebase-tools@latest projects:list
```

正確結果應包含：

```text
Project ID: nurse-4981a
```

不要把本資料夾部署到其他 Firebase project。

### 3. Firebase Console 人工設定

人工操作位置：

```text
Firebase Console → 專案 nurse-4981a
```

啟用 Authentication：

```text
Authentication → 登入方式 → Google → 啟用
```

加入授權網域：

```text
Authentication → 設定 → 授權網域
```

至少加入：

```text
localhost
albertchang1008-alt.github.io
nurse-4981a.firebaseapp.com
nurse-4981a.web.app
```

若 GitHub Pages 實際網域不同，請加入實際網域。

建立 Web app 並取得前端設定：

```text
Firebase Console → 專案設定 → 一般 → 你的應用程式 → 新增 Web app
```

建立後複製 Firebase SDK config，格式會像：

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "nurse-4981a.firebaseapp.com",
  projectId: "nurse-4981a",
  storageBucket: "nurse-4981a.firebasestorage.app",
  messagingSenderId: "...",
  appId: "...",
  measurementId: "..."
};
```

把這些值貼到：

```text
firebase-config.js
```

注意：目前 `firebase-config.js` 已移除舊 `ap-neuron` 設定，若尚未貼入 `nurse-4981a` 的 Web SDK config，學生端會無法連線。

### 4. 部署 Firestore rules / indexes

```bash
cd "/Users/HHC/Documents/New project/題庫系統-v1.9"
"/Users/HHC/Documents/New project/.tools/node/bin/npx" -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes --project nurse-4981a
```

成功後 Firestore 才會允許新版 Google 登入與學生資料讀寫規則。

### 5. 更新 GAS

人工操作：

1. 開啟 Apps Script。
2. 用本資料夾的 `Code.gs` 覆蓋 Apps Script 中的 `Code.gs`。
3. 確認 Script Properties 已設定 Firebase service account。
4. 部署新版 Web App。
5. 將 Web App URL 填回 `admin.html` 的 `GAS_URL`。

Script Properties 必要值：

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

若使用目前提供的 service account JSON：

```text
nurse-4981a-firebase-adminsdk-fbsvc-d0c1977f3a.json
```

Apps Script 指令碼屬性請設定：

```text
FIREBASE_PROJECT_ID = nurse-4981a
FIREBASE_CLIENT_EMAIL = firebase-adminsdk-fbsvc@nurse-4981a.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY = JSON 內 private_key 的完整內容
```

`FIREBASE_PRIVATE_KEY` 必須包含：

```text
-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----
```

注意：

- 這個 JSON 含私鑰，不可以上傳 GitHub。
- 本資料夾已用 `.gitignore` 忽略 `*-firebase-adminsdk-*.json`。
- service account JSON 只給 GAS 後端同步 Firebase 使用。
- 學生端 `firebase-config.js` 仍需要 Firebase Web app SDK config，不能用 service account JSON 取代。

注意：

- GAS 只做 Sheet ↔ Firebase 同步。
- 學生端不透過 GAS 作答。
- 不要把 `Code.full-legacy.gs` 貼回正式 Apps Script。

### 6. 部署 GitHub Pages

若使用 GitHub Pages，更新並上傳：

```text
index.html
admin.html
firebase-config.js
firebase-v1685.js
README.md
DEVELOPMENT_LOG.md
```

若用 Git 指令，通常流程是：

```bash
cd "/Users/HHC/Documents/New project/題庫系統-v1.9"
git status
git add index.html admin.html firebase-config.js firebase-v1685.js README.md DEVELOPMENT_LOG.md Code.gs firestore.rules firestore.indexes.json
git commit -m "Release v1.915"
git push
```

如果這個資料夾不是 GitHub Pages repo 根目錄，請把上述檔案複製到實際 GitHub Pages 專案後再提交。

### 7. 後台同步資料到 Firebase

開啟：

```text
admin.html
```

依序操作：

1. 登入教師後台。
2. 設定首頁主標題、標題顏色、三段登入提醒。
3. 設定完成度達標分數與分類。
4. 若要限制 email，勾選「限定 Google 登入信箱範圍」。
5. 填入允許網域，例如 `ctcn.edu.tw`。
6. 按「儲存設定」。
7. 按「檢查 Google 登入名單」。
8. 按「同步到 Firebase」。

同步成功後 Firestore 應更新：

```text
questions
system/main
students
studentsByEmail
syncStatus/main
```

### 8. 學生端驗收

開啟：

```text
index.html
```

驗收：

1. 登入頁不顯示班級排行。
2. 標題與三段提醒符合後台設定。
3. Google 登入可正常跳轉。
4. 未註冊學生會看到註冊表單。
5. 不符合 email 限制者不可登入或註冊。
6. 作答完成後 Firestore 出現 `answerBatches`。
7. 作答完成後 Firestore 更新 `studentProgress`。
8. 重新整理後可恢復登入狀態。
9. 第二視窗登入同一帳號時，舊視窗送出會被擋下。

### 9. 成績回寫 Google Sheet

在 `admin.html` 按：

```text
同步成績回 Sheet
```

確認 Google Sheet：

```text
成績紀錄
```

應新增 Firebase 送出的作答紀錄，且包含：

```text
Batch ID
Google Email
Firebase UID
Auth Provider
Details JSON
```

### 10. 發布後檢查

發布後請檢查：

```text
Firebase Authentication → Users
Firestore → answerBatches
Firestore → studentProgress
Firestore → loginStates
Google Sheet → 成績紀錄
```

若有大量學生同時上線，優先看 Firebase，不要用 GAS 即時計算。

## Firebase 專案

本資料夾目前使用的 Firebase project：

```text
nurse-4981a
```

不要把本資料夾部署到其他 Firebase project。

確認 CLI 可看到專案：

```bash
cd "/Users/HHC/Documents/New project/題庫系統-v1.9"
"/Users/HHC/Documents/New project/.tools/node/bin/npx" -y firebase-tools@latest projects:list
```

## Firebase Console 必做設定

### 1. 啟用 Google Authentication

人工操作：

```text
Firebase Console → Authentication → 登入方式 → Google → 啟用
```

確認專案公開名稱與支援 email 已設定。

### 2. 加入授權網域

人工操作：

```text
Authentication → 設定 → 授權網域
```

至少加入：

```text
localhost
albertchang1008-alt.github.io
nurse-4981a.firebaseapp.com
nurse-4981a.web.app
```

若 GitHub Pages 實際網域不同，請加入實際網域。

## 學生首次登入與註冊

學生流程：

```text
使用 Google 登入
→ Firebase 取得 Google user.email / uid / emailVerified
→ 檢查 email 是否符合後台允許規則
→ 查 studentsByEmail/{emailKey}
→ 若找到學生資料，直接進入
→ 若找不到，顯示註冊表單
→ 學生填學號、姓名、班級、校區
→ Google 信箱已驗證才可建立學生資料
→ 建立 students/{studentId} 與 studentsByEmail/{emailKey}
→ 建立 loginStates/{studentId}
→ 進入主選單
```

註冊後建立：

```text
students/{studentId}
studentsByEmail/{emailKey}
```

email 規則：

- 全部轉小寫。
- 去除前後空白。
- 不限定 `@ctcn.edu.tw`。
- 同一個 Google email 只能註冊一次。
- 同一個學號只能註冊一次。

## Google Sheet 學生名單

v1.9 不要求先有學生名單。若老師想預先建帳，`學生名單` 可保留 email 欄位並由 GAS 同步到 Firebase。

建議欄位：

```text
校區
修課班級
座號
班級
學號
姓名
email
角色
啟用狀態
```

若使用學生名單同步：

- email 不可重複。
- 學號不可重複。
- `啟用狀態` 可填 `停用`、`false`、`disabled`、`0` 來停用學生。
- 後台可按「檢查 Google 登入名單」檢查錯誤。

## Firebase 資料流

老師在 Google Sheet 維護題庫與設定後，後台按「同步到 Firebase」。

GAS 會寫入：

```text
questions/{科目/年度/學期/章節/分類/題目ID 組成的安全 ID}
system/main
syncStatus/main
```

若有學生名單，也會寫入：

```text
students/{studentId}
studentsByEmail/{emailKey}
```

學生作答完成後一次批次寫入：

```text
answerBatches
wrongQuestions
studentProgress
```

Google Sheet 成績同步：

```text
Firebase answerBatches
→ Google Sheet 成績紀錄
→ 由 Sheet 公式或後續 Firebase 匯出流程更新學生成績總表
```

學生端 `index.html` 不呼叫 GAS。若學生端需要題庫、設定、完成度或錯題，一律讀寫 Firebase。

## 防雙視窗

Google 登入成功並取得學生資料後，系統寫入：

```text
loginStates/{studentId}
```

同一學生再次登入：

- 新 token 覆蓋舊 token。
- 新視窗保留。
- 舊視窗被踢出。
- 舊視窗送出成績前會被擋下，顯示「帳號重複登入，本次作答成績未計入」。

## 部署指令

部署 Firestore rules / indexes：

```bash
cd "/Users/HHC/Documents/New project/題庫系統-v1.9"
"/Users/HHC/Documents/New project/.tools/node/bin/npx" -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes --project nurse-4981a
```

若使用 Firebase Hosting：

```bash
cd "/Users/HHC/Documents/New project/題庫系統-v1.9"
"/Users/HHC/Documents/New project/.tools/node/bin/npx" -y firebase-tools@latest deploy --only hosting --project nurse-4981a
```

若使用 GitHub Pages，更新這些檔案：

```text
index.html
admin.html
firebase-config.js
firebase-v1685.js
```

## GAS 更新

人工操作：

1. 將本資料夾的 `Code.gs` 貼到 Apps Script。
2. 部署新版 Web App。
3. 確認 `admin.html` 的 `GAS_URL` 指向新版 Web App。

Script Properties 仍建議設定：

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

若使用 `nurse-4981a-firebase-adminsdk-fbsvc-d0c1977f3a.json`，請填：

```text
FIREBASE_PROJECT_ID = nurse-4981a
FIREBASE_CLIENT_EMAIL = firebase-adminsdk-fbsvc@nurse-4981a.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY = JSON 內 private_key 的完整內容
```

這三個值用於 GAS 將題庫、設定、學生名單同步到 Firebase，或把 Firebase `answerBatches` 回寫到 Google Sheet。

瘦身後 `Code.gs` 支援的主要 action：

```text
adminLogin
saveSettings
syncFirebaseV19
syncFirebaseV1685
validateStudentEmailsV19
syncFirestoreScoresToSheetsV19
getFirebaseBootstrap
getSyncStatusV19
getTeacherData
```

已移除的日常 GAS 工作：

```text
學生登入 / session 驗證
學生端讀題 / 判題 / 送成績 / 送明細
排行即時計算
錯題查詢
重複登入報告分析
題目完整分析快取
從歷史成績大量重建 studentProgress
```

大量歷史資料補回或十年資料遷移請使用一次性工具，不要放進日常 Web App GAS，避免學生使用期間拖慢或超時。

## 人工操作流程

1. Firebase Console 啟用 Google Authentication。
2. Firebase Console 加入 GitHub Pages 授權網域。
3. 部署 Firestore rules / indexes。
4. Apps Script 更新 `Code.gs` 並部署 Web App。
5. 後台按「同步到 Firebase」，把題庫、設定、學生名單推到 Firebase。
6. 若要限定學生信箱，在後台勾選「限定 Google 登入信箱範圍」，填入允許網域，例如 `ctcn.edu.tw`。
7. 儲存設定後，再按「同步到 Firebase」。
8. 若使用學生名單，先按「檢查 Google 登入名單」，確認沒有重複 email 或重複學號。
9. 用一個未註冊但符合網域的 Google 帳號測試首次註冊。
10. 用一個不符合網域的 Google 帳號測試是否被擋下。
11. 登入後重新整理頁面，確認不需重新 Google 登入即可回主選單。
12. 用同一帳號第二個視窗登入，確認舊視窗會被踢出。
13. 完成一次作答，確認 Firestore 有 `answerBatches` 與 `studentProgress`。
14. 後台按「同步成績回 Sheet」，確認 `成績紀錄` 有資料。

## 驗收清單

### Google 登入與註冊

- 已註冊 Google 帳號可直接登入。
- 未註冊 Google 帳號會看到註冊表單。
- Google email 未驗證時不可註冊。
- 註冊後 Firestore 出現 `students/{studentId}`。
- 註冊後 Firestore 出現 `studentsByEmail/{emailKey}`。
- 重複學號不可覆蓋既有學生。
- 重複 email 不可覆蓋既有學生。
- LINE 內建瀏覽器會提示改用 Safari / Chrome。
- 啟用 email 限制後，不符合網域的 Google 帳號不可登入或註冊。
- 重新整理頁面後，若 token 仍有效，會直接回主選單。

### 成績

- `answerBatches` 有 `uid`、`email`、`authProvider: google`。
- `studentProgress` 立即更新。
- Firebase 回寫 Sheet 後，`成績紀錄` 有 Google Email、Firebase UID、Auth Provider。
- 歷史成績仍以 studentId 重建，不因沒有 uid/email 而失效。

### 安全

- 未 Google 登入不能寫入成績。
- 未驗證 Google email 不能自助註冊。
- 學生不能 update 或 delete `students` / `studentsByEmail`。
- 前端不能用假 uid 寫入別人的成績。
- 舊視窗 token 失效後不能交卷。

## 常見問題

### Google 登入後要求註冊

代表 Firebase 找不到 `studentsByEmail/{emailKey}`。這是 v1.9 正常流程，學生完成註冊後即可進入。

### 註冊失敗：權限不足

檢查：

- Firestore rules 是否已部署新版。
- Google Authentication 是否啟用。
- Google email 是否已驗證。
- 學號或 email 是否已被註冊。

### Google 登入跳不回來

檢查 Firebase Authorized domains 是否包含 GitHub Pages 網域。

### 學生看不到舊完成度

瘦身後後台不再提供日常「補回原本成績」按鈕。請先確認 Firebase `answerBatches` 是否已有新成績；若是舊歷史成績尚未遷移，請用一次性遷移工具從 Google Sheet `成績紀錄` 重建 Firebase `studentProgress`。歷史資料仍以 studentId 為主。

### Firebase 同步被擋

若使用學生名單同步，通常是：

- 重複 email
- 重複學號
- email 格式錯誤

先按「檢查 Google 登入名單」看結果，再回 Sheet 修正。
