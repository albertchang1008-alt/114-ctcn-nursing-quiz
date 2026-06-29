# 專案交接紀錄

## 1. 目前狀態

- 專案：題庫系統 v1.9
- 目前版本：v1.915
- 架構方向：Firebase-first，學生端不直接呼叫 GAS。
- Google Sheet：老師維護題庫、系統設定、學生名單與成績回寫報表。
- GAS：只作為 Google Sheet 與 Firebase 的同步工具。
- Firebase：學生登入、題庫讀取、作答紀錄、完成度、錯題與 session token。
- 本檔用途：供下一輪 Codex、人工作業或自動化腳本接續目前開發狀態。
- 最後更新：2026-06-29

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

## 3. 已知待處理問題

- [ ] v1.912 需實機確認：測驗作答中只顯示「已選」，不提前顯示正解。
- [ ] v1.912 需實機確認：交卷後解析區仍正確顯示正解與解析。
- [ ] v1.912 需實機確認：綜合練習分類清單能從完整題庫顯示各章節認知類型。
- [ ] v1.912 需實機確認：沒有認知類型資料的分類顯示「尚未標註認知類型」。
- [ ] v1.915 需實機確認：右上角風格切換可在夜讀深色與淺色模式間切換並保留偏好。
- [ ] v1.915 需實機確認：章節有講義連結時顯示「講義」按鈕，無連結時不顯示。
- [ ] 手機端 Google 登入需持續實機驗證，尤其是 Safari、Chrome 與 GitHub Pages 網域。

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

1. 實機確認右上角風格切換在手機與桌面都可用。
2. 實機確認講義按鈕可開啟 Google Drive、PDF 或外部講義連結。
3. 實機確認測驗作答中不再出現紅色錯誤與綠色正解。
4. 實機確認交卷後完整解析仍顯示正確答案與學生選擇。
5. 實機確認綜合練習分類清單的認知類型是否完整。
6. 若仍有分類顯示「尚未標註認知類型」，需回頭檢查 Google Sheet 題庫欄位與 Firebase `questions` 文件。
7. 若修改程式，需同步更新版本號、README.md、DEVELOPMENT_LOG.md 與本檔。

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
目前 v1.915 已加入第三種夜讀深色風格、右上角風格切換，以及章節講義連結。
下一步請優先做手機端實機驗收，不要直接大幅重構。
若需要修改，請依 v1.9 Firebase-first 架構進行，並同步更新版本號與三份文件。
```
