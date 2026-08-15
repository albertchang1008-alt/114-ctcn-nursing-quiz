# 專案交接紀錄

## 1. 目前狀態

- 專案：題庫系統 v1.9
- 目前版本：v1.923
- 架構方向：Firebase-first，學生端不直接呼叫 GAS。
- Google Sheet：老師維護題庫、系統設定、學生名單與成績回寫報表。
- GAS：只作為 Google Sheet 與 Firebase 的同步工具。
- Firebase：學生登入、題庫讀取、作答紀錄、完成度、錯題與 session token。
- 本檔用途：供下一輪 Codex、人工作業或自動化腳本接續目前開發狀態。
- 最後更新：2026-08-16

## 2. 已完成事項

- [x] 建立 v1.9 Firebase-first 架構。
- [x] 學生端改用 Firebase Authentication Google 登入。
- [x] LINE 內建瀏覽器登入防呆已規劃並加入前端流程。
- [x] 取消學生端首頁排行與今日練習人數讀取，降低 Firebase 讀取成本。
- [x] 學生端主選單改為先選科目，再顯示章節。
- [x] 章節排序加入章節編號。
- [x] 測驗進入前先選題數。
- [x] 測驗加入上一題 / 下一題。
- [x] 答題中不寫入 Firebase，交卷時一次送出。
- [x] 題庫支援舊解析與蘇格拉底式解析並行。
- [x] 已建立 README.md 與 DEVELOPMENT_LOG.md 維護規則。
- [x] 已記錄測驗作答畫面狀態異常。
- [x] 已記錄綜合練習認知類型顯示不完整。
- [x] 自本次起新增 handoff.md 作為交接檔。
- [x] v1.912 修正測驗作答中提前顯示紅綠正解的問題。
- [x] v1.912 修正綜合練習認知類型只依目前載入題目彙整的問題。
- [x] v1.913 將學生端切換為第三種「夜讀深色」前端風格。
- [x] v1.915 新增右上角「淺色 / 夜讀」風格切換按鈕。
- [x] v1.915 新增章節講義欄位與學生端「講義」按鈕。
- [x] v1.916 修正測驗中選過答案後不能修改的問題，交卷前可重新選答案。
- [x] v1.917 新增 `questionBundles/current` 題庫 bundle，降低學生端每次載入讀取整個 `questions` collection 的成本。
- [x] v1.917 學生端載入改為 bundle 優先，bundle 不存在或 rules 未放行時才 fallback 到 `questions` collection。
- [x] v1.918 修正 iPhone Safari／Chrome 因 popup 前等待與跨站 redirect 而無法保留 Google 登入狀態的問題。
- [x] v1.918 登入改為 popup-only，並加入登入程式 cachebuster 與可操作的錯誤提示。
- [x] v1.919 未登入只讀公開設定，登入後才載入系統與題庫。
- [x] v1.920 完成內容雜湊、同步鎖、題庫／名單差異同步與章節 bundle。
- [x] v1.921 完成錯題 V2 雙寫、歷史事件、兩種時間回看與搬移工具。
- [x] v1.922 完成 Firebase 成績 cursor 增量回寫。
- [x] v1.923 修正章節懶載入造成測驗題數彈窗全部為 0，加入章節快取、metadata fallback 與競態保護。

## 3. 已知待處理問題

- [ ] v1.912 需實機確認：測驗作答中只顯示「已選」，不提前顯示正解。
- [ ] v1.912 需實機確認：交卷後解析區仍正確顯示正解與解析。
- [ ] v1.912 需實機確認：綜合練習分類清單能從完整題庫顯示各章節認知類型。
- [ ] v1.912 需實機確認：沒有認知類型資料的分類顯示「尚未標註認知類型」。
- [ ] v1.915 需實機確認：右上角風格切換可在夜讀深色與淺色模式間切換並保留偏好。
- [ ] v1.915 需實機確認：章節有講義連結時顯示「講義」按鈕，無連結時不顯示。
- [ ] v1.916 需實機確認：測驗中同一題可在交卷前反覆改選，最後送出以最後選擇為準。
- [ ] v1.917 需部署確認：更新 Firestore rules，允許讀取 `questionBundles/current` 與 `chunks`。
- [ ] v1.917 需同步確認：更新 `Code.gs` 後按後台「同步到 Firebase」，確認 Firestore 出現 `questionBundles/current/chunks/001...N`。
- [ ] v1.917 需用量確認：學生端載入後不應再每次讀取 1000+ 筆 `questions` 文件。
- [ ] v1.918 需在 iPhone Safari、Chrome 實機驗證 popup-only Google 登入。
- [ ] v1.922 需發布 rules、GAS 與前端，並完成首次 Firebase 同步。
- [ ] v1.922 需按一次「搬移錯題 V2」並比對新舊錯題數。
- [ ] v1.922 需驗證未登入僅 1 筆公開設定讀取、單章只讀該章 chunks。
- [ ] v1.922 需驗證相同題庫再次同步會回報「題庫未變更，已跳過」。
- [ ] v1.922 需驗證成績同步重跑不重複、cursor 邊界不漏資料。
- [ ] v1.923 需在 iPhone 實機確認 36 題章節顯示全部 36、未作答 36，10／20／30／全部可選，50 題停用。

## 4. 最近修改檔案

- `index.html`
- `firebase-v1685.js`
- `Code.gs`
- `admin.html`
- `CreateQuestionBankSheet.gs`
- `README.md`
- `DEVELOPMENT_LOG.md`
- `handoff.md`

## 5. 下一步建議

1. 將新版 `Code.gs` 貼到 Apps Script，儲存後重新部署或直接在後台使用目前 Web App。
2. 將新版 `firestore.rules` 貼到 Firebase Console 的 Firestore 規則並發布。
3. 開啟 `admin.html`，按「同步到 Firebase」，建立 `questionBundles/current`。
4. 到 Firebase Console 確認 `questionBundles/current` 與 `questionBundles/current/chunks/001...N` 存在。
5. 部署新版 `index.html`、`firebase-v1685.js` 到 GitHub Pages；`?v=1923` 會強制載入新版程式。
6. 實機確認學生端正常登入、選科目、選章節、作答與交卷。
7. 觀察 Firebase reads 是否不再因每次首頁載入而大量讀取 `questions`。
8. 若修改程式，需同步更新版本號、README.md、DEVELOPMENT_LOG.md 與本檔。

## 6. 接手規則

下一輪 Codex 或人工接手時，請先閱讀：

```text
README.md
DEVELOPMENT_LOG.md
handoff.md
```

接手後請遵守：

- 不要重做已完成事項。
- 不要直接回復舊版登入或 GAS-first 架構。
- 學生端 `index.html` 不應直接呼叫 GAS。
- 每次程式修正都要同步更新版本號。
- 每次修正都要同步更新 README.md、DEVELOPMENT_LOG.md、handoff.md。
- 不要把 Firebase private key、API token、密碼寫入本檔。

## 7. 交接給下一輪 Codex 的提示

```text
請先閱讀 README.md、DEVELOPMENT_LOG.md、handoff.md。
目前 v1.923 已完成登入優先、章節 bundle 差異同步、錯題 V2、成績 cursor 增量回寫及章節題數彈窗修正；舊資料仍保留供回退。
下一步請依 README 的首次部署順序發布 rules、GAS 與 v1.923 前端，執行一次題庫同步和錯題搬移，再觀察 Firebase reads/writes。
若需要修改，請依 v1.9 Firebase-first 架構進行，並同步更新版本號與三份文件。
```
