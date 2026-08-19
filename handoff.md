# 專案交接紀錄

## 1. 目前狀態

- 專案：題庫系統 v1.9
- 目前版本：v1.937（管理端；GAS 維持 v1.936）
- 架構方向：Firebase-first，學生端不直接呼叫 GAS。
- Google Sheet：老師維護題庫、系統設定、學生名單與成績回寫報表。
- GAS：只作為 Google Sheet 與 Firebase 的同步工具。
- Firebase：學生登入、題庫讀取、作答紀錄、完成度、錯題與 session token。
- 本檔用途：供下一輪 Codex、人工作業或自動化腳本接續目前開發狀態。
- 最後更新：2026-08-19

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
- [x] v1.924 成績回寫改用 Asia/Taipei Date，並自動修正既有 UTC ISO 時間字串。
- [x] v1.925 新增 `scoreSummaries/{batchId}`，並與完整成績、完成度、錯題 V2 以 transaction 原子寫入。
- [x] v1.925 新增 `topicId`、`completionTopicIds` 與 `studentProgress.topicProgress`，完成度設定不再刪除其他單元最高分。
- [x] v1.925 修正後台完成度分類顯示 `undefined` 與班級來源空白問題。
- [x] v1.925 修正 GAS slim 回傳空學生名單；後台會合併 Sheet 全名單與 Firebase 作答分析，未作答學生也可見。
- [x] v1.925 將 Firebase 發布拆為題庫、設定、學生名單三個獨立同步，另保留需確認的完整同步。
- [x] v1.925 學生名單新增科目ID；學生完成度依其科目與全域完成度設定的交集計算。
- [x] v1.925 歷次成績以 uid 查詢並新增 uid/answeredAt 索引，畫面會回報 rules 或 index 未部署等實際原因。
- [x] v1.925 新增學生歷次成績、逐題時間明細、教師最近 100 筆即時成績。
- [x] v1.925 停止頂層舊錯題雙寫，離線補送使用固定 batchId 防重。
- [x] v1.926 測驗依實際題數採每題 60 秒倒數，時間到自動交卷並截止修改。
- [x] v1.926 長單元名稱在手機端最多顯示兩行，平均每題秒數移至章節資訊列。
- [x] v1.926 學生端、後台、GAS 及前端 cachebuster 已同步版本號。
- [x] v1.927 歷次成績清單與明細的長單元名稱改為最多兩行，右側分數保持完整顯示。
- [x] v1.927 學生端、後台、GAS 及前端 cachebuster 已同步版本號。
- [x] v1.928 學生歷次成績改為表格，長單元名稱可完整換行並可點列查看明細。
- [x] v1.928 後台新增歷次成績顯示單元設定；空白設定代表顯示全部。
- [x] v1.928 學生端、後台、GAS 及前端 cachebuster 已同步版本號。
- [x] v1.929 歷次成績改為科目、單元、成績三行精簡表格，日期保留於成績行右側。
- [x] v1.929 答對題數與用時移至明細，舊成績可由 topic metadata 補找科目。
- [x] v1.929 學生端、後台、Firebase fallback、GAS 及前端 cachebuster 已同步版本號。
- [x] v1.930 正式完成度統一採完整測驗／完整閃卡最高有效分數達標判定。
- [x] v1.930 單元題數比例正名為題目練習率，新增正式完成狀態。
- [x] v1.930 歷次成績清單與明細使用 `studentProgress` 顯示相同完成狀態。
- [x] v1.930 修正舊學生缺少科目ID時完成度摘要被隱藏的相容問題。
- [x] v1.930 學生端、後台、Firebase fallback、GAS 及前端 cachebuster 已同步版本號。
- [x] v1.931 後台新增手動更新的學生完成度看板，可依科目與單元篩選。
- [x] v1.931 合併 Sheet 全學生名單與 Firebase `studentProgress`，可顯示尚未練習學生。
- [x] v1.931 完成判定改以目前後台門檻對最高有效分數重算，入口、歷次成績與看板一致。
- [x] v1.931 完成度看板不使用即時 listener，只有按更新按鈕才讀取 Firebase。
- [x] v1.931 學生端、後台、Firebase fallback、GAS 及前端 cachebuster已同步版本號。
- [x] v1.932 後台完成度設定明確改為目前必須完成單元，可隨課程進度調整。
- [x] v1.932 學生入口新增目前尚待完成清單與測驗／閃卡快捷入口。
- [x] v1.932 學生每次登入強制重新讀取最新 `system/main` 完成度設定。
- [x] v1.932 學生端、後台、Firebase fallback、GAS 及前端 cachebuster 已同步版本號。
- [x] v1.933 學生端改為科目選擇、科目首頁、待完成單元三層導覽。
- [x] v1.933 單一科目也必須先選科目，科目首頁顯示待完成入口與全部章節。
- [x] v1.933 待完成清單依目前科目篩選，全部完成時仍保留入口與完成提示。
- [x] v1.933 學生端、後台、Firebase fallback、GAS 及前端 cachebuster 已同步版本號。
- [x] v1.934 新增 Ch08 穩定單元碼相容層，不修改學生歷史資料。
- [x] v1.934 練習率改用章節實際題目 ID 與 attemptedQuestions 交集；未知狀態不再顯示 0%。
- [x] v1.934 完成度、最高分、待完成看板與歷次成績改以名稱相容鍵優先，Ch08 禁用重複 topicId fallback。
- [x] v1.935 GAS 管理登入新增 6 小時滑動 session、登出撤銷與登入失敗節流。
- [x] v1.935 除 adminLogin 外的管理 GAS actions 統一驗證 adminSessionToken。
- [x] v1.935 完成度看板改走 GAS 安全代理、field mask 與 120 秒共用快取。
- [x] v1.935 新增獨立懶載入的最近 100 筆做答摘要代理，不預載 detailsJson。
- [x] v1.935 管理端套用 Ch08 相容碼、尚缺單元欄與篩選後摘要重算。
- [x] v1.936 完成度單元改為核取式複選，支援全選、清除與任意組合。
- [x] v1.936 完成度分母、摘要卡與尚缺單元依複選集合重算，且不增加 Firestore reads。
- [x] v1.937 完成度看板新增學生／單元雙視角與完成率排行。
- [x] v1.937 單元三種狀態人數可開啟學生名單，並新增全看板姓名遮蔽切換。
- [x] v1.937 最近 100 筆紀錄跟隨單元與學生搜尋條件，所有新操作不增加 Firestore reads。

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
- [ ] v1.924 需部署 GAS 後按一次「同步成績回 Sheet」，確認既有 `03:15:57Z` 顯示為台北 `11:15:57`，且第二次同步不重複新增。
- [x] v1.925 Firestore rules/indexes 已於 2026-08-17 部署至正式 `nurse-4981a`；CLI 帳號為 `hhchang@ctcn.edu.tw`。
- [ ] v1.925 尚需同步題庫與設定並部署新版前端至 GitHub Pages。
- [ ] v1.925 需以 dry-run 檢查 `migrate_score_summaries.js` 筆數，維護時段才可加 `--apply --rebuild-progress`。
- [ ] v1.925 教師帳號需設定 `admin=true` Custom Claim 並重新登入，才可監聽全班成績。
- [ ] v1.925 需在 Firebase 測試環境驗證 transaction、離線重送與兩裝置同時交卷。
- [ ] v1.926 需部署新版前端與 GAS，並在 iPhone Safari／Chrome 實機驗證兩行標題、40 題 40:00 倒數及逾時自動交卷。
- [ ] v1.927 需在 iPhone Safari／Chrome 實機驗證歷次成績清單與明細的兩行標題。
- [ ] v1.928 需部署 GAS 與前端，於後台儲存後按「同步設定」，再以學生帳號驗證表格與單元篩選。
- [x] v1.928 原橫向表格已由 v1.929 三行精簡表格取代，不再需要橫向滑動驗收。
- [ ] v1.929 需在 iPhone Safari／Chrome 實機確認三行精簡表格、長單元換行及明細資訊。
- [ ] v1.930 需驗證完整測驗與完整閃卡達標會顯示已完成，未達標顯示未完成。
- [ ] v1.930 需驗證抽題練習只增加題目練習率，不改變正式完成狀態。
- [ ] v1.931 需以具 `admin=true` claim 的教師帳號驗證手動更新、科目／單元切換與未作答學生顯示。
- [ ] v1.931 需核對更新一次的 Firestore read 數約等於目前 `studentProgress` 文件數，切換篩選不應增加讀取。
- [ ] v1.932 需驗證後台調整目前必須完成單元並同步後，學生重新登入會套用新分母與待完成清單。
- [ ] v1.932 需在手機確認待完成單元長名稱、最高分資訊及測驗／閃卡按鈕版面。
- [ ] v1.933 需以單科目與多科目學生驗證登入後均先停在科目選擇層。
- [ ] v1.933 需驗證科目首頁待完成數量不混入其他科目，全部章節仍顯示完整清單。
- [ ] v1.933 需驗證全部完成時入口與完成提示，以及從待完成清單進入測驗／閃卡後的返回層級。
- [ ] v1.933 需在手機確認三層返回按鈕、長單元名稱與快捷按鈕版面。
- [ ] v1.935 部署後需驗證正確／偽造／過期／登出 session，以及所有教師重新登入流程。
- [ ] v1.935 需核對完成度首次讀取、120 秒 cache hit、強制更新的 reads 與傳輸 KB 標示。
- [ ] v1.935 需確認最近 100 筆只有展開時讀取，且不下載 detailsJson、不進行自動輪詢。
- [ ] v1.935 需驗證 Sheet 名單中的未作答學生、Ch08 重複 topicId、尚缺單元與搜尋後摘要一致性。
- [ ] v1.936 需在桌機與手機驗證單元複選器展開、外部點擊關閉、全選、清除及科目切換重設。
- [ ] v1.936 需驗證單選與複選的完成度分母、最高有效分數及尚缺單元內容。
- [ ] v1.937 需在桌機與手機驗證雙視角、排行方向、三色學生名單彈窗及水平捲動。
- [ ] v1.937 需驗證姓名預設遮蔽、完整姓名切換與重新進入看板後恢復遮蔽。

