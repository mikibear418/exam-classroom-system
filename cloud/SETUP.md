# 段考監考教室系統 V1.16：雲端啟用說明

目前已加入可選用 Supabase 的教師登入及班級資料同步程式，但尚未連接實際 Supabase 專案，預設仍是本機版。

## 必要設定
1. 到 https://supabase.com/dashboard 建立學校專用專案。
2. 在 SQL Editor 執行 cloud/schema.sql，建立 classroom_members 與 classroom_state 及 RLS。
3. 在 Authentication > Users 建立教師帳號；建議關閉不受控的公開註冊。
4. 用 SQL Editor 查詢教師 UUID：select id,email from auth.users;
5. 在 SQL Editor 授權班級，例如：
insert into public.classroom_members(room,user_id,role) values ('知足班','實際 UUID'::uuid,'editor') on conflict(room,user_id) do update set role=excluded.role;
6. 在 Project Settings > API 複製 Project URL 與 publishable/anon 公開金鑰，填入 cloud/config.js 的 url 與 publishableKey。
7. 不得在公開 GitHub 存放 service_role、secret API key、資料庫密碼、教師密碼及真實學生名冊。
8. 網站更新後教師登入；第一次該班雲端尚無資料時，授權老師按「初始化本班」。後續同班授權老師登入，即能讀取雲端資料。

## 授權與同步
- classroom_members 中 role 為 admin、editor、viewer。viewer 只有檢視權限；班級成員新增由學校管理者於 SQL Editor 執行。
- 不同班級的資料依 room 欄位分開，RLS 限制讀寫。多位老師可編輯相同班級。
- 自動儲存採約 850ms 延遲上傳。出現版本衝突時不會靜默覆蓋，需先保留本機工作、再載入雲端版本。
- 班級版本的 JSON 可先備份；請用校內受控方式保存。

## 上線前必做
- 用兩位不同教師、兩台設備實測登入、權限、同班同步和衝突處理。
- 確認未獲授權帳號無法查詢或修改任何班級。
- 確認學校學生個資管理、帳號停用、資料刪除及備份程序。

未實際建立 Supabase 專案、完成 SQL 設定與測試之前，不能視為雲端版已正式上線。