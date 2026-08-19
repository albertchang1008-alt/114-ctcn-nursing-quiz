# v1.935 管理端 GAS 安全代理設計紀錄

- 日期：2026-08-19
- 範圍：完成度看板、最近 100 筆做答摘要、管理端 GAS session
- 不在範圍：即時成績與分析頁 Firebase 資料流
- 資料異動：無；所有新增代理均為只讀

## 資料流

```text
管理員帳密 → GAS 驗證管理人名單 → 核發 adminSessionToken
                                         ↓
Sheet 學生名單／完成度設定 → GAS getTeacherData → admin.html
                                         ↓
Firestore studentProgress → GAS 欄位遮罩／精簡 → 完成度看板
Firestore answerBatches 最後 100 筆 → GAS 摘要 → 展開式最近做答
```

Sheet 名單決定應出現的學生、班級與選修科目；Firestore 是最高有效分數及做答事件的權威來源；前端以學號合併，因此未作答學生仍會列為尚未練習。

## 安全設計

- `adminLogin` 是唯一不需要 session 的 POST action。
- Token 為兩組 UUID 加時間資訊產生的隨機值；GAS Cache key 只保存 token 的 SHA-256 digest。
- Token 只存在 sessionStorage 及 POST body，滑動期限 6 小時。
- 無 token、偽造 token、Cache 已淘汰或登出後 token 一律回傳 `auth_required`。
- 登入失敗每帳號 10 分鐘最多 5 次；管理人名單既有帳密格式維持相容。

## 流量模型

| 操作 | Cache miss reads | Cache hit reads | 備註 |
|---|---:|---:|---|
| 完成度 | 約等於 studentProgress 文件數 | 0 | 目前約 34 份 |
| 最近做答 | 最多 100 | 0 | 未展開不讀取 |
| 科目／單元／學生篩選 | 0 | 0 | 瀏覽器記憶體處理 |

- 兩個資料集各自使用 120 秒 Script Cache，互不連動。
- 完成度回傳只含學號、更新時間及單元分數摘要。
- 最近做答只含名單顯示欄位及成績摘要，不含 `detailsJson`。
- field mask 降低網路 bytes，但 Firestore 計費 reads 仍按回傳文件數計算。
- 快取 JSON 超過約 90 KB 時仍回傳但不寫 Cache，畫面會顯示未快取。
- 禁止輪詢；只有進入完成度、展開最近做答或按強制更新才產生請求。

## 部署及驗收

1. 在短維護窗口先部署 v1.935 GAS，再立即部署 admin.html 及版本資源。
2. 教師重新登入，確認後台取得新的安全 session。
3. 完成度第一次載入應顯示 Firestore reads；兩分鐘內重新進入應顯示 GAS 快取及 0 reads。
4. 強制更新應繞過快取；切換篩選不得增加 reads。
5. 展開最近做答才查詢 100 筆；收合、篩選完成度不應觸發此查詢。
6. 驗證 Ch08 重複 topicId 不會交叉配對，第二型過敏舊名稱顯示為新名稱。
7. 驗證登出、過期及偽造 token 均無法呼叫管理 actions。