## 4. 最近修改檔案

- `index.html`
- `firebase-v1685.js`
- `Code.gs`
- `ADMIN_GAS_PROXY_V1935.md`
- `tests/v1935_proxy_static_test.js`
- `admin.html`
- `CreateQuestionBankSheet.gs`
- `README.md`
- `DEVELOPMENT_LOG.md`
- `handoff.md`
- `firebase-config.js`
- `firestore.rules`
- `firestore.indexes.json`
- `migrate_score_summaries.js`
- `set_admin_claim.js`

## 5. 下一步建議

1. 先發布 `firestore.rules` 與 `firestore.indexes.json`，等待摘要索引完成。
2. 更新 `Code.gs`，從後台同步 Firebase，確認 topics 有 `topicId` 且設定有 `completionTopicIds`。
3. 部署 `firebase-config.js`、`firebase-v1685.js`、`index.html`、`admin.html`。
4. 預覽並核對歷史摘要回補筆數，再於維護時段執行正式回補及最高分重建。
5. 使用 `set_admin_claim.js` 為指定教師帳號設定 Firebase 管理員 claim。
6. 驗收學生歷次成績、最高分、完成度、逐題秒數及後台最近 100 筆監聽。
7. 確認 Google Sheet 仍使用既有 `answerBatches` cursor 增量同步且不重複。
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
目前 v1.937 已在本機完成 GAS 安全代理、最近 100 筆做答摘要、完成度單元複選、學生／單元雙視角排行及姓名遮蔽；未搬移、刪除或改寫任何 Firestore 歷史資料，資料結構仍沿用 v1.925，GAS 部署版本維持 v1.936。
部署時先發布新版 GAS，再立即發布管理端；所有教師須重新登入取得 adminSessionToken。完成度不再需要 Firebase Google 登入，但即時成績與分析仍沿用 Firebase 權限。
若需要修改，請依 v1.9 Firebase-first 架構進行，並同步更新版本號與三份文件。
```
